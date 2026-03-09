import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppKeyboardShortcuts } from './useAppKeyboardShortcuts'

const shortcutSettingsMock = vi.hoisted(() => ({
    current: {
        toggleSettings: true,
        adjustFontScale: true,
        toggleSidebar: true,
        openNewSession: true,
    },
}))

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
    useKeyboardShortcutSettings: () => ({
        shortcutSettings: shortcutSettingsMock.current,
    }),
}))

function Harness(props: { onOpenNewSession: () => void }) {
    useAppKeyboardShortcuts({
        isMobileViewport: false,
        canToggleMobileSessionPane: false,
        onOpenNewSession: props.onOpenNewSession,
        onToggleSettings: vi.fn(),
        onToggleDesktopSidebar: vi.fn(),
        onToggleMobileSessionPane: vi.fn(),
    })

    return null
}

describe('useAppKeyboardShortcuts', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        shortcutSettingsMock.current = {
            toggleSettings: true,
            adjustFontScale: true,
            toggleSidebar: true,
            openNewSession: true,
        }
    })

    it('opens the new session panel on Cmd/Ctrl+Alt+N when enabled', () => {
        const onOpenNewSession = vi.fn()
        render(<Harness onOpenNewSession={onOpenNewSession} />)

        const event = new KeyboardEvent('keydown', {
            code: 'KeyN',
            altKey: true,
            metaKey: true,
            bubbles: true,
            cancelable: true,
        })

        window.dispatchEvent(event)

        expect(onOpenNewSession).toHaveBeenCalledTimes(1)
        expect(event.defaultPrevented).toBe(true)
    })

    it('does not open the new session panel when the shortcut is disabled', () => {
        shortcutSettingsMock.current = {
            toggleSettings: true,
            adjustFontScale: true,
            toggleSidebar: true,
            openNewSession: false,
        }

        const onOpenNewSession = vi.fn()
        render(<Harness onOpenNewSession={onOpenNewSession} />)

        const event = new KeyboardEvent('keydown', {
            code: 'KeyN',
            altKey: true,
            metaKey: true,
            bubbles: true,
            cancelable: true,
        })

        window.dispatchEvent(event)

        expect(onOpenNewSession).not.toHaveBeenCalled()
        expect(event.defaultPrevented).toBe(false)
    })
})
