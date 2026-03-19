import { randomUUID } from 'node:crypto'

import { deriveScheduledTask, getHapiTimezone, isScheduledTaskConsumed, resolveDelayedRunAt } from '@hapi/protocol'
import type { ScheduledDelay, ScheduledTask, ScheduledTaskPhase, ScheduledTaskRun } from '@hapi/protocol'
import { logger } from '@/ui/logger'
import { RunnerSchedulerStore } from './store'
import { isTaskDue, resolveNextRunAt } from './nextRun'
import type {
  CreateScheduledTaskInput,
  ListScheduledTaskRunsFilters,
  ListScheduledTasksFilters,
  ReportScheduledTaskOutcomeInput,
  SchedulerTriggerContext,
  SchedulerTriggerResult,
  UpdateScheduledTaskInput
} from './types'

type SchedulerChangeEvent =
  | { type: 'task-updated'; task: ScheduledTask }
  | { type: 'task-removed'; taskId: string; machineId: string; namespace: string }
  | { type: 'run-updated'; run: ScheduledTaskRun; task: ScheduledTask }

type SchedulerValidationCode =
  | 'schedule.invalid_input'
  | 'schedule.invalid_transition'
  | 'schedule.once_consumed'
  | 'schedule.phase_archived'

class SchedulerValidationError extends Error {
  code: SchedulerValidationCode

  constructor(code: SchedulerValidationCode, message: string) {
    super(message)
    this.name = 'SchedulerValidationError'
    this.code = code
  }
}

function assertScheduleInput(input: {
  scheduleType: ScheduledTask['scheduleType']
  runAt?: number
  delay?: ScheduledDelay
  cron?: string
}): void {
  if (input.scheduleType === 'cron') {
    if (input.runAt !== undefined || input.delay !== undefined) {
      throw new SchedulerValidationError('schedule.invalid_input', 'cron schedule cannot include runAt or delay')
    }
    if (!input.cron?.trim()) {
      throw new SchedulerValidationError('schedule.invalid_input', 'cron schedule requires a cron expression')
    }
    return
  }

  if (input.runAt !== undefined && input.delay !== undefined) {
    throw new SchedulerValidationError('schedule.invalid_input', 'once schedule requires exactly one of runAt or delay')
  }

  if (!Number.isFinite(input.runAt)) {
    if (!input.delay) {
      throw new SchedulerValidationError('schedule.invalid_input', 'once schedule requires a valid runAt timestamp or delay')
    }
  }
}

function resolveOnceRunAt(now: number, input: { runAt?: number; delay?: ScheduledDelay }): number | undefined {
  if (Number.isFinite(input.runAt)) {
    return input.runAt
  }
  if (!input.delay) {
    return undefined
  }
  return resolveDelayedRunAt(now, input.delay)
}

function buildTaskBase(input: {
  existing?: ScheduledTask
  now: number
  machineId: string
  namespace: string
  createdBySessionId?: string
  title: string
  prompt: string
  agentFlavor: ScheduledTask['agentFlavor']
  targetDirectory: string
  model?: string
  scheduleType: ScheduledTask['scheduleType']
  runAt?: number
  delay?: ScheduledDelay
  cron?: string
  timezone: string
  scheduledSessionPermission: ScheduledTask['scheduledSessionPermission']
  allowOverlap: boolean
  catchUpPolicy: ScheduledTask['catchUpPolicy']
  maxSkewMs: number
  phase: ScheduledTaskPhase
}): ScheduledTask {
  return {
    id: input.existing?.id ?? randomUUID(),
    namespace: input.existing?.namespace ?? input.namespace,
    machineId: input.existing?.machineId ?? input.machineId,
    createdBySessionId: input.existing?.createdBySessionId ?? input.createdBySessionId,
    title: input.title,
    prompt: input.prompt,
    agentFlavor: input.agentFlavor,
    targetDirectory: input.targetDirectory,
    permissionMode: input.agentFlavor === 'codex' ? 'yolo' : 'bypassPermissions',
    basePermissionMode: input.agentFlavor === 'codex' ? 'yolo' : 'bypassPermissions',
    model: input.model,
    reasoningEffort: input.agentFlavor === 'codex' ? 'xhigh' : undefined,
    runStrategy: 'new_session',
    scheduleType: input.scheduleType,
    runAt: input.scheduleType === 'once' ? input.runAt : undefined,
    delay: input.scheduleType === 'once' ? input.delay : undefined,
    cron: input.scheduleType === 'cron' ? input.cron?.trim() : undefined,
    timezone: input.timezone,
    phase: input.phase,
    scheduledSessionPermission: input.scheduledSessionPermission,
    allowOverlap: input.allowOverlap,
    catchUpPolicy: input.catchUpPolicy,
    maxSkewMs: input.maxSkewMs,
    createdAt: input.existing?.createdAt ?? input.now,
    updatedAt: input.now
  }
}

