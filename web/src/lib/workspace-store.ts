import { useSyncExternalStore } from 'react'

export type WorkspaceTab = 'sessions' | 'scheduled'
export type SessionSubview = 'chat' | 'files' | 'terminal'

export type WorkspaceState = {
    tab: WorkspaceTab
    selectedSessionId: string | null
    sessionSubview: SessionSubview
    selectedScheduledTaskId: string | null
    selectedScheduledRunId: string | null
}

const DEFAULT_STATE: WorkspaceState = {
    tab: 'sessions',
    selectedSessionId: null,
    sessionSubview: 'chat',
    selectedScheduledTaskId: null,
    selectedScheduledRunId: null,
}

let state: WorkspaceState = DEFAULT_STATE
const listeners = new Set<() => void>()

function emit(): void {
    for (const listener of listeners) {
        listener()
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function getWorkspaceState(): WorkspaceState {
    return state
}

export function setWorkspaceState(next: Partial<WorkspaceState>): void {
    state = { ...state, ...next }
    emit()
}

export function resetWorkspaceState(): void {
    state = DEFAULT_STATE
    emit()
}

export function selectWorkspaceTab(tab: WorkspaceTab): void {
    setWorkspaceState({ tab })
}

export function openWorkspaceSession(sessionId: string, subview: SessionSubview = 'chat'): void {
    setWorkspaceState({
        tab: 'sessions',
        selectedSessionId: sessionId,
        sessionSubview: subview,
    })
}

export function clearWorkspaceSessionSelection(): void {
    setWorkspaceState({ selectedSessionId: null, sessionSubview: 'chat' })
}

export function openWorkspaceScheduledTask(taskId: string, runId?: string | null): void {
    setWorkspaceState({
        tab: 'scheduled',
        selectedScheduledTaskId: taskId,
        selectedScheduledRunId: runId ?? null,
    })
}

export function selectWorkspaceScheduledRun(runId: string | null): void {
    setWorkspaceState({ selectedScheduledRunId: runId })
}

export function clearWorkspaceScheduledSelection(): void {
    setWorkspaceState({
        selectedScheduledTaskId: null,
        selectedScheduledRunId: null,
    })
}

export function useWorkspaceState(): WorkspaceState {
    return useSyncExternalStore(subscribe, getWorkspaceState)
}
