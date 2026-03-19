import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReasoningGroup } from './reasoning'

const assistantMocks = vi.hoisted(() => ({
    message: {
        id: 'assistant-1',
        status: { type: 'running' as string },
        content: [{ type: 'reasoning' as string, text: 'First reasoning' }]
    }
}))

vi.mock('@assistant-ui/react', () => ({
    TextMessagePartProvider: ({ children }: { text: string; children: React.ReactNode }) => <>{children}</>,
    useMessage: () => assistantMocks.message
}))

vi.mock('@assistant-ui/react-markdown', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@assistant-ui/react-markdown')>()
    return {
        ...actual,
        MarkdownTextPrimitive: ({ className }: { className?: string }) => <div className={className}>mock-markdown</div>
    }
})

function renderReasoningGroup(startIndex: number, endIndex: number) {
    return render(
        <ReasoningGroup startIndex={startIndex} endIndex={endIndex}>
            <div>unused children</div>
        </ReasoningGroup>
    )
}

function getReasoningButtons() {
    return screen.getAllByRole('button', { name: /Reasoning/i })
}

describe('ReasoningGroup', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        assistantMocks.message = {
            id: 'assistant-1',
            status: { type: 'running' },
            content: [{ type: 'reasoning', text: 'First reasoning' }]
        }
    })

    it('auto-expands the currently streaming reasoning group', () => {
        renderReasoningGroup(0, 0)

        expect(screen.getByRole('button', { name: /Reasoning/i })).toHaveAttribute('aria-expanded', 'true')
    })

    it('collapses the previous auto-opened reasoning group when a newer reasoning starts streaming', () => {
        assistantMocks.message = {
            id: 'assistant-1',
            status: { type: 'running' },
            content: [
                { type: 'reasoning', text: 'First reasoning' },
                { type: 'text', text: 'Interleaving text' },
                { type: 'reasoning', text: 'Second reasoning' }
            ]
        }

        render(
            <>
                <ReasoningGroup startIndex={0} endIndex={0}>
                    <div>first</div>
                </ReasoningGroup>
                <ReasoningGroup startIndex={2} endIndex={2}>
                    <div>second</div>
                </ReasoningGroup>
            </>
        )

        const [firstButton, secondButton] = getReasoningButtons()
        expect(firstButton).toHaveAttribute('aria-expanded', 'false')
        expect(secondButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('keeps completed session reasoning collapsed by default', () => {
        assistantMocks.message = {
            id: 'assistant-1',
            status: { type: 'complete' },
            content: [{ type: 'reasoning', text: 'Finished reasoning' }]
        }

        renderReasoningGroup(0, 0)

        expect(screen.getByRole('button', { name: /Reasoning/i })).toHaveAttribute('aria-expanded', 'false')
    })
})
