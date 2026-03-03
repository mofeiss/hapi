import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { getBasePermissionModesForFlavor, supportsPlanToggle } from '@hapi/protocol'
import type { ApiClient } from '@/api/client'
import type { Machine } from '@/types/api'
import { usePlatform } from '@/hooks/usePlatform'
import { useSpawnSession } from '@/hooks/mutations/useSpawnSession'
import { useSessions } from '@/hooks/queries/useSessions'
import { useAgentModels } from '@/hooks/queries/useAgentModels'
import { useActiveSuggestions, type Suggestion } from '@/hooks/useActiveSuggestions'
import { useDirectorySuggestions } from '@/hooks/useDirectorySuggestions'
import { useRecentPaths } from '@/hooks/useRecentPaths'
import type { CodexReasoningEffort } from '@/types/api'
import type { AgentType, SessionType } from './types'
import { buildCodexModelOptions, MODEL_OPTIONS } from './types'
import { ActionButtons } from './ActionButtons'
import { AgentSelector } from './AgentSelector'
import { DirectorySection } from './DirectorySection'
import { MachineSelector } from './MachineSelector'
import { ModelSelector } from './ModelSelector'
import {
    loadPreferredAgent,
    loadPreferredDirectory,
    loadPreferredModel,
    loadPreferredPermissionMode,
    loadPreferredPlanActive,
    loadPreferredReasoningEffort,
    loadPreferredSessionType,
    loadPreferredWorktreeName,
    savePreferredAgent,
    savePreferredDirectory,
    savePreferredModel,
    savePreferredPermissionMode,
    savePreferredPlanActive,
    savePreferredReasoningEffort,
    savePreferredSessionType,
    savePreferredWorktreeName,
} from './preferences'
import { setPendingSessionMode } from '@/lib/pending-session-mode-store'
import { SessionTypeSelector } from './SessionTypeSelector'
import { PermissionSelector } from './PermissionSelector'
import type { PermissionMode } from '@/types/api'
import {
    CLAUDE_CUSTOM_MODEL_OPTION_VALUE,
    getClaudeNewSessionModelOptions,
    isClaudePresetModel,
    loadClaudeCustomModelValue,
    normalizeClaudeModelValue,
    saveClaudeCustomModelValue
} from '@/lib/claudeModels'

