import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ThreadPrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type { AttachmentMetadata, SessionMetadataSummary } from '@/types/api'
import { HappyChatProvider } from '@/components/AssistantChat/context'
import { HappyAssistantMessage } from '@/components/AssistantChat/messages/AssistantMessage'
import { HappyAgentTurnGroup } from '@/components/AssistantChat/messages/AgentTurnGroup'
import { HappyUserMessage } from '@/components/AssistantChat/messages/UserMessage'
import { HappySystemMessage } from '@/components/AssistantChat/messages/SystemMessage'
import { Spinner } from '@/components/Spinner'
import { QueuedMessages } from '@/components/AssistantChat/QueuedMessages'
import type { QueuedMessage } from '@/hooks/useMessageQueue'
import { useTranslation } from '@/lib/use-translation'

function NewMessagesIndicator(props: { count: number; onClick: () => void }) {
    const { t } = useTranslation()
    if (props.count === 0) {
        return null
    }

    return (
        <button
            onClick={props.onClick}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[var(--app-button)] text-[var(--app-button-text)] px-3 py-1.5 rounded-full text-sm font-medium shadow-lg animate-bounce-in z-10"
        >
            {t('misc.newMessage', { n: props.count })} &#8595;
        </button>
    )
}

function MessageSkeleton() {
    const { t } = useTranslation()
    const rows = [
        { align: 'end', width: 'w-2/3', height: 'h-10' },
        { align: 'start', width: 'w-3/4', height: 'h-12' },
        { align: 'end', width: 'w-1/2', height: 'h-9' },
        { align: 'start', width: 'w-5/6', height: 'h-14' }
    ]

    return (
        <div role="status" aria-live="polite">
            <span className="sr-only">{t('misc.loadingMessages')}</span>
            <div className="space-y-3 animate-pulse">
                {rows.map((row, index) => (
                    <div key={`skeleton-${index}`} className={row.align === 'end' ? 'flex justify-end' : 'flex justify-start'}>
                        <div className={`${row.height} ${row.width} rounded-xl bg-[var(--app-subtle-bg)]`} />
                    </div>
                ))}
            </div>
        </div>
    )
}

const THREAD_MESSAGE_COMPONENTS = {
    UserMessage: HappyUserMessage,
    AssistantMessage: HappyAssistantMessage,
    SystemMessage: HappySystemMessage
} as const

type ThreadMessageRole = 'user' | 'assistant' | 'system'

type ThreadMessageGroup =
    | {
        kind: 'user'
        key: string
        index: number
    }
    | {
        kind: 'agent-turn'
        key: string
        indices: number[]
    }

function buildThreadMessageGroups(messages: readonly { id: string; role: ThreadMessageRole }[]): ThreadMessageGroup[] {
    const groups: ThreadMessageGroup[] = []

    let index = 0
    while (index < messages.length) {
        const current = messages[index]
        if (!current) break

        if (current.role === 'user') {
            groups.push({
                kind: 'user',
                key: current.id,
                index
            })
            index += 1
            continue
        }

        const indices: number[] = []
        const startId = current.id
        while (index < messages.length && messages[index]?.role !== 'user') {
            indices.push(index)
            index += 1
        }
        const endId = messages[indices[indices.length - 1]]?.id ?? startId
        groups.push({
            kind: 'agent-turn',
            key: `${startId}:${endId}`,
            indices
        })
    }

    return groups
}

