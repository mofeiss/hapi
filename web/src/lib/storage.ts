export type StorageScope = 'local' | 'session'

function getStorage(scope: StorageScope): Storage | null {
    if (typeof window === 'undefined') {
        return null
    }

    return scope === 'local' ? window.localStorage : window.sessionStorage
}

export function readStorageItem(scope: StorageScope, key: string): string | null {
    try {
        return getStorage(scope)?.getItem(key) ?? null
    } catch {
        return null
    }
}

export function writeStorageItem(scope: StorageScope, key: string, value: string): void {
    try {
        getStorage(scope)?.setItem(key, value)
    } catch {
        // Ignore storage failures so the app remains usable.
    }
}

export function removeStorageItem(scope: StorageScope, key: string): void {
    try {
        getStorage(scope)?.removeItem(key)
    } catch {
        // Ignore storage failures so the app remains usable.
    }
}

export function readStorageJson<T>(scope: StorageScope, key: string): T | null {
    const raw = readStorageItem(scope, key)
    if (!raw) {
        return null
    }

    try {
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

export function writeStorageJson(scope: StorageScope, key: string, value: unknown): void {
    writeStorageItem(scope, key, JSON.stringify(value))
}
