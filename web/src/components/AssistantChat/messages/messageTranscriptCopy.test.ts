import { describe, expect, it } from 'vitest'
import type { AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import { buildLoadedTranscriptCopyText, buildTranscriptText } from '@/components/AssistantChat/messages/messageTranscriptCopy'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import type { SessionMetadataSummary } from '@/types/api'

const metadata: SessionMetadataSummary = {
    path: '/workspace',
    host: 'local',
    machineId: 'machine-1',
    flavor: 'codex',
    model: 'gpt-5-codex',
    reasoningEffort: 'high',
    name: 'Debug flaky session',
    worktree: {
        name: 'feature-copy-boundary',
        branch: 'feat/copy-boundary',
        basePath: '/workspace',
        worktreePath: '/workspace/.worktrees/feature-copy-boundary'
    }
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
                        result: { content: '# heading\n' },
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

        expect(buildTranscriptText(messages, {
            metadata,
            locale: 'en',
            t: (key) => key
        })).toBe(
            [
                '<UserPrompt>\nRename the file.\n</UserPrompt>',
                '```Reasoning\nCheck the current file name.\n```',
                [
                    '```Tool_Call',
                    '✓ Read | View CLAUDE.md file',
                    '<Input>',
                    '{',
                    '  "file_path": "/workspace/CLAUDE.md"',
                    '}',
                    '</Input>',
                    '<Result>',
                    '{',
                    '  "content": "# heading\\n"',
                    '}',
                    '</Result>',
                    '```'
                ].join('\n')
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

        expect(buildTranscriptText(messages, {
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
                        result: { success: true },
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

        expect(buildTranscriptText(messages, {
            metadata,
            locale: 'en',
            t: (key) => key
        })).toBe(
            [
                '<UserPrompt>\n创建一个一次性任务。\n</UserPrompt>',
                [
                    '```Tool_Call',
                    '✓ mcp__hapi__change_title | 创建一次性任务查询 Node 版本',
                    '<Input>',
                    '{',
                    '  "title": "创建一次性任务查询 Node 版本"',
                    '}',
                    '</Input>',
                    '<Result>',
                    '{',
                    '  "success": true',
                    '}',
                    '</Result>',
                    '```'
                ].join('\n')
            ].join('\n\n')
        )
    })

    it('includes raw json for nested tool calls inside steps', () => {
        const messages: TestMessage[] = [
            createMessage({
                id: 'user:u1',
                role: 'user',
                content: [{ type: 'text', text: '检查并运行测试。' }],
                custom: { kind: 'user' }
            }),
            createMessage({
                id: 'assistant:a1',
                role: 'assistant',
                content: [{ type: 'tool-call', artifact: {
                    kind: 'tool-call',
                    id: 'steps-1',
                    localId: null,
                    createdAt: 1,
                    tool: {
                        id: 'steps-1',
                        name: 'Steps',
                        state: 'completed',
                        input: { count: 2 },
                        result: null,
                        createdAt: 1,
                        startedAt: 1,
                        completedAt: 2,
                        description: null
                    },
                    children: [
                        {
                            kind: 'tool-call',
                            id: 'read-1',
                            localId: null,
                            createdAt: 1,
                            tool: {
                                id: 'read-1',
                                name: 'Read',
                                state: 'completed',
                                input: { file_path: '/workspace/package.json' },
                                result: { content: '{"name":"hapi"}' },
                                createdAt: 1,
                                startedAt: 1,
                                completedAt: 2,
                                description: null
                            },
                            children: []
                        }
                    ]
                } }],
                custom: { kind: 'assistant' }
            })
        ]

        expect(buildTranscriptText(messages, {
            metadata,
            locale: 'en',
            t: (key) => key
        })).toBe(
            [
                '<UserPrompt>\n检查并运行测试。\n</UserPrompt>',
                [
                    '```Steps | 2 calls',
                    '- ✓ Read | View package.json file',
                    '<Input>',
                    '{',
                    '  "file_path": "/workspace/package.json"',
                    '}',
                    '</Input>',
                    '<Result>',
                    '{',
                    '  "content": "{\\"name\\":\\"hapi\\"}"',
                    '}',
                    '</Result>',
                    '```'
                ].join('\n')
            ].join('\n\n')
        )
    })

    it('wraps Copy ALL output with chat boundaries and evidence-oriented metadata', () => {
        const messages: TestMessage[] = [
            createMessage({
                id: 'user:u1',
                role: 'user',
                content: [{ type: 'text', text: '帮我分析这个会话为什么断开。' }],
                custom: { kind: 'user' }
            }),
            createMessage({
                id: 'assistant:a1',
                role: 'assistant',
                content: [{ type: 'text', text: '我先看日志线索。' }],
                custom: { kind: 'assistant' }
            })
        ]

        expect(buildLoadedTranscriptCopyText(messages, {
            sessionId: 'sess_123',
            metadata: {
                ...metadata,
                codexSessionId: '019cfdb3-1b12-7250-b334-85e4beac7ffe',
                forensics: {
                    hapiHomeDir: '/Users/ofeiss/.hapidev',
                    hapiLogsDir: '/Users/ofeiss/.hapidev/logs',
                    resolvedHapiLogFile: '/Users/ofeiss/.hapidev/logs/2026-03-18-05-28-11-pid-86667.log',
                    agentSessionSearchRoot: '/Users/ofeiss/.codex/sessions',
                    resolvedAgentSessionFile: '/Users/ofeiss/.codex/sessions/2026/03/18/rollout-2026-03-18T05-28-19-019cfdb3-1b12-7250-b334-85e4beac7ffe.jsonl',
                    codexSessionsRoot: '/Users/ofeiss/.codex/sessions',
                    codexSessionId: '019cfdb3-1b12-7250-b334-85e4beac7ffe'
                },
                trigger: {
                    type: 'scheduled-task',
                    taskId: 'task_1',
                    runId: 'run_9',
                    scheduleType: 'once',
                    scheduledSessionPermission: 'aware',
                    iteration: 3
                }
            },
            locale: 'en',
            t: (key) => key
        })).toBe(
            [
                '[聊天记录开始]',
                '',
                '<ChatRecordMeta>',
                '<Format>hapi-chat-record-v1</Format>',
                '<SessionId>sess_123</SessionId>',
                '<SessionTitle>Debug flaky session</SessionTitle>',
                '<AgentFlavor>codex</AgentFlavor>',
                '<Model>gpt-5-codex</Model>',
                '<ReasoningEffort>high</ReasoningEffort>',
                '<Host>local</Host>',
                '<MachineId>machine-1</MachineId>',
                '<WorkspacePath>/workspace</WorkspacePath>',
                '<WorktreeName>feature-copy-boundary</WorktreeName>',
                '<WorktreeBranch>feat/copy-boundary</WorktreeBranch>',
                '<WorktreeBasePath>/workspace</WorktreeBasePath>',
                '<WorktreePath>/workspace/.worktrees/feature-copy-boundary</WorktreePath>',
                '<TriggerType>scheduled-task</TriggerType>',
                '<ScheduledTaskId>task_1</ScheduledTaskId>',
                '<ScheduledRunId>run_9</ScheduledRunId>',
                '<ScheduledScheduleType>once</ScheduledScheduleType>',
                '<ScheduledIteration>3</ScheduledIteration>',
                '<CodexSessionId>019cfdb3-1b12-7250-b334-85e4beac7ffe</CodexSessionId>',
                '<ResolvedHapiLogFile>/Users/ofeiss/.hapidev/logs/2026-03-18-05-28-11-pid-86667.log</ResolvedHapiLogFile>',
                '<ResolvedAgentSessionFile>/Users/ofeiss/.codex/sessions/2026/03/18/rollout-2026-03-18T05-28-19-019cfdb3-1b12-7250-b334-85e4beac7ffe.jsonl</ResolvedAgentSessionFile>',
                '</ChatRecordMeta>',
                '',
                '<UserPrompt>',
                '帮我分析这个会话为什么断开。',
                '</UserPrompt>',
                '',
                '我先看日志线索。',
                '',
                '[聊天记录结束]'
            ].join('\n')
        )
    })
})
