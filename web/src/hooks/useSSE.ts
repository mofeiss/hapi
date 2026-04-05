import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isObject } from '@hapi/protocol'
import type { SyncEvent } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { clearMessageWindow, ingestIncomingMessages } from '@/lib/message-window-store'
import type { Session, SessionResponse, SessionsResponse, SessionSummary } from '@/types/api'

function hasOwn(record: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key)
}

export function mergeSessionData<T extends Session>(session: T, patch: unknown): { session: T; changed: boolean } {
    if (!isObject(patch)) {
        return { session, changed: false }
    }

    const next = { ...session } as T
    let changed = false

    if (typeof patch.active === 'boolean' && patch.active !== session.active) {
        next.active = patch.active
        changed = true
    }
    if (typeof patch.activeAt === 'number' && patch.activeAt !== session.activeAt) {
        next.activeAt = patch.activeAt
        changed = true
    }
    if (typeof patch.thinking === 'boolean' && patch.thinking !== session.thinking) {
        next.thinking = patch.thinking
        changed = true
    }
    if (typeof patch.updatedAt === 'number' && patch.updatedAt !== session.updatedAt) {
        next.updatedAt = patch.updatedAt
        changed = true
    }
    if (typeof patch.seq === 'number' && patch.seq !== session.seq) {
        next.seq = patch.seq
        changed = true
    }
    if (hasOwn(patch, 'metadata') && patch.metadata !== session.metadata) {
        next.metadata = patch.metadata as T['metadata']
        changed = true
    }
    if (typeof patch.metadataVersion === 'number' && patch.metadataVersion !== session.metadataVersion) {
        next.metadataVersion = patch.metadataVersion
        changed = true
    }
    if (hasOwn(patch, 'agentState') && patch.agentState !== session.agentState) {
        next.agentState = patch.agentState as T['agentState']
        changed = true
    }
    if (typeof patch.agentStateVersion === 'number' && patch.agentStateVersion !== session.agentStateVersion) {
        next.agentStateVersion = patch.agentStateVersion
        changed = true
    }
    if (hasOwn(patch, 'todos') && patch.todos !== session.todos) {
        next.todos = patch.todos as T['todos']
        changed = true
    }
    if (hasOwn(patch, 'permissionMode') && patch.permissionMode !== session.permissionMode) {
        next.permissionMode = patch.permissionMode as T['permissionMode']
        changed = true
    }
    if (hasOwn(patch, 'basePermissionMode') && patch.basePermissionMode !== session.basePermissionMode) {
        next.basePermissionMode = patch.basePermissionMode as T['basePermissionMode']
        changed = true
    }
    if (hasOwn(patch, 'modelMode') && patch.modelMode !== session.modelMode) {
        next.modelMode = patch.modelMode as T['modelMode']
        changed = true
    }

    return changed ? { session: next, changed } : { session, changed }
}

