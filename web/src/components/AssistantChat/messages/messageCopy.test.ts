import { describe, expect, it } from 'vitest'
import type { AgentReasoningBlock, ToolCallBlock } from '@/chat/types'
import { buildAssistantCopyText, type AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import type { SessionMetadataSummary } from '@/types/api'

const metadata: SessionMetadataSummary = {
    path: '/workspace',
    host: 'local'
}

function createToolBlock(
    id: string,
    name: string,
    input: unknown,
    children: ToolCallBlock['children'] = [],
    state: ToolCallBlock['tool']['state'] = 'completed'
): ToolCallBlock {
    return {
        kind: 'tool-call',
        id,
        localId: null,
        createdAt: 1,
        tool: {
            id,
            name,
            state,
            input,
            createdAt: 1,
            startedAt: 1,
            completedAt: state === 'completed' || state === 'error' ? 2 : null,
            description: null
        },
        children
    }
}

function createReasoningBlock(id: string, text: string): AgentReasoningBlock {
    return {
        kind: 'agent-reasoning',
        id,
        localId: null,
        createdAt: 1,
        text
    }
}

describe('buildAssistantCopyText', () => {
    it('copies text, reasoning, and single tool summaries together', () => {
        const parts: AssistantCopyPart[] = [
            { type: 'text', text: 'Done.' },
            { type: 'reasoning', text: 'Inspect src/app.ts\nCheck types' },
            { type: 'tool-call', artifact: createToolBlock('read-1', 'Read', { file_path: '/workspace/src/app.ts' }) }
        ]

        expect(buildAssistantCopyText(parts, { metadata, locale: 'en' })).toBe(
            [
                'Done.',
                '```Reasoning\nInspect src/app.ts\nCheck types\n```',
                '```Tool_Call\n✓ View src/app.ts file\n```'
            ].join('\n\n')
        )
    })

    it('summarizes grouped steps and keeps nested reasoning in order', () => {
        const steps = createToolBlock(
            'steps-1',
            'Steps',
            { count: 2 },
            [
                createToolBlock('read-1', 'Read', { file_path: '/workspace/src/app.ts' }),
                createReasoningBlock('reasoning-1', 'Need to verify\nafter edit'),
                createToolBlock('bash-1', 'Bash', { command: 'bun test web' }, [], 'running')
            ]
        )

        const parts: AssistantCopyPart[] = [
            { type: 'tool-call', artifact: steps }
        ]

        expect(buildAssistantCopyText(parts, { metadata, locale: 'en' })).toBe(
            '```Tool Calls | 2 calls\n- ✓ View src/app.ts file\n- Reasoning: Need to verify after edit\n- ⋯ Run command bun test web\n```'
        )
    })

    it('keeps tool-only assistant messages copyable', () => {
        const parts: AssistantCopyPart[] = [
            {
                type: 'tool-call',
                artifact: createToolBlock('write-1', 'Write', {
                    file_path: '/workspace/src/app.ts',
                    content: 'hello'
                })
            }
        ]

        expect(buildAssistantCopyText(parts, { metadata, locale: 'en' })).toBe(
            '```Tool_Call\n✓ Write 5 chars to src/app.ts\n```'
        )
    })

    it('merges consecutive tool-call parts into one tool_call block', () => {
        const parts: AssistantCopyPart[] = [
            { type: 'tool-call', artifact: createToolBlock('read-1', 'Read', { file_path: '/workspace/src/app.ts' }) },
            { type: 'tool-call', artifact: createToolBlock('bash-1', 'Bash', { command: 'bun test web' }, [], 'error') }
        ]

        expect(buildAssistantCopyText(parts, { metadata, locale: 'en' })).toBe(
            '```Tool_Call\n✓ View src/app.ts file\n✗ Run command bun test web\n```'
        )
    })
})
