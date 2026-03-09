import { useSyncExternalStore } from 'react'

export type KeyboardShortcutId =
    | 'toggleSettings'
    | 'adjustFontScale'
    | 'toggleSidebar'
    | 'openNewSession'

export type KeyboardShortcutSettings = Record<KeyboardShortcutId, boolean>

export type KeyboardShortcutDefinition = {
    id: KeyboardShortcutId
    titleKey: string
    detailKey: string
    combos: ReadonlyArray<ReadonlyArray<string>>
}

const STORAGE_KEY = 'hapi:keyboard-shortcuts'
const listeners = new Set<() => void>()

export const defaultKeyboardShortcutSettings: KeyboardShortcutSettings = {
    toggleSettings: true,
    adjustFontScale: true,
    toggleSidebar: true,
    openNewSession: true,
}

let cachedStoredValue: string | null | undefined
let cachedShortcutSettings: KeyboardShortcutSettings = defaultKeyboardShortcutSettings

export const keyboardShortcutDefinitions: ReadonlyArray<KeyboardShortcutDefinition> = [
    {
        id: 'toggleSettings',
        titleKey: 'settings.shortcuts.toggleSettings.title',
        detailKey: 'settings.shortcuts.toggleSettings.detail',
        combos: [['Cmd/Ctrl', ',']],
    },
    {
        id: 'adjustFontScale',
        titleKey: 'settings.shortcuts.adjustFontScale.title',
        detailKey: 'settings.shortcuts.adjustFontScale.detail',
        combos: [['Cmd/Ctrl', '='], ['Cmd/Ctrl', '-']],
    },
    {
        id: 'toggleSidebar',
        titleKey: 'settings.shortcuts.toggleSidebar.title',
        detailKey: 'settings.shortcuts.toggleSidebar.detail',
        combos: [['Cmd/Ctrl', 'Shift', 'D']],
    },
    {
        id: 'openNewSession',
        titleKey: 'settings.shortcuts.openNewSession.title',
        detailKey: 'settings.shortcuts.openNewSession.detail',
        combos: [['Cmd/Ctrl', 'Alt', 'N']],
    },
]

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function emitChange(): void {
    listeners.forEach((listener) => listener())
}

function normalizeShortcutSettings(raw: unknown): KeyboardShortcutSettings {
    if (!raw || typeof raw !== 'object') {
        return defaultKeyboardShortcutSettings
    }

    const data = raw as Partial<Record<KeyboardShortcutId, unknown>>
    return {
        toggleSettings:
            typeof data.toggleSettings === 'boolean'
                ? data.toggleSettings
                : defaultKeyboardShortcutSettings.toggleSettings,
        adjustFontScale:
            typeof data.adjustFontScale === 'boolean'
                ? data.adjustFontScale
                : defaultKeyboardShortcutSettings.adjustFontScale,
        toggleSidebar:
            typeof data.toggleSidebar === 'boolean'
                ? data.toggleSidebar
                : defaultKeyboardShortcutSettings.toggleSidebar,
        openNewSession:
            typeof data.openNewSession === 'boolean'
                ? data.openNewSession
                : defaultKeyboardShortcutSettings.openNewSession,
    }
}

function getCachedShortcutSettings(stored: string | null): KeyboardShortcutSettings {
    if (stored === cachedStoredValue) {
        return cachedShortcutSettings
    }

    cachedStoredValue = stored

    if (!stored) {
        cachedShortcutSettings = defaultKeyboardShortcutSettings
        return cachedShortcutSettings
    }

    try {
        cachedShortcutSettings = normalizeShortcutSettings(JSON.parse(stored))
        return cachedShortcutSettings
    } catch {
        cachedShortcutSettings = defaultKeyboardShortcutSettings
        return cachedShortcutSettings
    }
}

function readShortcutSettings(): KeyboardShortcutSettings {
    if (!isBrowser()) {
        return defaultKeyboardShortcutSettings
    }

    try {
        return getCachedShortcutSettings(localStorage.getItem(STORAGE_KEY))
    } catch {
        return defaultKeyboardShortcutSettings
    }
}

function writeShortcutSettings(settings: KeyboardShortcutSettings): void {
    if (!isBrowser()) {
        return
    }

    try {
        const serialized = JSON.stringify(settings)
        localStorage.setItem(STORAGE_KEY, serialized)
        cachedStoredValue = serialized
        cachedShortcutSettings = settings
    } catch {
        // Ignore storage errors
    }
}

function subscribe(callback: () => void): () => void {
    listeners.add(callback)

    if (!isBrowser()) {
        return () => listeners.delete(callback)
    }

    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            callback()
        }
    }

    window.addEventListener('storage', onStorage)
    return () => {
        listeners.delete(callback)
        window.removeEventListener('storage', onStorage)
    }
}

export function getKeyboardShortcutSettings(): KeyboardShortcutSettings {
    return readShortcutSettings()
}

export function setKeyboardShortcutEnabled(id: KeyboardShortcutId, enabled: boolean): void {
    const current = readShortcutSettings()
    if (current[id] === enabled) {
        return
    }

    writeShortcutSettings({
        ...current,
        [id]: enabled,
    })
    emitChange()
}

export function useKeyboardShortcutSettings(): {
    shortcutSettings: KeyboardShortcutSettings
    setShortcutEnabled: (id: KeyboardShortcutId, enabled: boolean) => void
} {
    const shortcutSettings = useSyncExternalStore(
        subscribe,
        readShortcutSettings,
        () => defaultKeyboardShortcutSettings
    )

    return {
        shortcutSettings,
        setShortcutEnabled: setKeyboardShortcutEnabled,
    }
}
