import type {
  ScheduledAgentFlavor,
  ScheduledTask,
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
  permissionMode?: string
  basePermissionMode?: string
  model?: string
  reasoningEffort?: ScheduledTask['reasoningEffort']
  runAt: number
  timezone?: string
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

