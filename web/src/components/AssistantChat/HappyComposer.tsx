import { getBasePermissionModeOptionsForFlavor, supportsPlanToggle, MODEL_MODE_LABELS, MODEL_MODES } from '@hapi/protocol'
import { ComposerPrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import {
    type ChangeEvent as ReactChangeEvent,
    type ClipboardEvent as ReactClipboardEvent,
    type FormEvent as ReactFormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type SyntheticEvent as ReactSyntheticEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import type { AgentState, CodexReasoningEffort, ModelMode, PermissionMode, UserMessageMeta } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import type { ConversationStatus } from '@/realtime/types'
import { useActiveWord } from '@/hooks/useActiveWord'
import { useActiveSuggestions } from '@/hooks/useActiveSuggestions'
import { applySuggestion } from '@/utils/applySuggestion'
import { usePlatform } from '@/hooks/usePlatform'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { isCodexFamilyFlavor } from '@/lib/agentFlavorUtils'
import { markSkillUsed } from '@/lib/recent-skills'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import { StatusBar } from '@/components/AssistantChat/StatusBar'
import { ComposerButtons } from '@/components/AssistantChat/ComposerButtons'
import { AttachmentItem, ComposerImagePreviewContext } from '@/components/AssistantChat/AttachmentItem'
import { ImagePreviewModal, type PreviewImage } from '@/components/AssistantChat/ImagePreviewModal'
import { isImageMimeType } from '@/lib/fileAttachments'
import { useTranslation } from '@/lib/use-translation'

export interface TextInputState {
    text: string
    selection: { start: number; end: number }
}

const defaultSuggestionHandler = async (): Promise<Suggestion[]> => []

function joinVoiceDraft(prefix: string, transcript: string): string {
    const left = prefix.trim()
    const right = transcript.trim()
    if (!left) return right
    if (!right) return left
    return `${left} ${right}`
}

export function HappyComposer(props: {
    disabled?: boolean
    sendDisabled?: boolean
    permissionMode?: PermissionMode
    basePermissionMode?: PermissionMode
    modelMode?: ModelMode
    active?: boolean
    allowSendWhenInactive?: boolean
    thinking?: boolean
    agentState?: AgentState | null
    contextSize?: number
    controlledByUser?: boolean
    agentFlavor?: string | null
    onPermissionModeChange?: (mode: PermissionMode) => void
    onModelModeChange?: (mode: ModelMode) => void
    onPlanToggle?: () => void
    codexModel?: string | null
    codexModelOptions?: { value: string; label: string }[]
    codexReasoningEffort?: CodexReasoningEffort | null
    codexReasoningOptions?: { value: CodexReasoningEffort; label: string }[]
    onCodexModelChange?: (model: string) => void
    onCodexReasoningEffortChange?: (effort: CodexReasoningEffort) => void
    autocompletePrefixes?: string[]
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    // Voice assistant props
    voiceStatus?: ConversationStatus
    voiceRawText?: string
    voiceCorrectedText?: string
    voiceError?: string | null
    voiceCorrectionUnavailable?: boolean
    voiceMicMuted?: boolean
    onVoiceToggle?: (options?: { discard?: boolean }) => void
    onVoiceMicToggle?: () => void
    onTranscript?: (cb: (text: string) => void) => void
    // Queue send props
    onQueueSend?: (text: string, meta?: UserMessageMeta) => void
    hasQueue?: boolean
    onFlushQueue?: () => void
}) {
    const { t } = useTranslation()
    const {
        disabled = false,
        sendDisabled = false,
        permissionMode: rawPermissionMode,
        basePermissionMode: rawBasePermissionMode,
        modelMode: rawModelMode,
        active = true,
        allowSendWhenInactive = false,
        thinking = false,
        agentState,
        contextSize,
        controlledByUser = false,
        agentFlavor,
        onPermissionModeChange,
        onModelModeChange,
        onPlanToggle,
        codexModel = null,
        codexModelOptions = [],
        codexReasoningEffort = null,
        codexReasoningOptions = [],
        onCodexModelChange,
        onCodexReasoningEffortChange,
        autocompletePrefixes = ['@', '/', '$'],
        autocompleteSuggestions = defaultSuggestionHandler,
        voiceStatus = 'disconnected',
        voiceRawText = '',
        voiceCorrectedText = '',
        voiceError = null,
        voiceCorrectionUnavailable = false,
        voiceMicMuted = false,
        onVoiceToggle,
        onVoiceMicToggle,
        onTranscript,
        onQueueSend,
        hasQueue = false,
        onFlushQueue
    } = props

    // Use ?? so missing values fall back to default (destructuring defaults only handle undefined)
    const permissionMode = rawPermissionMode ?? 'default'
    const basePermissionMode = rawBasePermissionMode ?? (permissionMode === 'plan' ? 'default' : permissionMode)
    const modelMode = rawModelMode ?? 'default'
    const isPlan = permissionMode === 'plan'
    const showPlanToggle = Boolean(onPlanToggle && supportsPlanToggle(agentFlavor))

    const api = useAssistantApi()
    const composerText = useAssistantState(({ composer }) => composer.text)
    const attachments = useAssistantState(({ composer }) => composer.attachments)
    const threadIsRunning = useAssistantState(({ thread }) => thread.isRunning)
    const threadIsDisabled = useAssistantState(({ thread }) => thread.isDisabled)

    const controlsDisabled = disabled || (!active && !allowSendWhenInactive) || threadIsDisabled
    const trimmed = composerText.trim()
    const hasText = trimmed.length > 0
    const hasAttachments = attachments.length > 0
    const attachmentsReady = !hasAttachments || attachments.every((attachment) => {
        if (attachment.status.type === 'complete') {
            return true
        }
        if (attachment.status.type !== 'requires-action') {
            return false
        }
        const path = (attachment as { path?: string }).path
        return typeof path === 'string' && path.length > 0
    })
    const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && !sendDisabled

    const [inputState, setInputState] = useState<TextInputState>({
        text: '',
        selection: { start: 0, end: 0 }
    })
    const [isAborting, setIsAborting] = useState(false)
    const [showContinueHint, setShowContinueHint] = useState(false)
    const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null)

    // Compute image attachments for the shared preview modal
    const imageAttachments = useMemo(() => {
        return attachments.filter(a => {
            const ct = (a as { contentType?: string }).contentType ?? ''
            const pu = (a as { previewUrl?: string }).previewUrl
            return isImageMimeType(ct) && !!pu
        })
    }, [attachments])

    const previewImages: PreviewImage[] = useMemo(() => {
        return imageAttachments.map(a => ({
            src: (a as { previewUrl?: string }).previewUrl!,
            alt: a.name
        }))
    }, [imageAttachments])

    const previewSelectedIndex = useMemo(() => {
        if (!previewAttachmentId) return 0
        const idx = imageAttachments.findIndex(a => (a as { id?: string }).id === previewAttachmentId)
        return idx >= 0 ? idx : 0
    }, [previewAttachmentId, imageAttachments])

    const imagePreviewCtx = useMemo(() => ({
        openPreview: (id: string) => setPreviewAttachmentId(id)
    }), [])

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const prevControlledByUser = useRef(controlledByUser)
    const pendingSendAfterVoiceRef = useRef(false)

    useEffect(() => {
        setInputState((prev) => {
            if (prev.text === composerText) return prev
            // When syncing from composerText, update selection to end of text
            // This ensures activeWord detection works correctly
            const newPos = composerText.length
            return { text: composerText, selection: { start: newPos, end: newPos } }
        })
    }, [composerText])

    // Register STT transcript callback — sets final transcribed text in composer
    const composerTextRef = useRef(composerText)
    composerTextRef.current = composerText
    const preVoiceTextRef = useRef('')
    const voiceSessionPreparedRef = useRef(false)

    // Reset pre-voice text when composer is cleared (e.g. after sending)
    useEffect(() => {
        if (!composerText && voiceStatus === 'disconnected') {
            preVoiceTextRef.current = ''
        }
    }, [composerText, voiceStatus])

    useEffect(() => {
        if (voiceStatus === 'connected') {
            if (!voiceSessionPreparedRef.current) {
                preVoiceTextRef.current = composerTextRef.current
                voiceSessionPreparedRef.current = true
            }
            return
        }
        voiceSessionPreparedRef.current = false
    }, [voiceStatus])

    useEffect(() => {
        if (!onTranscript) return
        onTranscript((text: string) => {
            api.composer().setText(joinVoiceDraft(preVoiceTextRef.current, text))
            preVoiceTextRef.current = ''
        })
    }, [onTranscript, api])

    // Track one-time "continue" hint after switching from local to remote.
    useEffect(() => {
        if (prevControlledByUser.current === true && controlledByUser === false) {
            setShowContinueHint(true)
        }
        if (controlledByUser) {
            setShowContinueHint(false)
        }
        prevControlledByUser.current = controlledByUser
    }, [controlledByUser])

    const { haptic: platformHaptic, isTouch } = usePlatform()
    const { isStandalone, isIOS } = usePWAInstall()
    const isIOSPWA = isIOS && isStandalone
    const isVoiceFocusMode = voiceStatus !== 'disconnected'
    const voicePanelSizeClass = isVoiceFocusMode
        ? (isTouch ? 'min-h-[320px]' : 'min-h-[280px]')
        : (isTouch ? 'min-h-[160px]' : 'min-h-[140px]')
    const bottomPaddingClass = isIOSPWA ? 'pb-0' : 'pb-3'
    const activeWord = useActiveWord(inputState.text, inputState.selection, autocompletePrefixes)
    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeWord,
        autocompleteSuggestions,
        { clampSelection: true, wrapAround: true }
    )

    const haptic = useCallback((type: 'light' | 'success' | 'error' = 'light') => {
        if (type === 'light') {
            platformHaptic.impact('light')
        } else if (type === 'success') {
            platformHaptic.notification('success')
        } else {
            platformHaptic.notification('error')
        }
    }, [platformHaptic])

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (!suggestion || !textareaRef.current) return
        if (suggestion.text.startsWith('$')) {
            markSkillUsed(suggestion.text.slice(1))
        }

        // For Codex user prompts with content, expand the content instead of command name
        let textToInsert = suggestion.text
        let addSpace = true
        if (agentFlavor === 'codex' && suggestion.source === 'user' && suggestion.content) {
            textToInsert = suggestion.content
            addSpace = false
        }

        const result = applySuggestion(
            inputState.text,
            inputState.selection,
            textToInsert,
            autocompletePrefixes,
            addSpace
        )

        api.composer().setText(result.text)
        setInputState({
            text: result.text,
            selection: { start: result.cursorPosition, end: result.cursorPosition }
        })

        setTimeout(() => {
            const el = textareaRef.current
            if (!el) return
            el.setSelectionRange(result.cursorPosition, result.cursorPosition)
            try {
                el.focus({ preventScroll: true })
            } catch {
                el.focus()
            }
        }, 0)

        haptic('light')
    }, [api, suggestions, inputState, autocompletePrefixes, haptic, agentFlavor])

    const abortDisabled = controlsDisabled || isAborting || !threadIsRunning

    useEffect(() => {
        if (!isAborting) return
        if (threadIsRunning) return
        setIsAborting(false)
    }, [isAborting, threadIsRunning])

    const handleAbort = useCallback(() => {
        if (abortDisabled) return
        haptic('error')
        setIsAborting(true)
        api.thread().cancelRun()
    }, [abortDisabled, api, haptic])

    const permissionModeOptions = useMemo(
        () => getBasePermissionModeOptionsForFlavor(agentFlavor),
        [agentFlavor]
    )
    const permissionModes = useMemo(
        () => permissionModeOptions.map((option) => option.mode),
        [permissionModeOptions]
    )
    const modelModeSelectOptions = useMemo(
        () => MODEL_MODES.map((mode) => ({ value: mode, label: MODEL_MODE_LABELS[mode] })),
        []
    )
    const permissionSelectOptions = useMemo(
        () => permissionModeOptions.map((option) => ({ value: option.mode, label: option.label })),
        [permissionModeOptions]
    )
    const codexMessageMeta = useMemo<UserMessageMeta | undefined>(() => {
        if (!isCodexFamilyFlavor(agentFlavor) || !codexModel) {
            return undefined
        }

        return {
            model: codexModel,
            reasoningEffort: codexReasoningEffort
        }
    }, [agentFlavor, codexModel, codexReasoningEffort])

    const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        const key = e.key

        // Avoid intercepting IME composition keystrokes (Enter, arrows, etc.)
        if (e.nativeEvent.isComposing) {
            return
        }

        // In voice focus mode:
        // - Enter: exit voice input mode (instead of send)
        // - Escape: exit voice input mode
        if (voiceStatus !== 'disconnected' && (
            (key === 'Enter' && !e.shiftKey)
            || key === 'Escape'
        )) {
            e.preventDefault()
            pendingSendAfterVoiceRef.current = false
            if (voiceStatus === 'connected' && onVoiceToggle) {
                onVoiceToggle()
            }
            return
        }

        if (suggestions.length > 0) {
            if (key === 'ArrowUp') {
                e.preventDefault()
                moveUp()
                return
            }
            if (key === 'ArrowDown') {
                e.preventDefault()
                moveDown()
                return
            }
            if ((key === 'Enter' || key === 'Tab') && !e.shiftKey) {
                e.preventDefault()
                const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
                handleSuggestionSelect(indexToSelect)
                return
            }
            if (key === 'Escape') {
                e.preventDefault()
                clearSuggestions()
                return
            }
        }

        if (key === 'Escape' && threadIsRunning) {
            e.preventDefault()
            handleAbort()
            return
        }

        // When agent is running, intercept Enter to queue/interrupt
        if (key === 'Enter' && !e.shiftKey && threadIsRunning && onQueueSend && hasText && !sendDisabled) {
            e.preventDefault()
            if (e.metaKey || e.ctrlKey) {
                // Cmd/Ctrl+Enter = interrupt: queue current text, then abort (flush will send all)
                onQueueSend(trimmed, codexMessageMeta)
                api.composer().setText('')
                handleAbort()
            } else {
                // Plain Enter = auto-queue
                onQueueSend(trimmed, codexMessageMeta)
                api.composer().setText('')
            }
            setTimeout(() => textareaRef.current?.focus(), 0)
            return
        }

        // Empty input + has queued messages: Enter = flush queue now
        if (key === 'Enter' && !e.shiftKey && !hasText && hasQueue && onFlushQueue && !sendDisabled) {
            e.preventDefault()
            onFlushQueue()
            return
        }

        if (key === 'Tab' && e.shiftKey && onPermissionModeChange && permissionModes.length > 0) {
            e.preventDefault()
            const currentIndex = permissionModes.indexOf(basePermissionMode)
            const nextIndex = (currentIndex + 1) % permissionModes.length
            const nextMode = permissionModes[nextIndex] ?? 'default'
            onPermissionModeChange(nextMode)
            haptic('light')
        }
    }, [
        suggestions,
        selectedIndex,
        moveUp,
        moveDown,
        clearSuggestions,
        handleSuggestionSelect,
        threadIsRunning,
        handleAbort,
        onQueueSend,
        hasText,
        hasQueue,
        onFlushQueue,
        trimmed,
        codexMessageMeta,
        api,
        voiceStatus,
        onVoiceToggle,
        onPermissionModeChange,
        permissionMode,
        basePermissionMode,
        permissionModes,
        haptic,
        sendDisabled
    ])

    useEffect(() => {
        const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'm' && (e.metaKey || e.ctrlKey) && onModelModeChange && !isCodexFamilyFlavor(agentFlavor)) {
                e.preventDefault()
                const currentIndex = MODEL_MODES.indexOf(modelMode as typeof MODEL_MODES[number])
                const nextIndex = (currentIndex + 1) % MODEL_MODES.length
                onModelModeChange(MODEL_MODES[nextIndex])
                haptic('light')
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [modelMode, onModelModeChange, haptic, agentFlavor])

    const handleChange = useCallback((e: ReactChangeEvent<HTMLTextAreaElement>) => {
        // If user manually edits while voice is recording, stop voice input
        // to prevent accumulated transcript from overwriting their edits
        if (voiceStatus === 'connected' && onVoiceToggle) {
            onVoiceToggle({ discard: true })
        }
        const selection = {
            start: e.target.selectionStart,
            end: e.target.selectionEnd
        }
        setInputState({ text: e.target.value, selection })
    }, [voiceStatus, onVoiceToggle])

    const handleSelect = useCallback((e: ReactSyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement
        setInputState(prev => ({
            ...prev,
            selection: { start: target.selectionStart, end: target.selectionEnd }
        }))
    }, [])

    const handlePaste = useCallback(async (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData?.files || [])
        const imageFiles = files.filter(file => file.type.startsWith('image/'))

        if (imageFiles.length === 0) return

        e.preventDefault()

        try {
            for (const file of imageFiles) {
                await api.composer().addAttachment(file)
            }
        } catch (error) {
            console.error('Error adding pasted image:', error)
        }
    }, [api])

    const handleSubmit = useCallback((event?: ReactFormEvent<HTMLFormElement>) => {
        if (event && voiceStatus !== 'disconnected') {
            event.preventDefault()
            pendingSendAfterVoiceRef.current = false
            if (voiceStatus === 'connected' && onVoiceToggle) {
                onVoiceToggle()
            }
            return
        }
        if (event && sendDisabled) {
            event.preventDefault()
            return
        }
        if (event && !attachmentsReady) {
            event.preventDefault()
            return
        }
        setShowContinueHint(false)
    }, [attachmentsReady, onVoiceToggle, sendDisabled, voiceStatus])

    const handlePermissionChange = useCallback((mode: string) => {
        if (!onPermissionModeChange || controlsDisabled) return
        onPermissionModeChange(mode as PermissionMode)
        haptic('light')
    }, [onPermissionModeChange, controlsDisabled, haptic])

    const handleModelChange = useCallback((mode: string) => {
        if (!onModelModeChange || controlsDisabled) return
        onModelModeChange(mode as ModelMode)
        haptic('light')
    }, [onModelModeChange, controlsDisabled, haptic])

    const handleCodexModelChange = useCallback((model: string) => {
        if (!onCodexModelChange || controlsDisabled) return
        onCodexModelChange(model)
        haptic('light')
    }, [onCodexModelChange, controlsDisabled, haptic])

    const handleCodexReasoningEffortChange = useCallback((effort: string) => {
        if (!onCodexReasoningEffortChange || controlsDisabled) return
        onCodexReasoningEffortChange(effort as CodexReasoningEffort)
        haptic('light')
    }, [onCodexReasoningEffortChange, controlsDisabled, haptic])

    const showPermissionSettings = Boolean(onPermissionModeChange && permissionModeOptions.length > 0)
    const showModelSettings = Boolean(onModelModeChange && !isCodexFamilyFlavor(agentFlavor))
    const showCodexModelSettings = Boolean(isCodexFamilyFlavor(agentFlavor) && codexModel && codexModelOptions.length > 0)
    const showCodexReasoningSettings = Boolean(showCodexModelSettings && codexReasoningEffort && codexReasoningOptions.length > 0)
    const showAbortButton = threadIsRunning && !hasText && !hasQueue
    const voiceEnabled = Boolean(onVoiceToggle)

    const sendNow = useCallback(() => {
        if (sendDisabled) {
            return
        }
        if (!hasText && !hasAttachments && !hasQueue) {
            return
        }
        // Empty input + has queue: flush now
        if (!hasText && hasQueue && onFlushQueue) {
            onFlushQueue()
            return
        }
        if (threadIsRunning && onQueueSend) {
            // Auto-queue: enqueue the text and clear composer
            onQueueSend(trimmed, codexMessageMeta)
            api.composer().setText('')
            setTimeout(() => textareaRef.current?.focus(), 0)
            return
        }
        api.composer().send()
        setTimeout(() => textareaRef.current?.focus(), 0)
    }, [api, threadIsRunning, onQueueSend, trimmed, codexMessageMeta, hasText, hasAttachments, hasQueue, onFlushQueue, sendDisabled])

    const handleClear = useCallback(() => {
        if (voiceStatus === 'connected' && onVoiceToggle) {
            onVoiceToggle({ discard: true })
        }
        pendingSendAfterVoiceRef.current = false
        preVoiceTextRef.current = ''
        api.composer().setText('')
        setTimeout(() => textareaRef.current?.focus(), 0)
    }, [api, onVoiceToggle, voiceStatus])

    const handleSend = useCallback(() => {
        if (voiceStatus !== 'disconnected') {
            pendingSendAfterVoiceRef.current = true
            if (voiceStatus === 'connected' && onVoiceToggle) {
                onVoiceToggle()
            }
            return
        }
        sendNow()
    }, [voiceStatus, onVoiceToggle, sendNow])

    useEffect(() => {
        if (!pendingSendAfterVoiceRef.current) return
        if (voiceStatus !== 'disconnected') return

        pendingSendAfterVoiceRef.current = false
        sendNow()
    }, [voiceStatus, sendNow])

    const overlays = useMemo(() => {
        if (suggestions.length > 0) {
            return (
                <div className="absolute bottom-[100%] mb-2 w-full">
                    <FloatingOverlay>
                        <Autocomplete
                            suggestions={suggestions}
                            selectedIndex={selectedIndex}
                            onSelect={(index) => handleSuggestionSelect(index)}
                        />
                    </FloatingOverlay>
                </div>
            )
        }

        return null
    }, [suggestions, selectedIndex, handleSuggestionSelect])

    const correctionPreviewText = voiceCorrectionUnavailable
        ? voiceRawText
        : (voiceCorrectedText || voiceRawText)

    return (
        <div className={`px-3 ${bottomPaddingClass} pt-2 bg-[var(--app-bg)]`}>
            <div className="mx-auto w-full max-w-content">
                <ComposerPrimitive.Root className="relative" onSubmit={handleSubmit}>
                    {overlays}

                    <StatusBar
                        active={active}
                        thinking={thinking}
                        agentState={agentState}
                        contextSize={contextSize}
                        modelMode={modelMode}
                        voiceStatus={voiceStatus}
                    />

                    <div className={`overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)] transition-[min-height,box-shadow] duration-200 ease-out ${voicePanelSizeClass} ${isVoiceFocusMode ? 'shadow-[0_14px_36px_rgba(15,23,42,0.12)]' : ''}`}>
                        {isVoiceFocusMode ? (
                            <div className="flex h-full min-h-0 flex-col">
                                <div className="min-h-0 flex-1 px-3 pt-3 pb-2">
                                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]">
                                        <div className="min-h-0 flex-1 p-3">
                                            <div className="mb-2 flex items-center justify-between text-xs text-[var(--app-hint)]">
                                                <span>原始实时录入</span>
                                                <span>{voiceStatus === 'connected' ? '识别中' : '收尾中'}</span>
                                            </div>
                                            <div className="h-full max-h-full overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--app-fg)]">
                                                {voiceRawText || '...'}
                                            </div>
                                        </div>

                                        <div className="h-px bg-[var(--app-border)]" />

                                        <div className="min-h-0 flex-1 p-3">
                                            <div className="mb-2 flex items-center justify-between text-xs text-[var(--app-hint)]">
                                                <span>{voiceCorrectionUnavailable ? '修正区（已降级为原文）' : '实时修正'}</span>
                                                {voiceCorrectionUnavailable ? (
                                                    <span className="text-[var(--app-orange-base)]">不可用</span>
                                                ) : null}
                                            </div>
                                            {voiceCorrectionUnavailable ? (
                                                <div className="mb-2 rounded-md border border-[var(--app-orange-base)]/40 bg-[var(--app-orange-base)]/10 px-2 py-1 text-xs text-[var(--app-orange-base)]">
                                                    未检测到语音修正 API 配置，实时修正功能不可用。
                                                </div>
                                            ) : null}
                                            <div className="h-full max-h-full overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--app-fg)]">
                                                {correctionPreviewText || '...'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {voiceError ? (
                                    <div className="px-3 pb-2 text-xs text-red-500">
                                        {voiceError}
                                    </div>
                                ) : null}

                                <ComposerButtons
                                    canSend={canSend}
                                    controlsDisabled={controlsDisabled}
                                    showModelSelect={showModelSettings}
                                    modelMode={modelMode}
                                    modelModeOptions={modelModeSelectOptions}
                                    onModelModeChange={handleModelChange}
                                    showCodexModelSelect={showCodexModelSettings}
                                    codexModel={codexModel ?? ''}
                                    codexModelOptions={codexModelOptions}
                                    onCodexModelChange={handleCodexModelChange}
                                    showCodexReasoningSelect={showCodexReasoningSettings}
                                    codexReasoningEffort={codexReasoningEffort ?? 'medium'}
                                    codexReasoningOptions={codexReasoningOptions}
                                    onCodexReasoningEffortChange={handleCodexReasoningEffortChange}
                                    showPermissionSelect={showPermissionSettings}
                                    permissionMode={basePermissionMode}
                                    permissionModeOptions={permissionSelectOptions}
                                    onPermissionModeChange={handlePermissionChange}
                                    showPlanToggle={showPlanToggle}
                                    isPlanActive={isPlan}
                                    onPlanToggle={onPlanToggle ?? (() => {})}
                                    showAbortButton={showAbortButton}
                                    abortDisabled={abortDisabled}
                                    isAborting={isAborting}
                                    onAbort={handleAbort}
                                    showCopyButton={!isTouch}
                                    inputText={correctionPreviewText || composerText}
                                    voiceEnabled={voiceEnabled}
                                    voiceStatus={voiceStatus}
                                    voiceMicMuted={voiceMicMuted}
                                    onVoiceToggle={onVoiceToggle ?? (() => {})}
                                    onVoiceMicToggle={onVoiceMicToggle}
                                    canClear={hasText}
                                    onClear={handleClear}
                                    onSend={handleSend}
                                    hasQueue={hasQueue}
                                    onFlush={onFlushQueue}
                                />
                            </div>
                        ) : (
                            <>
                                {attachments.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 px-4 pt-3">
                                        <ComposerImagePreviewContext.Provider value={imagePreviewCtx}>
                                            <ComposerPrimitive.Attachments components={{ Attachment: AttachmentItem }} />
                                        </ComposerImagePreviewContext.Provider>
                                    </div>
                                ) : null}

                                <div className="flex items-center px-4 py-3">
                                    <ComposerPrimitive.Input
                                        ref={textareaRef}
                                        autoFocus={!controlsDisabled && !isTouch}
                                        placeholder={controlledByUser ? t('composer.controlledByTerminal') : showContinueHint ? t('misc.typeMessage') : t('misc.typeAMessage')}
                                        disabled={controlsDisabled}
                                        maxRows={5}
                                        submitOnEnter={!isTouch}
                                        cancelOnEscape={false}
                                        onChange={handleChange}
                                        onSelect={handleSelect}
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                        className="flex-1 resize-none bg-transparent text-base leading-snug text-[var(--app-fg)] placeholder-[var(--app-hint)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>

                                <ComposerButtons
                                    canSend={canSend}
                                    controlsDisabled={controlsDisabled}
                                    showModelSelect={showModelSettings}
                                    modelMode={modelMode}
                                    modelModeOptions={modelModeSelectOptions}
                                    onModelModeChange={handleModelChange}
                                    showCodexModelSelect={showCodexModelSettings}
                                    codexModel={codexModel ?? ''}
                                    codexModelOptions={codexModelOptions}
                                    onCodexModelChange={handleCodexModelChange}
                                    showCodexReasoningSelect={showCodexReasoningSettings}
                                    codexReasoningEffort={codexReasoningEffort ?? 'medium'}
                                    codexReasoningOptions={codexReasoningOptions}
                                    onCodexReasoningEffortChange={handleCodexReasoningEffortChange}
                                    showPermissionSelect={showPermissionSettings}
                                    permissionMode={basePermissionMode}
                                    permissionModeOptions={permissionSelectOptions}
                                    onPermissionModeChange={handlePermissionChange}
                                    showPlanToggle={showPlanToggle}
                                    isPlanActive={isPlan}
                                    onPlanToggle={onPlanToggle ?? (() => {})}
                                    showAbortButton={showAbortButton}
                                    abortDisabled={abortDisabled}
                                    isAborting={isAborting}
                                    onAbort={handleAbort}
                                    showCopyButton={!isTouch}
                                    inputText={composerText}
                                    voiceEnabled={voiceEnabled}
                                    voiceStatus={voiceStatus}
                                    voiceMicMuted={voiceMicMuted}
                                    onVoiceToggle={onVoiceToggle ?? (() => {})}
                                    onVoiceMicToggle={onVoiceMicToggle}
                                    canClear={hasText}
                                    onClear={handleClear}
                                    onSend={handleSend}
                                    hasQueue={hasQueue}
                                    onFlush={onFlushQueue}
                                />
                            </>
                        )}
                    </div>
                </ComposerPrimitive.Root>

                {previewAttachmentId && previewImages.length > 0 && (
                    <ImagePreviewModal
                        open={!!previewAttachmentId}
                        onOpenChange={(open) => { if (!open) setPreviewAttachmentId(null) }}
                        images={previewImages}
                        selectedIndex={previewSelectedIndex}
                        onSelectedIndexChange={(i) => {
                            const att = imageAttachments[i]
                            if (att) setPreviewAttachmentId((att as { id?: string }).id ?? null)
                        }}
                    />
                )}
            </div>
        </div>
    )
}
