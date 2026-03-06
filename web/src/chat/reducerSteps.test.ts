import { describe, expect, it } from 'vitest'
import type { AgentReasoningBlock, ChatBlock, ToolCallBlock } from '@/chat/types'
import { groupToolBlocksIntoSteps } from '@/chat/reducerSteps'

function createToolBlock(id: string, createdAt: number): ToolCallBlock {
    return {
        kind: 'tool-call',
        id,
        localId: null,
        createdAt,
        tool: {
            id,
            name: 'Read',
            state: 'completed',
            input: {},
            createdAt,
            startedAt: createdAt,
            completedAt: createdAt,
            description: null
        },
        children: []
    }
}

function createReasoningBlock(id: string, createdAt: number, text: string): AgentReasoningBlock {
    return {
        kind: 'agent-reasoning',
        id,
        localId: null,
        createdAt,
        text
    }
}

function expectStepsBlock(block: ChatBlock | undefined): ToolCallBlock {
    expect(block?.kind).toBe('tool-call')
    if (!block || block.kind !== 'tool-call') {
        throw new Error('Expected tool-call block')
    }
    expect(block.tool.name).toBe('Steps')
    return block
}

describe('groupToolBlocksIntoSteps', () => {
    it('keeps leading reasoning outside when only one tool follows', () => {
        const blocks: ChatBlock[] = [
            createReasoningBlock('r1', 1, 'leading reasoning'),
            createToolBlock('t1', 2)
        ]

        const grouped = groupToolBlocksIntoSteps(blocks)

        expect(grouped).toHaveLength(2)
        expect(grouped[0]?.kind).toBe('agent-reasoning')
        expect(grouped[1]?.kind).toBe('tool-call')
        if (grouped[1]?.kind !== 'tool-call') return
        expect(grouped[1].tool.name).toBe('Read')
    })

    it('groups consecutive tools into a single steps block after standalone reasoning', () => {
        const blocks: ChatBlock[] = [
            createReasoningBlock('r1', 1, 'leading reasoning'),
            createToolBlock('t1', 2),
            createToolBlock('t2', 3)
        ]

        const grouped = groupToolBlocksIntoSteps(blocks)

        expect(grouped).toHaveLength(2)
        expect(grouped[0]?.kind).toBe('agent-reasoning')
        const steps = expectStepsBlock(grouped[1])
        expect(steps.tool.input).toEqual({ count: 2 })
        expect(steps.children.map((child) => child.id)).toEqual(['t1', 't2'])
    })

    it('groups only reasoning that is sandwiched between two tools', () => {
        const blocks: ChatBlock[] = [
            createReasoningBlock('r1', 1, 'leading reasoning'),
            createToolBlock('t1', 2),
            createReasoningBlock('r2', 3, 'middle reasoning'),
            createToolBlock('t2', 4),
            createReasoningBlock('r3', 5, 'trailing reasoning')
        ]

        const grouped = groupToolBlocksIntoSteps(blocks)

        expect(grouped).toHaveLength(3)
        expect(grouped[0]?.id).toBe('r1')
        const steps = expectStepsBlock(grouped[1])
        expect(steps.tool.input).toEqual({ count: 2 })
        expect(steps.children.map((child) => child.id)).toEqual(['t1', 'r2', 't2'])
        expect(grouped[2]?.id).toBe('r3')
    })
})
