import type { ModelMode } from './modes'
import type { ReasoningEffort, Session, SessionForensics, SessionTriggerMetadata, WorktreeMetadata } from './schemas'

export type SessionSummaryMetadata = {
    name?: string
    path: string
    host?: string
    machineId?: string
    summary?: { text: string }
    flavor?: string | null
    model?: string
    reasoningEffort?: ReasoningEffort
    worktree?: WorktreeMetadata
    trigger?: SessionTriggerMetadata
    claudeSessionId?: string
    codexSessionId?: string
    forensics?: SessionForensics
}

export type SessionSummary = {
    id: string
    createdAt: number
    active: boolean
    thinking: boolean
    activeAt: number
    updatedAt: number
    metadata: SessionSummaryMetadata | null
    todoProgress: { completed: number; total: number } | null
    pendingRequestsCount: number
    modelMode?: ModelMode
}

export function toSessionSummary(session: Session): SessionSummary {
    const pendingRequestsCount = session.agentState?.requests ? Object.keys(session.agentState.requests).length : 0

    const metadata: SessionSummaryMetadata | null = session.metadata ? {
        name: session.metadata.name,
        path: session.metadata.path,
        host: session.metadata.host,
        machineId: session.metadata.machineId ?? undefined,
        summary: session.metadata.summary ? { text: session.metadata.summary.text } : undefined,
        flavor: session.metadata.flavor ?? null,
        model: session.metadata.model,
        reasoningEffort: session.metadata.reasoningEffort,
        worktree: session.metadata.worktree,
        trigger: session.metadata.trigger,
        claudeSessionId: session.metadata.claudeSessionId,
        codexSessionId: session.metadata.codexSessionId,
        forensics: session.metadata.forensics
    } : null

    const todoProgress = session.todos?.length ? {
        completed: session.todos.filter(t => t.status === 'completed').length,
        total: session.todos.length
    } : null

    return {
        id: session.id,
        createdAt: session.createdAt,
        active: session.active,
        thinking: session.thinking,
        activeAt: session.activeAt,
        updatedAt: session.updatedAt,
        metadata,
        todoProgress,
        pendingRequestsCount,
        modelMode: session.modelMode
    }
}
