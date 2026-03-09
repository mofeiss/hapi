import { useEffect } from 'react'
import { useKeyboardShortcutSettings } from '@/hooks/useKeyboardShortcuts'

type UseAppKeyboardShortcutsOptions = {
    isMobileViewport: boolean
    canToggleMobileSessionPane: boolean
    onOpenNewSession: () => void
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
                && event.code === 'KeyN'
                && event.altKey
                && !event.shiftKey
                && !event.repeat
            ) {
                event.preventDefault()
                onOpenNewSession()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        canToggleMobileSessionPane,
        isMobileViewport,
        onOpenNewSession,
        onToggleDesktopSidebar,
        onToggleMobileSessionPane,
        onToggleSettings,
        shortcutSettings,
    ])
}
