import { useEffect } from 'react'
import { useKeyboardShortcutSettings } from '@/hooks/useKeyboardShortcuts'

type UseAppKeyboardShortcutsOptions = {
    isMobileViewport: boolean
    canToggleMobileSessionPane: boolean
    onOpenNewSession: () => void
    onSwitchToScheduled: () => void
    onSwitchToSessions: () => void
    onToggleSettings: () => void
    onToggleDesktopSidebar: () => void
    onToggleMobileSessionPane: () => void
}

function hasCommandModifier(event: KeyboardEvent): boolean {
    return event.metaKey || event.ctrlKey
}

export function useAppKeyboardShortcuts(options: UseAppKeyboardShortcutsOptions): void {
    const { shortcutSettings } = useKeyboardShortcutSettings()
    const {
        canToggleMobileSessionPane,
        isMobileViewport,
        onOpenNewSession,
        onSwitchToScheduled,
        onSwitchToSessions,
        onToggleDesktopSidebar,
        onToggleMobileSessionPane,
        onToggleSettings,
    } = options

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!hasCommandModifier(event) || event.isComposing) {
                return
            }

            if (
                shortcutSettings.toggleSettings
                && event.code === 'Comma'
                && !event.altKey
                && !event.shiftKey
                && !event.repeat
            ) {
                event.preventDefault()
                onToggleSettings()
                return
            }

            if (
                shortcutSettings.toggleSidebar
                && event.code === 'KeyD'
                && !event.altKey
                && event.shiftKey
                && !event.repeat
            ) {
                if (isMobileViewport) {
                    if (!canToggleMobileSessionPane) {
                        return
                    }
                    event.preventDefault()
                    onToggleMobileSessionPane()
                    return
                }

                event.preventDefault()
                onToggleDesktopSidebar()
                return
            }

            if (
                shortcutSettings.openNewSession
                && event.code === 'Comma'
                && event.altKey
                && !event.shiftKey
                && !event.repeat
            ) {
                event.preventDefault()
                onOpenNewSession()
                return
            }

            if (
                shortcutSettings.switchToSessions
                && event.code === 'Digit1'
                && !event.altKey
                && !event.shiftKey
                && !event.repeat
            ) {
                event.preventDefault()
                onSwitchToSessions()
                return
            }

            if (
                shortcutSettings.switchToScheduled
                && event.code === 'Digit2'
                && !event.altKey
                && !event.shiftKey
                && !event.repeat
            ) {
                event.preventDefault()
                onSwitchToScheduled()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        canToggleMobileSessionPane,
        isMobileViewport,
        onOpenNewSession,
        onSwitchToScheduled,
        onSwitchToSessions,
        onToggleDesktopSidebar,
        onToggleMobileSessionPane,
        onToggleSettings,
        shortcutSettings,
    ])
}
