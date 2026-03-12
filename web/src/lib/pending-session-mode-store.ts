import { useSyncExternalStore } from 'react'
import type { PermissionMode } from '@/types/api'

type PendingSessionMode = {
    permissionMode: PermissionMode
    basePermissionMode?: PermissionMode
    createdAt: number
}

const TTL_MS = 2 * 60 * 1000
const pendingBySessionId = new Map<string, PendingSessionMode>()
const listeners = new Set<() => void>()

function notify(): void {
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

function pruneExpired(now: number = Date.now()): void {
    let changed = false
    for (const [sessionId, entry] of pendingBySessionId.entries()) {
        if (now - entry.createdAt > TTL_MS) {
            pendingBySessionId.delete(sessionId)
            changed = true
        }
    }
    if (changed) {
        notify()
    }
}

function isExpired(entry: PendingSessionMode, now: number = Date.now()): boolean {
    return now - entry.createdAt > TTL_MS
}

export function setPendingSessionMode(
    sessionId: string,
    payload: { permissionMode: PermissionMode; basePermissionMode?: PermissionMode }
): void {
    pruneExpired()
    pendingBySessionId.set(sessionId, {
        permissionMode: payload.permissionMode,
        basePermissionMode: payload.basePermissionMode,
        createdAt: Date.now()
    })
    notify()
}

export function clearPendingSessionMode(sessionId: string): void {
    if (pendingBySessionId.delete(sessionId)) {
        notify()
    }
}

export function getPendingSessionMode(sessionId: string): PendingSessionMode | null {
    const entry = pendingBySessionId.get(sessionId)
    if (!entry) {
        return null
    }
    return isExpired(entry) ? null : entry
}

export function usePendingSessionMode(sessionId: string): PendingSessionMode | null {
    return useSyncExternalStore(
        subscribe,
        () => getPendingSessionMode(sessionId)
    )
}
