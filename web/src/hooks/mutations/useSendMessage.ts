import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ApiError, type ApiClient } from '@/api/client'
import type { AttachmentMetadata, DecryptedMessage, UserMessageMeta } from '@/types/api'
import { makeClientSideId } from '@/lib/messages'
import {
    appendOptimisticMessage,
    getMessageWindowState,
    updateMessageStatus,
} from '@/lib/message-window-store'
import { usePlatform } from '@/hooks/usePlatform'

type SendMessageInput = {
    sessionId: string
    text: string
    localId: string
    createdAt: number
    attachments?: AttachmentMetadata[]
    meta?: UserMessageMeta
}

type BlockedReason = 'no-api' | 'no-session' | 'pending'

type UseSendMessageOptions = {
    resolveSessionId?: (sessionId: string) => Promise<string>
    onSessionResolved?: (sessionId: string) => void
    onBlocked?: (reason: BlockedReason) => void
}

function findMessageByLocalId(
    sessionId: string,
    localId: string,
): DecryptedMessage | null {
    const state = getMessageWindowState(sessionId)
    for (const message of state.messages) {
        if (message.localId === localId) return message
    }
    for (const message of state.pending) {
        if (message.localId === localId) return message
    }
    return null
}

function extractMessageMeta(message: DecryptedMessage | null): UserMessageMeta | undefined {
    if (!message || !message.content || typeof message.content !== 'object') {
        return undefined
    }

    const rawMeta = (message.content as { meta?: unknown }).meta
    if (!rawMeta || typeof rawMeta !== 'object') {
        return undefined
    }

    return rawMeta as UserMessageMeta
}

export function useSendMessage(
    api: ApiClient | null,
    sessionId: string | null,
    options?: UseSendMessageOptions
): {
    sendMessage: (
        text: string,
        attachments?: AttachmentMetadata[],
        options?: { localId?: string; createdAt?: number; meta?: UserMessageMeta }
    ) => void
    retryMessage: (localId: string) => void
    isSending: boolean
} {
    const { haptic } = usePlatform()
    const [isResolving, setIsResolving] = useState(false)
    const resolveGuardRef = useRef(false)

    const sendMessageWithActivationRetry = async (input: SendMessageInput): Promise<void> => {
        if (!api) {
            throw new Error('API unavailable')
        }

        try {
            await api.sendMessage(input.sessionId, input.text, input.localId, input.attachments, input.meta)
        } catch (error) {
            const shouldWaitForActive = error instanceof ApiError
                && error.status === 409
                && error.message.toLowerCase().includes('inactive')

            if (!shouldWaitForActive) {
                throw error
            }

            await api.waitForSessionActive(input.sessionId)
            await api.sendMessage(input.sessionId, input.text, input.localId, input.attachments, input.meta)
        }
    }

    const mutation = useMutation({
        mutationFn: async (input: SendMessageInput) => {
            await sendMessageWithActivationRetry(input)
        },
        onMutate: async (input) => {
            const optimisticMessage: DecryptedMessage = {
                id: input.localId,
                seq: null,
                localId: input.localId,
                content: {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: input.text,
                        attachments: input.attachments
                    },
                    meta: input.meta
                },
                createdAt: input.createdAt,
                status: 'sending',
                originalText: input.text,
            }

            appendOptimisticMessage(input.sessionId, optimisticMessage)
        },
        onSuccess: (_, input) => {
            updateMessageStatus(input.sessionId, input.localId, 'sent')
            haptic.notification('success')
        },
        onError: (_, input) => {
            updateMessageStatus(input.sessionId, input.localId, 'failed')
            haptic.notification('error')
        },
    })

    const sendMessage = (
        text: string,
        attachments?: AttachmentMetadata[],
        sendOptions?: { localId?: string; createdAt?: number; meta?: UserMessageMeta }
    ) => {
        if (!api) {
            options?.onBlocked?.('no-api')
            haptic.notification('error')
            return
        }
        if (!sessionId) {
            options?.onBlocked?.('no-session')
            haptic.notification('error')
            return
        }
        if (mutation.isPending || resolveGuardRef.current) {
            options?.onBlocked?.('pending')
            return
        }
        const localId = sendOptions?.localId ?? makeClientSideId('local')
        const createdAt = sendOptions?.createdAt ?? Date.now()
        void (async () => {
            let targetSessionId = sessionId
            if (options?.resolveSessionId) {
                resolveGuardRef.current = true
                setIsResolving(true)
                try {
                    const resolved = await options.resolveSessionId(sessionId)
                    if (resolved && resolved !== sessionId) {
                        options.onSessionResolved?.(resolved)
                        targetSessionId = resolved
                    }
                } catch (error) {
                    haptic.notification('error')
                    console.error('Failed to resolve session before send:', error)
                    return
                } finally {
                    resolveGuardRef.current = false
                    setIsResolving(false)
                }
            }
            try {
                await mutation.mutateAsync({
                    sessionId: targetSessionId,
                    text,
                    localId,
                    createdAt,
                    attachments,
                    meta: sendOptions?.meta
                })
            } catch {
                // mutation handlers already update optimistic state and haptics
            }
        })()
    }

    const retryMessage = (localId: string) => {
        if (!api) {
            options?.onBlocked?.('no-api')
            haptic.notification('error')
            return
        }
        if (!sessionId) {
            options?.onBlocked?.('no-session')
            haptic.notification('error')
            return
        }
        if (mutation.isPending || resolveGuardRef.current) {
            options?.onBlocked?.('pending')
            return
        }

        const message = findMessageByLocalId(sessionId, localId)
        if (!message?.originalText) return

        updateMessageStatus(sessionId, localId, 'sending')

        void mutation.mutateAsync({
            sessionId,
            text: message.originalText,
            localId,
            createdAt: message.createdAt,
            meta: extractMessageMeta(message)
        }).catch(() => {
            // mutation handlers already update optimistic state and haptics
        })
    }

    return {
        sendMessage,
        retryMessage,
        isSending: mutation.isPending || isResolving,
    }
}
