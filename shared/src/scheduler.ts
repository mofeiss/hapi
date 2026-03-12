import { z } from 'zod'

export const ScheduledAgentFlavorSchema = z.enum(['claude', 'codex'])
export type ScheduledAgentFlavor = z.infer<typeof ScheduledAgentFlavorSchema>

export const ScheduledTaskStatusSchema = z.enum([
    'active',
    'paused',
    'completed',
    'failed',
    'canceled'
])
export type ScheduledTaskStatus = z.infer<typeof ScheduledTaskStatusSchema>

export const ScheduledTaskRunStatusSchema = z.enum([
    'queued',
    'running',
    'succeeded',
    'failed',
    'missed',
    'canceled'
])
export type ScheduledTaskRunStatus = z.infer<typeof ScheduledTaskRunStatusSchema>

export const ScheduledRunStrategySchema = z.enum(['new_session'])
export type ScheduledRunStrategy = z.infer<typeof ScheduledRunStrategySchema>

export const ScheduledTaskTypeSchema = z.enum(['once', 'cron'])
export type ScheduledTaskType = z.infer<typeof ScheduledTaskTypeSchema>

export const ScheduledCatchUpPolicySchema = z.enum(['once_within_window', 'skip'])
export type ScheduledCatchUpPolicy = z.infer<typeof ScheduledCatchUpPolicySchema>

