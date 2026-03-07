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
    children: ToolCallBlock['children'] = []
): ToolCallBlock {
    return {
        kind: 'tool-call',
        id,
        localId: null,
        createdAt: 1,
        tool: {
            id,
            name,
            state: 'completed',
            input,
            createdAt: 1,
            startedAt: 1,
            completedAt: 2,
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
                '```Tool_Call\nView src/app.ts file\n```'
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
                createReasoningBlock('reasoning-1', 'Need to verify after edit'),
                createToolBlock('bash-1', 'Bash', { command: 'bun test web' })
            ]
        )

        const parts: AssistantCopyPart[] = [
            { type: 'tool-call', artifact: steps }
        ]

        expect(buildAssistantCopyText(parts, { metadata, locale: 'en' })).toBe(
            '```Tool_Call\nTool Calls | 2 calls\n\n- View src/app.ts file\n\nReasoning:\nNeed to verify after edit\n\n- Run command bun test web\n```'
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
            '```Tool_Call\nWrite 5 chars to src/app.ts\n```'
        )
    })

    it('merges consecutive tool-call parts into one tool_call block', () => {
        const parts: AssistantCopyPart[] = [
            { type: 'tool-call', artifact: createToolBlock('read-1', 'Read', { file_path: '/workspace/src/app.ts' }) },
            { type: 'tool-call', artifact: createToolBlock('bash-1', 'Bash', { command: 'bun test web' }) }
        ]

        expect(buildAssistantCopyText(parts, { metadata, locale: 'en' })).toBe(
            '```Tool_Call\nView src/app.ts file\n\nRun command bun test web\n```'
        )
    })
})
