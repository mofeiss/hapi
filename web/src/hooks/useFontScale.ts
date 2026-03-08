import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'

export type FontScale = 0.8 | 0.9 | 1 | 1.1 | 1.2
const listeners = new Set<() => void>()
const FONT_SCALE_OPTIONS: ReadonlyArray<{ value: FontScale; label: string }> = [
    { value: 0.8, label: '80%' },
    { value: 0.9, label: '90%' },
    { value: 1, label: '100%' },
    { value: 1.1, label: '110%' },
    { value: 1.2, label: '120%' },
]

export function getFontScaleOptions(): ReadonlyArray<{ value: FontScale; label: string }> {
    return FONT_SCALE_OPTIONS
}

function getFontScaleStorageKey(): string {
    return 'hapi-font-scale'
}

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
}

const useIsomorphicLayoutEffect = isBrowser() ? useLayoutEffect : useEffect

function safeGetItem(key: string): string | null {
    if (!isBrowser()) {
        return null
    }
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeSetItem(key: string, value: string): void {
    if (!isBrowser()) {
        return
    }
    try {
        localStorage.setItem(key, value)
    } catch {
        // Ignore storage errors
    }
}

function safeRemoveItem(key: string): void {
    if (!isBrowser()) {
        return
    }
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage errors
    }
}

function emitChange(): void {
    listeners.forEach((listener) => listener())
}

function parseFontScale(raw: string | null): FontScale {
    const value = Number(raw)
    if (value === 0.8 || value === 0.9 || value === 1 || value === 1.1 || value === 1.2) {
        return value
    }
    return 1
}

function applyFontScale(scale: FontScale): void {
    if (!isBrowser()) {
        return
    }
    document.documentElement.style.setProperty('--app-font-scale', String(scale))
}

function getInitialFontScale(): FontScale {
    return parseFontScale(safeGetItem(getFontScaleStorageKey()))
}

function subscribe(callback: () => void): () => void {
    listeners.add(callback)

    if (!isBrowser()) {
        return () => listeners.delete(callback)
    }

    const onStorage = (event: StorageEvent) => {
        if (event.key === getFontScaleStorageKey()) {
            callback()
        }
    }

    window.addEventListener('storage', onStorage)
    return () => {
        listeners.delete(callback)
        window.removeEventListener('storage', onStorage)
    }
}

export function initializeFontScale(): void {
    applyFontScale(getInitialFontScale())
}

export function setFontScale(scale: FontScale): void {
    applyFontScale(scale)

    if (scale === 1) {
        safeRemoveItem(getFontScaleStorageKey())
    } else {
        safeSetItem(getFontScaleStorageKey(), String(scale))
    }

    emitChange()
}

export function stepFontScale(direction: -1 | 1): FontScale {
    const options = FONT_SCALE_OPTIONS.map((option) => option.value) as FontScale[]
    const currentScale = getInitialFontScale()
    const currentIndex = options.indexOf(currentScale)
    const nextIndex = Math.min(
        options.length - 1,
        Math.max(0, currentIndex + direction)
    )
    const nextScale = options[nextIndex] ?? FONT_SCALE_OPTIONS[2].value
    setFontScale(nextScale)
    return nextScale
}

export function useFontScale(): { fontScale: FontScale; setFontScale: (scale: FontScale) => void } {
    const fontScale = useSyncExternalStore(
        subscribe,
        getInitialFontScale,
        () => FONT_SCALE_OPTIONS[2].value
    )

    useIsomorphicLayoutEffect(() => {
        applyFontScale(fontScale)
    }, [fontScale])

    return { fontScale, setFontScale }
}
