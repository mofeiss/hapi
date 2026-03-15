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
  SchedulerTriggerResult,
  UpdateScheduledTaskInput
} from './types'

type SchedulerChangeEvent =
  | { type: 'task-updated'; task: ScheduledTask }
  | { type: 'task-removed'; taskId: string; machineId: string; namespace: string }
  | { type: 'run-updated'; run: ScheduledTaskRun; task: ScheduledTask }

type SchedulerValidationCode =
  | 'scheduled.once_expired'
  | 'scheduled.cron_invalid'
  | 'scheduled.invalid_state'

class SchedulerValidationError extends Error {
  code: SchedulerValidationCode

  constructor(code: SchedulerValidationCode, message: string) {
    super(message)
    this.name = 'SchedulerValidationError'
    this.code = code
  }
}

function resolveScheduleSpec(input: {
  scheduleType: ScheduledTask['scheduleType']
  runAt?: number
  cron?: string
}): ScheduledTask['scheduleSpec'] {
  if (input.scheduleType === 'cron') {
    return { cron: input.cron?.trim() }
  }

  return { runAt: input.runAt }
}

function assertScheduleInput(input: {
  scheduleType: ScheduledTask['scheduleType']
  runAt?: number
  cron?: string
}): void {
  if (input.scheduleType === 'cron') {
    if (!input.cron?.trim()) {
      throw new Error('cron schedule requires a cron expression')
    }
    return
  }

  if (!Number.isFinite(input.runAt)) {
    throw new Error('once schedule requires a valid runAt timestamp')
  }
}

function assertTaskCanRun(input: {
  scheduleType: ScheduledTask['scheduleType']
  runAt?: number
  cron?: string
  timezone?: string
  now: number
}): void {
  if (input.scheduleType === 'once') {
    if (!Number.isFinite(input.runAt)) {
      throw new SchedulerValidationError('scheduled.invalid_state', 'once schedule requires a valid runAt timestamp')
    }
    if ((input.runAt as number) <= input.now) {
      throw new SchedulerValidationError('scheduled.once_expired', 'once task run time has already passed and cannot be resumed')
    }
    return
  }

  const expression = input.cron?.trim()
  if (!expression) {
    throw new SchedulerValidationError('scheduled.cron_invalid', 'cron schedule requires a cron expression')
  }

  try {
    resolveNextRunAt({
      id: 'validation',
      namespace: 'default',
      machineId: 'validation',
      title: 'validation',
      prompt: 'validation',
      agentFlavor: 'claude',
      targetDirectory: '.',
      permissionMode: 'bypassPermissions',
      basePermissionMode: 'bypassPermissions',
      runStrategy: 'new_session',
      scheduleType: 'cron',
      scheduleSpec: { cron: expression },
      timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'active',
      paused: false,
      allowOverlap: false,
      catchUpPolicy: 'once_within_window',
      maxSkewMs: 10 * 60 * 1000,
      createdAt: input.now,
      updatedAt: input.now
    }, input.now)
  } catch {
    throw new SchedulerValidationError('scheduled.cron_invalid', 'cron schedule is invalid and cannot be resumed')
  }
}

export class RunnerSchedulerService {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private processing = false

  constructor(
    private readonly store: RunnerSchedulerStore,
    private readonly triggerTask: (context: SchedulerTriggerContext) => Promise<SchedulerTriggerResult>,
    private readonly onChange?: (event: SchedulerChangeEvent) => void | Promise<void>
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
    const scheduleType = input.scheduleType ?? 'once'
    assertScheduleInput({ scheduleType, runAt: input.runAt, cron: input.cron })

    const draft: ScheduledTask = {
      id: randomUUID(),
      namespace: input.namespace ?? 'default',
      machineId: input.machineId,
      createdBySessionId: input.createdBySessionId,
      title: input.title,
      prompt: input.prompt,
      agentFlavor: input.agentFlavor ?? 'claude',
      targetDirectory: input.targetDirectory,
      permissionMode: (input.agentFlavor ?? 'claude') === 'codex' ? 'yolo' : 'bypassPermissions',
      basePermissionMode: (input.agentFlavor ?? 'claude') === 'codex' ? 'yolo' : 'bypassPermissions',
      model: input.model,
      reasoningEffort: (input.agentFlavor ?? 'claude') === 'codex' ? 'xhigh' : undefined,
      runStrategy: 'new_session',
      scheduleType,
      scheduleSpec: resolveScheduleSpec({ scheduleType, runAt: input.runAt, cron: input.cron }),
      timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      nextRunAt: undefined,
      status: 'active',
      paused: input.paused ?? false,
      allowOverlap: input.allowOverlap ?? false,
      catchUpPolicy: input.catchUpPolicy ?? 'once_within_window',
      maxSkewMs: input.maxSkewMs ?? 10 * 60 * 1000,
      createdAt: now,
      updatedAt: now
    }

    const task: ScheduledTask = {
      ...draft,
      nextRunAt: resolveNextRunAt(draft, now)
    }

    await this.store.update((state) => ({
      ...state,
      tasks: [...state.tasks, task]
    }))

    await this.emitChange({ type: 'task-updated', task })
    this.scheduleNextWakeup()
    return task
  }

