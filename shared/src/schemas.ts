import { z } from 'zod'
import { MODEL_MODES, PERMISSION_MODES } from './modes'
import {
    ScheduledAgentFlavorSchema,
    ScheduledCatchUpPolicySchema,
    ScheduledRunStrategySchema,
    ScheduledSessionPermissionSchema,
    ScheduledTaskOutcomeStatusSchema,
    ScheduledTaskRunStatusSchema,
    ScheduledTaskStatusSchema,
    ScheduledTaskTypeSchema
} from './scheduler'

export const PermissionModeSchema = z.enum(PERMISSION_MODES)
export const ModelModeSchema = z.enum(MODEL_MODES)

const MetadataSummarySchema = z.object({
    text: z.string(),
    updatedAt: z.number()
})

export const WorktreeMetadataSchema = z.object({
    basePath: z.string(),
    branch: z.string(),
    name: z.string(),
    worktreePath: z.string().optional(),
    createdAt: z.number().optional()
})

export type WorktreeMetadata = z.infer<typeof WorktreeMetadataSchema>

export const ReasoningEffortSchema = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>

export const SessionTriggerMetadataSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('scheduled-task'),
        taskId: z.string(),
        runId: z.string(),
        scheduleType: ScheduledTaskTypeSchema,
        scheduledSessionPermission: ScheduledSessionPermissionSchema,
        iteration: z.number().int().positive().optional()
    })
])

export type SessionTriggerMetadata = z.infer<typeof SessionTriggerMetadataSchema>

export const SessionForensicsSchema = z.object({
    hapiHomeDir: z.string().optional(),
    hapiLogsDir: z.string().optional(),
    resolvedHapiLogFile: z.string().optional(),
    agentSessionSearchRoot: z.string().optional(),
    resolvedAgentSessionFile: z.string().optional(),
    claudeProjectPath: z.string().optional(),
    claudeSessionId: z.string().optional(),
    codexSessionsRoot: z.string().optional(),
    codexSessionId: z.string().optional()
})

export type SessionForensics = z.infer<typeof SessionForensicsSchema>

export const MetadataSchema = z.object({
    path: z.string(),
    host: z.string(),
    version: z.string().optional(),
    name: z.string().optional(),
    os: z.string().optional(),
    summary: MetadataSummarySchema.optional(),
    machineId: z.string().optional(),
    claudeSessionId: z.string().optional(),
    codexSessionId: z.string().optional(),
    geminiSessionId: z.string().optional(),
    opencodeSessionId: z.string().optional(),
    tools: z.array(z.string()).optional(),
    slashCommands: z.array(z.string()).optional(),
    homeDir: z.string().optional(),
    happyHomeDir: z.string().optional(),
    happyLibDir: z.string().optional(),
    happyToolsDir: z.string().optional(),
    startedFromRunner: z.boolean().optional(),
    hostPid: z.number().optional(),
    startedBy: z.enum(['runner', 'terminal']).optional(),
    lifecycleState: z.string().optional(),
    lifecycleStateSince: z.number().optional(),
    archivedBy: z.string().optional(),
    archiveReason: z.string().optional(),
    flavor: z.string().nullish(),
    model: z.string().optional(),
    reasoningEffort: ReasoningEffortSchema.optional(),
    worktree: WorktreeMetadataSchema.optional(),
    trigger: SessionTriggerMetadataSchema.optional(),
    forensics: SessionForensicsSchema.optional()
})

export type Metadata = z.infer<typeof MetadataSchema>

export const AgentStateRequestSchema = z.object({
    tool: z.string(),
    arguments: z.unknown(),
    createdAt: z.number().nullish()
})

export type AgentStateRequest = z.infer<typeof AgentStateRequestSchema>

export const AgentStateCompletedRequestSchema = z.object({
    tool: z.string(),
    arguments: z.unknown(),
    createdAt: z.number().nullish(),
    completedAt: z.number().nullish(),
    status: z.enum(['canceled', 'denied', 'approved']),
    reason: z.string().optional(),
    mode: z.string().optional(),
    decision: z.enum(['approved', 'approved_for_session', 'denied', 'abort']).optional(),
    allowTools: z.array(z.string()).optional(),
    // Flat format: Record<string, string[]> (AskUserQuestion)
    // Nested format: Record<string, { answers: string[] }> (request_user_input)
    answers: z.union([
        z.record(z.string(), z.array(z.string())),
        z.record(z.string(), z.object({ answers: z.array(z.string()) }))
    ]).optional()
})

export type AgentStateCompletedRequest = z.infer<typeof AgentStateCompletedRequestSchema>

export const AgentStateSchema = z.object({
    controlledByUser: z.boolean().nullish(),
    runtimeUnavailable: z.object({
        reason: z.string(),
        detectedAt: z.number(),
        recoverable: z.boolean().optional()
    }).nullish(),
    requests: z.record(z.string(), AgentStateRequestSchema).nullish(),
    completedRequests: z.record(z.string(), AgentStateCompletedRequestSchema).nullish()
})

export type AgentState = z.infer<typeof AgentStateSchema>

export const TodoItemSchema = z.object({
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
    priority: z.enum(['high', 'medium', 'low']),
    id: z.string()
})

export type TodoItem = z.infer<typeof TodoItemSchema>

export const TodosSchema = z.array(TodoItemSchema)

