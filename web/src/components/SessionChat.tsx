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
    onSend: (text: string, attachments?: AttachmentMetadata[]) => void
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

    const handleVoiceToggle = useCallback(async () => {
        stt.toggle()
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
    }, [props.session.id])

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
        for (const message of props.messages) {
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
    }, [props.messages])

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

    const handleSend = useCallback((text: string, attachments?: AttachmentMetadata[]) => {
        props.onSend(text, attachments)
        setForceScrollToken((token) => token + 1)

        // Detect /clear command: reset context size and title
        if (text.trim() === '/clear') {
            setContextSizeOverride(0)
            setSessionTitleOverride(props.session.id, 'New Chat')
        }
    }, [props.onSend, props.session.id])

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
                        onFlushPending={props.onFlushPending}
                        onAtBottomChange={props.onAtBottomChange}
                        isLoadingMessages={props.isLoadingMessages}
                        messagesWarning={props.messagesWarning}
                        hasMoreMessages={props.hasMoreMessages}
                        isLoadingMoreMessages={props.isLoadingMoreMessages}
                        onLoadMore={props.onLoadMore}
                        pendingCount={props.pendingCount}
                        rawMessagesCount={props.messages.length}
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