export function HappyThread(props: {
    api: ApiClient
    sessionId: string
    metadata: SessionMetadataSummary | null
    disabled: boolean
    onRefresh: () => void
    onRetryMessage?: (localId: string) => void
    onResendMessage?: (text: string, attachments?: AttachmentMetadata[]) => void
    onStartEditMessage?: (messageId: string) => Promise<void>
    onCommitEditMessage?: (payload: {
        messageId: string
        text: string
        attachments?: AttachmentMetadata[]
    }) => void
    editedMessageTextById?: Record<string, string>
    onFlushPending: () => void
    onAtBottomChange: (atBottom: boolean) => void
    isLoadingMessages: boolean
    messagesWarning: string | null
    hasMoreMessages: boolean
    isLoadingMoreMessages: boolean
    onLoadMore: () => Promise<unknown>
    pendingCount: number
    rawMessagesCount: number
    normalizedMessagesCount: number
    messagesVersion: number
    forceScrollToken: number
    queuedMessages?: QueuedMessage[]
}) {
    const assistantApi = useAssistantApi()
    const { t } = useTranslation()
    const threadMessagesLength = useAssistantState(({ thread }) => thread.messages.length)
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const loadLockRef = useRef(false)
    const pendingScrollRef = useRef<{ scrollTop: number; scrollHeight: number; startVersion: number } | null>(null)
    const lastScrollTopRef = useRef(0)
    const prevLoadingMoreRef = useRef(false)
    const isLoadingMoreRef = useRef(props.isLoadingMoreMessages)
    const hasMoreMessagesRef = useRef(props.hasMoreMessages)
    const isLoadingMessagesRef = useRef(props.isLoadingMessages)
    const onLoadMoreRef = useRef(props.onLoadMore)
    const handleLoadMoreRef = useRef<() => void>(() => {})
    const atBottomRef = useRef(true)
    const onAtBottomChangeRef = useRef(props.onAtBottomChange)
    const onFlushPendingRef = useRef(props.onFlushPending)
    const forceScrollTokenRef = useRef(props.forceScrollToken)

    // Smart scroll state: autoScroll enabled when user is near bottom
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
    const autoScrollEnabledRef = useRef(autoScrollEnabled)

    // Keep refs in sync with state
    useEffect(() => {
        autoScrollEnabledRef.current = autoScrollEnabled
    }, [autoScrollEnabled])
    useEffect(() => {
        onAtBottomChangeRef.current = props.onAtBottomChange
    }, [props.onAtBottomChange])
    useEffect(() => {
        onFlushPendingRef.current = props.onFlushPending
    }, [props.onFlushPending])
    useEffect(() => {
        hasMoreMessagesRef.current = props.hasMoreMessages
    }, [props.hasMoreMessages])
    useEffect(() => {
        isLoadingMessagesRef.current = props.isLoadingMessages
    }, [props.isLoadingMessages])
    useEffect(() => {
        onLoadMoreRef.current = props.onLoadMore
    }, [props.onLoadMore])

    // Track scroll position to toggle autoScroll (stable listener using refs)
    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        const BOTTOM_THRESHOLD_PX = 120
        const TOP_LOAD_THRESHOLD_PX = 72
        lastScrollTopRef.current = viewport.scrollTop

        const handleScroll = () => {
            const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
            const isNearBottom = distanceFromBottom < BOTTOM_THRESHOLD_PX
            const currentScrollTop = viewport.scrollTop
            const isScrollingUp = currentScrollTop < lastScrollTopRef.current

            if (isNearBottom) {
                if (!autoScrollEnabledRef.current) setAutoScrollEnabled(true)
            } else if (autoScrollEnabledRef.current) {
                setAutoScrollEnabled(false)
            }

            if (isNearBottom !== atBottomRef.current) {
                atBottomRef.current = isNearBottom
                onAtBottomChangeRef.current(isNearBottom)
                if (isNearBottom) {
                    onFlushPendingRef.current()
                }
            }

            // Support "swipe/scroll up to load more" so loading older messages
            // does not require clicking the top button.
            if (!isNearBottom && isScrollingUp && currentScrollTop <= TOP_LOAD_THRESHOLD_PX) {
                handleLoadMoreRef.current()
            }

            lastScrollTopRef.current = currentScrollTop
        }

        viewport.addEventListener('scroll', handleScroll, { passive: true })
        return () => viewport.removeEventListener('scroll', handleScroll)
    }, []) // Stable: no dependencies, reads from refs

    // Allow nested UI (e.g. Steps/tool expanders) to explicitly disable auto-scroll
    // so expansion doesn't anchor to bottom and appear to "expand upward".
    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        const onDisableAutoScroll = () => {
            if (autoScrollEnabledRef.current) {
                setAutoScrollEnabled(false)
            }
            if (atBottomRef.current) {
                atBottomRef.current = false
                onAtBottomChangeRef.current(false)
            }
        }

        viewport.addEventListener('hapi:disable-auto-scroll', onDisableAutoScroll as EventListener)
        return () => viewport.removeEventListener('hapi:disable-auto-scroll', onDisableAutoScroll as EventListener)
    }, [])

    // Scroll to bottom handler for the indicator button
    const scrollToBottom = useCallback(() => {
        const viewport = viewportRef.current
        if (viewport) {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
        }
        setAutoScrollEnabled(true)
        if (!atBottomRef.current) {
            atBottomRef.current = true
            onAtBottomChangeRef.current(true)
        }
        onFlushPendingRef.current()
    }, [])

    // Reset state when session changes
    useEffect(() => {
        setAutoScrollEnabled(true)
        atBottomRef.current = true
        onAtBottomChangeRef.current(true)
        forceScrollTokenRef.current = props.forceScrollToken
    }, [props.sessionId])

    useEffect(() => {
        if (forceScrollTokenRef.current === props.forceScrollToken) {
            return
        }
        forceScrollTokenRef.current = props.forceScrollToken
        scrollToBottom()
    }, [props.forceScrollToken, scrollToBottom])

    const handleLoadMore = useCallback(() => {
        if (isLoadingMessagesRef.current || !hasMoreMessagesRef.current || isLoadingMoreRef.current || loadLockRef.current) {
            return
        }
        const viewport = viewportRef.current
        if (!viewport) {
            return
        }
        pendingScrollRef.current = {
            scrollTop: viewport.scrollTop,
            scrollHeight: viewport.scrollHeight,
            startVersion: props.messagesVersion
        }
        loadLockRef.current = true
        let loadPromise: Promise<unknown>
        try {
            loadPromise = onLoadMoreRef.current()
        } catch (error) {
            pendingScrollRef.current = null
            loadLockRef.current = false
            throw error
        }
        void loadPromise.catch((error) => {
            pendingScrollRef.current = null
            loadLockRef.current = false
            console.error('Failed to load older messages:', error)
        })
    }, [props.messagesVersion])

    useEffect(() => {
        handleLoadMoreRef.current = handleLoadMore
    }, [handleLoadMore])

    useLayoutEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) {
            return
        }
        const pending = pendingScrollRef.current
        if (!pending) {
            return
        }
        if (props.messagesVersion <= pending.startVersion) {
            return
        }

        let cancelled = false
        const restore = (attempt: number) => {
            if (cancelled) return
            const currentPending = pendingScrollRef.current
            const currentViewport = viewportRef.current
            if (!currentPending || !currentViewport) return

            const delta = currentViewport.scrollHeight - currentPending.scrollHeight
            if (delta <= 0 && attempt < 6) {
                requestAnimationFrame(() => restore(attempt + 1))
                return
            }

            currentViewport.scrollTop = currentPending.scrollTop + Math.max(0, delta)
            lastScrollTopRef.current = currentViewport.scrollTop
            pendingScrollRef.current = null
            loadLockRef.current = false
        }

        restore(0)

        return () => {
            cancelled = true
        }
    }, [props.messagesVersion])

    useEffect(() => {
        isLoadingMoreRef.current = props.isLoadingMoreMessages
        if (prevLoadingMoreRef.current && !props.isLoadingMoreMessages && pendingScrollRef.current) {
            const pending = pendingScrollRef.current
            if (pending && props.messagesVersion <= pending.startVersion) {
                pendingScrollRef.current = null
                loadLockRef.current = false
            }
        }
        prevLoadingMoreRef.current = props.isLoadingMoreMessages
    }, [props.isLoadingMoreMessages, props.messagesVersion])

    const showSkeleton = props.isLoadingMessages && props.rawMessagesCount === 0 && props.pendingCount === 0
    const threadMessages = threadMessagesLength > 0
        ? assistantApi.thread().getState().messages
        : []
    const messageGroups = useMemo(
        () => buildThreadMessageGroups(
            threadMessages.map((message) => ({
                id: message.id,
                role: message.role as ThreadMessageRole
            }))
        ),
        [threadMessagesLength, props.messagesVersion]
    )

    return (
        <HappyChatProvider value={{
            api: props.api,
            sessionId: props.sessionId,
            metadata: props.metadata,
            disabled: props.disabled,
            onRefresh: props.onRefresh,
            onRetryMessage: props.onRetryMessage,
            onResendMessage: props.onResendMessage,
            onStartEditMessage: props.onStartEditMessage,
            onCommitEditMessage: props.onCommitEditMessage,
            editedMessageTextById: props.editedMessageTextById
        }}>
            <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col relative">
                <ThreadPrimitive.Viewport asChild autoScroll={autoScrollEnabled}>
                    <div
                        ref={viewportRef}
                        data-chat-viewport="true"
                        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                    >
                        {props.isLoadingMoreMessages ? (
                            <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2" aria-live="polite">
                                <Spinner size="sm" label={t('misc.loading')} className="text-current" />
                            </div>
                        ) : null}
                        <div className="mx-auto w-full max-w-content min-w-0 p-3">
                            {showSkeleton ? (
                                <MessageSkeleton />
                            ) : (
                                <>
                                    {props.messagesWarning ? (
                                        <div className="mb-3 rounded-md bg-amber-500/10 p-2 text-xs">
                                            {props.messagesWarning}
                                        </div>
                                    ) : null}

                                    {import.meta.env.DEV && props.normalizedMessagesCount === 0 && props.rawMessagesCount > 0 ? (
                                        <div className="mb-2 rounded-md bg-amber-500/10 p-2 text-xs">
                                            Message normalization returned 0 items for {props.rawMessagesCount} messages (see `web/src/chat/normalize.ts`).
                                        </div>
                                    ) : null}
                                </>
                            )}
                            <div className="flex flex-col gap-3">
                                {messageGroups.map((group) => {
                                    if (group.kind === 'user') {
                                        return (
                                            <ThreadPrimitive.MessageByIndex
                                                key={group.key}
                                                index={group.index}
                                                components={THREAD_MESSAGE_COMPONENTS}
                                            />
                                        )
                                    }

                                    return (
                                        <HappyAgentTurnGroup key={group.key} indices={group.indices} />
                                    )
                                })}
                                <QueuedMessages messages={props.queuedMessages ?? []} />
                            </div>
                        </div>
                    </div>
                </ThreadPrimitive.Viewport>
                <NewMessagesIndicator count={props.pendingCount} onClick={scrollToBottom} />
            </ThreadPrimitive.Root>
        </HappyChatProvider>
    )
}
