import { AssistantRuntimeProvider } from '@assistant-ui/react'
import {
    useCallback,
    useEffectEvent,
    useEffect,
    useMemo,
    useState,
    type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import type { ApiClient } from '@/api/client'
import { HappyComposer } from '@/components/AssistantChat/HappyComposer'
import { AgentFlavorStatusIcon } from '@/components/AgentFlavorStatusIcon'
import { PageHeaderUtilityControls } from '@/components/PageHeaderUtilityControls'
import { usePlatform } from '@/hooks/usePlatform'
import { useDirectorySuggestions } from '@/hooks/useDirectorySuggestions'
import { useActiveSuggestions, type Suggestion } from '@/hooks/useActiveSuggestions'
import { useRecentPaths } from '@/hooks/useRecentPaths'
import { useSpawnSession } from '@/hooks/mutations/useSpawnSession'
import { useAgentModels } from '@/hooks/queries/useAgentModels'
import { useSlashCommands } from '@/hooks/queries/useSlashCommands'
import { useSkills } from '@/hooks/queries/useSkills'
import { useSessions } from '@/hooks/queries/useSessions'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useHappyRuntime } from '@/lib/assistant-runtime'
import { createDraftAttachmentAdapter } from '@/lib/draftAttachments'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from '@/lib/use-translation'
import type { AttachmentMetadata, Machine, PermissionMode, Session, UserMessageMeta } from '@/types/api'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import { isTelegramApp } from '@/hooks/useTelegram'
import type { AgentType, SessionType } from './types'
import { buildCodexModelOptions, getHighestCodexReasoningEffort } from './types'
import {
    loadPreferredAgent,
    loadPreferredDirectory,
    loadPreferredModel,
    loadPreferredPermissionMode,
    loadPreferredPlanActive,
    loadPreferredSessionType,
    savePreferredAgent,
    savePreferredDirectory,
    savePreferredModel,
    savePreferredPermissionMode,
    savePreferredPlanActive,
    savePreferredSessionType,
} from './preferences'
import { setPendingSessionMode } from '@/lib/pending-session-mode-store'
import {
    buildClaudeComposerModelOptions,
    isClaudePresetModel,
    loadClaudeCustomModelValue,
    normalizeClaudeModelValue
} from '@/lib/claudeModels'

function BackIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
        </svg>
    )
}

function ChevronDownIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}

function FolderIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
            <path d="M2 10h20" />
        </svg>
    )
}

function DesktopIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8" />
            <path d="M12 16v4" />
        </svg>
    )
}

function LayersIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="translate-y-px"
        >
            <path d="m12 3-8 4 8 4 8-4-8-4Z" />
            <path d="m4 11 8 4 8-4" />
            <path d="m4 15 8 4 8-4" />
        </svg>
    )
}

function getMachineTitle(machine: Machine | null | undefined): string {
    if (machine?.metadata?.displayName) return machine.metadata.displayName
    if (machine?.metadata?.host) return machine.metadata.host
    if (machine?.id) return machine.id.slice(0, 8)
    return ''
}

const EMPTY_AGENT_STATE = null
const EMPTY_CODEX_REASONING_OPTIONS: [] = []
const EMPTY_DRAFT_BLOCKS: [] = []


function PillSelect(props: {
    label: string
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    disabled?: boolean
    icon?: React.ReactNode
    minWidthClassName?: string
}) {
    return (
        <div className={`flex h-8 min-w-0 items-center gap-2 rounded-xl border border-[var(--app-panel-border)] bg-[var(--app-bg)] px-2.5 ${props.minWidthClassName ?? 'min-w-[144px]'}`}>
            {props.icon ? (
                <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--app-hint)]"
                    title={props.label}
                    aria-label={props.label}
                >
                    {props.icon}
                </span>
            ) : null}
            <div className="relative min-w-0 flex-1">
                <select
                    value={props.value}
                    onChange={(event) => props.onChange(event.target.value)}
                    disabled={props.disabled}
                    className="h-full w-full min-w-0 appearance-none bg-transparent pr-4 text-[13px] leading-none text-[var(--app-fg)] outline-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {props.options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--app-hint)]">
                    <ChevronDownIcon />
                </span>
            </div>
        </div>
    )
}

