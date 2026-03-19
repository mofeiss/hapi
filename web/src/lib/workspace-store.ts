import { useSyncExternalStore } from 'react'
import { readStorageJson, writeStorageJson } from '@/lib/storage'

export type WorkspaceTab = 'sessions' | 'scheduled'
export type SessionSubview = 'chat' | 'files' | 'terminal'
export type WorkspaceOverlay = 'none' | 'settings' | 'newSession'

export type WorkspaceState = {
    tab: WorkspaceTab
    overlay: WorkspaceOverlay
    selectedSessionId: string | null
    sessionSubview: SessionSubview
    selectedScheduledTaskId: string | null
    selectedScheduledRunId: string | null
}

const DEFAULT_STATE: WorkspaceState = {
    tab: 'sessions',
    overlay: 'none',
    selectedSessionId: null,
    sessionSubview: 'chat',
    selectedScheduledTaskId: null,
    selectedScheduledRunId: null,
}

const STORAGE_KEY = 'hapi:workspace-state'

function isWorkspaceTab(value: unknown): value is WorkspaceTab {
    return value === 'sessions' || value === 'scheduled'
}

function isSessionSubview(value: unknown): value is SessionSubview {
    return value === 'chat' || value === 'files' || value === 'terminal'
}

function isWorkspaceOverlay(value: unknown): value is WorkspaceOverlay {
    return value === 'none' || value === 'settings' || value === 'newSession'
}

function readPersistedState(): WorkspaceState {
    const parsed = readStorageJson<Partial<WorkspaceState>>('session', STORAGE_KEY)
    if (!parsed) {
        return DEFAULT_STATE
    }

    return {
        tab: isWorkspaceTab(parsed.tab) ? parsed.tab : DEFAULT_STATE.tab,
        overlay: isWorkspaceOverlay(parsed.overlay) ? parsed.overlay : DEFAULT_STATE.overlay,
        selectedSessionId: typeof parsed.selectedSessionId === 'string' ? parsed.selectedSessionId : null,
        sessionSubview: isSessionSubview(parsed.sessionSubview) ? parsed.sessionSubview : DEFAULT_STATE.sessionSubview,
        selectedScheduledTaskId: typeof parsed.selectedScheduledTaskId === 'string' ? parsed.selectedScheduledTaskId : null,
        selectedScheduledRunId: typeof parsed.selectedScheduledRunId === 'string' ? parsed.selectedScheduledRunId : null,
    }
}

function persistState(nextState: WorkspaceState): void {
    writeStorageJson('session', STORAGE_KEY, nextState)
}

let state: WorkspaceState = readPersistedState()
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
    const nextState = { ...state, ...next }

    if (
        nextState.tab === state.tab
        && nextState.overlay === state.overlay
        && nextState.selectedSessionId === state.selectedSessionId
        && nextState.sessionSubview === state.sessionSubview
        && nextState.selectedScheduledTaskId === state.selectedScheduledTaskId
        && nextState.selectedScheduledRunId === state.selectedScheduledRunId
    ) {
        return
    }

    state = nextState
    persistState(state)
    emit()
}

export function resetWorkspaceState(): void {
    state = DEFAULT_STATE
    persistState(state)
    emit()
}

export function selectWorkspaceTab(tab: WorkspaceTab): void {
    setWorkspaceState({ tab })
}

export function selectWorkspaceOverlay(overlay: WorkspaceOverlay): void {
    setWorkspaceState({ overlay })
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