function canTransitionPhase(current: ScheduledTaskPhase, next: ScheduledTaskPhase): boolean {
  if (current === next) return true
  if (current === 'enabled' && (next === 'paused' || next === 'archived')) return true
  if (current === 'paused' && (next === 'enabled' || next === 'archived')) return true
  return false
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
      if (filters?.phase && task.phase !== filters.phase) return false
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
    assertScheduleInput({ scheduleType, runAt: input.runAt, delay: input.delay, cron: input.cron })
    const runAt = scheduleType === 'once' ? resolveOnceRunAt(now, { runAt: input.runAt, delay: input.delay }) : undefined

    const task = buildTaskBase({
      now,
      machineId: input.machineId,
      namespace: input.namespace ?? 'default',
      createdBySessionId: input.createdBySessionId,
      title: input.title,
      prompt: input.prompt,
      agentFlavor: input.agentFlavor ?? 'claude',
      targetDirectory: input.targetDirectory,
      model: input.model,
      scheduleType,
      runAt,
      delay: scheduleType === 'once' ? input.delay : undefined,
      cron: input.cron,
      timezone: input.timezone ?? getHapiTimezone(),
      scheduledSessionPermission: input.scheduledSessionPermission,
      allowOverlap: input.allowOverlap ?? false,
      catchUpPolicy: input.catchUpPolicy ?? 'once_within_window',
      maxSkewMs: input.maxSkewMs ?? 10 * 60 * 1000,
      phase: 'enabled'
    })

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

    const taskRuns = currentState.runs.filter((run) => run.taskId === existing.id)
    if (existing.phase === 'archived') {
      throw new SchedulerValidationError('schedule.phase_archived', 'archived task cannot be edited')
    }
    if (isScheduledTaskConsumed(existing, taskRuns)) {
      throw new SchedulerValidationError('schedule.once_consumed', 'once task has already been consumed')
    }

    const now = Date.now()
    const scheduleType = input.scheduleType ?? existing.scheduleType
    const delay = input.delay ?? existing.delay
    const rawRunAt = input.runAt ?? existing.runAt
    const runAt = scheduleType === 'once' ? resolveOnceRunAt(now, { runAt: rawRunAt, delay }) : undefined
    const cron = input.cron ?? existing.cron
    assertScheduleInput({ scheduleType, runAt: rawRunAt, delay, cron })

    const nextPhase = input.phase ?? existing.phase
    if (!canTransitionPhase(existing.phase, nextPhase)) {
      throw new SchedulerValidationError('schedule.invalid_transition', `invalid phase transition: ${existing.phase} -> ${nextPhase}`)
    }

    const updated = buildTaskBase({
      existing,
      now,
      machineId: existing.machineId,
      namespace: existing.namespace,
      title: input.title ?? existing.title,
      prompt: input.prompt ?? existing.prompt,
      agentFlavor: input.agentFlavor ?? existing.agentFlavor,
      targetDirectory: input.targetDirectory ?? existing.targetDirectory,
      model: input.model ?? existing.model,
      scheduleType,
      runAt,
      delay: scheduleType === 'once' ? delay : undefined,
      cron,
      timezone: input.timezone ?? existing.timezone ?? getHapiTimezone(),
      scheduledSessionPermission: input.scheduledSessionPermission ?? existing.scheduledSessionPermission,
      allowOverlap: input.allowOverlap ?? existing.allowOverlap,
      catchUpPolicy: input.catchUpPolicy ?? existing.catchUpPolicy,
      maxSkewMs: input.maxSkewMs ?? existing.maxSkewMs,
      phase: nextPhase
    })

    await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.map((task) => task.id === updated.id ? updated : task)
    }))

    await this.emitChange({ type: 'task-updated', task: updated })
    this.scheduleNextWakeup()
    return updated
  }

  async archiveTask(taskId: string): Promise<ScheduledTask | null> {
    return await this.updateTask({ taskId, phase: 'archived' })
  }

  async reportTaskOutcome(input: ReportScheduledTaskOutcomeInput): Promise<ScheduledTaskRun | null> {
    const currentState = await this.store.read()
    const existing = currentState.runs.find((run) => run.id === input.runId)
    if (!existing) {
      return null
    }

    const updatedRun: ScheduledTaskRun = {
      ...existing,
      outcome: input.outcome,
      updatedAt: Math.max(existing.updatedAt ?? 0, input.outcome.reportedAt)
    }

    await this.store.update((state) => ({
      ...state,
      runs: state.runs.map((run) => run.id === input.runId ? updatedRun : run)
    }))

    const task = currentState.tasks.find((entry) => entry.id === existing.taskId)
    if (task) {
      await this.emitChange({ type: 'run-updated', run: updatedRun, task })
    }

    return updatedRun
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
      tasks: state.tasks.map((task) => this.reconcileTask(task, state.runs, now))
    }))

    await Promise.all(nextState.tasks.map(async (task) => {
      await this.emitChange({ type: 'task-updated', task })
    }))
  }

  private reconcileTask(task: ScheduledTask, runs: readonly ScheduledTaskRun[], now: number): ScheduledTask {
    const derived = deriveScheduledTask(task, runs, resolveNextRunAt(task, now))
    if (task.scheduleType === 'once' && derived.consumed) {
      return {
        ...task,
        phase: 'archived',
        updatedAt: now
      }
    }

    return task
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
        .map((task) => ({ task, nextRunAt: resolveNextRunAt(task, Date.now()) }))
        .filter((entry) => typeof entry.nextRunAt === 'number')
        .sort((a, b) => (a.nextRunAt as number) - (b.nextRunAt as number))[0]

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
    const scheduledFor = resolveNextRunAt(task, now) ?? task.runAt ?? now
    let finalRun: ScheduledTaskRun

    try {
      const triggerResult = await this.triggerTask({
        task,
        run: {
          id: randomUUID(),
          taskId: task.id,
          machineId: task.machineId,
          scheduledFor,
          triggeredAt: now,
          startedAt: now,
          status: 'succeeded'
        }
      })

      const finishedAt = Date.now()
      finalRun = {
        id: randomUUID(),
        taskId: task.id,
        machineId: task.machineId,
        scheduledFor,
        triggeredAt: now,
        startedAt: now,
        finishedAt,
        status: 'succeeded',
        sessionId: triggerResult.sessionId,
        resultSummary: triggerResult.resultSummary,
        createdAt: now,
        updatedAt: finishedAt
      }
    } catch (error) {
      const finishedAt = Date.now()
      const message = error instanceof Error ? error.message : String(error)
      logger.debug('[scheduler] task trigger failed', { taskId: task.id, error: message })
      finalRun = {
        id: randomUUID(),
        taskId: task.id,
        machineId: task.machineId,
        scheduledFor,
        triggeredAt: now,
        startedAt: now,
        finishedAt,
        status: 'failed',
        errorMessage: message,
        createdAt: now,
        updatedAt: finishedAt
      }
    }

    const finishedAt = finalRun.finishedAt ?? now
    const nextTaskState: ScheduledTask = task.scheduleType === 'once'
      ? { ...task, phase: 'archived', updatedAt: finishedAt }
      : { ...task, updatedAt: finishedAt }

    await this.store.update((state) => ({
      ...state,
      tasks: state.tasks.map((current) => current.id !== task.id ? current : nextTaskState),
      runs: [...state.runs, finalRun]
    }))

    await this.emitChange({ type: 'task-updated', task: nextTaskState })
    await this.emitChange({ type: 'run-updated', run: finalRun, task: nextTaskState })
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
