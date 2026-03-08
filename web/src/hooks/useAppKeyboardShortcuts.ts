import { useEffect } from 'react'
import { stepFontScale } from '@/hooks/useFontScale'
import { useKeyboardShortcutSettings } from '@/hooks/useKeyboardShortcuts'

type UseAppKeyboardShortcutsOptions = {
    isMobileViewport: boolean
    canToggleMobileSessionPane: boolean
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
        onToggleDesktopSidebar,
        onToggleMobileSessionPane,
        onToggleSettings,
    } = options

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!hasCommandModifier(event) || event.altKey || event.isComposing) {
                return
            }

            if (
                shortcutSettings.toggleSettings
                && event.code === 'Comma'
                && !event.shiftKey
                && !event.repeat
            ) {
                event.preventDefault()
                onToggleSettings()
                return
            }

            if (shortcutSettings.adjustFontScale && event.code === 'Equal') {
                event.preventDefault()
                stepFontScale(1)
                return
            }

            if (shortcutSettings.adjustFontScale && event.code === 'Minus') {
                event.preventDefault()
                stepFontScale(-1)
                return
            }

            if (
                shortcutSettings.toggleSidebar
                && event.code === 'KeyD'
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
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        canToggleMobileSessionPane,
        isMobileViewport,
        onToggleDesktopSidebar,
        onToggleMobileSessionPane,
        onToggleSettings,
        shortcutSettings,
    ])
}