  async updateTask(input: UpdateScheduledTaskInput): Promise<ScheduledTask | null> {
    const currentState = await this.store.read()
    const existing = currentState.tasks.find((task) => task.id === input.taskId)
    if (!existing) {
      return null
    }

    const now = Date.now()
    const scheduleType = input.scheduleType ?? existing.scheduleType
    const runAt = input.runAt ?? existing.scheduleSpec.runAt
    const cron = input.cron ?? existing.scheduleSpec.cron
    assertScheduleInput({ scheduleType, runAt, cron })

    const nextPaused = input.paused ?? existing.paused
    if (!nextPaused) {
      assertTaskCanRun({
        scheduleType,
        runAt,
        cron,
        timezone: input.timezone ?? existing.timezone,
        now
      })
    }

    const updated: ScheduledTask = {
      ...existing,
      title: input.title ?? existing.title,
      prompt: input.prompt ?? existing.prompt,
      agentFlavor: input.agentFlavor ?? existing.agentFlavor,
      targetDirectory: input.targetDirectory ?? existing.targetDirectory,
      permissionMode: (input.agentFlavor ?? existing.agentFlavor) === 'codex' ? 'yolo' : 'bypassPermissions',
      basePermissionMode: (input.agentFlavor ?? existing.agentFlavor) === 'codex' ? 'yolo' : 'bypassPermissions',
      model: input.model ?? existing.model,
      reasoningEffort: (input.agentFlavor ?? existing.agentFlavor) === 'codex' ? 'xhigh' : undefined,
      scheduleType,
      scheduleSpec: resolveScheduleSpec({ scheduleType, runAt, cron }),
      timezone: input.timezone ?? existing.timezone,
      paused: nextPaused,
      allowOverlap: input.allowOverlap ?? existing.allowOverlap,
      catchUpPolicy: input.catchUpPolicy ?? existing.catchUpPolicy,
      maxSkewMs: input.maxSkewMs ?? existing.maxSkewMs,
      updatedAt: now,
      status: existing.status === 'canceled' ? 'active' : existing.status,
      lastError: undefined
    }

    updated.nextRunAt = updated.paused ? undefined : resolveNextRunAt(updated, now)
    if (updated.scheduleType === 'once' && updated.status === 'completed') {
      updated.status = 'active'
    }
    if (updated.status === 'failed') {
      updated.status = 'active'
    }

    await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.map((task) => task.id === updated.id ? updated : task)
    }))

    await this.emitChange({ type: 'task-updated', task: updated })
    this.scheduleNextWakeup()
    return updated
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

    if (canceledTask) {
      await this.emitChange({ type: 'task-updated', task: canceledTask })
    }

    this.scheduleNextWakeup()
    return canceledTask
  }

  async deleteTask(taskId: string): Promise<{ taskId: string; machineId: string; namespace: string } | null> {
    const currentState = await this.store.read()
    const existing = currentState.tasks.find((task) => task.id === taskId)
    if (!existing) {
      return null
    }

    await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.filter((task) => task.id !== taskId),
      runs: state.runs.filter((run) => run.taskId !== taskId)
    }))

    const deletedTask = { taskId: existing.id, machineId: existing.machineId, namespace: existing.namespace }
    await this.emitChange({
      type: 'task-removed',
      taskId: deletedTask.taskId,
      machineId: deletedTask.machineId,
      namespace: deletedTask.namespace
    })

    this.scheduleNextWakeup()
    return deletedTask
  }

  async reconcileTasks(now: number = Date.now()): Promise<void> {
    const nextState = await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.map((task) => ({
        ...task,
        nextRunAt: task.paused ? undefined : resolveNextRunAt(task, now)
      }))
    }))

    await Promise.all(nextState.tasks.map(async (task) => {
      await this.emitChange({ type: 'task-updated', task })
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
      const missedRun: ScheduledTaskRun = {
        id: randomUUID(),
        taskId: task.id,
        machineId: task.machineId,
        scheduledFor,
        triggeredAt: now,
        status: 'missed',
        error: `Task missed execution window by ${skew}ms`,
        createdAt: now,
        updatedAt: now
      }

      const nextTaskState = this.buildNextTaskStateAfterRun({
        task,
        now,
        status: 'failed',
        lastError: missedRun.error
      })

      await this.store.update((state) => ({
        ...state,
        tasks: state.tasks.map((current) => current.id !== task.id ? current : nextTaskState),
        runs: [...state.runs, missedRun]
      }))

      await this.emitChange({ type: 'task-updated', task: nextTaskState })
      await this.emitChange({ type: 'run-updated', run: missedRun, task: nextTaskState })
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
    await this.emitChange({ type: 'run-updated', run, task })

    try {
      const result = await this.triggerTask({ task, run })
      const finishedAt = Date.now()
      const succeededRun: ScheduledTaskRun = {
        ...run,
        status: 'succeeded',
        sessionId: result.sessionId,
        resultSummary: result.resultSummary,
        finishedAt,
        updatedAt: finishedAt
      }
      const nextTaskState = this.buildNextTaskStateAfterRun({
        task,
        now: finishedAt,
        status: task.scheduleType === 'cron' ? 'active' : 'completed'
      })

      await this.store.update((state) => ({
        ...state,
        tasks: state.tasks.map((current) => current.id !== task.id ? current : nextTaskState),
        runs: state.runs.map((current) => current.id !== run.id ? current : succeededRun)
      }))

      await this.emitChange({ type: 'task-updated', task: nextTaskState })
      await this.emitChange({ type: 'run-updated', run: succeededRun, task: nextTaskState })
    } catch (error) {
      const finishedAt = Date.now()
      const message = error instanceof Error ? error.message : String(error)
      logger.debug('[scheduler] task trigger failed', { taskId: task.id, error: message })

      const failedRun: ScheduledTaskRun = {
        ...run,
        status: 'failed',
        error: message,
        finishedAt,
        updatedAt: finishedAt
      }
      const nextTaskState = this.buildNextTaskStateAfterRun({
        task,
        now: finishedAt,
        status: task.scheduleType === 'cron' ? 'active' : 'failed',
        lastError: message
      })

      await this.store.update((state) => ({
        ...state,
        tasks: state.tasks.map((current) => current.id !== task.id ? current : nextTaskState),
        runs: state.runs.map((current) => current.id !== run.id ? current : failedRun)
      }))

      await this.emitChange({ type: 'task-updated', task: nextTaskState })
      await this.emitChange({ type: 'run-updated', run: failedRun, task: nextTaskState })
    }
  }

  private buildNextTaskStateAfterRun(options: {
    task: ScheduledTask
    now: number
    status: ScheduledTask['status']
    lastError?: string
  }): ScheduledTask {
    const baseTask: ScheduledTask = {
      ...options.task,
      status: options.status,
      lastRunAt: options.now,
      updatedAt: options.now,
      lastError: options.lastError
    }

    if (options.task.scheduleType === 'cron' && options.status !== 'canceled') {
      return {
        ...baseTask,
        nextRunAt: baseTask.paused ? undefined : resolveNextRunAt(baseTask, options.now)
      }
    }

    return {
      ...baseTask,
      nextRunAt: undefined
    }
  }

  private async emitChange(event: SchedulerChangeEvent): Promise<void> {
    if (!this.onChange) {
      return
    }

    try {
      await this.onChange(event)
    } catch (error) {
      logger.debug('[scheduler] failed to emit change event', error)
    }
  }
}
