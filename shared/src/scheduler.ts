import { z } from 'zod'

export const HAPI_TIMEZONE = 'Asia/Shanghai'

export const ScheduledDelayUnitValueSchema = z.number().int().nonnegative()

export const ScheduledDelaySchema = z.object({
    years: ScheduledDelayUnitValueSchema.optional(),
    months: ScheduledDelayUnitValueSchema.optional(),
    days: ScheduledDelayUnitValueSchema.optional(),
    hours: ScheduledDelayUnitValueSchema.optional(),
    minutes: ScheduledDelayUnitValueSchema.optional(),
    seconds: ScheduledDelayUnitValueSchema.optional()
}).refine((value) => Object.values(value).some((entry) => typeof entry === 'number' && entry > 0), {
    message: 'at least one delay unit must be greater than zero'
})

export type ScheduledDelay = z.infer<typeof ScheduledDelaySchema>

export const ScheduledAgentFlavorSchema = z.enum(['claude', 'codex'])
export type ScheduledAgentFlavor = z.infer<typeof ScheduledAgentFlavorSchema>

export const ScheduledTaskPhaseSchema = z.enum([
    'enabled',
    'paused',
    'archived'
])
export type ScheduledTaskPhase = z.infer<typeof ScheduledTaskPhaseSchema>

export const ScheduledTaskRunStatusSchema = z.enum([
    'succeeded',
    'failed'
])
export type ScheduledTaskRunStatus = z.infer<typeof ScheduledTaskRunStatusSchema>

export const ScheduledTaskDisplayStatusSchema = z.enum([
    'ready',
    'succeeded',
    'completed',
    'healthy',
    'failed'
])
export type ScheduledTaskDisplayStatus = z.infer<typeof ScheduledTaskDisplayStatusSchema>

export const ScheduledRunStrategySchema = z.enum(['new_session'])
export type ScheduledRunStrategy = z.infer<typeof ScheduledRunStrategySchema>

export const ScheduledTaskTypeSchema = z.enum(['once', 'cron'])
export type ScheduledTaskType = z.infer<typeof ScheduledTaskTypeSchema>

export const ScheduledCatchUpPolicySchema = z.enum(['once_within_window', 'skip'])
export type ScheduledCatchUpPolicy = z.infer<typeof ScheduledCatchUpPolicySchema>

export const ScheduledSessionPermissionSchema = z.enum([
    'aware',
    'self_control',
    'system_control'
])
export type ScheduledSessionPermission = z.infer<typeof ScheduledSessionPermissionSchema>

export const ScheduledTaskOutcomeStatusSchema = z.enum([
    'completed',
    'partial',
    'blocked',
    'abandoned'
])
export type ScheduledTaskOutcomeStatus = z.infer<typeof ScheduledTaskOutcomeStatusSchema>
