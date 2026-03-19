import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import type { ApiClient } from '@/api/client'
import type { Machine, ScheduledTask, ScheduledTaskRun } from '@/types/api'
import { useScheduledTasks } from '@/hooks/queries/useScheduledTasks'
import { useScheduledTaskActions } from '@/hooks/mutations/useScheduledTaskActions'
import { useLongPress } from '@/hooks/useLongPress'
import { usePlatform } from '@/hooks/usePlatform'
import { EmbeddedSessionView } from '@/components/EmbeddedSessionView'
import { ScheduledTaskActionMenu } from '@/components/ScheduledTaskActionMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/lib/use-translation'
import { formatTimestamp } from '@/lib/dateTime'
import { getScheduledRunStatusToneClassName } from '@/lib/scheduled-run-status'
import { canScheduledTaskTogglePaused, getScheduledTaskPauseValidationCode } from '@/lib/scheduled-task-compat'
import {
    openWorkspaceScheduledTask,
    selectWorkspaceScheduledRun,
    selectWorkspaceTab,
    useWorkspaceState,
} from '@/lib/workspace-store'

function getMachineTitle(machine: Machine | null | undefined): string {
    if (machine?.metadata?.displayName) return machine.metadata.displayName
    if (machine?.metadata?.host) return machine.metadata.host
    if (machine?.id) return machine.id.slice(0, 8)
    return 'Unknown machine'
}

function formatDateTime(value: number | undefined): string {
    return formatTimestamp(value) ?? '-'
}

function formatDateTimeLocalInput(value: number | undefined): string {
    if (!value) return ''
    const date = new Date(value)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return year + '-' + month + '-' + day + 'T' + hour + ':' + minute + ':' + second
}

function getScheduledRunResultSummaryLabel(resultSummary: string, t: ReturnType<typeof useTranslation>['t']): string {
    const summaryKey = `scheduled.runResult.${resultSummary}`
    const translated = t(summaryKey)
    return translated === summaryKey ? resultSummary : translated
}

function getScheduledTaskDisplayStatusText(task: ScheduledTask, t: ReturnType<typeof useTranslation>['t']): string {
    return t(`scheduled.list.status.${task.displayStatus}`)
}

function getScheduledTaskDisplayStatusClassName(task: ScheduledTask): string {
    if (task.displayStatus === 'failed') return 'bg-rose-500/10 text-rose-600'
    if (task.displayStatus === 'completed') return 'bg-emerald-500/10 text-emerald-600'
    if (task.displayStatus === 'healthy') return 'bg-emerald-500/10 text-emerald-600'
    if (task.displayStatus === 'succeeded') return getScheduledRunStatusToneClassName('succeeded')
    return 'bg-[var(--app-subtle-bg)] text-[var(--app-fg)]'
}

function getScheduledTaskPhaseText(task: ScheduledTask, t: ReturnType<typeof useTranslation>['t']): string {
    return t(`scheduled.list.phase.${task.phase}`)
}

function getScheduledWorkspacePauseValidationMessage(task: ScheduledTask, t: ReturnType<typeof useTranslation>['t']): string | null {
    if (task.phase === 'paused') {
        const pauseValidationCode = getScheduledTaskPauseValidationCode(task)
        if (pauseValidationCode === 'once_already_consumed') return t('scheduled.validation.onceAlreadyConsumed')
        if (pauseValidationCode === 'once_expired') return t('scheduled.validation.onceExpired')
        if (pauseValidationCode === 'unknown') return t('scheduled.validation.unknown')
        return null
    }

    const pauseValidationCode = getScheduledTaskPauseValidationCode(task)
    if (pauseValidationCode === 'once_already_consumed') return t('scheduled.validation.onceAlreadyConsumed')
    if (pauseValidationCode === 'once_expired') return t('scheduled.validation.onceExpiredPause')
    if (pauseValidationCode === 'unknown') return t('scheduled.validation.unknown')
    return null
}

type EditState = {
    title: string
    prompt: string
    targetDirectory: string
    model: string
    scheduleType: 'once' | 'cron'
    runAt: string
    cron: string
    paused: boolean
}

function buildEditState(task: ScheduledTask): EditState {
    return {
        title: task.title,
        prompt: task.prompt,
        targetDirectory: task.targetDirectory,
        model: task.model ?? '',
        scheduleType: task.scheduleType,
        runAt: formatDateTimeLocalInput(task.runAt ?? task.nextRunAt),
        cron: task.cron ?? '',
        paused: task.phase === 'paused',
    }
}

