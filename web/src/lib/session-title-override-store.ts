/**
 * Lightweight global store for session title overrides.
 * Used to show "New Chat" in both SessionHeader and SessionList after /clear.
 */
import { useSyncExternalStore } from 'react'

const overrides = new Map<string, string>()
const listeners = new Set<() => void>()

function notify() {
    for (const fn of listeners) fn()
}

function subscribe(cb: () => void) {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
}

export function setSessionTitleOverride(sessionId: string, title: string) {
    overrides.set(sessionId, title)
    notify()
}

export function clearSessionTitleOverride(sessionId: string) {
    if (overrides.delete(sessionId)) {
        notify()
    }
}

export function getSessionTitleOverride(sessionId: string): string | null {
    return overrides.get(sessionId) ?? null
}

export function useSessionTitleOverride(sessionId: string): string | null {
    return useSyncExternalStore(
        subscribe,
        () => overrides.get(sessionId) ?? null
    )
}
