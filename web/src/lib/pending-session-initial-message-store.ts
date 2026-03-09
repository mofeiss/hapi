import type { AttachmentMetadata, UserMessageMeta } from '@/types/api'

export type PendingSessionInitialMessage = {
    text: string
    attachments?: AttachmentMetadata[]
    meta?: UserMessageMeta
}

const pendingMessages = new Map<string, PendingSessionInitialMessage>()

export function setPendingSessionInitialMessage(
    sessionId: string,
    payload: PendingSessionInitialMessage
): void {
    const normalizedSessionId = sessionId.trim()
    const normalizedText = payload.text.trim()
    const normalizedAttachments = payload.attachments?.filter((attachment) => Boolean(
        attachment.id
        && attachment.filename
        && attachment.path
    ))

    if (!normalizedSessionId || (!normalizedText && (!normalizedAttachments || normalizedAttachments.length === 0))) {
        return
    }

    pendingMessages.set(normalizedSessionId, {
        text: normalizedText,
        attachments: normalizedAttachments && normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
        meta: payload.meta
    })
}

export function consumePendingSessionInitialMessage(sessionId: string): PendingSessionInitialMessage | null {
    const pending = peekPendingSessionInitialMessage(sessionId)
    if (pending) {
        clearPendingSessionInitialMessage(sessionId)
    }
    return pending
}

export function peekPendingSessionInitialMessage(sessionId: string): PendingSessionInitialMessage | null {
    const normalizedSessionId = sessionId.trim()
    if (!normalizedSessionId) {
        return null
    }

    return pendingMessages.get(normalizedSessionId) ?? null
}

export function clearPendingSessionInitialMessage(sessionId: string): void {
    const normalizedSessionId = sessionId.trim()
    if (!normalizedSessionId) {
        return
    }

    pendingMessages.delete(normalizedSessionId)
}
