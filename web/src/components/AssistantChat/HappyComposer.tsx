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
import type { AgentState, ModelMode, PermissionMode } from '@/types/api'
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
import { AttachmentItem } from '@/components/AssistantChat/AttachmentItem'
import { useTranslation } from '@/lib/use-translation'

export interface TextInputState {
    text: string
    selection: { start: number; end: number }
}

const defaultSuggestionHandler = async (): Promise<Suggestion[]> => []

export function HappyComposer(props: {
    disabled?: boolean
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
    onSwitchToRemote?: () => void
    autocompletePrefixes?: string[]
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    // Voice assistant props
    voiceStatus?: ConversationStatus
    voiceMicMuted?: boolean
    onVoiceToggle?: () => void
    onVoiceMicToggle?: () => void
    onTranscript?: (cb: (text: string) => void) => void
    onInterim?: (cb: (text: string) => void) => void
}) {
    const { t } = useTranslation()
    const {
        disabled = false,
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
        autocompletePrefixes = ['@', '/', '$'],
        autocompleteSuggestions = defaultSuggestionHandler,
        voiceStatus = 'disconnected',
        voiceMicMuted = false,
        onVoiceToggle,
        onVoiceMicToggle,
        onTranscript,
        onInterim
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
    const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && !threadIsRunning

    const [inputState, setInputState] = useState<TextInputState>({
        text: '',
        selection: { start: 0, end: 0 }
    })
    const [isAborting, setIsAborting] = useState(false)
    const [showContinueHint, setShowContinueHint] = useState(false)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const prevControlledByUser = useRef(controlledByUser)

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
    useEffect(() => {
        if (!onTranscript) return
        onTranscript((text: string) => {
            api.composer().setText(preVoiceTextRef.current ? `${preVoiceTextRef.current} ${text}` : text)
            textareaRef.current?.focus()
        })
    }, [onTranscript, api])

    // Register STT interim callback — shows real-time partial text while speaking
    useEffect(() => {
        if (!onInterim) return
        onInterim((text: string) => {
            if (text) {
                // Save pre-voice text on first interim
                if (!preVoiceTextRef.current && composerTextRef.current) {
                    preVoiceTextRef.current = composerTextRef.current
                }
                api.composer().setText(preVoiceTextRef.current ? `${preVoiceTextRef.current} ${text}` : text)
                textareaRef.current?.focus()
            } else {
                // Interim cleared (recording stopped) — reset pre-voice text
                preVoiceTextRef.current = ''
            }
        })
    }, [onInterim, api])

    // Auto-focus textarea when voice recording starts
    useEffect(() => {
        if (voiceStatus === 'connected') {
            textareaRef.current?.focus()
        }
    }, [voiceStatus])

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

    const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        const key = e.key

        // Avoid intercepting IME composition keystrokes (Enter, arrows, etc.)
        if (e.nativeEvent.isComposing) {
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
        onPermissionModeChange,
        permissionMode,
        basePermissionMode,
        permissionModes,
        haptic
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
        const selection = {
            start: e.target.selectionStart,
            end: e.target.selectionEnd
        }
        setInputState({ text: e.target.value, selection })
    }, [])

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
        if (event && !attachmentsReady) {
            event.preventDefault()
            return
        }
        setShowContinueHint(false)
    }, [attachmentsReady])

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

    const showPermissionSettings = Boolean(onPermissionModeChange && permissionModeOptions.length > 0)
    const showModelSettings = Boolean(onModelModeChange && !isCodexFamilyFlavor(agentFlavor))
    const showAbortButton = threadIsRunning
    const voiceEnabled = Boolean(onVoiceToggle)

    const handleSend = useCallback(() => {
        api.composer().send()
    }, [api])

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

                    <div className="overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)]">
                        {attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2 px-4 pt-3">
                                <ComposerPrimitive.Attachments components={{ Attachment: AttachmentItem }} />
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
                            showQrButton={!isTouch}
                            voiceEnabled={voiceEnabled}
                            voiceStatus={voiceStatus}
                            voiceMicMuted={voiceMicMuted}
                            onVoiceToggle={onVoiceToggle ?? (() => {})}
                            onVoiceMicToggle={onVoiceMicToggle}
                            onSend={handleSend}
                        />
                    </div>
                </ComposerPrimitive.Root>
            </div>
        </div>
    )
}