export function NewSession(props: {
    api: ApiClient
    machines: Machine[]
    isLoading?: boolean
    onSuccess: (sessionId: string) => void
    onCancel: () => void
}) {
    const { haptic } = usePlatform()
    const { spawnSession, isPending, error: spawnError } = useSpawnSession(props.api)
    const { sessions } = useSessions(props.api)
    const isFormDisabled = Boolean(isPending || props.isLoading)
    const { getRecentPaths, addRecentPath, getLastUsedMachineId, setLastUsedMachineId } = useRecentPaths()
    const preferredAgent = loadPreferredAgent()
    const preferredModel = normalizeClaudeModelValue(loadPreferredModel())

    const [machineId, setMachineId] = useState<string | null>(null)
    const [directory, setDirectory] = useState(loadPreferredDirectory)
    const [suppressSuggestions, setSuppressSuggestions] = useState(false)
    const [isDirectoryFocused, setIsDirectoryFocused] = useState(false)
    const [pathExistence, setPathExistence] = useState<Record<string, boolean>>({})
    const [agent, setAgent] = useState<AgentType>(preferredAgent)
    const [model, setModel] = useState(() => {
        if (
            preferredAgent === 'claude'
            && preferredModel
            && !isClaudePresetModel(preferredModel)
            && preferredModel !== CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        ) {
            return CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        }
        return preferredModel ?? 'auto'
    })
    const [claudeCustomModelInput, setClaudeCustomModelInput] = useState(() => {
        if (
            preferredAgent === 'claude'
            && preferredModel
            && !isClaudePresetModel(preferredModel)
            && preferredModel !== CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        ) {
            return preferredModel
        }
        return loadClaudeCustomModelValue()
    })
    const [reasoningEffort, setReasoningEffort] = useState<CodexReasoningEffort | 'auto'>(loadPreferredReasoningEffort)
    const [basePermissionMode, setBasePermissionMode] = useState<PermissionMode>(() => loadPreferredPermissionMode(preferredAgent))
    const [isPlanActive, setIsPlanActive] = useState<boolean>(loadPreferredPlanActive)
    const [sessionType, setSessionType] = useState<SessionType>(loadPreferredSessionType)
    const [worktreeName, setWorktreeName] = useState(loadPreferredWorktreeName)
    const [error, setError] = useState<string | null>(null)
    const worktreeInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (sessionType === 'worktree') {
            worktreeInputRef.current?.focus()
        }
    }, [sessionType])

    useEffect(() => {
        if (!getBasePermissionModesForFlavor(agent).includes(basePermissionMode)) {
            setBasePermissionMode(loadPreferredPermissionMode(agent))
        }
    }, [agent, basePermissionMode])

    useEffect(() => {
        if (!supportsPlanToggle(agent) && isPlanActive) {
            setIsPlanActive(false)
        }
    }, [agent, isPlanActive])

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
        if (agent === 'claude' && model === CLAUDE_CUSTOM_MODEL_OPTION_VALUE) {
            savePreferredModel(CLAUDE_CUSTOM_MODEL_OPTION_VALUE)
            return
        }
        savePreferredModel(model)
    }, [agent, model])

    useEffect(() => {
        if (agent !== 'claude') {
            return
        }
        saveClaudeCustomModelValue(claudeCustomModelInput)
    }, [agent, claudeCustomModelInput])

    useEffect(() => {
        savePreferredReasoningEffort(reasoningEffort)
    }, [reasoningEffort])

    useEffect(() => {
        savePreferredSessionType(sessionType)
    }, [sessionType])

    useEffect(() => {
        savePreferredWorktreeName(worktreeName)
    }, [worktreeName])

    useEffect(() => {
        if (props.machines.length === 0) return
        if (machineId && props.machines.find((m) => m.id === machineId)) return

        const lastUsed = getLastUsedMachineId()
        const foundLast = lastUsed ? props.machines.find((m) => m.id === lastUsed) : null

        if (foundLast) {
            setMachineId(foundLast.id)
        } else if (props.machines[0]) {
            setMachineId(props.machines[0].id)
        }
    }, [props.machines, machineId, getLastUsedMachineId])

    const { data: agentModelsData } = useAgentModels(props.api, machineId, agent)

    const codexModelOptions = useMemo(
        () => buildCodexModelOptions(agentModelsData?.models),
        [agentModelsData?.models]
    )

    const modelOptions = useMemo(
        () => {
            if (agent === 'codex') {
                return [
                    { value: 'auto', label: 'Auto' },
                    ...codexModelOptions.map((entry) => ({ value: entry.value, label: entry.label }))
                ]
            }
            if (agent === 'claude') {
                return getClaudeNewSessionModelOptions()
            }
            return MODEL_OPTIONS[agent]
        },
        [agent, codexModelOptions]
    )

    useEffect(() => {
        if (modelOptions.length === 0) {
            if (model !== 'auto') {
                setModel('auto')
            }
            return
        }

        const exists = modelOptions.some((option) => option.value === model)
        if (!exists) {
            setModel('auto')
        }
    }, [model, modelOptions])

    const selectedCodexModel = useMemo(
        () => {
            if (agent !== 'codex') {
                return null
            }
            return codexModelOptions.find((entry) => entry.value === model) ?? null
        },
        [agent, codexModelOptions, model]
    )

    const reasoningOptions = useMemo(
        () => selectedCodexModel?.supportedReasoningEfforts.map((value) => ({ value })) ?? [],
        [selectedCodexModel]
    )

    useEffect(() => {
        if (agent !== 'codex' || model === 'auto') {
            if (reasoningEffort !== 'auto') {
                setReasoningEffort('auto')
            }
            return
        }

        if (!selectedCodexModel) {
            if (reasoningEffort !== 'auto') {
                setReasoningEffort('auto')
            }
            return
        }

        if (reasoningEffort !== 'auto' && !selectedCodexModel.supportedReasoningEfforts.includes(reasoningEffort)) {
            setReasoningEffort('auto')
        }
    }, [agent, model, reasoningEffort, selectedCodexModel])

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
            setPathExistence({})
            return () => { cancelled = true }
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

    const handleMachineChange = useCallback((newMachineId: string) => {
        setMachineId(newMachineId)
        setLastUsedMachineId(newMachineId)
    }, [setLastUsedMachineId])

    const handlePathClick = useCallback((path: string) => {
        setDirectory(path)
    }, [])

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (suggestion) {
            setDirectory(suggestion.text)
            clearSuggestions()
            setSuppressSuggestions(true)
        }
    }, [suggestions, clearSuggestions])

    const handleDirectoryChange = useCallback((value: string) => {
        setSuppressSuggestions(false)
        setDirectory(value)
    }, [])

    const handleDirectoryFocus = useCallback(() => {
        setSuppressSuggestions(false)
        setIsDirectoryFocused(true)
    }, [])

    const handleDirectoryBlur = useCallback(() => {
        setIsDirectoryFocused(false)
    }, [])

    const handleDirectoryKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) return

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
    }, [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions, handleSuggestionSelect])

    async function handleCreate() {
        if (!machineId || !directory.trim()) return

        setError(null)
        try {
            const resolvedClaudeModel = (() => {
                if (agent !== 'claude') {
                    return model
                }
                if (model !== CLAUDE_CUSTOM_MODEL_OPTION_VALUE) {
                    return model
                }
                return normalizeClaudeModelValue(claudeCustomModelInput) ?? 'auto'
            })()
            const resolvedModel = resolvedClaudeModel !== 'auto' && agent !== 'opencode' ? resolvedClaudeModel : undefined
            const resolvedReasoningEffort = (() => {
                if (agent !== 'codex' || !resolvedModel) {
                    return undefined
                }
                if (reasoningEffort !== 'auto') {
                    return reasoningEffort
                }
                return selectedCodexModel?.defaultReasoningEffort
            })()
            const shouldUsePlanMode = supportsPlanToggle(agent) && isPlanActive
            const requestedPermissionMode = shouldUsePlanMode ? 'plan' : basePermissionMode
            const result = await spawnSession({
                machineId,
                directory: directory.trim(),
                agent,
                model: resolvedModel,
                reasoningEffort: resolvedReasoningEffort,
                permissionMode: requestedPermissionMode,
                basePermissionMode: basePermissionMode,
                sessionType,
                worktreeName: sessionType === 'worktree' ? (worktreeName.trim() || undefined) : undefined
            })

            if (result.type === 'success') {
                haptic.notification('success')
                setLastUsedMachineId(machineId)
                addRecentPath(machineId, directory.trim())
                if (requestedPermissionMode !== 'default') {
                    setPendingSessionMode(result.sessionId, {
                        permissionMode: requestedPermissionMode,
                        basePermissionMode
                    })
                }
                props.onSuccess(result.sessionId)
                return
            }

            haptic.notification('error')
            setError(result.message)
        } catch (e) {
            haptic.notification('error')
            setError(e instanceof Error ? e.message : 'Failed to create session')
        }
    }

    const customModelReady = (
        agent !== 'claude'
        || model !== CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        || Boolean(normalizeClaudeModelValue(claudeCustomModelInput))
    )
    const canCreate = Boolean(machineId && directory.trim() && !isFormDisabled && customModelReady)

    return (
        <div className="flex flex-col divide-y divide-[var(--app-divider)]">
            <MachineSelector
                machines={props.machines}
                machineId={machineId}
                isLoading={props.isLoading}
                isDisabled={isFormDisabled}
                onChange={handleMachineChange}
            />
            <DirectorySection
                directory={directory}
                suggestions={suggestions}
                selectedIndex={selectedIndex}
                isDisabled={isFormDisabled}
                recentPaths={recentPaths}
                onDirectoryChange={handleDirectoryChange}
                onDirectoryFocus={handleDirectoryFocus}
                onDirectoryBlur={handleDirectoryBlur}
                onDirectoryKeyDown={handleDirectoryKeyDown}
                onSuggestionSelect={handleSuggestionSelect}
                onPathClick={handlePathClick}
            />
            <SessionTypeSelector
                sessionType={sessionType}
                worktreeName={worktreeName}
                worktreeInputRef={worktreeInputRef}
                isDisabled={isFormDisabled}
                onSessionTypeChange={setSessionType}
                onWorktreeNameChange={setWorktreeName}
            />
            <AgentSelector
                agent={agent}
                isDisabled={isFormDisabled}
                onAgentChange={setAgent}
            />
            <ModelSelector
                agent={agent}
                model={model}
                modelOptions={modelOptions}
                claudeCustomModelInput={claudeCustomModelInput}
                reasoningEffort={reasoningEffort}
                reasoningOptions={reasoningOptions}
                isDisabled={isFormDisabled}
                onModelChange={setModel}
                onClaudeCustomModelInputChange={setClaudeCustomModelInput}
                onReasoningEffortChange={setReasoningEffort}
            />
            <PermissionSelector
                agentFlavor={agent}
                basePermissionMode={basePermissionMode}
                onBasePermissionModeChange={setBasePermissionMode}
                isPlanActive={isPlanActive}
                onPlanToggle={setIsPlanActive}
                disabled={isFormDisabled}
            />

            {(error ?? spawnError) ? (
                <div className="px-3 py-2 text-sm text-red-600">
                    {error ?? spawnError}
                </div>
            ) : null}

            <ActionButtons
                isPending={isPending}
                canCreate={canCreate}
                isDisabled={isFormDisabled}
                onCancel={props.onCancel}
                onCreate={handleCreate}
            />
        </div>
    )
}
