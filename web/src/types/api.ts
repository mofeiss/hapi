import type {
    DecryptedMessage as ProtocolDecryptedMessage,
    ScheduledTask,
    ScheduledTaskRun,
    Session,
    SessionTriggerMetadata,
    SessionSummary,
    SyncEvent as ProtocolSyncEvent,
    WorktreeMetadata
} from '@hapi/protocol/types'

export type {
    AgentState,
    AttachmentMetadata,
    ModelMode,
    PermissionMode,
    ScheduledTask,
    ScheduledTaskRun,
    Session,
    SessionSummary,
    SessionSummaryMetadata,
    TodoItem,
    WorktreeMetadata
} from '@hapi/protocol/types'

export type SessionMetadataSummary = {
    path: string
    host: string
    version?: string
    name?: string
    os?: string
    summary?: { text: string; updatedAt: number }
    machineId?: string
    tools?: string[]
    flavor?: string | null
    model?: string
    reasoningEffort?: CodexReasoningEffort
    worktree?: WorktreeMetadata
    trigger?: SessionTriggerMetadata
    claudeSessionId?: string
    codexSessionId?: string
    forensics?: {
        hapiHomeDir?: string
        hapiLogsDir?: string
        resolvedHapiLogFile?: string
        agentSessionSearchRoot?: string
        resolvedAgentSessionFile?: string
        claudeProjectPath?: string
        claudeSessionId?: string
        codexSessionsRoot?: string
        codexSessionId?: string
    }
}

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type DecryptedMessage = ProtocolDecryptedMessage & {
    status?: MessageStatus
    originalText?: string
}

export type Machine = {
    id: string
    active: boolean
    metadata: {
        host: string
        platform: string
        happyCliVersion: string
        displayName?: string
    } | null
}

export type AuthResponse = {
    token: string
    user: {
        id: number
        username?: string
        firstName?: string
        lastName?: string
    }
}

export type SessionsResponse = { sessions: SessionSummary[] }
export type SessionResponse = { session: Session }
export type MessagesResponse = {
    messages: DecryptedMessage[]
    page: {
        limit: number
        beforeSeq: number | null
        nextBeforeSeq: number | null
        hasMore: boolean
    }
}

export type MachinesResponse = { machines: Machine[] }
export type MachinePathsExistsResponse = { exists: Record<string, boolean> }
export type ScheduledTasksResponse = { tasks: ScheduledTask[]; runs: ScheduledTaskRun[] }

export type SpawnResponse =
    | { type: 'success'; sessionId: string }
    | { type: 'error'; message: string }

export type CodexReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export type UserMessageMeta = {
    sentFrom?: string
    fallbackModel?: string | null
    customSystemPrompt?: string | null
    appendSystemPrompt?: string | null
    allowedTools?: string[] | null
    disallowedTools?: string[] | null
    model?: string | null
    reasoningEffort?: CodexReasoningEffort | null
}

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

export type AgentModelsResponse = {
    success: boolean
    source?: 'codex-app-server' | 'fallback-static'
    models?: AgentModel[]
    error?: string
}

export type GitCommandResponse = {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

export type FileSearchItem = {
    fileName: string
    filePath: string
    fullPath: string
    fileType: 'file' | 'folder'
}

export type FileSearchResponse = {
    success: boolean
    files?: FileSearchItem[]
    error?: string
}

export type DirectoryEntry = {
    name: string
    type: 'file' | 'directory' | 'other'
    size?: number
    modified?: number
}

export type ListDirectoryResponse = {
    success: boolean
    entries?: DirectoryEntry[]
    error?: string
}

export type FileReadResponse = {
    success: boolean
    content?: string
    error?: string
}

export type UploadFileResponse = {
    success: boolean
    path?: string
    error?: string
}

export type DeleteUploadResponse = {
    success: boolean
    error?: string
}

export type GitFileStatus = {
    fileName: string
    filePath: string
    fullPath: string
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'
    isStaged: boolean
    linesAdded: number
    linesRemoved: number
    oldPath?: string
}

export type GitStatusFiles = {
    stagedFiles: GitFileStatus[]
    unstagedFiles: GitFileStatus[]
    branch: string | null
    totalStaged: number
    totalUnstaged: number
}

export type SlashCommand = {
    name: string
    description?: string
    source: 'builtin' | 'user' | 'plugin'
    content?: string  // Expanded content for Codex user prompts
    pluginName?: string
}

export type SlashCommandsResponse = {
    success: boolean
    commands?: SlashCommand[]
    error?: string
}

export type SkillSummary = {
    name: string
    description?: string
}

export type SkillsResponse = {
    success: boolean
    skills?: SkillSummary[]
    error?: string
}

export type PushSubscriptionKeys = {
    p256dh: string
    auth: string
}

export type PushSubscriptionPayload = {
    endpoint: string
    keys: PushSubscriptionKeys
}

export type PushUnsubscribePayload = {
    endpoint: string
}

export type PushVapidPublicKeyResponse = {
    publicKey: string
}

export type VisibilityPayload = {
    subscriptionId: string
    visibility: 'visible' | 'hidden'
}

export type SyncEvent = ProtocolSyncEvent