export function mergeSessionSummaryData(session: SessionSummary, patch: unknown): { session: SessionSummary; changed: boolean } {
    if (!isObject(patch)) {
        return { session, changed: false }
    }

    const next = { ...session }
    let changed = false

    if (typeof patch.active === 'boolean' && patch.active !== session.active) {
        next.active = patch.active
        changed = true
    }
    if (typeof patch.activeAt === 'number' && patch.activeAt !== session.activeAt) {
        next.activeAt = patch.activeAt
        changed = true
    }
    if (typeof patch.thinking === 'boolean' && patch.thinking !== session.thinking) {
        next.thinking = patch.thinking
        changed = true
    }
    if (typeof patch.updatedAt === 'number' && patch.updatedAt !== session.updatedAt) {
        next.updatedAt = patch.updatedAt
        changed = true
    }
    if (hasOwn(patch, 'metadata') && patch.metadata !== session.metadata) {
        next.metadata = patch.metadata as SessionSummary['metadata']
        changed = true
    }
    if (hasOwn(patch, 'todoProgress') && patch.todoProgress !== session.todoProgress) {
        next.todoProgress = patch.todoProgress as SessionSummary['todoProgress']
        changed = true
    }
    if (typeof patch.pendingRequestsCount === 'number' && patch.pendingRequestsCount !== session.pendingRequestsCount) {
        next.pendingRequestsCount = patch.pendingRequestsCount
        changed = true
    } else if (hasOwn(patch, 'agentState')) {
        const pendingRequestsCount = isObject(patch.agentState) && isObject(patch.agentState.requests)
            ? Object.keys(patch.agentState.requests).length
            : 0
        if (pendingRequestsCount !== session.pendingRequestsCount) {
            next.pendingRequestsCount = pendingRequestsCount
            changed = true
        }
    }
    if (hasOwn(patch, 'modelMode') && patch.modelMode !== session.modelMode) {
        next.modelMode = patch.modelMode as SessionSummary['modelMode']
        changed = true
    }

    return changed ? { session: next, changed } : { session, changed }
}

function patchSessionCaches(queryClient: ReturnType<typeof useQueryClient>, sessionId: string, patch: unknown): boolean {
    let updated = false

    queryClient.setQueryData<SessionResponse | undefined>(queryKeys.session(sessionId), (current) => {
        if (!current?.session) {
            return current
        }

        const merged = mergeSessionData(current.session, patch)
        if (!merged.changed) {
            return current
        }

        updated = true
        return { session: merged.session }
    })

    queryClient.setQueryData<SessionsResponse | undefined>(queryKeys.sessions, (current) => {
        if (!current?.sessions) {
            return current
        }

        let changed = false
        const sessions = current.sessions.map((session) => {
            if (session.id !== sessionId) {
                return session
            }

            const merged = mergeSessionSummaryData(session, patch)
            if (!merged.changed) {
                return session
            }

            changed = true
            return merged.session
        })

        if (!changed) {
            return current
        }

        updated = true
        return { sessions }
    })

    return updated
}

type SSESubscription = {
    all?: boolean
    sessionId?: string
    machineId?: string
}

type VisibilityState = 'visible' | 'hidden'

type ToastEvent = Extract<SyncEvent, { type: 'toast' }>

function getVisibilityState(): VisibilityState {
    if (typeof document === 'undefined') {
        return 'hidden'
    }
    return document.visibilityState === 'visible' ? 'visible' : 'hidden'
}

function buildEventsUrl(
    baseUrl: string,
    token: string,
    subscription: SSESubscription,
    visibility: VisibilityState
): string {
    const params = new URLSearchParams()
    params.set('token', token)
    params.set('visibility', visibility)
    if (subscription.all) {
        params.set('all', 'true')
    }
    if (subscription.sessionId) {
        params.set('sessionId', subscription.sessionId)
    }
    if (subscription.machineId) {
        params.set('machineId', subscription.machineId)
    }

    const path = `/api/events?${params.toString()}`
    try {
        return new URL(path, baseUrl).toString()
    } catch {
        return path
    }
}

