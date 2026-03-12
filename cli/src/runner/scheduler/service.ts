import { randomUUID } from 'node:crypto'

import type { ScheduledTask, ScheduledTaskRun } from '@hapi/protocol'
import { logger } from '@/ui/logger'
import { RunnerSchedulerStore } from './store'
import { isTaskDue, resolveNextRunAt } from './nextRun'
import type {
  CreateScheduledTaskInput,
  ListScheduledTaskRunsFilters,
  ListScheduledTasksFilters,
  SchedulerTriggerContext,
  SchedulerTriggerResult
} from './types'

export class RunnerSchedulerService {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private processing = false

  constructor(
    private readonly store: RunnerSchedulerStore,
    private readonly triggerTask: (context: SchedulerTriggerContext) => Promise<SchedulerTriggerResult>
  ) {}

  async start(): Promise<void> {
    this.running = true
    await this.reconcileTasks()
    this.scheduleNextWakeup()
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  async listTasks(filters?: ListScheduledTasksFilters): Promise<ScheduledTask[]> {
    const tasks = await this.store.listTasks()
    return tasks.filter((task) => {
      if (filters?.machineId && task.machineId !== filters.machineId) return false
      if (filters?.status && task.status !== filters.status) return false
      return true
    })
  }

  async listRuns(filters?: ListScheduledTaskRunsFilters): Promise<ScheduledTaskRun[]> {
    const runs = await this.store.listRuns()
    return runs.filter((run) => {
      if (filters?.taskId && run.taskId !== filters.taskId) return false
      if (filters?.machineId && run.machineId !== filters.machineId) return false
      return true
    })
  }

  async createTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const now = Date.now()
    const task: ScheduledTask = {
      id: randomUUID(),
      namespace: input.namespace ?? 'default',
      machineId: input.machineId,
      createdBySessionId: input.createdBySessionId,
      title: input.title,
      prompt: input.prompt,
      agentFlavor: input.agentFlavor ?? 'claude',
      targetDirectory: input.targetDirectory,
      permissionMode: input.permissionMode,
      basePermissionMode: input.basePermissionMode,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      runStrategy: 'new_session',
      scheduleType: 'once',
      scheduleSpec: { runAt: input.runAt },
      timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      nextRunAt: input.runAt,
      status: 'active',
      paused: false,
      allowOverlap: false,
      catchUpPolicy: 'once_within_window',
      maxSkewMs: input.maxSkewMs ?? 10 * 60 * 1000,
      createdAt: now,
      updatedAt: now
    }

    await this.store.update((state) => ({
      ...state,
      tasks: [...state.tasks, task]
    }))

    this.scheduleNextWakeup()
    return task
  }

  async cancelTask(taskId: string): Promise<ScheduledTask | null> {
    let canceledTask: ScheduledTask | null = null
    await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.map((task) => {
        if (task.id !== taskId) return task
        canceledTask = {
          ...task,
          status: 'canceled',
          paused: true,
          nextRunAt: undefined,
          updatedAt: Date.now()
        }
        return canceledTask
      })
    }))

    this.scheduleNextWakeup()
    return canceledTask
  }

  async reconcileTasks(now: number = Date.now()): Promise<void> {
    await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.map((task) => ({
        ...task,
        nextRunAt: resolveNextRunAt(task, now)
      }))
    }))
  }

  private scheduleNextWakeup(): void {
    if (!this.running) {
      return
    }

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    void this.store.listTasks().then((tasks) => {
      const nextTask = tasks
        .filter((task) => task.status === 'active' && !task.paused && typeof task.nextRunAt === 'number')
        .sort((a, b) => (a.nextRunAt ?? Number.MAX_SAFE_INTEGER) - (b.nextRunAt ?? Number.MAX_SAFE_INTEGER))[0]

      if (!nextTask?.nextRunAt) {
        return
      }

      const delay = Math.max(0, nextTask.nextRunAt - Date.now())
      this.timer = setTimeout(() => {
        void this.processDueTasks()
      }, delay)
    }).catch((error) => {
      logger.debug('[scheduler] failed to schedule next wakeup', error)
    })
  }

  async processDueTasks(now: number = Date.now()): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true
    try {
      const state = await this.store.read()
      const dueTasks = state.tasks.filter((task) => isTaskDue(task, now))

      for (const task of dueTasks) {
        await this.runTask(task, now)
      }
    } finally {
      this.processing = false
      this.scheduleNextWakeup()
    }
  }

  private async runTask(task: ScheduledTask, now: number): Promise<void> {
    const scheduledFor = task.nextRunAt ?? task.scheduleSpec.runAt ?? now
    const skew = now - scheduledFor

    if (skew > task.maxSkewMs) {
      await this.store.update((state) => ({
        ...state,
        tasks: state.tasks.map((current) => current.id !== task.id ? current : {
          ...current,
          status: 'failed',
          lastError: `Task missed execution window by ${skew}ms`,
          nextRunAt: undefined,
          updatedAt: now
        }),
        runs: [...state.runs, {
          id: randomUUID(),
          taskId: task.id,
          machineId: task.machineId,
          scheduledFor,
          triggeredAt: now,
          status: 'missed',
          error: `Task missed execution window by ${skew}ms`,
          createdAt: now,
          updatedAt: now
        }]
      }))
      return
    }

    const run: ScheduledTaskRun = {
      id: randomUUID(),
      taskId: task.id,
      machineId: task.machineId,
      scheduledFor,
      triggeredAt: now,
      startedAt: now,
      status: 'running',
      createdAt: now,
      updatedAt: now
    }

    await this.store.update((state) => ({
      ...state,
      runs: [...state.runs, run]
    }))

    try {
      const result = await this.triggerTask({ task, run })
      const finishedAt = Date.now()
      await this.store.update((state) => ({
        ...state,
        tasks: state.tasks.map((current) => current.id !== task.id ? current : {
          ...current,
          status: 'completed',
          lastRunAt: finishedAt,
          nextRunAt: undefined,
          updatedAt: finishedAt,
          lastError: undefined
        }),
        runs: state.runs.map((current) => current.id !== run.id ? current : {
          ...current,
          status: 'succeeded',
          sessionId: result.sessionId,
          resultSummary: result.resultSummary,
          finishedAt,
          updatedAt: finishedAt
        })
      }))
    } catch (error) {
      const finishedAt = Date.now()
      const message = error instanceof Error ? error.message : String(error)
      logger.debug('[scheduler] task trigger failed', { taskId: task.id, error: message })
      await this.store.update((state) => ({
        ...state,
        tasks: state.tasks.map((current) => current.id !== task.id ? current : {
          ...current,
          status: 'failed',
          lastRunAt: finishedAt,
          nextRunAt: undefined,
          updatedAt: finishedAt,
          lastError: message
        }),
        runs: state.runs.map((current) => current.id !== run.id ? current : {
          ...current,
          status: 'failed',
          error: message,
          finishedAt,
          updatedAt: finishedAt
        })
      }))
    }
  }
}

