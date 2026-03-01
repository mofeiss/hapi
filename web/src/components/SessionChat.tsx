import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type { AttachmentMetadata, DecryptedMessage, ModelMode, PermissionMode, Session } from '@/types/api'
import type { ChatBlock, NormalizedMessage } from '@/chat/types'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { normalizeDecryptedMessage } from '@/chat/normalize'
import { reduceChatBlocks } from '@/chat/reducer'
import { reconcileChatBlocks } from '@/chat/reconcile'
import { HappyComposer } from '@/components/AssistantChat/HappyComposer'
import { HappyThread } from '@/components/AssistantChat/HappyThread'
import { useHappyRuntime } from '@/lib/assistant-runtime'
import { createAttachmentAdapter } from '@/lib/attachmentAdapter'
import { SessionHeader } from '@/components/SessionHeader'
import { FilesPanel } from '@/routes/sessions/files'
import { TerminalPanel } from '@/routes/sessions/terminal'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { useVoiceOptional } from '@/lib/voice-context'
import { RealtimeVoiceSession, registerSessionStore, registerVoiceHooksStore, voiceHooks } from '@/realtime'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useMessageQueue } from '@/hooks/useMessageQueue'
import { setSessionTitleOverride, clearSessionTitleOverride, useSessionTitleOverride } from '@/lib/session-title-override-store'
import { makeClientSideId } from '@/lib/messages'

type SendOptions = {
    localId?: string
    createdAt?: number
}

type EditedResendState = {
    anchorMessageId: string
    hiddenSyntheticLocalId: string | null
    hiddenSyntheticMessageId: string | null
    maxSeqAtEdit: number
    editCommittedAt: number
}

type PersistedEditedState = {
    editedResend: EditedResendState | null
    editedMessageTextById: Record<string, string>
}

function editedStateStorageKey(sessionId: string): string {
    return `hapi:edited-resend:${sessionId}`
}

const EDITED_RESEND_NOTICE_HEADER = '[Edited resend notice]'
const EDITED_RESEND_NOTICE_HINT = 'This message was edited and resent by the user. Treat the following content as the latest authoritative request.'
const EDITED_RESEND_NOTICE_PREFIX = `${EDITED_RESEND_NOTICE_HEADER}\n${EDITED_RESEND_NOTICE_HINT}\n\n`

function getUserTextContent(message: DecryptedMessage): string | null {
    const raw = message.content
    if (!raw || typeof raw !== 'object') return null
    const record = raw as {
        role?: unknown
        content?: {
            type?: unknown
            text?: unknown
        }
    }
    if (record.role !== 'user') return null
    if (record.content?.type !== 'text') return null
    return typeof record.content.text === 'string' ? record.content.text : null
}

function parseEditedResendWrappedText(text: string): string | null {
    if (!text.startsWith(EDITED_RESEND_NOTICE_PREFIX)) {
        return null
    }
    return text.slice(EDITED_RESEND_NOTICE_PREFIX.length)
}

function extractEditedResendPayload(message: DecryptedMessage): string | null {
    const text = getUserTextContent(message)
    if (!text) return null
    return parseEditedResendWrappedText(text)
}

