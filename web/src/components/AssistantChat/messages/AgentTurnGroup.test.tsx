import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HappyChatProvider } from '@/components/AssistantChat/context'
import { I18nProvider } from '@/lib/i18n-context'
import { HappyAgentTurnGroup } from './AgentTurnGroup'

const assistantMocks = vi.hoisted(() => ({
    threadMessages: [] as Array<{
        id: string
        role: 'user' | 'assistant' | 'system'
        createdAt: Date
        content: Array<{ type: string; text?: string }>
        metadata?: {
            custom?: Record<string, unknown>
        }
    }>
}))

vi.mock('@assistant-ui/react', () => ({
    ThreadPrimitive: {
        MessageByIndex: ({ index }: { index: number }) => <div data-testid={`message-${index}`} />
    },
    useAssistantApi: () => ({
        thread: () => ({
            getState: () => ({ messages: assistantMocks.threadMessages })
        })
    }),
    useAssistantState: (selector: (state: { thread: { isRunning: boolean; messages: typeof assistantMocks.threadMessages } }) => unknown) => selector({
        thread: {
            isRunning: false,
            messages: assistantMocks.threadMessages
        }
    })
}))

function renderAgentTurnGroup() {
    return render(
        <I18nProvider>
            <HappyChatProvider value={{
                api: {} as never,
                sessionId: 'session-1',
                metadata: {
                    path: '/workspace',
                    host: 'local'
                },
                disabled: false,
                onRefresh: vi.fn()
            }}
            >
                <HappyAgentTurnGroup indices={[1]} />
            </HappyChatProvider>
        </I18nProvider>
    )
}

describe('HappyAgentTurnGroup', () => {
    beforeEach(() => {
        localStorage.setItem('hapi-lang', 'en')
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: () => ({
                matches: false,
                media: '',
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false
            })
        })
        assistantMocks.threadMessages = [
            {
                id: 'user-1',
                role: 'user',
                createdAt: new Date('2026-03-10T10:00:00.000Z'),
                content: [{ type: 'text', text: 'Status?' }]
            },
            {
                id: 'assistant-1',
                role: 'assistant',
                createdAt: new Date('2026-03-10T10:00:02.000Z'),
                content: [{ type: 'image' }]
            }
        ]
    })

    it('keeps the copy button visible when the current turn has no serializable text yet', () => {
        renderAgentTurnGroup()

        expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Copy all' })).toBeInTheDocument()
    })
})
