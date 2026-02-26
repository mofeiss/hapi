import { useSyncExternalStore } from 'react'
import { getTelegramWebApp } from './useTelegram'

type ColorScheme = 'light' | 'dark'

const THEME_OVERRIDE_KEY = 'hapi:theme:override'

function getColorScheme(): ColorScheme {
    // User manual override takes priority
    if (typeof window !== 'undefined') {
        const override = localStorage.getItem(THEME_OVERRIDE_KEY)
        if (override === 'light' || override === 'dark') {
            return override
        }
    }

    const tg = getTelegramWebApp()
    if (tg?.colorScheme) {
        return tg.colorScheme === 'dark' ? 'dark' : 'light'
    }

    // Fallback to system preference for browser environment
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    return 'light'
}

function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function applyTheme(scheme: ColorScheme): void {
    document.documentElement.setAttribute('data-theme', scheme)
}

function applyPlatform(): void {
    if (isIOS()) {
        document.documentElement.classList.add('ios')
    }
}

// External store for theme state
let currentScheme: ColorScheme = getColorScheme()
const listeners = new Set<() => void>()

// Apply theme immediately at module load (before React renders)
applyTheme(currentScheme)

function subscribe(callback: () => void): () => void {
    listeners.add(callback)
    return () => listeners.delete(callback)
}

function getSnapshot(): ColorScheme {
    return currentScheme
}

function updateScheme(): void {
    const newScheme = getColorScheme()
    if (newScheme !== currentScheme) {
        currentScheme = newScheme
        applyTheme(newScheme)
        listeners.forEach((cb) => cb())
    }
}

// Track if theme listeners have been set up
let listenersInitialized = false

function toggleTheme(): void {
    const newScheme: ColorScheme = currentScheme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_OVERRIDE_KEY, newScheme)
    currentScheme = newScheme
    applyTheme(newScheme)
    listeners.forEach((cb) => cb())
}

export function useTheme(): { colorScheme: ColorScheme; isDark: boolean; toggleTheme: () => void } {
    const colorScheme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    return {
        colorScheme,
        isDark: colorScheme === 'dark',
        toggleTheme,
    }
}

// Call this once at app startup to ensure theme is applied and listeners attached
export function initializeTheme(): void {
    currentScheme = getColorScheme()
    applyTheme(currentScheme)

    // Set up listeners only once (after SDK may have loaded)
    if (!listenersInitialized) {
        listenersInitialized = true
        const tg = getTelegramWebApp()
        if (tg?.onEvent) {
            // Telegram theme changes
            tg.onEvent('themeChanged', updateScheme)
        } else if (typeof window !== 'undefined' && window.matchMedia) {
            // Browser system preference changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            mediaQuery.addEventListener('change', updateScheme)
        }
    }
}