type MachineTaskGroup = {
    machineId: string
    title: string
    tasks: ScheduledTask[]
    latestAt: number
}

const SCHEDULED_TASK_PHASE_SORT_ORDER: Record<ScheduledTask['phase'], number> = {
    enabled: 0,
    paused: 1,
    archived: 2,
}

function compareScheduledTasks(left: ScheduledTask, right: ScheduledTask): number {
    const phaseDiff = SCHEDULED_TASK_PHASE_SORT_ORDER[left.phase] - SCHEDULED_TASK_PHASE_SORT_ORDER[right.phase]

    if (phaseDiff !== 0) {
        return phaseDiff
    }

    return right.createdAt - left.createdAt
}

function groupTasksByMachine(tasks: ScheduledTask[], machines: Machine[]): MachineTaskGroup[] {
    const machineMap = new Map(machines.map((machine) => [machine.id, machine]))
    const groups = new Map<string, ScheduledTask[]>()

    for (const task of tasks) {
        if (!groups.has(task.machineId)) {
            groups.set(task.machineId, [])
        }
        groups.get(task.machineId)?.push(task)
    }

    return Array.from(groups.entries())
        .map(([machineId, machineTasks]) => {
            const sortedTasks = [...machineTasks].sort(compareScheduledTasks)
            const latestAt = sortedTasks.reduce((max, task) => Math.max(max, task.nextRunAt ?? task.lastRunAt ?? task.createdAt), 0)
            return {
                machineId,
                title: getMachineTitle(machineMap.get(machineId) ?? null),
                tasks: sortedTasks,
                latestAt,
            }
        })
        .sort((left, right) => right.latestAt - left.latestAt)
}

function SidebarTab(props: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={props.onClick}
            className={
                'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ' +
                (props.active
                    ? 'bg-[var(--app-fg)] text-[var(--app-bg)]'
                    : 'text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]')
            }
        >
            {props.label}
        </button>
    )
}

function RunStatusBadge(props: { status: ScheduledTaskRun['status'] }) {
    const { t } = useTranslation()
    const className = getScheduledRunStatusToneClassName(props.status)

    return <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ' + className}>{t(`scheduled.runStatus.${props.status}`)}</span>
}

function ScheduledTaskListItem(props: {
    task: ScheduledTask
    latestRun: ScheduledTaskRun | undefined
    selected: boolean
    isPending: boolean
    onSelect: () => void
    onTogglePaused: () => void
    onArchive: () => void
        onDelete: () => void
}) {
    const { t } = useTranslation()
    const { haptic } = usePlatform()
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState({ x: 0, y: 0 })
    const canTogglePaused = canScheduledTaskTogglePaused(props.task) && !props.isPending
    const togglePausedTitle = getScheduledWorkspacePauseValidationMessage(props.task, t)
        ?? (props.task.phase === 'paused' ? t('scheduled.action.resume') : t('scheduled.action.pause'))

    const longPressHandlers = useLongPress({
        onLongPress: (point) => {
            haptic.impact('medium')
            setMenuAnchorPoint(point)
            setMenuOpen(true)
        },
        onClick: () => {
            if (!menuOpen) {
                props.onSelect()
            }
        },
        threshold: 500,
        disabled: props.isPending,
    })

    return (
        <>
            <button
                type="button"
                {...longPressHandlers}
                className={
                    'w-full rounded-2xl border px-3 py-3 text-left transition-colors ' +
                    (props.selected
                        ? 'border-[var(--app-fg)] bg-[var(--app-secondary-bg)]'
                        : 'border-transparent hover:border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)]')
                }
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--app-fg)]">{props.task.title}</div>
                        <div className="mt-1 truncate text-xs text-[var(--app-hint)]">{props.task.targetDirectory}</div>
                    </div>
                    <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium ' + getScheduledTaskDisplayStatusClassName(props.task)}>
                        {getScheduledTaskDisplayStatusText(props.task, t)}
                    </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--app-hint)]">
                    <span>{props.task.scheduleType}</span>
                    <span>·</span>
                    <span>{props.task.agentFlavor}</span>
                    <span>·</span>
                    <span>{getScheduledTaskPhaseText(props.task, t)}</span>
                    <span>·</span>
                    <span>next {formatDateTime(props.task.nextRunAt)}</span>
                </div>
                {props.latestRun ? (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--app-hint)]">
                        <RunStatusBadge status={props.latestRun.status} />
                        <span>{formatDateTime(props.latestRun.triggeredAt)}</span>
                    </div>
                ) : null}
            </button>

            <ScheduledTaskActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                paused={props.task.phase === 'paused'}
                canTogglePaused={canTogglePaused}
                togglePausedTitle={togglePausedTitle}
                canArchive={props.task.phase !== 'archived' && !props.isPending}
                onTogglePaused={props.onTogglePaused}
                onArchive={props.onArchive}
                onDelete={props.onDelete}
                anchorPoint={menuAnchorPoint}
            />
        </>
    )
}