export function SessionChat(props: {
    api: ApiClient
    session: Session
    messages: DecryptedMessage[]
    messagesWarning: string | null
    hasMoreMessages: boolean
    isLoadingMessages: boolean
    isLoadingMoreMessages: boolean
    isSending: boolean
    pendingCount: number
    messagesVersion: number
    onBack: () => void
    onRefresh: () => void
    onLoadMore: () => Promise<unknown>
    onSend: (text: string, attachments?: AttachmentMetadata[], options?: SendOptions) => void
    onFlushPending: () => void
    onAtBottomChange: (atBottom: boolean) => void
    onRetryMessage?: (localId: string) => void
    onSessionDeleted?: () => void
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
}) {
    const { haptic } = usePlatform()
    const sessionInactive = !props.session.active
    const normalizedCacheRef = useRef<Map<string, { source: DecryptedMessage; normalized: NormalizedMessage | null }>>(new Map())
    const blocksByIdRef = useRef<Map<string, ChatBlock>>(new Map())
    const [forceScrollToken, setForceScrollToken] = useState(0)
    const [editedResend, setEditedResend] = useState<EditedResendState | null>(null)
    const [editedMessageTextById, setEditedMessageTextById] = useState<Record<string, string>>({})
    const agentFlavor = props.session.metadata?.flavor ?? null
    const { abortSession, switchSession, setPermissionMode, setModelMode } = useSessionActions(
        props.api,
        props.session.id,
        agentFlavor
    )

    // Override context size after /clear (reset to 0 = 100% remaining)
    const [contextSizeOverride, setContextSizeOverride] = useState<number | null>(null)
    // Override title after /clear (show "New Chat" until agent sets a new title)
    const titleOverride = useSessionTitleOverride(props.session.id)

    // Voice assistant integration
    const voice = useVoiceOptional()

    // Speech-to-text voice input (replaces ConvAI voice call)
    const stt = useVoiceInput(props.api)

    // Map STT status to ConversationStatus for existing UI
    const sttVoiceStatus = stt.status === 'recording' ? 'connected' as const
        : stt.status === 'transcribing' ? 'connecting' as const
        : 'disconnected' as const

    // Register session store for voice client tools
    useEffect(() => {
        registerSessionStore({
            getSession: () => props.session as { agentState?: { requests?: Record<string, unknown> } } | null,
            sendMessage: (_sessionId: string, message: string) => props.onSend(message),
            approvePermission: async (_sessionId: string, requestId: string) => {
                await props.api.approvePermission(props.session.id, requestId)
                props.onRefresh()
            },
            denyPermission: async (_sessionId: string, requestId: string) => {
                await props.api.denyPermission(props.session.id, requestId)
                props.onRefresh()
            }
        })
    }, [props.session, props.api, props.onSend, props.onRefresh])

    useEffect(() => {
        registerVoiceHooksStore(
            (sessionId) => (sessionId === props.session.id ? props.session : null),
            (sessionId) => (sessionId === props.session.id ? props.messages : [])
        )
    }, [props.session, props.messages])

    // Track and report new messages to voice assistant
    // Note: voiceHooks internally checks isVoiceSessionStarted() so we don't need to check voice.status here
    const prevMessagesRef = useRef<DecryptedMessage[]>([])

    useEffect(() => {
        const prevIds = new Set(prevMessagesRef.current.map(m => m.id))
        const newMessages = props.messages.filter(m => !prevIds.has(m.id))

        if (newMessages.length > 0) {
            voiceHooks.onMessages(props.session.id, newMessages)
        }

        prevMessagesRef.current = props.messages
    }, [props.messages, props.session.id])

    // Report ready event when thinking stops
    // Note: voiceHooks internally checks isVoiceSessionStarted() so we don't need to check voice.status here
    const prevThinkingRef = useRef(props.session.thinking)

    useEffect(() => {
        // Detect transition: thinking → not thinking
        if (prevThinkingRef.current && !props.session.thinking) {
            voiceHooks.onReady(props.session.id)
        }

        prevThinkingRef.current = props.session.thinking
    }, [props.session.thinking, props.session.id])

    // Report permission requests to voice assistant
    // Note: voiceHooks internally checks isVoiceSessionStarted() so we don't need to check voice.status here
    const prevRequestIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const requests = props.session.agentState?.requests ?? {}
        const currentIds = new Set(Object.keys(requests))

        for (const [requestId, request] of Object.entries(requests)) {
            if (!prevRequestIdsRef.current.has(requestId)) {
                voiceHooks.onPermissionRequested(
                    props.session.id,
                    requestId,
                    (request as { tool?: string }).tool ?? 'unknown',
                    (request as { arguments?: unknown }).arguments
                )
            }
        }

        prevRequestIdsRef.current = currentIds
    }, [props.session.agentState?.requests, props.session.id])

    const handleVoiceToggle = useCallback((options?: { discard?: boolean }) => {
        stt.toggle(options)
    }, [stt])

    const handleVoiceMicToggle = useCallback(() => {
        if (!voice) return
        voice.toggleMic()
    }, [voice])

    // Track session id to clear caches when it changes
    const prevSessionIdRef = useRef<string | null>(null)

    useEffect(() => {
        normalizedCacheRef.current.clear()
        blocksByIdRef.current.clear()

        const key = editedStateStorageKey(props.session.id)
        try {
            const raw = localStorage.getItem(key)
            if (!raw) {
                setEditedResend(null)
                setEditedMessageTextById({})
                return
            }
            const parsed = JSON.parse(raw) as PersistedEditedState
            const restored = parsed?.editedResend
            if (restored && typeof restored === 'object') {
                setEditedResend({
                    anchorMessageId: typeof restored.anchorMessageId === 'string' ? restored.anchorMessageId : '',
                    hiddenSyntheticLocalId: typeof restored.hiddenSyntheticLocalId === 'string' ? restored.hiddenSyntheticLocalId : null,
                    hiddenSyntheticMessageId: typeof restored.hiddenSyntheticMessageId === 'string'
                        ? restored.hiddenSyntheticMessageId
                        : (typeof restored.hiddenSyntheticLocalId === 'string' ? restored.hiddenSyntheticLocalId : null),
                    maxSeqAtEdit: typeof restored.maxSeqAtEdit === 'number' ? restored.maxSeqAtEdit : 0,
                    editCommittedAt: typeof restored.editCommittedAt === 'number' ? restored.editCommittedAt : 0
                })
            } else {
                setEditedResend(null)
            }
            setEditedMessageTextById(parsed?.editedMessageTextById ?? {})
        } catch {
            setEditedResend(null)
            setEditedMessageTextById({})
        }
    }, [props.session.id])

    useEffect(() => {
        const key = editedStateStorageKey(props.session.id)
        if (!editedResend && Object.keys(editedMessageTextById).length === 0) {
            localStorage.removeItem(key)
            return
        }
        const payload: PersistedEditedState = {
            editedResend,
            editedMessageTextById
        }
        localStorage.setItem(key, JSON.stringify(payload))
    }, [props.session.id, editedResend, editedMessageTextById])

    const messageView = useMemo(() => {
        if (!editedResend) {
            return {
                messages: props.messages
            }
        }

        const isHiddenEditedResendPrompt = (message: DecryptedMessage): boolean => {
            if (editedResend.hiddenSyntheticMessageId && message.id === editedResend.hiddenSyntheticMessageId) {
                return true
            }
            if (editedResend.hiddenSyntheticLocalId && message.localId === editedResend.hiddenSyntheticLocalId) {
                return true
            }
            const payload = extractEditedResendPayload(message)
            if (!payload) {
                return false
            }
            return message.createdAt === editedResend.editCommittedAt
        }

        const withoutEditedResendPrompt = props.messages.filter((message) => {
            if (!isHiddenEditedResendPrompt(message)) return true
            return message.status === 'failed'
        })

        const anchorIndex = withoutEditedResendPrompt.findIndex((message) => message.id === editedResend.anchorMessageId)
        if (anchorIndex < 0) {
            return {
                messages: withoutEditedResendPrompt
            }
        }

        const nextMessages = withoutEditedResendPrompt.filter((message, index) => {
            if (index <= anchorIndex) {
                return true
            }

            const seq = typeof message.seq === 'number' ? message.seq : null
            if (seq !== null) {
                return seq > editedResend.maxSeqAtEdit
            }

            return message.createdAt >= editedResend.editCommittedAt
        })

        return {
            messages: nextMessages
        }
    }, [props.messages, editedResend])

    useEffect(() => {
        if (!editedResend) return
        const failed = props.messages.find(
            (message) => (
                (editedResend.hiddenSyntheticLocalId && message.localId === editedResend.hiddenSyntheticLocalId)
                || (editedResend.hiddenSyntheticMessageId && message.id === editedResend.hiddenSyntheticMessageId)
            ) && message.status === 'failed'
        )
        if (!failed) return

        setEditedResend(null)
        setEditedMessageTextById((prev) => {
            const next = { ...prev }
            delete next[editedResend.anchorMessageId]
            return next
        })
    }, [props.messages, editedResend])

    useEffect(() => {
        if (!editedResend) return

        if (editedResend.hiddenSyntheticLocalId) {
            const resolved = props.messages.find((message) => message.localId === editedResend.hiddenSyntheticLocalId)
            if (resolved && resolved.id !== editedResend.hiddenSyntheticMessageId) {
                setEditedResend((prev) => prev ? {
                    ...prev,
                    hiddenSyntheticMessageId: resolved.id
                } : prev)
                return
            }
        }

        if (props.isLoadingMessages && props.messages.length === 0) {
            return
        }

        const hasAnchor = props.messages.some((message) => message.id === editedResend.anchorMessageId)
        if (hasAnchor) return

        const hasEditedResendPrompt = props.messages.some((message) => {
            if (editedResend.hiddenSyntheticLocalId && message.localId === editedResend.hiddenSyntheticLocalId) {
                return true
            }
            if (editedResend.hiddenSyntheticMessageId && message.id === editedResend.hiddenSyntheticMessageId) {
                return true
            }
            const payload = extractEditedResendPayload(message)
            return payload !== null && message.createdAt === editedResend.editCommittedAt
        })
        if (hasEditedResendPrompt) return

        if (props.isLoadingMessages || props.messages.length === 0) {
            return
        }

        setEditedResend(null)
        setEditedMessageTextById({})
    }, [props.messages, editedResend, props.isLoadingMessages])

    useEffect(() => {
        if (editedResend) return
        if (props.isLoadingMessages && props.messages.length === 0) return

        let wrapperIndex = -1
        let wrapperPayload: string | null = null
        for (let index = props.messages.length - 1; index >= 0; index -= 1) {
            const payload = extractEditedResendPayload(props.messages[index])
            if (payload !== null) {
                wrapperIndex = index
                wrapperPayload = payload
                break
            }
        }
        if (wrapperIndex < 0 || wrapperPayload === null) return

        const wrapper = props.messages[wrapperIndex]
        let anchor: DecryptedMessage | null = null
        for (let index = wrapperIndex - 1; index >= 0; index -= 1) {
            const candidate = props.messages[index]
            const userText = getUserTextContent(candidate)
            if (!userText) continue
            if (extractEditedResendPayload(candidate) !== null) continue
            anchor = candidate
            break
        }

        if (!anchor) return

        const maxSeqAtEdit = typeof wrapper.seq === 'number'
            ? Math.max(wrapper.seq - 1, 0)
            : 0

        setEditedMessageTextById((prev) => ({
            ...prev,
            [anchor.id]: wrapperPayload
        }))
        setEditedResend({
            anchorMessageId: anchor.id,
            hiddenSyntheticLocalId: wrapper.localId ?? null,
            hiddenSyntheticMessageId: wrapper.id,
            maxSeqAtEdit,
            editCommittedAt: wrapper.createdAt
        })
    }, [props.messages, editedResend, props.isLoadingMessages])

    const normalizedMessages: NormalizedMessage[] = useMemo(() => {
        // Clear caches immediately when session changes (before useEffect runs)
        if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== props.session.id) {
            normalizedCacheRef.current.clear()
            blocksByIdRef.current.clear()
        }
        prevSessionIdRef.current = props.session.id

        const cache = normalizedCacheRef.current
        const normalized: NormalizedMessage[] = []
        const seen = new Set<string>()
        for (const message of messageView.messages) {
            seen.add(message.id)
            const cached = cache.get(message.id)
            if (cached && cached.source === message) {
                if (cached.normalized) normalized.push(cached.normalized)
                continue
            }
            const next = normalizeDecryptedMessage(message)
            cache.set(message.id, { source: message, normalized: next })
            if (next) normalized.push(next)
        }
        for (const id of cache.keys()) {
            if (!seen.has(id)) {
                cache.delete(id)
            }
        }
        return normalized
    }, [props.session.id, messageView.messages])

    const reduced = useMemo(
        () => reduceChatBlocks(normalizedMessages, props.session.agentState),
        [normalizedMessages, props.session.agentState]
    )
    const reconciled = useMemo(
        () => reconcileChatBlocks(reduced.blocks, blocksByIdRef.current),
        [reduced.blocks]
    )

    useEffect(() => {
        blocksByIdRef.current = reconciled.byId
    }, [reconciled.byId])

    // Clear context size override when new usage data arrives from backend
    useEffect(() => {
        if (contextSizeOverride !== null && reduced.latestUsage) {
            setContextSizeOverride(null)
        }
    }, [reduced.latestUsage?.timestamp])

    // Clear title override when agent sets a new title (via change_title MCP tool)
    const sessionName = props.session.metadata?.name
    useEffect(() => {
        if (titleOverride !== null && sessionName) {
            clearSessionTitleOverride(props.session.id)
        }
    }, [sessionName])

    // Permission mode change handler (base mode)
    const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
        try {
            const isPlan = props.session.permissionMode === 'plan'
            if (isPlan) {
                // Plan is ON: change base mode while keeping plan active
                await setPermissionMode('plan', mode)
            } else {
                await setPermissionMode(mode)
            }
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set permission mode:', e)
        }
    }, [setPermissionMode, props.onRefresh, haptic, props.session.permissionMode])

    // Plan toggle handler
    const handlePlanToggle = useCallback(async () => {
        try {
            const currentMode = props.session.permissionMode
            if (currentMode === 'plan') {
                // Turn off plan: revert to basePermissionMode
                const baseMode = props.session.basePermissionMode ?? 'default'
                await setPermissionMode(baseMode)
            } else {
                // Turn on plan: remember current mode as base
                await setPermissionMode('plan', currentMode ?? 'default')
            }
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to toggle plan mode:', e)
        }
    }, [setPermissionMode, props.onRefresh, haptic, props.session.permissionMode, props.session.basePermissionMode])

    // Model mode change handler
    const handleModelModeChange = useCallback(async (mode: ModelMode) => {
        try {
            await setModelMode(mode)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set model mode:', e)
        }
    }, [setModelMode, props.onRefresh, haptic])

    // Abort handler
    const handleAbort = useCallback(async () => {
        await abortSession()
        props.onRefresh()
    }, [abortSession, props.onRefresh])

    // Switch to remote handler
    const handleSwitchToRemote = useCallback(async () => {
        await switchSession()
        props.onRefresh()
    }, [switchSession, props.onRefresh])

    const [filesOpen, setFilesOpen] = useState(false)
    const [terminalOpen, setTerminalOpen] = useState(false)

    const handleToggleFiles = useCallback(() => {
        setFilesOpen(prev => {
            if (!prev) setTerminalOpen(false)
            return !prev
        })
    }, [])

    const handleToggleTerminal = useCallback(() => {
        setTerminalOpen(prev => {
            if (!prev) setFilesOpen(false)
            return !prev
        })
    }, [])

    const handleSend = useCallback((text: string, attachments?: AttachmentMetadata[], options?: SendOptions) => {
        props.onSend(text, attachments, options)
        setForceScrollToken((token) => token + 1)

        // Detect /clear command: reset context size and title
        if (text.trim() === '/clear') {
            setContextSizeOverride(0)
            setSessionTitleOverride(props.session.id, 'New Chat')
        }
    }, [props.onSend, props.session.id])

    const handleResendMessage = useCallback((text: string, attachments?: AttachmentMetadata[]) => {
        if (text.trim().length === 0 && (!attachments || attachments.length === 0)) {
            return
        }
        handleSend(text, attachments)
    }, [handleSend])

    const handleStartEditMessage = useCallback(async (_messageId: string) => {
        if (!props.session.thinking) {
            return
        }
        await handleAbort()
    }, [props.session.thinking, handleAbort])

    const handleCommitEditMessage = useCallback((payload: {
        messageId: string
        text: string
        attachments?: AttachmentMetadata[]
    }) => {
        const trimmed = payload.text.trim()
        if (!trimmed && (!payload.attachments || payload.attachments.length === 0)) {
            return
        }

        const maxSeqAtEdit = props.messages.reduce((max, message) => {
            if (typeof message.seq !== 'number') return max
            return message.seq > max ? message.seq : max
        }, 0)

        const localId = makeClientSideId('edit')
        const editCommittedAt = Date.now()
        const isSlashCommand = trimmed.startsWith('/')
        const outboundText = isSlashCommand
            ? payload.text
            : `${EDITED_RESEND_NOTICE_PREFIX}${payload.text}`

        setEditedMessageTextById((prev) => ({
            ...prev,
            [payload.messageId]: payload.text
        }))
        setEditedResend({
            anchorMessageId: payload.messageId,
            hiddenSyntheticLocalId: localId,
            hiddenSyntheticMessageId: localId,
            maxSeqAtEdit,
            editCommittedAt
        })

        handleSend(outboundText, payload.attachments, { localId, createdAt: editCommittedAt })
    }, [props.messages, handleSend])

    // Message queue for sending while agent is running
    const messageQueue = useMessageQueue(!!props.session.thinking, handleSend)

    const handleFlushNow = useCallback(() => {
        messageQueue.flushNow()
        abortSession()
        props.onRefresh()
    }, [messageQueue.flushNow, abortSession, props.onRefresh])

    const attachmentAdapter = useMemo(() => {
        if (!props.session.active) {
            return undefined
        }
        return createAttachmentAdapter(props.api, props.session.id)
    }, [props.api, props.session.id, props.session.active])

    const runtime = useHappyRuntime({
        session: props.session,
        blocks: reconciled.blocks,
        isSending: props.isSending,
        onSendMessage: handleSend,
        onAbort: handleAbort,
        attachmentAdapter,
        allowSendWhenInactive: true
    })

    return (
        <div className="relative flex h-full flex-col">
            <SessionHeader
                session={props.session}
                onBack={props.onBack}
                onToggleTerminal={props.session.active ? handleToggleTerminal : undefined}
                terminalOpen={terminalOpen}
                onToggleFiles={props.session.metadata?.path ? handleToggleFiles : undefined}
                filesOpen={filesOpen}
                api={props.api}
                onSessionDeleted={props.onSessionDeleted ?? props.onBack}
            />

            {sessionInactive ? (
                <div className="px-3 pt-3">
                    <div className="mx-auto w-full max-w-content rounded-md bg-[var(--app-subtle-bg)] p-3 text-sm text-[var(--app-hint)]">
                        Session is inactive. Sending will resume it automatically.
                    </div>
                </div>
            ) : null}

            <AssistantRuntimeProvider runtime={runtime}>
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <HappyThread
                        key={props.session.id}
                        api={props.api}
                        sessionId={props.session.id}
                        metadata={props.session.metadata}
                        disabled={sessionInactive}
                        onRefresh={props.onRefresh}
                        onRetryMessage={props.onRetryMessage}
                        onResendMessage={handleResendMessage}
                        onStartEditMessage={handleStartEditMessage}
                        onCommitEditMessage={handleCommitEditMessage}
                        editedMessageTextById={editedMessageTextById}
                        onFlushPending={props.onFlushPending}
                        onAtBottomChange={props.onAtBottomChange}
                        isLoadingMessages={props.isLoadingMessages}
                        messagesWarning={props.messagesWarning}
                        hasMoreMessages={props.hasMoreMessages}
                        isLoadingMoreMessages={props.isLoadingMoreMessages}
                        onLoadMore={props.onLoadMore}
                        pendingCount={props.pendingCount}
                        rawMessagesCount={messageView.messages.length}
                        normalizedMessagesCount={normalizedMessages.length}
                        messagesVersion={props.messagesVersion}
                        forceScrollToken={forceScrollToken}
                        queuedMessages={messageQueue.queue}
                    />

                    <HappyComposer
                        disabled={props.isSending}
                        permissionMode={props.session.permissionMode}
                        basePermissionMode={props.session.basePermissionMode}
                        modelMode={props.session.modelMode}
                        agentFlavor={agentFlavor}
                        active={props.session.active}
                        allowSendWhenInactive
                        thinking={props.session.thinking}
                        agentState={props.session.agentState}
                        contextSize={contextSizeOverride ?? reduced.latestUsage?.contextSize}
                        controlledByUser={props.session.agentState?.controlledByUser === true}
                        onPermissionModeChange={handlePermissionModeChange}
                        onModelModeChange={handleModelModeChange}
                        onPlanToggle={handlePlanToggle}
                        onSwitchToRemote={handleSwitchToRemote}
                        autocompleteSuggestions={props.autocompleteSuggestions}
                        voiceStatus={sttVoiceStatus}
                        voiceRawText={stt.rawText}
                        voiceError={stt.error}
                        onVoiceToggle={handleVoiceToggle}
                        onTranscript={stt.setOnTranscript}
                        onInterim={stt.setOnInterim}
                        onQueueSend={messageQueue.enqueue}
                        hasQueue={messageQueue.queue.length > 0}
                        onFlushQueue={handleFlushNow}
                    />

                    {/* Files overlay - covers main content area only */}
                    <div className={`absolute inset-0 z-50 bg-[var(--app-bg)] transition-opacity duration-200 ${filesOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <FilesPanel sessionId={props.session.id} />
                    </div>

                    {/* Terminal overlay - covers main content area only */}
                    <div className={`absolute inset-0 z-50 bg-[var(--app-bg)] transition-opacity duration-200 ${terminalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <TerminalPanel sessionId={props.session.id} />
                    </div>
                </div>
            </AssistantRuntimeProvider>

            {/* Voice session component - renders nothing but initializes ElevenLabs */}
            {voice && (
                <RealtimeVoiceSession
                    api={props.api}
                    micMuted={voice.micMuted}
                    onStatusChange={voice.setStatus}
                />
            )}
        </div>
    )
}
