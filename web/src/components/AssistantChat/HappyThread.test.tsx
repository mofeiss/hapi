import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { buildThreadMessageGroups, HappyThread } from './HappyThread'

vi.mock('@assistant-ui/react', () => ({
    ThreadPrimitive: {
        Root: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
        Viewport: ({ children }: { children: React.ReactElement }) => children,
        MessageByIndex: ({ index }: { index: number }) => <div data-testid={`message-${index}`} />
    },
    useAssistantApi: () => ({
        thread: () => ({
            getState: () => ({ messages: [] })
        })
    }),
    useAssistantState: (selector: (state: { thread: { messages: unknown[] } }) => unknown) => selector({ thread: { messages: [] } })
}))

function renderHappyThread() {
    const onAtBottomChange = vi.fn()
    const onFlushPending = vi.fn()

    const result = render(
        <I18nProvider>
            <HappyThread
                api={{} as never}
                sessionId="session-1"
                metadata={null}
                disabled={false}
                onRefresh={vi.fn()}
                onFlushPending={onFlushPending}
                onAtBottomChange={onAtBottomChange}
                isLoadingMessages={false}
                messagesWarning={null}
                hasMoreMessages={false}
                isLoadingMoreMessages={false}
                onLoadMore={vi.fn(async () => undefined)}
                pendingCount={0}
                rawMessagesCount={0}
                normalizedMessagesCount={0}
                messagesVersion={0}
                forceScrollToken={0}
            />
        </I18nProvider>
    )

    const viewport = result.container.querySelector('[data-chat-viewport="true"]') as HTMLDivElement | null
    if (!viewport) {
        throw new Error('Expected chat viewport')
    }

    return {
        ...result,
        viewport,
        onAtBottomChange,
        onFlushPending,
    }
}

function mockViewportMetrics(
    viewport: HTMLDivElement,
    metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }
) {
    Object.defineProperties(viewport, {
        scrollHeight: {
            configurable: true,
            get: () => metrics.scrollHeight
        },
        clientHeight: {
            configurable: true,
            get: () => metrics.clientHeight
        },
        scrollTop: {
            configurable: true,
            get: () => metrics.scrollTop,
            set: (value: number) => {
                metrics.scrollTop = value
            }
        }
    })
}

describe('HappyThread auto-scroll sync events', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps bottom-following state when tool expansion still leaves viewport near bottom', async () => {
        const { viewport, onAtBottomChange, onFlushPending } = renderHappyThread()
        mockViewportMetrics(viewport, {
            scrollHeight: 160,
            clientHeight: 200,
            scrollTop: 0
        })

        await waitFor(() => {
            expect(onAtBottomChange).toHaveBeenCalledWith(true)
        })
        onAtBottomChange.mockClear()
        onFlushPending.mockClear()

        act(() => {
            viewport.dispatchEvent(new CustomEvent('hapi:disable-auto-scroll'))
        })
        expect(onAtBottomChange).not.toHaveBeenCalled()

        act(() => {
            viewport.dispatchEvent(new CustomEvent('hapi:sync-scroll-state'))
        })

        expect(onAtBottomChange).not.toHaveBeenCalled()
        expect(onFlushPending).not.toHaveBeenCalled()
    })

    it('marks the thread away-from-bottom only after sync confirms overflowed content', async () => {
        const { viewport, onAtBottomChange } = renderHappyThread()
        mockViewportMetrics(viewport, {
            scrollHeight: 160,
            clientHeight: 200,
            scrollTop: 0
        })

        await waitFor(() => {
            expect(onAtBottomChange).toHaveBeenCalledWith(true)
        })
        onAtBottomChange.mockClear()

        act(() => {
            viewport.dispatchEvent(new CustomEvent('hapi:disable-auto-scroll'))
        })
        expect(onAtBottomChange).not.toHaveBeenCalled()

        mockViewportMetrics(viewport, {
            scrollHeight: 480,
            clientHeight: 200,
            scrollTop: 0
        })

        act(() => {
            viewport.dispatchEvent(new CustomEvent('hapi:sync-scroll-state'))
        })

        expect(onAtBottomChange).toHaveBeenCalledTimes(1)
        expect(onAtBottomChange).toHaveBeenCalledWith(false)
    })

    it('keeps agent-turn keys stable when new assistant messages extend the same turn', () => {
        const initial = buildThreadMessageGroups([
            { id: 'user-1', role: 'user' },
            { id: 'assistant-1', role: 'assistant' }
        ])
        const extended = buildThreadMessageGroups([
            { id: 'user-1', role: 'user' },
            { id: 'assistant-1', role: 'assistant' },
            { id: 'assistant-2', role: 'assistant' },
            { id: 'system-1', role: 'system' }
        ])

        expect(initial[1]).toMatchObject({
            kind: 'agent-turn',
            key: 'assistant-1',
            indices: [1]
        })
        expect(extended[1]).toMatchObject({
            kind: 'agent-turn',
            key: 'assistant-1',
            indices: [1, 2, 3]
        })
    })
})
