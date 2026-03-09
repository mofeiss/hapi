import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nContext, I18nProvider } from '@/lib/i18n-context'
import { en } from '@/lib/locales'
import { PROTOCOL_VERSION } from '@hapi/protocol'
import { SettingsPanel as SettingsPage } from './index'

// Mock the router hooks
vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn(),
    useRouter: () => ({ history: { back: vi.fn() } }),
    useLocation: () => '/settings',
}))

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
    useKeyboardShortcutSettings: () => ({
        shortcutSettings: {
            toggleSettings: true,
            toggleSidebar: false,
            openNewSession: true,
        },
        setShortcutEnabled: vi.fn(),
    }),
    keyboardShortcutDefinitions: [
        {
            id: 'toggleSettings',
            titleKey: 'settings.shortcuts.toggleSettings.title',
            detailKey: 'settings.shortcuts.toggleSettings.detail',
            combos: [['Cmd/Ctrl', ',']],
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
    ],
}))

// Mock languages
vi.mock('@/lib/languages', () => ({
    getElevenLabsSupportedLanguages: () => [
        { code: null, name: 'Auto-detect' },
        { code: 'en', name: 'English' },
    ],
    getLanguageDisplayName: (lang: { code: string | null; name: string }) => lang.name,
}))

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <I18nProvider>
            {ui}
        </I18nProvider>
    )
}

function renderWithSpyT(ui: React.ReactElement) {
    const translations = en as Record<string, string>
    const spyT = vi.fn((key: string) => translations[key] ?? key)
    render(
        <I18nContext.Provider value={{ t: spyT, locale: 'en', setLocale: vi.fn() }}>
            {ui}
        </I18nContext.Provider>
    )
    return spyT
}

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(() => 'en'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }
        Object.defineProperty(window, 'localStorage', { value: localStorageMock })
    })

    it('renders the About section', () => {
        renderWithProviders(<SettingsPage />)
        expect(screen.getByText('About')).toBeInTheDocument()
    })

    it('displays the App Version with correct value', () => {
        renderWithProviders(<SettingsPage />)
        expect(screen.getAllByText('App Version').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(__APP_VERSION__).length).toBeGreaterThanOrEqual(1)
    })

    it('displays the Protocol Version with correct value', () => {
        renderWithProviders(<SettingsPage />)
        expect(screen.getAllByText('Protocol Version').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(String(PROTOCOL_VERSION)).length).toBeGreaterThanOrEqual(1)
    })

    it('displays the website link with correct URL and security attributes', () => {
        renderWithProviders(<SettingsPage />)
        expect(screen.getAllByText('Website').length).toBeGreaterThanOrEqual(1)
        const links = screen.getAllByRole('link', { name: 'hapi.run' })
        expect(links.length).toBeGreaterThanOrEqual(1)
        const link = links[0]
        expect(link).toHaveAttribute('href', 'https://hapi.run')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders the keyboard shortcuts section with switches', () => {
        renderWithProviders(<SettingsPage />)
        expect(screen.getAllByText('Keyboard Shortcuts').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByRole('switch', { name: 'Toggle Settings' }).at(-1)).toHaveAttribute('aria-checked', 'true')
        expect(screen.getAllByRole('switch', { name: 'Sidebar / Session List' }).at(-1)).toHaveAttribute('aria-checked', 'false')
        expect(screen.getAllByRole('switch', { name: 'Open New Session' }).at(-1)).toHaveAttribute('aria-checked', 'true')
        expect(screen.getAllByText('Cmd/Ctrl').length).toBeGreaterThanOrEqual(1)
    })

    it('shows the native browser zoom hint instead of app font size controls', () => {
        renderWithProviders(<SettingsPage />)
        expect(screen.getAllByText('Zoom Mode').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/native browser zoom/i).length).toBeGreaterThanOrEqual(1)
    })

    it('uses correct i18n keys for About section', () => {
        const spyT = renderWithSpyT(<SettingsPage />)
        const calledKeys = spyT.mock.calls.map((call) => call[0])
        expect(calledKeys).toContain('settings.about.title')
        expect(calledKeys).toContain('settings.about.website')
        expect(calledKeys).toContain('settings.about.appVersion')
        expect(calledKeys).toContain('settings.about.protocolVersion')
    })
})