export const AttachmentMetadataSchema = z.object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    path: z.string(),
    previewUrl: z.string().optional()
})

export type AttachmentMetadata = z.infer<typeof AttachmentMetadataSchema>

export const DecryptedMessageSchema = z.object({
    id: z.string(),
    seq: z.number().nullable(),
    localId: z.string().nullable(),
    content: z.unknown(),
    createdAt: z.number()
})

export type DecryptedMessage = z.infer<typeof DecryptedMessageSchema>

export const ScheduledTaskSchema = z.object({
    id: z.string(),
    namespace: z.string(),
    machineId: z.string(),
    createdBySessionId: z.string().optional(),
    title: z.string(),
    prompt: z.string(),
    agentFlavor: ScheduledAgentFlavorSchema,
    targetDirectory: z.string(),
    permissionMode: z.string().optional(),
    basePermissionMode: z.string().optional(),
    model: z.string().optional(),
    reasoningEffort: ReasoningEffortSchema.optional(),
    runStrategy: ScheduledRunStrategySchema,
    scheduleType: ScheduledTaskTypeSchema,
    scheduleSpec: z.object({
        runAt: z.number().optional(),
        cron: z.string().optional()
    }),
    timezone: z.string(),
    nextRunAt: z.number().optional(),
    lastRunAt: z.number().optional(),
    status: ScheduledTaskStatusSchema,
    paused: z.boolean(),
    scheduledSessionPermission: ScheduledSessionPermissionSchema,
    allowOverlap: z.boolean(),
    catchUpPolicy: ScheduledCatchUpPolicySchema,
    maxSkewMs: z.number().int().nonnegative(),
    lastError: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number()
})

export type ScheduledTask = z.infer<typeof ScheduledTaskSchema>

export const ScheduledTaskOutcomeSchema = z.object({
    status: ScheduledTaskOutcomeStatusSchema,
    summary: z.string().min(1),
    needsUserIntervention: z.boolean().optional(),
    permanentFailureLikely: z.boolean().optional(),
    reportedAt: z.number()
})

export type ScheduledTaskOutcome = z.infer<typeof ScheduledTaskOutcomeSchema>

export const ScheduledTaskRunSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    machineId: z.string(),
    scheduledFor: z.number(),
    triggeredAt: z.number(),
    startedAt: z.number().optional(),
    finishedAt: z.number().optional(),
    status: ScheduledTaskRunStatusSchema,
    sessionId: z.string().optional(),
    error: z.string().optional(),
    resultSummary: z.string().optional(),
    taskOutcome: ScheduledTaskOutcomeSchema.optional(),
    createdAt: z.number(),
    updatedAt: z.number()
})

export type ScheduledTaskRun = z.infer<typeof ScheduledTaskRunSchema>

export const SessionSchema = z.object({
    id: z.string(),
    namespace: z.string(),
    seq: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    active: z.boolean(),
    activeAt: z.number(),
    metadata: MetadataSchema.nullable(),
    metadataVersion: z.number(),
    agentState: AgentStateSchema.nullable(),
    agentStateVersion: z.number(),
    thinking: z.boolean(),
    thinkingAt: z.number(),
    todos: TodosSchema.optional(),
    permissionMode: PermissionModeSchema.optional(),
    basePermissionMode: PermissionModeSchema.optional(),
    modelMode: ModelModeSchema.optional()
})

export type Session = z.infer<typeof SessionSchema>

const SessionEventBaseSchema = z.object({
    namespace: z.string().optional()
})

const SessionChangedSchema = SessionEventBaseSchema.extend({
    sessionId: z.string()
})

const MachineChangedSchema = SessionEventBaseSchema.extend({
    machineId: z.string()
})

const ScheduledTaskChangedSchema = MachineChangedSchema.extend({
    taskId: z.string()
})

const ScheduledRunChangedSchema = ScheduledTaskChangedSchema.extend({
    runId: z.string()
})

export const SyncEventSchema = z.discriminatedUnion('type', [
    SessionChangedSchema.extend({
        type: z.literal('session-added'),
        data: z.unknown().optional()
    }),
    SessionChangedSchema.extend({
        type: z.literal('session-updated'),
        data: z.unknown().optional()
    }),
    SessionEventBaseSchema.extend({
        type: z.literal('session-removed'),
        sessionId: z.string()
    }),
    SessionChangedSchema.extend({
        type: z.literal('message-received'),
        message: DecryptedMessageSchema
    }),
    MachineChangedSchema.extend({
        type: z.literal('machine-updated'),
        data: z.unknown().optional()
    }),
    ScheduledTaskChangedSchema.extend({
        type: z.literal('scheduled-task-updated'),
        data: z.unknown().optional()
    }),
    ScheduledTaskChangedSchema.extend({
        type: z.literal('scheduled-task-removed')
    }),
    ScheduledRunChangedSchema.extend({
        type: z.literal('scheduled-run-updated'),
        data: z.unknown().optional()
    }),
    SessionEventBaseSchema.extend({
        type: z.literal('toast'),
        data: z.object({
            title: z.string(),
            body: z.string(),
            sessionId: z.string(),
            url: z.string()
        })
    }),
    SessionEventBaseSchema.extend({
        type: z.literal('connection-changed'),
        data: z.object({
            status: z.string(),
            subscriptionId: z.string().optional()
        }).optional()
    })
])

export type SyncEvent = z.infer<typeof SyncEventSchema>
