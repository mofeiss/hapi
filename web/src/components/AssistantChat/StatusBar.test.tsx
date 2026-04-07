import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { StatusBar } from './StatusBar'

describe('StatusBar', () => {
    it('renders a manual refresh action and forwards clicks', () => {
        const onRefresh = vi.fn()

        render(
            <I18nProvider>
                <StatusBar
                    active
                    thinking
                    agentState={null}
                    onRefresh={onRefresh}
                />
            </I18nProvider>
        )

        const refreshButton = screen.getByRole('button', { name: /refresh rendering/i })
        fireEvent.click(refreshButton)

        expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('shows quota and context as separate indicators', () => {
        render(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    rateLimitUsedPercent={2}
                    contextSize={31643}
                    contextWindowTokens={258400}
                />
            </I18nProvider>
        )

        expect(screen.getByText('quota 98% left')).toBeInTheDocument()
        expect(screen.getByText('31.6K / 258K')).toBeInTheDocument()
    })
})