function DraftHeader(props: {
    title: string
    onBack: () => void
    isDark: boolean
    onToggleTheme: () => void
    onOpenSettings?: () => void
}) {
    const shouldShowBack = !isTelegramApp()

    return (
        <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex h-[49px] w-full max-w-content items-center border-b border-[var(--app-border)] px-3">
                {shouldShowBack ? (
                    <button
                        type="button"
                        onClick={props.onBack}
                        className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-fg)] transition-colors lg:hidden"
                    >
                        <BackIcon />
                    </button>
                ) : null}
                <div className="min-w-0 flex-1 font-semibold text-[var(--app-fg)]">
                    {props.title}
                </div>
                <PageHeaderUtilityControls
                    isDark={props.isDark}
                    onToggleTheme={props.onToggleTheme}
                    onOpenSettings={props.onOpenSettings}
                    useFallbackSettingsEvent
                />
            </div>
        </div>
    )
}

export function NewSession(props: {
    api: ApiClient
    machines: Machine[]
    isLoading?: boolean
    loadError?: string | null
    onSuccess: (
        sessionId: string,
        options?: {
            initialMessage?: string
            attachments?: AttachmentMetadata[]
            meta?: UserMessageMeta
        }
    ) => void
    onCancel: () => void
    onOpenSettings?: () => void
}) {
    const { t } = useTranslation()
    const { haptic } = usePlatform()
    const { isDark, toggleTheme } = useTheme()
    const { spawnSession, isPending, error: spawnError } = useSpawnSession(props.api)
    const { sessions } = useSessions(props.api)
    const { getRecentPaths, addRecentPath, getLastUsedMachineId, setLastUsedMachineId } = useRecentPaths()
    const preferredAgent = loadPreferredAgent()
    const preferredModel = normalizeClaudeModelValue(loadPreferredModel())
    const isFormDisabled = Boolean(isPending || props.isLoading)

    const [machineId, setMachineId] = useState<string | null>(null)
    const [directory, setDirectory] = useState(loadPreferredDirectory)
    const [suppressSuggestions, setSuppressSuggestions] = useState(false)
    const [isDirectoryFocused, setIsDirectoryFocused] = useState(false)
    const [pathExistence, setPathExistence] = useState<Record<string, boolean>>({})
    const [agent, setAgent] = useState<AgentType>(preferredAgent)
    const [model, setModel] = useState(() => preferredModel ?? 'opus')
    const [basePermissionMode, setBasePermissionMode] = useState<PermissionMode>(() => loadPreferredPermissionMode(preferredAgent))
    const [isPlanActive, setIsPlanActive] = useState<boolean>(loadPreferredPlanActive)
    const [sessionType, setSessionType] = useState<SessionType>(loadPreferredSessionType)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setBasePermissionMode(agent === 'codex' ? 'yolo' : 'bypassPermissions')
    }, [agent])

    useEffect(() => {
        savePreferredAgent(agent)
    }, [agent])

    useEffect(() => {
        savePreferredPermissionMode(basePermissionMode)
    }, [basePermissionMode])

    useEffect(() => {
        savePreferredPlanActive(isPlanActive)
    }, [isPlanActive])

    useEffect(() => {
        savePreferredDirectory(directory)
    }, [directory])

    useEffect(() => {
        savePreferredModel(model)
    }, [model])

    useEffect(() => {
        savePreferredSessionType(sessionType)
    }, [sessionType])

    useEffect(() => {
        if (props.machines.length === 0) return
        if (machineId && props.machines.find((machine) => machine.id === machineId)) return

        const lastUsed = getLastUsedMachineId()
        const foundLast = lastUsed ? props.machines.find((machine) => machine.id === lastUsed) : null

        if (foundLast) {
            setMachineId(foundLast.id)
        } else if (props.machines[0]) {
            setMachineId(props.machines[0].id)
        }
    }, [getLastUsedMachineId, machineId, props.machines])

    const { data: agentModelsData } = useAgentModels(props.api, machineId, agent)

    const codexModelOptions = useMemo(
        () => buildCodexModelOptions(agentModelsData?.models),
        [agentModelsData?.models]
    )
    const preferredClaudeCustomModel = useMemo(
        () => normalizeClaudeModelValue(loadClaudeCustomModelValue()),
        []
    )
    const activeClaudeCustomModel = useMemo(() => {
        if (
            agent === 'claude' &&
            preferredModel
            && !isClaudePresetModel(preferredModel)
            && preferredModel !== 'custom'
            && !preferredModel.startsWith('gpt-')
        ) {
            return preferredModel
        }
        return preferredClaudeCustomModel
    }, [agent, preferredClaudeCustomModel, preferredModel])

    const modelOptions = useMemo(
        () => agent === 'codex'
            ? codexModelOptions.map((entry) => ({ value: entry.value, label: entry.label }))
            : buildClaudeComposerModelOptions(activeClaudeCustomModel),
        [agent, codexModelOptions, activeClaudeCustomModel]
    )

    useEffect(() => {
        if (modelOptions.length === 0) {
            if (model !== (agent === 'codex' ? 'gpt-5.4' : 'opus')) {
                setModel(agent === 'codex' ? 'gpt-5.4' : 'opus')
            }
            return
        }

        const exists = modelOptions.some((option) => option.value === model)
        if (!exists) {
            setModel(agent === 'codex' ? 'gpt-5.4' : 'opus')
        }
    }, [agent, model, modelOptions])

    const recentPaths = useMemo(
        () => getRecentPaths(machineId),
        [getRecentPaths, machineId]
    )

    const allPaths = useDirectorySuggestions(machineId, sessions, recentPaths)

    const pathsToCheck = useMemo(
        () => Array.from(new Set(allPaths)).slice(0, 1000),
        [allPaths]
    )

    useEffect(() => {
        let cancelled = false

        if (!machineId || pathsToCheck.length === 0) {
            setPathExistence((current) => Object.keys(current).length === 0 ? current : {})
            return () => {
                cancelled = true
            }
        }

        void props.api.checkMachinePathsExists(machineId, pathsToCheck)
            .then((result) => {
                if (cancelled) return
                setPathExistence(result.exists ?? {})
            })
            .catch(() => {
                if (cancelled) return
                setPathExistence({})
            })

        return () => {
            cancelled = true
        }
    }, [machineId, pathsToCheck, props.api])

    const verifiedPaths = useMemo(
        () => allPaths.filter((path) => pathExistence[path]),
        [allPaths, pathExistence]
    )

    const getSuggestions = useCallback(async (query: string): Promise<Suggestion[]> => {
        const lowered = query.toLowerCase()
        return verifiedPaths
            .filter((path) => path.toLowerCase().includes(lowered))
            .slice(0, 8)
            .map((path) => ({
                key: path,
                text: path,
                label: path
            }))
    }, [verifiedPaths])

    const activeQuery = (!isDirectoryFocused || suppressSuggestions) ? null : directory

    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeQuery,
        getSuggestions,
        { allowEmptyQuery: true, autoSelectFirst: false }
    )

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (!suggestion) {
            return
        }

        setDirectory(suggestion.text)
        clearSuggestions()
        setSuppressSuggestions(true)
    }, [clearSuggestions, suggestions])

    const handleDirectoryKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) {
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            moveUp()
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            moveDown()
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
            if (selectedIndex >= 0) {
                event.preventDefault()
                handleSuggestionSelect(selectedIndex)
            }
        }

        if (event.key === 'Escape') {
            clearSuggestions()
        }
    }, [clearSuggestions, handleSuggestionSelect, moveDown, moveUp, selectedIndex, suggestions.length])

    const selectedMachine = useMemo(
        () => props.machines.find((machine) => machine.id === machineId) ?? null,
        [machineId, props.machines]
    )
    const agentOptions = useMemo(() => ([
        {
            value: 'claude',
            label: 'Claude',
            icon: <AgentFlavorStatusIcon flavor="claude" active sizeClassName="h-3.5 w-3.5" />
        },
        {
            value: 'codex',
            label: 'Codex',
            icon: <AgentFlavorStatusIcon flavor="codex" active sizeClassName="h-3.5 w-3.5" />
        },
    ]), [])

    const machineOptions = useMemo(
        () => {
            if (props.isLoading) {
                return [{ value: '', label: t('loading.machines') }]
            }
            if (props.machines.length === 0) {
                return [{ value: '', label: t('misc.noMachines') }]
            }

            return props.machines.map((machine) => ({
                value: machine.id,
                label: getMachineTitle(machine)
            }))
        },
        [props.isLoading, props.machines, t]
    )

    const stt = useVoiceInput(props.api)
    const sttVoiceStatus = stt.status === 'recording'
        ? 'connected' as const
        : stt.status === 'transcribing'
            ? 'connecting' as const
            : 'disconnected' as const
    const { getSuggestions: getSlashSuggestions } = useSlashCommands(props.api, null, agent)
    const { getSuggestions: getSkillSuggestions } = useSkills(props.api, null)
    const getAutocompleteSuggestions = useCallback(async (query: string) => {
        if (query.startsWith('$')) {
            return await getSkillSuggestions(query)
        }
        return await getSlashSuggestions(query)
    }, [getSkillSuggestions, getSlashSuggestions])
    const effectivePermissionMode = useMemo<PermissionMode>(
        () => isPlanActive ? 'plan' : basePermissionMode,
        [basePermissionMode, isPlanActive]
    )
    const claudeComposerModelOptions = useMemo(
        () => buildClaudeComposerModelOptions(activeClaudeCustomModel),
        [activeClaudeCustomModel]
    )
    const composerCodexModel = useMemo(
        () => {
            if (agent !== 'codex') {
                return null
            }

            if (model) {
                return model
            }

            return codexModelOptions.find((entry) => entry.isDefault)?.value
                ?? codexModelOptions[0]?.value
                ?? null
        },
        [agent, codexModelOptions, model]
    )
    const selectedComposerCodexModel = useMemo(
        () => codexModelOptions.find((entry) => entry.value === composerCodexModel) ?? null,
        [codexModelOptions, composerCodexModel]
    )
    const composerCodexReasoningEffort = useMemo(
        () => {
            if (agent !== 'codex' || !selectedComposerCodexModel) {
                return null
            }

            return getHighestCodexReasoningEffort(selectedComposerCodexModel.supportedReasoningEfforts)
        },
        [agent, selectedComposerCodexModel]
    )
    const codexComposerModelOptions = useMemo(
        () => codexModelOptions.map((option) => ({
            value: option.value,
            label: option.label
        })),
        [codexModelOptions]
    )
    const canCreateBase = Boolean(machineId && directory.trim() && !props.loadError)
    const draftAttachmentAdapter = useMemo(
        () => createDraftAttachmentAdapter(),
        []
    )
    const draftModelValue = useMemo(
        () => {
            if (agent === 'codex') {
                return composerCodexModel ?? undefined
            }
            return model || undefined
        },
        [agent, composerCodexModel, model]
    )
    const getInitialMessageMeta = useCallback((): UserMessageMeta | undefined => {
        if (agent === 'codex' && composerCodexModel) {
            return {
                model: composerCodexModel,
                reasoningEffort: composerCodexReasoningEffort ?? undefined
            }
        }

        if (agent === 'claude') {
            return {
                model: model || null
            }
        }

        return undefined
    }, [agent, composerCodexModel, composerCodexReasoningEffort, model])
    const handleAgentChange = useCallback((value: string) => {
        setAgent(value as AgentType)
    }, [])
    const handlePlanToggle = useCallback(() => {
        setIsPlanActive((current) => !current)
    }, [])
    const handleCodexModelChange = useCallback((nextModel: string) => {
        setModel(nextModel)
    }, [])

    const handleCreate = useCallback(async (payload?: {
        text?: string
        attachments?: AttachmentMetadata[]
        meta?: UserMessageMeta
    }) => {
        if (!machineId || !directory.trim()) {
            return
        }

        const trimmedInitialMessage = payload?.text?.trim() ?? ''
        setError(null)

        try {
            const resolvedModel = agent === 'codex'
                ? (composerCodexModel ?? undefined)
                : model !== 'auto'
                    ? model
                    : undefined
            const resolvedReasoningEffort = agent === 'codex'
                ? (composerCodexReasoningEffort ?? undefined)
                : undefined
            const requestedPermissionMode = isPlanActive
                ? 'plan'
                : (agent === 'codex' ? 'yolo' : 'bypassPermissions')

            const result = await spawnSession({
                machineId,
                directory: directory.trim(),
                agent,
                model: resolvedModel,
                reasoningEffort: resolvedReasoningEffort,
                permissionMode: requestedPermissionMode,
                basePermissionMode,
                sessionType
            })

            if (result.type !== 'success') {
                haptic.notification('error')
                setError(result.message)
                return
            }

            haptic.notification('success')
            setLastUsedMachineId(machineId)
            addRecentPath(machineId, directory.trim())
            setPendingSessionMode(result.sessionId, {
                permissionMode: requestedPermissionMode,
                basePermissionMode
            })
            props.onSuccess(
                result.sessionId,
                trimmedInitialMessage || payload?.attachments?.length
                    ? {
                        initialMessage: trimmedInitialMessage || undefined,
                        attachments: payload?.attachments,
                        meta: payload?.meta
                    }
                    : undefined
            )
        } catch (nextError) {
            haptic.notification('error')
            setError(nextError instanceof Error ? nextError.message : 'Failed to create session')
        }
    }, [
        addRecentPath,
        agent,
        basePermissionMode,
        directory,
        haptic,
        isPlanActive,
        machineId,
        model,
        props,
        composerCodexModel,
        composerCodexReasoningEffort,
        sessionType,
        setLastUsedMachineId,
        spawnSession,
    ])

    const draftSession = useMemo<Session>(() => ({
        id: '__new-session__',
        namespace: 'draft',
        seq: 0,
        createdAt: 0,
        updatedAt: 0,
        active: true,
        activeAt: 0,
        metadata: {
            path: directory.trim() || '~',
            host: selectedMachine?.metadata?.host ?? '',
            machineId: machineId ?? undefined,
            flavor: agent,
            model: draftModelValue,
            reasoningEffort: agent === 'codex' ? (composerCodexReasoningEffort ?? undefined) : undefined
        },
        metadataVersion: 0,
        agentState: null,
        agentStateVersion: 0,
        thinking: false,
        thinkingAt: 0,
        permissionMode: effectivePermissionMode,
        basePermissionMode,
        modelMode: 'default'
    }), [
        agent,
        basePermissionMode,
        composerCodexReasoningEffort,
        directory,
        effectivePermissionMode,
        draftModelValue,
        machineId,
        selectedMachine?.metadata?.host,
    ])

    const runtime = useHappyRuntime({
        session: draftSession,
        blocks: EMPTY_DRAFT_BLOCKS,
        isSending: isPending,
        onSendMessage: useEffectEvent((text, attachments, meta) => {
            if (!canCreateBase || isPending) {
                return
            }
            void handleCreate({ text, attachments, meta })
        }),
        onAbort: useEffectEvent(async () => {}),
        attachmentAdapter: draftAttachmentAdapter,
        allowSendWhenInactive: true,
        getMessageMeta: getInitialMessageMeta
    })

    const errorMessage = error ?? spawnError ?? props.loadError ?? null

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            <DraftHeader
                title={t('newSession.title')}
                onBack={props.onCancel}
                isDark={isDark}
                onToggleTheme={toggleTheme}
                onOpenSettings={props.onOpenSettings}
            />

            <AssistantRuntimeProvider runtime={runtime}>
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 overflow-y-auto">
                        <div className="mx-auto flex w-full max-w-content flex-1 flex-col px-3">
                            <div className="flex flex-1 items-center justify-center py-8">
                                <div className="w-full max-w-[680px]">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                                            <AgentFlavorStatusIcon
                                                flavor={agent}
                                                active
                                                sizeClassName="h-12 w-12"
                                            />
                                        </div>

                                        <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.02em] text-[var(--app-fg)] sm:text-[32px]">
                                            {t('newSession.empty.title')}
                                        </h1>
                                        <p className="mt-1.5 w-full max-w-[460px] overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-6 text-[var(--app-hint)]">
                                            {t('newSession.empty.subtitle')}
                                        </p>
                                    </div>

                                    <div className="mt-5 overflow-visible rounded-[20px] border border-[var(--app-panel-border)] bg-[var(--app-secondary-bg)] text-left">
                                        <div className="border-b border-[var(--app-panel-border)] px-4 py-2.5">
                                            <div className="flex flex-nowrap items-center gap-2">
                                                <div className="w-[128px] shrink-0">
                                                    <PillSelect
                                                        label={t('newSession.machine')}
                                                        value={machineId ?? ''}
                                                        options={machineOptions}
                                                        onChange={setMachineId}
                                                        disabled={isFormDisabled || machineOptions.length === 0}
                                                        icon={<DesktopIcon />}
                                                        minWidthClassName="min-w-0"
                                                    />
                                                </div>

                                                <div className="relative min-w-0 flex-1">
                                                    <div className="flex h-8 min-w-0 items-center gap-2 rounded-xl border border-[var(--app-panel-border)] bg-[var(--app-bg)] px-2.5">
                                                        <span
                                                            className="shrink-0 text-[var(--app-hint)]"
                                                            title={t('newSession.directory')}
                                                            aria-label={t('newSession.directory')}
                                                        >
                                                            <FolderIcon />
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={directory}
                                                            onChange={(event) => {
                                                                setSuppressSuggestions(false)
                                                                setDirectory(event.target.value)
                                                            }}
                                                            onFocus={() => {
                                                                setSuppressSuggestions(false)
                                                                setIsDirectoryFocused(true)
                                                            }}
                                                            onBlur={() => setIsDirectoryFocused(false)}
                                                            onKeyDown={handleDirectoryKeyDown}
                                                            disabled={isFormDisabled}
                                                            placeholder={t('newSession.placeholder')}
                                                            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--app-fg)] outline-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                    </div>

                                                    {suggestions.length > 0 ? (
                                                        <div className="absolute left-0 right-0 top-full z-20 mt-2">
                                                            <FloatingOverlay maxHeight={220}>
                                                                <Autocomplete
                                                                    suggestions={suggestions}
                                                                    selectedIndex={selectedIndex}
                                                                    onSelect={handleSuggestionSelect}
                                                                />
                                                            </FloatingOverlay>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="w-[120px] shrink-0">
                                                    <PillSelect
                                                        label={t('newSession.type')}
                                                        value={sessionType}
                                                        options={[
                                                            { value: 'simple', label: t('newSession.type.simple') },
                                                            { value: 'worktree', label: t('newSession.type.worktree') }
                                                        ]}
                                                        onChange={(value) => setSessionType(value as SessionType)}
                                                        disabled={isFormDisabled}
                                                        icon={<LayersIcon />}
                                                        minWidthClassName="min-w-0"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <HappyComposer
                                            embedded
                                            disabled={isPending}
                                            sendDisabled={!canCreateBase}
                                            permissionMode={effectivePermissionMode}
                                            basePermissionMode={basePermissionMode}
                                            modelMode="default"
                                            active
                                            allowSendWhenInactive
                                            agentState={EMPTY_AGENT_STATE}
                                            agentFlavor={agent}
                                            agent={agent}
                                            agentOptions={agentOptions}
                                            onAgentChange={handleAgentChange}
                                            onPermissionModeChange={undefined}
                                            onPlanToggle={handlePlanToggle}
                                            claudeModel={agent === 'claude' ? model : null}
                                            claudeModelOptions={agent === 'claude' ? claudeComposerModelOptions : []}
                                            onClaudeModelChange={agent === 'claude' ? setModel : undefined}
                                            codexModel={agent === 'codex' ? composerCodexModel : null}
                                            codexModelOptions={agent === 'codex' ? codexComposerModelOptions : []}
                                            codexReasoningEffort={agent === 'codex' ? composerCodexReasoningEffort : null}
                                            codexReasoningOptions={EMPTY_CODEX_REASONING_OPTIONS}
                                            onCodexModelChange={agent === 'codex' ? handleCodexModelChange : undefined}
                                            onCodexReasoningEffortChange={undefined}
                                            autocompleteSuggestions={getAutocompleteSuggestions}
                                            voiceStatus={sttVoiceStatus}
                                            voiceRawText={stt.rawText}
                                            voiceCorrectedText={stt.correctedText}
                                            voiceError={stt.error}
                                            voiceCorrectionUnavailable={stt.correctionAvailability === 'unavailable'}
                                            onVoiceToggle={stt.toggle}
                                            onTranscript={stt.setOnTranscript}
                                        />
                                    </div>

                                    {errorMessage ? (
                                        <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
                                            {errorMessage}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </AssistantRuntimeProvider>
        </div>
    )
}
