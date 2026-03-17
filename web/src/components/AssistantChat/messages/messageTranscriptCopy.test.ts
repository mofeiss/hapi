import { describe, expect, it } from 'vitest'
import type { AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import { buildLoadedTranscriptCopyText } from '@/components/AssistantChat/messages/messageTranscriptCopy'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import type { SessionMetadataSummary } from '@/types/api'

const metadata: SessionMetadataSummary = {
    path: '/workspace',
    host: 'local'
}

type TestMessage = Parameters<typeof buildLoadedTranscriptCopyText>[0][number]

function createMessage(props: {
    id: string
    role: TestMessage['role']
    content: AssistantCopyPart[]
    custom?: Partial<HappyChatMessageMetadata>
}): TestMessage {
    return {
        id: props.id,
        role: props.role,
        content: props.content,
        metadata: props.custom ? { custom: props.custom } : undefined
    }
}

describe('buildLoadedTranscriptCopyText', () => {
    it('copies from the earliest loaded user prompt through the current message', () => {
        const messages: TestMessage[] = [
            createMessage({
                id: 'event:0',
                role: 'system',
                content: [{ type: 'text', text: 'ready' }],
                custom: { kind: 'event', event: { type: 'ready' } }
            }),
            createMessage({
                id: 'user:u1',
                role: 'user',
                content: [{ type: 'text', text: 'Rename the file.' }],
                custom: { kind: 'user' }
            }),
            createMessage({
                id: 'assistant:a1',
                role: 'assistant',
                content: [{ type: 'reasoning', text: 'Check the current file name.' }],
                custom: { kind: 'assistant' }
            }),
            createMessage({
                id: 'assistant:a2',
                role: 'assistant',
                content: [{ type: 'tool-call', artifact: {
                    kind: 'tool-call',
                    id: 'tool-1',
                    localId: null,
                    createdAt: 1,
                    tool: {
                        id: 'tool-1',
                        name: 'Read',
                        state: 'completed',
                        input: { file_path: '/workspace/CLAUDE.md' },
                        createdAt: 1,
                        startedAt: 1,
                        completedAt: 2,
                        description: null
                    },
                    children: []
                } }],
                custom: { kind: 'tool', toolCallId: 'tool-1' }
            })
        ]

        expect(buildLoadedTranscriptCopyText(messages, {
            metadata,
            locale: 'en',
            t: (key) => key
        })).toBe(
            [
                '<UserPrompt>\nRename the file.\n</UserPrompt>',
                '```Reasoning\nCheck the current file name.\n```',
                '```Tool_Call\n✓ View CLAUDE.md file\n```'
            ].join('\n\n')
        )
    })

    it('uses edited user text and keeps later system messages in the copied range', () => {
        const messages: TestMessage[] = [
            createMessage({
                id: 'user:u1',
                role: 'user',
                content: [{ type: 'text', text: 'old text' }],
                custom: { kind: 'user' }
            }),
            createMessage({
                id: 'system:s1',
                role: 'system',
                content: [{ type: 'text', text: 'fallback' }],
                custom: { kind: 'event', event: { type: 'message', message: 'Permission granted' } }
            }),
            createMessage({
                id: 'assistant:a1',
                role: 'assistant',
                content: [{ type: 'text', text: 'Done.' }],
                custom: { kind: 'assistant' }
            })
        ]

        expect(buildLoadedTranscriptCopyText(messages, {
            metadata,
            locale: 'en',
            t: (_key, params) => String(params?.message ?? 'Permission granted'),
            editedMessageTextById: {
                u1: 'new text'
            }
        })).toBe(
            [
                '<UserPrompt>\nnew text\n</UserPrompt>',
                '<Event>\nPermission granted\n</Event>',
                'Done.'
            ].join('\n\n')
        )
    })

    it('keeps change_title output as a tool call in transcript copy', () => {
        const messages: TestMessage[] = [
            createMessage({
                id: 'user:u1',
                role: 'user',
                content: [{ type: 'text', text: '创建一个一次性任务。' }],
                custom: { kind: 'user' }
            }),
            createMessage({
                id: 'tool:title-1',
                role: 'assistant',
                content: [{ type: 'tool-call', artifact: {
                    kind: 'tool-call',
                    id: 'title-1',
                    localId: null,
                    createdAt: 1,
                    tool: {
                        id: 'title-1',
                        name: 'mcp__hapi__change_title',
                        state: 'completed',
                        input: { title: '创建一次性任务查询 Node 版本' },
                        createdAt: 1,
                        startedAt: 1,
                        completedAt: 2,
                        description: null
                    },
                    children: []
                } }],
                custom: { kind: 'tool', toolCallId: 'title-1' }
            })
        ]

        expect(buildLoadedTranscriptCopyText(messages, {
            metadata,
            locale: 'en',
            t: (key) => key
        })).toBe(
            [
                '<UserPrompt>\n创建一个一次性任务。\n</UserPrompt>',
                '```Tool_Call\n✓ MCP: HAPI Change Title | 创建一次性任务查询 Node 版本\n```'
            ].join('\n\n')
        )
    })
})
