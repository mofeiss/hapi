import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import type { ApiClient } from '@/api/client'
import type { ScheduledTask } from '@/types/api'
import { useScheduledTasks } from '@/hooks/queries/useScheduledTasks'
import { useScheduledTaskActions } from '@/hooks/mutations/useScheduledTaskActions'

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
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`
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

function ScheduledTaskCard(props: {
    task: ScheduledTask
    latestRun: { status?: string; sessionId?: string } | undefined
    isPending: boolean
    onCancel: (taskId: string) => Promise<void>
    onDelete: (taskId: string) => Promise<void>
    onUpdate: (body: Record<string, unknown>) => Promise<void>
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editState, setEditState] = useState<EditState>(() => buildEditState(props.task))

    useEffect(() => {
        if (!isEditing) {
            setEditState(buildEditState(props.task))
        }
    }, [isEditing, props.task])

    const isCancelable = props.task.status === 'active' && !props.task.paused
    const isPaused = props.task.paused

    const handleSave = async () => {
        const body: Record<string, unknown> = {
            taskId: props.task.id,
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

        await props.onUpdate(body)
        setIsEditing(false)
    }

    const handleTogglePaused = async () => {
        await props.onUpdate({ taskId: props.task.id, paused: !props.task.paused })
    }

    return (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    {isEditing ? (
                        <input
                            value={editState.title}
                            onChange={(event) => setEditState((current) => ({ ...current, title: event.target.value }))}
                            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                        />
                    ) : (
                        <div className="truncate text-base font-semibold text-[var(--app-fg)]">{props.task.title}</div>
                    )}

                    <div className="mt-2">
                        {isEditing ? (
                            <textarea
                                value={editState.prompt}
                                onChange={(event) => setEditState((current) => ({ ...current, prompt: event.target.value }))}
                                rows={4}
                                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                            />
                        ) : (
                            <div className="text-sm text-[var(--app-hint)]">{props.task.prompt}</div>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                    {!isEditing ? (
                        <>
                            <button
                                type="button"
                                disabled={props.isPending}
                                onClick={() => setIsEditing(true)}
                                className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                disabled={props.isPending}
                                onClick={() => void handleTogglePaused()}
                                className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                            >
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                                type="button"
                                disabled={props.isPending || !isCancelable}
                                onClick={() => void props.onCancel(props.task.id)}
                                className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={props.isPending}
                                onClick={() => void props.onDelete(props.task.id)}
                                className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                disabled={props.isPending}
                                onClick={() => void handleSave()}
                                className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                disabled={props.isPending}
                                onClick={() => {
                                    setEditState(buildEditState(props.task))
                                    setIsEditing(false)
                                }}
                                className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                            >
                                Cancel Edit
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-3 grid gap-3 text-sm text-[var(--app-hint)] md:grid-cols-2">
                <div>状态: <span className="text-[var(--app-fg)]">{props.task.status}</span></div>
                <div>Agent: <span className="text-[var(--app-fg)]">{props.task.agentFlavor}</span></div>
                <div>下次执行: <span className="text-[var(--app-fg)]">{formatDateTime(props.task.nextRunAt)}</span></div>
                <div>最近执行: <span className="text-[var(--app-fg)]">{formatDateTime(props.task.lastRunAt)}</span></div>
                <div>最近结果: <span className="text-[var(--app-fg)]">{props.latestRun?.status ?? '-'}</span></div>
                <div>类型: <span className="text-[var(--app-fg)]">{props.task.scheduleType}</span></div>
                <div>创建时间: <span className="text-[var(--app-fg)]">{formatDateTime(props.task.createdAt)}</span></div>
                <div>模型: <span className="text-[var(--app-fg)]">{props.task.model ?? '-'}</span></div>
                <div className="md:col-span-2">任务 ID: <span className="break-all text-[var(--app-fg)]">{props.task.id}</span></div>
                <div className="md:col-span-2">目录: <span className="break-all text-[var(--app-fg)]">{props.task.targetDirectory}</span></div>
                <div className="md:col-span-2">Cron: <span className="break-all text-[var(--app-fg)]">{props.task.scheduleSpec.cron ?? '-'}</span></div>
            </div>

            {isEditing ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm text-[var(--app-hint)]">
                        <span>Directory</span>
                        <input
                            value={editState.targetDirectory}
                            onChange={(event) => setEditState((current) => ({ ...current, targetDirectory: event.target.value }))}
                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-[var(--app-hint)]">
                        <span>Schedule Type</span>
                        <select
                            value={editState.scheduleType}
                            onChange={(event) => setEditState((current) => ({ ...current, scheduleType: event.target.value as 'once' | 'cron' }))}
                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                        >
                            <option value="once">once</option>
                            <option value="cron">cron</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-[var(--app-hint)] md:col-span-2">
                        <span>Model ID</span>
                        <input
                            value={editState.model}
                            onChange={(event) => setEditState((current) => ({ ...current, model: event.target.value }))}
                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                        />
                    </label>

                    {editState.scheduleType === 'once' ? (
                        <label className="flex flex-col gap-1 text-sm text-[var(--app-hint)] md:col-span-2">
                            <span>Run At</span>
                            <input
                                type="datetime-local"
                                step={1}
                                value={editState.runAt}
                                onChange={(event) => setEditState((current) => ({ ...current, runAt: event.target.value }))}
                                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                            />
                        </label>
                    ) : (
                        <label className="flex flex-col gap-1 text-sm text-[var(--app-hint)] md:col-span-2">
                            <span>Cron</span>
                            <input
                                value={editState.cron}
                                onChange={(event) => setEditState((current) => ({ ...current, cron: event.target.value }))}
                                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                            />
                        </label>
                    )}

                    <label className="flex items-center gap-2 text-sm text-[var(--app-hint)] md:col-span-2">
                        <input
                            type="checkbox"
                            checked={editState.paused}
                            onChange={(event) => setEditState((current) => ({ ...current, paused: event.target.checked }))}
                        />
                        <span>Paused</span>
                    </label>
                </div>
            ) : null}

            {props.latestRun?.sessionId ? (
                <div className="mt-3 text-sm text-[var(--app-hint)]">
                    对应会话:
                    <Link className="ml-1 text-[var(--app-link)] underline" to="/sessions/$sessionId" params={{ sessionId: props.latestRun.sessionId }}>
                        {props.latestRun.sessionId}
                    </Link>
                </div>
            ) : null}
        </div>
    )
}

export default function ScheduledPage(props: { api: ApiClient | null }) {
    const { tasks, runs, isLoading, error } = useScheduledTasks(props.api)
    const { cancelScheduledTask, deleteScheduledTask, updateScheduledTask, isPending } = useScheduledTaskActions(props.api)

    const latestRunByTaskId = useMemo(() => {
        const map = new Map<string, (typeof runs)[number]>()
        for (const run of runs) {
            const existing = map.get(run.taskId)
            if (!existing || run.triggeredAt > existing.triggeredAt) {
                map.set(run.taskId, run)
            }
        }
        return map
    }, [runs])

    const sortedTasks = useMemo(() => {
        return [...tasks].sort((left, right) => {
            const leftTime = left.nextRunAt ?? left.lastRunAt ?? left.createdAt
            const rightTime = right.nextRunAt ?? right.lastRunAt ?? right.createdAt
            return rightTime - leftTime
        })
    }, [tasks])

    return (
        <div className="flex h-full flex-col overflow-y-auto bg-[var(--app-bg)]">
            <div className="mx-auto flex w-full max-w-content items-center justify-between px-4 py-4">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--app-fg)]">Scheduled</h1>
                    <p className="text-sm text-[var(--app-hint)]">管理待执行的自动任务、循环任务与最近执行记录。</p>
                </div>
                <Link
                    to="/sessions"
                    className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                >
                    Back to Sessions
                </Link>
            </div>

            <div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-3 px-4 pb-6">
                {isLoading ? <div className="text-sm text-[var(--app-hint)]">Loading scheduled tasks...</div> : null}
                {error ? <div className="text-sm text-red-600">{error}</div> : null}
                {!isLoading && !error && tasks.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-5 text-sm text-[var(--app-hint)]">
                        还没有 Scheduled 任务。
                    </div>
                ) : null}

                {sortedTasks.map((task) => (
                    <ScheduledTaskCard
                        key={task.id}
                        task={task}
                        latestRun={latestRunByTaskId.get(task.id)}
                        isPending={isPending}
                        onCancel={cancelScheduledTask}
                        onDelete={deleteScheduledTask}
                        onUpdate={updateScheduledTask}
                    />
                ))}
            </div>
        </div>
    )
}
