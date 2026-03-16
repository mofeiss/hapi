export interface SpawnSessionOptions {
    machineId?: string
    directory: string
    sessionId?: string
    resumeSessionId?: string
    approvedNewDirectoryCreation?: boolean
    agent?: 'claude' | 'codex' | 'gemini' | 'opencode'
    model?: string
    reasoningEffort?: CodexReasoningEffort
    permissionMode?: string
    basePermissionMode?: string
    token?: string
    sessionType?: 'simple' | 'worktree'
    worktreeName?: string
    trigger?: {
        type: 'scheduled-task'
        taskId: string
        runId: string
        scheduleType: 'once' | 'cron'
        scheduledSessionPermission: 'aware' | 'self_control' | 'system_control'
        iteration?: number
    }
}

export type SpawnSessionResult =
    | { type: 'success'; sessionId: string }
    | { type: 'requestToApproveDirectoryCreation'; directory: string }
    | { type: 'error'; errorMessage: string }

export type CodexReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export type AgentModelReasoningEffortOption = {
    reasoningEffort: CodexReasoningEffort
    description: string
}

export type AgentModel = {
    id: string
    model: string
    displayName: string
    description: string
    hidden: boolean
    isDefault: boolean
    defaultReasoningEffort: CodexReasoningEffort
    supportedReasoningEfforts: AgentModelReasoningEffortOption[]
}

export type AgentModelsResult = {
    success: boolean
    source?: 'codex-app-server' | 'fallback-static'
    models?: AgentModel[]
    error?: string
}
