import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import type { ApiClient } from '@/api/client'
import type { Machine, ScheduledTask, ScheduledTaskRun } from '@/types/api'
import { useScheduledTasks } from '@/hooks/queries/useScheduledTasks'
import { useScheduledTaskActions } from '@/hooks/mutations/useScheduledTaskActions'
import { EmbeddedSessionView } from '@/components/EmbeddedSessionView'
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
    if (!value) return '-'
    return new Date(value).toLocaleString()
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
        runAt: formatDateTimeLocalInput(task.scheduleSpec.runAt ?? task.nextRunAt),
        cron: task.scheduleSpec.cron ?? '',
        paused: task.paused,
    }
}

type MachineTaskGroup = {
    machineId: string
    title: string
    tasks: ScheduledTask[]
    latestAt: number
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
            const sortedTasks = [...machineTasks].sort((left, right) => {
                const leftTime = left.nextRunAt ?? left.lastRunAt ?? left.createdAt
                const rightTime = right.nextRunAt ?? right.lastRunAt ?? right.createdAt
                return rightTime - leftTime
            })
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
    const className = props.status === 'succeeded'
        ? 'bg-emerald-500/10 text-emerald-600'
        : props.status === 'failed'
            ? 'bg-red-500/10 text-red-600'
            : props.status === 'running'
                ? 'bg-blue-500/10 text-blue-600'
                : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'

    return <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium ' + className}>{props.status}</span>
}

export function ScheduledWorkspace(props: {
    api: ApiClient | null
    machines: Machine[]
    onOpenSession?: (sessionId: string) => void
}) {
    const { tasks, runs, isLoading, error } = useScheduledTasks(props.api)
    const { cancelScheduledTask, deleteScheduledTask, updateScheduledTask, isPending } = useScheduledTaskActions(props.api)
    const workspace = useWorkspaceState()
    const [search, setSearch] = useState('')
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editState, setEditState] = useState<EditState | null>(null)

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
                task.scheduleSpec.cron,
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
            taskRuns.sort((left, right) => right.triggeredAt - left.triggeredAt)
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
            if (!existing || run.triggeredAt > existing.triggeredAt) {
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
        await updateScheduledTask({ taskId: selectedTask.id, paused: !selectedTask.paused })
    }

    return (
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
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedTaskId(task.id)
                                                setSelectedRunId(latestRun?.id ?? null)
                                                openWorkspaceScheduledTask(task.id, latestRun?.id ?? null)
                                            }}
                                            className={
                                                'w-full rounded-2xl border px-3 py-3 text-left transition-colors ' +
                                                (selected
                                                    ? 'border-[var(--app-fg)] bg-[var(--app-secondary-bg)]'
                                                    : 'border-transparent hover:border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)]')
                                            }
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-medium text-[var(--app-fg)]">{task.title}</div>
                                                    <div className="mt-1 truncate text-xs text-[var(--app-hint)]">{task.targetDirectory}</div>
                                                </div>
                                                <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium ' + (task.paused ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600')}>
                                                    {task.paused ? 'paused' : task.status}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--app-hint)]">
                                                <span>{task.scheduleType}</span>
                                                <span>·</span>
                                                <span>{task.agentFlavor}</span>
                                                <span>·</span>
                                                <span>next {formatDateTime(task.nextRunAt)}</span>
                                            </div>
                                            {latestRun ? (
                                                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--app-hint)]">
                                                    <RunStatusBadge status={latestRun.status} />
                                                    <span>{formatDateTime(latestRun.triggeredAt)}</span>
                                                </div>
                                            ) : null}
                                        </button>
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
                                            <button type="button" disabled={isPending} onClick={() => void handleTogglePaused()} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">{selectedTask.paused ? 'Resume' : 'Pause'}</button>
                                            <button type="button" disabled={isPending || selectedTask.status !== 'active' || selectedTask.paused} onClick={() => void cancelScheduledTask(selectedTask.id)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50">Cancel</button>
                                            <button type="button" disabled={isPending} onClick={() => void deleteScheduledTask(selectedTask.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-50">Delete</button>
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
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3"><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Status</div><div className="mt-1 text-sm text-[var(--app-fg)]">{selectedTask.status}{selectedTask.paused ? ' / paused' : ''}</div></div>
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
                                            <div><span className="text-[var(--app-hint)]">Expression:</span> <span> {selectedTask.scheduleSpec.cron ?? formatDateTime(selectedTask.scheduleSpec.runAt)}</span></div>
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

                                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4">
                                        {!selectedRun ? (
                                            <div className="text-sm text-[var(--app-hint)]">Pick a run to inspect it.</div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-semibold text-[var(--app-fg)]">Selected Run</h3>
                                                        <RunStatusBadge status={selectedRun.status} />
                                                    </div>
                                                    <p className="mt-1 text-sm text-[var(--app-hint)]">The selected run owns the session detail below.</p>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                    <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Triggered</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedRun.triggeredAt)}</div></div>
                                                    <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Finished</div><div className="mt-1 text-sm text-[var(--app-fg)]">{formatDateTime(selectedRun.finishedAt)}</div></div>
                                                    <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Run ID</div><div className="mt-1 break-all text-sm text-[var(--app-fg)]">{selectedRun.id}</div></div>
                                                    <div><div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">Session</div><div className="mt-1 break-all text-sm text-[var(--app-fg)]">{selectedRun.sessionId ?? '-'}</div></div>
                                                </div>
                                                {selectedRun.error ? (
                                                    <div className="rounded-2xl bg-red-500/8 px-4 py-3 text-sm text-red-600">{selectedRun.error}</div>
                                                ) : null}
                                                {selectedRun.resultSummary ? (
                                                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-4 py-3 text-sm text-[var(--app-fg)]">{selectedRun.resultSummary}</div>
                                                ) : null}
                                                {selectedRun.sessionId ? (
                                                    <div className="rounded-2xl border border-[var(--app-border)] px-0 py-0 overflow-hidden">
                                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
                                                            <div>
                                                                <div className="text-sm font-medium text-[var(--app-fg)]">Session Detail</div>
                                                                <div className="mt-1 text-sm text-[var(--app-hint)]">Embedded session view for the selected run.</div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {props.onOpenSession ? (
                                                                    <button type="button" onClick={() => props.onOpenSession?.(selectedRun.sessionId as string)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)]">Open Fullscreen</button>
                                                                ) : null}
                                                                <Link to="/sessions/$sessionId" params={{ sessionId: selectedRun.sessionId }} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)]">Open via Deep Link</Link>
                                                            </div>
                                                        </div>
                                                        <div className="h-[760px] bg-[var(--app-bg)]">
                                                            <EmbeddedSessionView
                                                                sessionId={selectedRun.sessionId}
                                                                onBack={() => setSelectedRunId(null)}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
