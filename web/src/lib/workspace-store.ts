import { useSyncExternalStore } from 'react'

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
    if (typeof window === 'undefined') {
        return DEFAULT_STATE
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return DEFAULT_STATE
        }

        const parsed = JSON.parse(raw) as Partial<WorkspaceState>
        return {
            tab: isWorkspaceTab(parsed.tab) ? parsed.tab : DEFAULT_STATE.tab,
            overlay: isWorkspaceOverlay(parsed.overlay) ? parsed.overlay : DEFAULT_STATE.overlay,
            selectedSessionId: typeof parsed.selectedSessionId === 'string' ? parsed.selectedSessionId : null,
            sessionSubview: isSessionSubview(parsed.sessionSubview) ? parsed.sessionSubview : DEFAULT_STATE.sessionSubview,
            selectedScheduledTaskId: typeof parsed.selectedScheduledTaskId === 'string' ? parsed.selectedScheduledTaskId : null,
            selectedScheduledRunId: typeof parsed.selectedScheduledRunId === 'string' ? parsed.selectedScheduledRunId : null,
        }
    } catch {
        return DEFAULT_STATE
    }
}

function persistState(nextState: WorkspaceState): void {
    if (typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch {
        // Ignore storage failures so the workspace remains usable.
    }
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
    state = { ...state, ...next }
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
