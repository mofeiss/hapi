import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'hapi:widescreen'
const listeners = new Set<() => void>()

function getSnapshot(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
        return true
    }

    return stored === 'true'
}

function subscribe(callback: () => void): () => void {
    listeners.add(callback)
    return () => listeners.delete(callback)
}

export function toggleWidescreen(): void {
    const next = !getSnapshot()
    localStorage.setItem(STORAGE_KEY, String(next))
    listeners.forEach(l => l())
}

export function useWidescreen(): { widescreen: boolean; toggleWidescreen: () => void } {
    const widescreen = useSyncExternalStore(subscribe, getSnapshot)
    return { widescreen, toggleWidescreen }
}
