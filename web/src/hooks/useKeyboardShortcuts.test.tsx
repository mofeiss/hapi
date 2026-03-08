import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useKeyboardShortcutSettings } from './useKeyboardShortcuts'

function ShortcutHarness() {
    const { shortcutSettings, setShortcutEnabled } = useKeyboardShortcutSettings()

    return (
        <button
            type="button"
            onClick={() => setShortcutEnabled('toggleSettings', !shortcutSettings.toggleSettings)}
        >
            {shortcutSettings.toggleSettings ? 'enabled' : 'disabled'}
        </button>
    )
}

describe('useKeyboardShortcutSettings', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('toggles shortcut settings without causing recursive updates', () => {
        render(<ShortcutHarness />)

        const button = screen.getByRole('button', { name: 'enabled' })
        fireEvent.click(button)

        expect(screen.getByRole('button', { name: 'disabled' })).toBeInTheDocument()
        expect(localStorage.getItem('hapi:keyboard-shortcuts')).toBe(
            JSON.stringify({
                toggleSettings: false,
                adjustFontScale: true,
                toggleSidebar: true,
            })
        )
    })
})
