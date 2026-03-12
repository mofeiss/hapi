import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'

import type { ApiClient } from '@/api/client'
import { useScheduledTasks } from '@/hooks/queries/useScheduledTasks'
import { useScheduledTaskActions } from '@/hooks/mutations/useScheduledTaskActions'

function formatDateTime(value: number | undefined): string {
    if (!value) return '-'
    return new Date(value).toLocaleString()
}

export default function ScheduledPage(props: { api: ApiClient | null }) {
    const { tasks, runs, isLoading, error } = useScheduledTasks(props.api)
    const { cancelScheduledTask, isPending } = useScheduledTaskActions(props.api)

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
                    <p className="text-sm text-[var(--app-hint)]">管理待执行的自动任务与最近执行记录。</p>
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

                {sortedTasks.map((task) => {
                    const latestRun = latestRunByTaskId.get(task.id)
                    const isCancelable = task.status === 'active' && !task.paused
                    return (
                        <div
                            key={task.id}
                            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-base font-semibold text-[var(--app-fg)]">{task.title}</div>
                                    <div className="mt-1 text-sm text-[var(--app-hint)]">{task.prompt}</div>
                                </div>
                                <button
                                    type="button"
                                    disabled={isPending || !isCancelable}
                                    onClick={() => void cancelScheduledTask(task.id)}
                                    className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="mt-3 grid gap-2 text-sm text-[var(--app-hint)] md:grid-cols-2">
                                <div>状态: <span className="text-[var(--app-fg)]">{task.status}</span></div>
                                <div>Agent: <span className="text-[var(--app-fg)]">{task.agentFlavor}</span></div>
                                <div>下次执行: <span className="text-[var(--app-fg)]">{formatDateTime(task.nextRunAt)}</span></div>
                                <div>目录: <span className="text-[var(--app-fg)] break-all">{task.targetDirectory}</span></div>
                                <div>最近执行: <span className="text-[var(--app-fg)]">{formatDateTime(task.lastRunAt)}</span></div>
                                <div>最近结果: <span className="text-[var(--app-fg)]">{latestRun?.status ?? '-'}</span></div>
                            </div>

                            {latestRun?.sessionId ? (
                                <div className="mt-3 text-sm text-[var(--app-hint)]">
                                    对应会话:
                                    <Link className="ml-1 text-[var(--app-link)] underline" to="/sessions/$sessionId" params={{ sessionId: latestRun.sessionId }}>
                                        {latestRun.sessionId}
                                    </Link>
                                </div>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