export function ScheduledWorkspace(props: {
    api: ApiClient | null
    machines: Machine[]
    onOpenSession?: (sessionId: string) => void
}) {
    const { t } = useTranslation()
    const { tasks, runs, isLoading, error } = useScheduledTasks(props.api)
    const { archiveScheduledTask, deleteScheduledTask, updateScheduledTask, isPending } = useScheduledTaskActions(props.api)
    const workspace = useWorkspaceState()
    const [search, setSearch] = useState('')
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editState, setEditState] = useState<EditState | null>(null)
    const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)

    const normalizedSearch = search.trim().toLowerCase()

    const filteredTasks = useMemo(() => {
        if (!normalizedSearch) {
            return tasks
        }
        return tasks.filter((task) => {
            const haystack = [
                task.title,
                task.prompt,
                task.targetDirectory,
                task.agentFlavor,
                task.model,
                task.cron,
                task.machineId,
            ]
                .filter(Boolean)
                .join('\n')
                .toLowerCase()
            return haystack.includes(normalizedSearch)
        })
    }, [normalizedSearch, tasks])

    const groups = useMemo(() => groupTasksByMachine(filteredTasks, props.machines), [filteredTasks, props.machines])

    useEffect(() => {
        if (groups.length === 0) {
            setSelectedTaskId(null)
            return
        }
        const exists = groups.some((group) => group.tasks.some((task) => task.id === selectedTaskId))
        if (!exists) {
            const fallbackTaskId = workspace.selectedScheduledTaskId && groups.some((group) => group.tasks.some((task) => task.id === workspace.selectedScheduledTaskId))
                ? workspace.selectedScheduledTaskId
                : (groups[0]?.tasks[0]?.id ?? null)
            setSelectedTaskId(fallbackTaskId)
        }
    }, [groups, selectedTaskId, workspace.selectedScheduledTaskId])

    const selectedTask = useMemo(
        () => filteredTasks.find((task) => task.id === selectedTaskId) ?? null,
        [filteredTasks, selectedTaskId]
    )

    const runsByTaskId = useMemo(() => {
        const map = new Map<string, ScheduledTaskRun[]>()
        for (const run of runs) {
            if (!map.has(run.taskId)) {
                map.set(run.taskId, [])
            }
            map.get(run.taskId)?.push(run)
        }
        for (const taskRuns of map.values()) {
            taskRuns.sort((left, right) => (right.triggeredAt ?? right.scheduledFor) - (left.triggeredAt ?? left.scheduledFor))
        }
        return map
    }, [runs])

    const selectedTaskRuns = useMemo(
        () => (selectedTask ? (runsByTaskId.get(selectedTask.id) ?? []) : []),
        [runsByTaskId, selectedTask]
    )

    useEffect(() => {
        if (selectedTaskRuns.length === 0) {
            setSelectedRunId(null)
            return
        }
        const exists = selectedTaskRuns.some((run) => run.id === selectedRunId)
        if (!exists) {
            setSelectedRunId(selectedTaskRuns[0]?.id ?? null)
        }
    }, [selectedRunId, selectedTaskRuns])

    const selectedRun = useMemo(
        () => selectedTaskRuns.find((run) => run.id === selectedRunId) ?? null,
        [selectedRunId, selectedTaskRuns]
    )

    useEffect(() => {
        selectWorkspaceTab('scheduled')
    }, [])

    useEffect(() => {
        if (selectedTaskId) {
            openWorkspaceScheduledTask(selectedTaskId, selectedRunId)
        }
    }, [selectedRunId, selectedTaskId])

    useEffect(() => {
        if (!selectedTask) {
            setEditState(null)
            setIsEditing(false)
            return
        }
        if (!isEditing) {
            setEditState(buildEditState(selectedTask))
        }
    }, [isEditing, selectedTask])

    const latestRunByTaskId = useMemo(() => {
        const map = new Map<string, ScheduledTaskRun>()
        for (const run of runs) {
            const existing = map.get(run.taskId)
            if (!existing || (run.triggeredAt ?? run.scheduledFor) > (existing.triggeredAt ?? existing.scheduledFor)) {
                map.set(run.taskId, run)
            }
        }
        return map
    }, [runs])

    async function handleSave(): Promise<void> {
        if (!selectedTask || !editState) {
            return
        }
        const body: Record<string, unknown> = {
            taskId: selectedTask.id,
            title: editState.title,
            prompt: editState.prompt,
            targetDirectory: editState.targetDirectory,
            model: editState.model.trim() || undefined,
            scheduleType: editState.scheduleType,
            paused: editState.paused,
        }

        if (editState.scheduleType === 'once') {
            if (editState.runAt.trim()) {
                const runAt = Date.parse(editState.runAt)
                if (Number.isFinite(runAt)) {
                    body.runAt = runAt
                }
            }
        } else {
            body.cron = editState.cron.trim()
        }

        await updateScheduledTask(body)
        setIsEditing(false)
    }

    async function handleTogglePaused(): Promise<void> {
        if (!selectedTask) {
            return
        }
        await updateScheduledTask({ taskId: selectedTask.id, phase: selectedTask.phase === 'paused' ? 'enabled' : 'paused' })
    }

    async function handleDeleteTask(): Promise<void> {
        if (!deleteTaskId) {
            return
        }
        await deleteScheduledTask(deleteTaskId)
        setDeleteTaskId(null)
    }

    const deleteTask = tasks.find((task) => task.id === deleteTaskId) ?? null

    return (
        <>
            <div className="flex h-full min-h-0 bg-[var(--app-bg)]">
                <div className="flex w-[360px] shrink-0 flex-col border-r border-[var(--app-divider)] bg-[var(--app-bg)]">
                <div className="border-b border-[var(--app-divider)] px-3 pb-3 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-1.5">
                            <img src="/icon.svg" alt="HAPI" className="h-5 w-5 shrink-0" />
                            <span className="text-sm font-semibold text-[var(--app-fg)]">HAPI</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-secondary-bg)] p-1">
                        <SidebarTab active={false} label="Sessions" onClick={() => selectWorkspaceTab('sessions')} />
                        <SidebarTab active label="Scheduled" onClick={() => selectWorkspaceTab('scheduled')} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-md bg-[var(--app-subtle-bg)] px-3 py-2">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search scheduled tasks"
                            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                    {isLoading ? <div className="px-2 py-3 text-sm text-[var(--app-hint)]">Loading scheduled tasks...</div> : null}
                    {error ? <div className="px-2 py-3 text-sm text-red-600">{error}</div> : null}
                    {!isLoading && !error && groups.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-[var(--app-hint)]">No scheduled tasks yet.</div>
                    ) : null}

                    {groups.map((group) => (
                        <div key={group.machineId} className="mb-4">
                            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-hint)]">
                                {group.title}
                            </div>
                            <div className="space-y-1">
                                {group.tasks.map((task) => {
                                    const latestRun = latestRunByTaskId.get(task.id)
                                    const selected = task.id === selectedTaskId
                                    return (
                                        <ScheduledTaskListItem
                                            key={task.id}
                                            task={task}
                                            latestRun={latestRun}
                                            selected={selected}
                                            isPending={isPending}
                                            onSelect={() => {
                                                setSelectedTaskId(task.id)
                                                setSelectedRunId(latestRun?.id ?? null)
                                                openWorkspaceScheduledTask(task.id, latestRun?.id ?? null)
                                            }}
                                            onTogglePaused={() => void updateScheduledTask({ taskId: task.id, phase: task.phase === 'paused' ? 'enabled' : 'paused' })}
                                            onArchive={() => void archiveScheduledTask(task.id)}
                                            onDelete={() => setDeleteTaskId(task.id)}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="min-w-0 flex-1 overflow-y-auto">
                {!selectedTask ? (
                    <div className="flex h-full items-center justify-center px-6 text-sm text-[var(--app-hint)]">
                        Select a scheduled task to manage it.
                    </div>
                ) : (
                    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-4">
                        <div className="rounded-[24px] bg-[var(--app-panel-bg)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    {isEditing && editState ? (
                                        <input
                                            value={editState.title}
                                            onChange={(event) => setEditState((current) => current ? { ...current, title: event.target.value } : current)}
                                            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-base font-semibold text-[var(--app-fg)]"
                                        />
                                    ) : (
                                        <h1 className="truncate text-xl font-semibold text-[var(--app-fg)]">{selectedTask.title}</h1>
                                    )}
                                    <p className="mt-1 text-sm text-[var(--app-hint)]">Task overview and management. Session details only appear after you pick a run below.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {!isEditing ? (
                                        <>
                                            <button type="button" disabled={isPending} onClick={() => setIsEditing(true)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">Edit</button>
                                            <button type="button" disabled={isPending} onClick={() => void handleTogglePaused()} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">{selectedTask.phase === 'paused' ? 'Resume' : 'Pause'}</button>
                                            <button type="button" disabled={isPending || selectedTask.phase === 'archived'} onClick={() => void archiveScheduledTask(selectedTask.id)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">Archive</button>
                                            <button type="button" disabled={isPending} onClick={() => setDeleteTaskId(selectedTask.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-50">Delete</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" disabled={isPending} onClick={() => void handleSave()} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">Save</button>
                                            <button type="button" disabled={isPending} onClick={() => { setEditState(buildEditState(selectedTask)); setIsEditing(false) }} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">Cancel Edit</button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Display Status</div><div className="mt-1 text-sm text-[var(--app-fg)]">{getScheduledTaskDisplayStatusText(selectedTask, t)}</div></div>
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Task Phase</div><div className="mt-1 text-sm text-[var(--app-fg)]">{getScheduledTaskPhaseText(selectedTask, t)}</div></div>
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Schedule</div><div className="mt-1 text-sm text-[var(--app-fg)]">{selectedTask.scheduleType}</div></div>
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Agent</div><div className="mt-1 text-sm text-[var(--app-fg)]">{selectedTask.agentFlavor}</div></div>
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Created</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedTask.createdAt)}</div></div>
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Next Run</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedTask.nextRunAt)}</div></div>
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Last Run</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedTask.lastRunAt)}</div></div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Prompt</div>
                                    {isEditing && editState ? (
                                        <textarea
                                            value={editState.prompt}
                                            onChange={(event) => setEditState((current) => current ? { ...current, prompt: event.target.value } : current)}
                                            rows={6}
                                            className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                                        />
                                    ) : (
                                        <div className="mt-2 whitespace-pre-wrap text-sm text-[var(--app-fg)]">{selectedTask.prompt}</div>
                                    )}
                                </div>
                                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Config</div>
                                    <div className="mt-2 space-y-2 text-sm text-[var(--app-fg)]">
                                        <div><span className="text-[var(--app-hint)]">Directory:</span> {isEditing && editState ? <input value={editState.targetDirectory} onChange={(event) => setEditState((current) => current ? { ...current, targetDirectory: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]" /> : <span className="break-all"> {selectedTask.targetDirectory}</span>}</div>
                                        <div><span className="text-[var(--app-hint)]">Model:</span> {isEditing && editState ? <input value={editState.model} onChange={(event) => setEditState((current) => current ? { ...current, model: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]" /> : <span> {selectedTask.model ?? '-'}</span>}</div>
                                        <div><span className="text-[var(--app-hint)]">Timezone:</span> <span> {selectedTask.timezone}</span></div>
                                        <div><span className="text-[var(--app-hint)]">Task ID:</span> <span className="break-all"> {selectedTask.id}</span></div>
                                        {isEditing && editState ? (
                                            <>
                                                <label className="block">
                                                    <span className="text-[var(--app-hint)]">Schedule Type</span>
                                                    <select value={editState.scheduleType} onChange={(event) => setEditState((current) => current ? { ...current, scheduleType: event.target.value as 'once' | 'cron' } : current)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]">
                                                        <option value="once">once</option>
                                                        <option value="cron">cron</option>
                                                    </select>
                                                </label>
                                                {editState.scheduleType === 'once' ? (
                                                    <label className="block">
                                                        <span className="text-[var(--app-hint)]">Run At</span>
                                                        <input type="datetime-local" step={1} value={editState.runAt} onChange={(event) => setEditState((current) => current ? { ...current, runAt: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]" />
                                                    </label>
                                                ) : (
                                                    <label className="block">
                                                        <span className="text-[var(--app-hint)]">Cron</span>
                                                        <input value={editState.cron} onChange={(event) => setEditState((current) => current ? { ...current, cron: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]" />
                                                    </label>
                                                )}
                                            </>
                                        ) : (
                                            <div><span className="text-[var(--app-hint)]">Expression:</span> <span> {selectedTask.cron ?? formatDateTime(selectedTask.runAt)}</span></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] bg-[var(--app-panel-bg)] p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold text-[var(--app-fg)]">Runs</h2>
                                    <p className="text-sm text-[var(--app-hint)]">Each execution stays attached to this task. Pick one to inspect its result.</p>
                                </div>
                                <div className="text-sm text-[var(--app-hint)]">{selectedTaskRuns.length} runs</div>
                            </div>

                            {selectedTaskRuns.length === 0 ? (
                                <div className="mt-4 rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-hint)]">
                                    This task has not produced any runs yet.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-4">
                                    <div className="overflow-x-auto pb-1">
                                        <div className="flex min-w-max gap-3">
                                            {selectedTaskRuns.map((run) => (
                                                <button
                                                    key={run.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRunId(run.id)
                                                        selectWorkspaceScheduledRun(run.id)
                                                    }}
                                                    className={
                                                        'min-w-[280px] rounded-2xl border px-4 py-3 text-left transition-colors ' +
                                                        (run.id === selectedRunId
                                                            ? 'border-[var(--app-fg)] bg-[var(--app-secondary-bg)]'
                                                            : 'border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)]')
                                                    }
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <RunStatusBadge status={run.status} />
                                                                <span className="text-[11px] text-[var(--app-hint)]">{formatDateTime(run.triggeredAt)}</span>
                                                            </div>
                                                            <div className="mt-2 text-xs text-[var(--app-hint)]">scheduled {formatDateTime(run.scheduledFor)}</div>
                                                            {run.sessionId ? <div className="mt-1 truncate text-xs text-[var(--app-fg)]">session {run.sessionId}</div> : null}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] overflow-hidden">
                                        <div className="border-b border-[var(--app-border)] px-4 py-4">
                                            {!selectedRun ? (
                                                <div className="text-sm text-[var(--app-hint)]">{t('scheduled.detail.pickRun')}</div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <h3 className="text-base font-semibold text-[var(--app-fg)]">{t('scheduled.detail.selectedRun')}</h3>
                                                        <RunStatusBadge status={selectedRun.status} />
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                        <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">{t('scheduled.detail.triggered')}</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedRun.triggeredAt)}</div></div>
                                                        <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">{t('scheduled.detail.finished')}</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedRun.finishedAt)}</div></div>
                                                        <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">{t('scheduled.detail.runId')}</div><div className="mt-1 break-all text-sm text-[var(--app-fg)]">{selectedRun.id}</div></div>
                                                        <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">{t('scheduled.detail.session')}</div><div className="mt-1 break-all text-sm text-[var(--app-fg)]">{selectedRun.sessionId ?? '-'}</div></div>
                                                    </div>
                                                    {selectedRun.errorMessage ? (
                                                        <div className={`px-4 py-3 text-sm ${getScheduledRunStatusToneClassName(selectedRun.status)}`}>{selectedRun.errorMessage}</div>
                                                    ) : null}
                                                    {selectedRun.resultSummary ? (
                                                        <div className={`px-4 py-3 text-sm ${getScheduledRunStatusToneClassName(selectedRun.status)}`}>{getScheduledRunResultSummaryLabel(selectedRun.resultSummary, t)}</div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                        {selectedRun?.sessionId ? (
                                            <div>
                                                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                                                    <h3 className="text-base font-semibold text-[var(--app-fg)]">{t('scheduled.detail.sessionView')}</h3>
                                                    {props.onOpenSession ? (
                                                        <button type="button" onClick={() => props.onOpenSession?.(selectedRun.sessionId as string)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)]">{t('scheduled.detail.openFullscreen')}</button>
                                                    ) : null}
                                                </div>
                                                <div className="h-[760px] bg-[var(--app-bg)] border-t border-[var(--app-border)]">
                                                    <EmbeddedSessionView
                                                        sessionId={selectedRun.sessionId}
                                                        onBack={() => setSelectedRunId(null)}
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            </div>

            <ConfirmDialog
                isOpen={deleteTask !== null}
                onClose={() => setDeleteTaskId(null)}
                title={t('scheduled.deleteDialog.title')}
                description={t('scheduled.deleteDialog.description', {
                    name: deleteTask?.title ?? '',
                })}
                confirmLabel={t('scheduled.deleteDialog.confirm')}
                confirmingLabel={t('scheduled.deleteDialog.confirming')}
                onConfirm={handleDeleteTask}
                isPending={isPending}
                destructive
            />
        </>
    )
}
