import type {
  ScheduledAgentFlavor,
  ScheduledCatchUpPolicy,
  ScheduledSessionPermission,
  ScheduledTask,
  ScheduledTaskOutcome,
  ScheduledTaskRun
} from '@hapi/protocol'

export type CreateScheduledTaskInput = {
  machineId: string
  namespace?: string
  createdBySessionId?: string
  title: string
  prompt: string
  agentFlavor?: ScheduledAgentFlavor
  targetDirectory: string
  model?: string
  scheduleType?: ScheduledTask['scheduleType']
  runAt?: number
  cron?: string
  timezone?: string
  paused?: boolean
  scheduledSessionPermission: ScheduledSessionPermission
  allowOverlap?: boolean
  catchUpPolicy?: ScheduledCatchUpPolicy
  maxSkewMs?: number
}

export type UpdateScheduledTaskInput = {
  taskId: string
  title?: string
  prompt?: string
  agentFlavor?: ScheduledAgentFlavor
  targetDirectory?: string
  model?: string
  scheduleType?: ScheduledTask['scheduleType']
  runAt?: number
  cron?: string
  timezone?: string
  paused?: boolean
  scheduledSessionPermission?: ScheduledSessionPermission
  allowOverlap?: boolean
  catchUpPolicy?: ScheduledCatchUpPolicy
  maxSkewMs?: number
}

export type ListScheduledTasksFilters = {
  machineId?: string
  status?: ScheduledTask['status']
}

export type ListScheduledTaskRunsFilters = {
  taskId?: string
  machineId?: string
}

export type SchedulerTriggerContext = {
  task: ScheduledTask
  run: ScheduledTaskRun
}

export type SchedulerTriggerResult = {
  sessionId?: string
  resultSummary?: string
}

export type ReportScheduledTaskOutcomeInput = {
  runId: string
  outcome: ScheduledTaskOutcome
}