export function useSSE(options: {
    enabled: boolean
    token: string
    baseUrl: string
    subscription?: SSESubscription
    onEvent: (event: SyncEvent) => void
    onConnect?: () => void
    onDisconnect?: (reason: string) => void
    onError?: (error: unknown) => void
    onToast?: (event: ToastEvent) => void
}): { subscriptionId: string | null } {
    const queryClient = useQueryClient()
    const onEventRef = useRef(options.onEvent)
    const onConnectRef = useRef(options.onConnect)
    const onDisconnectRef = useRef(options.onDisconnect)
    const onErrorRef = useRef(options.onError)
    const onToastRef = useRef(options.onToast)
    const eventSourceRef = useRef<EventSource | null>(null)
    const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

    useEffect(() => {
        onEventRef.current = options.onEvent
    }, [options.onEvent])

    useEffect(() => {
        onErrorRef.current = options.onError
    }, [options.onError])

    useEffect(() => {
        onConnectRef.current = options.onConnect
    }, [options.onConnect])

    useEffect(() => {
        onDisconnectRef.current = options.onDisconnect
    }, [options.onDisconnect])

    useEffect(() => {
        onToastRef.current = options.onToast
    }, [options.onToast])

    const subscription = options.subscription ?? {}

    const subscriptionKey = useMemo(() => {
        return `${subscription.all ? '1' : '0'}|${subscription.sessionId ?? ''}|${subscription.machineId ?? ''}`
    }, [subscription.all, subscription.sessionId, subscription.machineId])

    useEffect(() => {
        if (!options.enabled) {
            eventSourceRef.current?.close()
            eventSourceRef.current = null
            setSubscriptionId(null)
            return
        }

        setSubscriptionId(null)
        const url = buildEventsUrl(options.baseUrl, options.token, {
            ...subscription,
            sessionId: subscription.sessionId ?? undefined
        }, getVisibilityState())
        const eventSource = new EventSource(url)
        eventSourceRef.current = eventSource

        const handleSyncEvent = (event: SyncEvent) => {
            if (event.type === 'connection-changed') {
                const data = event.data
                if (data && typeof data === 'object' && 'subscriptionId' in data) {
                    const nextId = (data as { subscriptionId?: unknown }).subscriptionId
                    if (typeof nextId === 'string' && nextId.length > 0) {
                        setSubscriptionId(nextId)
                    }
                }
            }

            if (event.type === 'toast') {
                onToastRef.current?.(event)
                return
            }

            if (event.type === 'message-received') {
                ingestIncomingMessages(event.sessionId, [event.message])
            }

            if (event.type === 'session-added' || event.type === 'session-updated' || event.type === 'session-removed') {
                if ('sessionId' in event) {
                    if (event.type === 'session-removed') {
                        void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
                        void queryClient.removeQueries({ queryKey: queryKeys.session(event.sessionId) })
                        clearMessageWindow(event.sessionId)
                    } else {
                        const patched = patchSessionCaches(queryClient, event.sessionId, event.data)
                        if (!patched || event.type === 'session-added') {
                            void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
                            void queryClient.invalidateQueries({ queryKey: queryKeys.session(event.sessionId) })
                        }
                    }
                } else {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
                }
            }

            if (event.type === 'machine-updated') {
                void queryClient.invalidateQueries({ queryKey: queryKeys.machines })
                void queryClient.invalidateQueries({ queryKey: queryKeys.runtimeConfig })
            }

            if (
                event.type === 'scheduled-task-updated'
                || event.type === 'scheduled-task-removed'
                || event.type === 'scheduled-run-updated'
            ) {
                void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks })
            }

            onEventRef.current(event)
        }

        const handleMessage = (message: MessageEvent<string>) => {
            if (typeof message.data !== 'string') {
                return
            }

            let parsed: unknown
            try {
                parsed = JSON.parse(message.data)
            } catch {
                return
            }

            if (!isObject(parsed)) {
                return
            }
            if (typeof parsed.type !== 'string') {
                return
            }

            handleSyncEvent(parsed as SyncEvent)
        }

        eventSource.onmessage = handleMessage
        eventSource.onopen = () => {
            onConnectRef.current?.()
        }
        eventSource.onerror = (error) => {
            onErrorRef.current?.(error)
            const reason = eventSource.readyState === EventSource.CLOSED ? 'closed' : 'error'
            onDisconnectRef.current?.(reason)
        }

        return () => {
            eventSource.close()
            if (eventSourceRef.current === eventSource) {
                eventSourceRef.current = null
            }
            setSubscriptionId(null)
        }
    }, [options.baseUrl, options.enabled, options.token, subscriptionKey, queryClient])

    return { subscriptionId }
}
