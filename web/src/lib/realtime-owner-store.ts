import { useSyncExternalStore } from 'react'

export type RealtimeFocusKind = 'session-detail' | 'scheduled-session-detail' | 'scheduled-detail' | 'none'

export type RealtimeOwnerState = {
    focusKind: RealtimeFocusKind
    sessionId: string | null
}

const DEFAULT_STATE: RealtimeOwnerState = {
    focusKind: 'none',
    sessionId: null,
}

let state: RealtimeOwnerState = DEFAULT_STATE
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

export function getRealtimeOwnerState(): RealtimeOwnerState {
    return state
}

export function setRealtimeOwnerState(next: RealtimeOwnerState): void {
    if (state.focusKind === next.focusKind && state.sessionId === next.sessionId) {
        return
    }
    state = next
    emit()
}

export function clearRealtimeOwnerState(): void {
    setRealtimeOwnerState(DEFAULT_STATE)
}

export function useRealtimeOwnerState(): RealtimeOwnerState {
    return useSyncExternalStore(subscribe, getRealtimeOwnerState)
}

