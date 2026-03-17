import { describe, expect, it } from 'vitest'
import type { TracedMessage } from '@/chat/tracer'
import { reduceTimeline } from '@/chat/reducerTimeline'

function createReducerContext(groups: Map<string, TracedMessage[]>, subAgentPrompts: string[] = []) {
    return {
        permissionsById: new Map(),
        groups,
        consumedGroupIds: new Set<string>(),
        subAgentPrompts: new Set(subAgentPrompts),
        titleChangesByToolUseId: new Map<string, string>(),
        emittedTitleChangeToolUseIds: new Set<string>(),
        seenSkillReadContents: new Set<string>()
    }
}

function createTaskMessage(taskMessageId: string, prompt: string): TracedMessage {
    return {
        id: taskMessageId,
        localId: null,
        createdAt: 1,
        role: 'agent',
        isSidechain: false,
        content: [{
            type: 'tool-call',
            id: `task-tool-${taskMessageId}`,
            name: 'Task',
            input: { prompt },
            description: null,
            uuid: 'root-uuid',
            parentUUID: null
        }]
    }
}

describe('reduceTimeline sidechain prompt handling', () => {
    it('keeps change_title as a tool call instead of converting it into an event', () => {
        const root: TracedMessage[] = [
            {
                id: 'title-tool-call',
                localId: null,
                createdAt: 1,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: 'title-tool-1',
                    name: 'mcp__hapi__change_title',
                    input: { title: '创建一次性任务查询 Node 版本' },
                    description: null,
                    uuid: 'title-tool-uuid',
                    parentUUID: null
                }]
            },
            {
                id: 'title-tool-result',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-result',
                    tool_use_id: 'title-tool-1',
                    content: { ok: true },
                    is_error: false,
                    uuid: 'title-tool-result-uuid',
                    parentUUID: null
                }]
            }
        ]

        const result = reduceTimeline(root, createReducerContext(new Map()))

        expect(result.blocks).toHaveLength(1)
        expect(result.blocks[0]?.kind).toBe('tool-call')
        if (result.blocks[0]?.kind !== 'tool-call') return

        expect(result.blocks[0].tool.name).toBe('mcp__hapi__change_title')
        expect(result.blocks[0].tool.state).toBe('completed')
        expect(result.blocks[0].tool.input).toEqual({ title: '创建一次性任务查询 Node 版本' })
    })

    it('does not render prompt echo as duplicated assistant text inside Task details', () => {
        const prompt = '分析日志并总结错误原因'
        const taskMessageId = 'task-msg-1'
        const root = [createTaskMessage(taskMessageId, prompt)]

        const sidechain: TracedMessage[] = [
            {
                id: 'sidechain-root',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: true,
                content: [{ type: 'sidechain', uuid: 'sidechain-uuid', prompt }]
            },
            {
                id: 'sidechain-agent-text',
                localId: null,
                createdAt: 3,
                role: 'agent',
                isSidechain: true,
                content: [{ type: 'text', text: prompt, uuid: 'reply-uuid', parentUUID: 'sidechain-uuid' }]
            },
            {
                id: 'sidechain-agent-real-output',
                localId: null,
                createdAt: 4,
                role: 'agent',
                isSidechain: true,
                content: [{ type: 'text', text: '共发现 2 个错误', uuid: 'reply-uuid-2', parentUUID: 'reply-uuid' }]
            }
        ]

        const groups = new Map<string, TracedMessage[]>([[taskMessageId, sidechain]])
        const result = reduceTimeline(root, createReducerContext(groups, [prompt]))

        expect(result.blocks).toHaveLength(1)
        expect(result.blocks[0]?.kind).toBe('tool-call')
        if (result.blocks[0]?.kind !== 'tool-call') return

        expect(result.blocks[0].children).toHaveLength(1)
        expect(result.blocks[0].children[0]?.kind).toBe('agent-text')
        if (result.blocks[0].children[0]?.kind !== 'agent-text') return
        expect(result.blocks[0].children[0].text).toBe('共发现 2 个错误')
    })

    it('still keeps real user messages in Task sidechain details', () => {
        const taskMessageId = 'task-msg-2'
        const root = [createTaskMessage(taskMessageId, '执行任务')]

        const sidechain: TracedMessage[] = [
            {
                id: 'sidechain-root-2',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: true,
                content: [{ type: 'sidechain', uuid: 'sidechain-uuid-2', prompt: '执行任务' }]
            },
            {
                id: 'real-user-message',
                localId: null,
                createdAt: 3,
                role: 'user',
                isSidechain: true,
                content: { type: 'text', text: '请只输出关键结论' }
            }
        ]

        const groups = new Map<string, TracedMessage[]>([[taskMessageId, sidechain]])
        const result = reduceTimeline(root, createReducerContext(groups, ['执行任务']))
        const taskBlock = result.blocks[0]

        if (!taskBlock || taskBlock.kind !== 'tool-call') {
            throw new Error('Expected first block to be task tool-call')
        }

        expect(taskBlock.children).toHaveLength(1)
        expect(taskBlock.children[0]?.kind).toBe('user-text')
    })

    it('drops prompt echoes for parallel sidechains without affecting Task cards', () => {
        const prompts = [
            '请查询并告诉我现在的准确时间（包括日期和时区信息）。用中文回答。',
            '请查询北京明天（2026年3月11日）的天气预报，包括温度、天气状况、风力等信息。用中文回答。',
            '请查询成都明天（2026年3月11日）的天气预报，包括温度、天气状况、风力等信息。用中文回答。'
        ]

        const root = prompts.map((prompt, index) => createTaskMessage(`task-msg-parallel-${index}`, prompt))
        const groups = new Map<string, TracedMessage[]>(
            prompts.map((prompt, index) => [
                `task-msg-parallel-${index}`,
                [
                    {
                        id: `sidechain-root-${index}`,
                        localId: null,
                        createdAt: index + 2,
                        role: 'agent',
                        isSidechain: true,
                        content: [{ type: 'sidechain', uuid: `sidechain-uuid-${index}`, prompt }]
                    },
                    {
                        id: `sidechain-echo-${index}`,
                        localId: null,
                        createdAt: index + 3,
                        role: 'agent',
                        isSidechain: true,
                        content: [{ type: 'text', text: prompt, uuid: `reply-uuid-${index}`, parentUUID: `sidechain-uuid-${index}` }]
                    }
                ]
            ])
        )

        const result = reduceTimeline(root, createReducerContext(groups, prompts))

        expect(result.blocks).toHaveLength(3)
        for (const block of result.blocks) {
            expect(block.kind).toBe('tool-call')
            if (block.kind !== 'tool-call') continue
            expect(block.children).toHaveLength(0)
        }
    })

    it('drops sidechain prompt echoes for Agent tool results rendered in the main thread', () => {
        const prompt = '执行 pwd 命令，把结果告诉我。'
        const root: TracedMessage[] = [
            {
                id: 'agent-tool-msg',
                localId: null,
                createdAt: 1,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: 'agent-tool-1',
                    name: 'Agent',
                    input: {
                        prompt,
                        description: '子 agent 执行 pwd',
                        mode: 'auto'
                    },
                    description: '子 agent 执行 pwd',
                    uuid: 'agent-tool-uuid',
                    parentUUID: null
                }]
            },
            {
                id: 'sidechain-prompt-echo',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: true,
                content: [{
                    type: 'text',
                    text: prompt,
                    uuid: 'sidechain-prompt-uuid',
                    parentUUID: null
                }]
            },
            {
                id: 'agent-final-answer',
                localId: null,
                createdAt: 3,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'text',
                    text: '子 agent 执行 `pwd` 的结果是：\n\n```\n/Users/ofeiss/project/hapi\n```',
                    uuid: 'agent-final-uuid',
                    parentUUID: null
                }]
            }
        ]

        const result = reduceTimeline(root, createReducerContext(new Map(), [prompt]))

        expect(result.blocks).toHaveLength(2)
        expect(result.blocks[0]?.kind).toBe('tool-call')
        expect(result.blocks[1]?.kind).toBe('agent-text')
        if (result.blocks[1]?.kind !== 'agent-text') return
        expect(result.blocks[1].text).toContain('/Users/ofeiss/project/hapi')
    })

    it('merges duplicate exec_command payloads and preserves richer output', () => {
        const root: TracedMessage[] = [
            {
                id: 'tool-call-rich',
                localId: null,
                createdAt: 1,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: 'call-1',
                    name: 'exec_command',
                    input: {
                        command: '/bin/zsh -lc rg -n "todo|fixme" .',
                        cwd: '/workspace',
                        parsed_cmd: [{ type: 'search', query: 'todo|fixme', path: '.' }],
                        source: 'unified_exec_startup',
                        process_id: '123'
                    },
                    description: null,
                    uuid: 'uuid-1',
                    parentUUID: null
                }]
            },
            {
                id: 'tool-call-thin',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: 'call-1',
                    name: 'exec_command',
                    input: {
                        command: '/bin/zsh -lc "rg -n \\"todo|fixme\\" ."',
                        cwd: '/workspace'
                    },
                    description: null,
                    uuid: 'uuid-2',
                    parentUUID: null
                }]
            },
            {
                id: 'tool-result-rich',
                localId: null,
                createdAt: 3,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-result',
                    tool_use_id: 'call-1',
                    content: {
                        command: '/bin/zsh -lc rg -n "todo|fixme" .',
                        cwd: '/workspace',
                        stdout: './foo.ts:1:// TODO\n',
                        output: './foo.ts:1:// TODO\n',
                        exit_code: 0,
                        status: 'completed'
                    },
                    is_error: false,
                    uuid: 'uuid-3',
                    parentUUID: null
                }]
            },
            {
                id: 'tool-result-thin',
                localId: null,
                createdAt: 4,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-result',
                    tool_use_id: 'call-1',
                    content: {
                        command: '/bin/zsh -lc "rg -n \\"todo|fixme\\" ."',
                        cwd: '/workspace',
                        exit_code: 0,
                        status: 'completed'
                    },
                    is_error: false,
                    uuid: 'uuid-4',
                    parentUUID: null
                }]
            }
        ]

        const result = reduceTimeline(root, createReducerContext(new Map()))
        expect(result.blocks).toHaveLength(1)

        const block = result.blocks[0]
        if (!block || block.kind !== 'tool-call') {
            throw new Error('Expected first block to be tool-call')
        }

        expect(block.tool.input).toMatchObject({
            cwd: '/workspace',
            source: 'unified_exec_startup',
            process_id: '123'
        })
        expect(block.tool.result).toMatchObject({
            cwd: '/workspace',
            stdout: './foo.ts:1:// TODO\n',
            output: './foo.ts:1:// TODO\n',
            exit_code: 0,
            status: 'completed'
        })
    })

    it('keeps write_stdin as a separate tool call instead of merging it into exec_command', () => {
        const root: TracedMessage[] = [
            {
                id: 'bash-call',
                localId: null,
                createdAt: 1,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: 'cmd-1',
                    name: 'exec_command',
                    input: {
                        command: 'python -i',
                        cwd: '/workspace'
                    },
                    description: null,
                    uuid: 'bash-call-uuid',
                    parentUUID: null
                }]
            },
            {
                id: 'stdin-call',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: 'write_stdin:cmd-1',
                    name: 'write_stdin',
                    input: {
                        stdin: 'print(1)\n',
                        call_id: 'cmd-1'
                    },
                    description: null,
                    uuid: 'stdin-call-uuid',
                    parentUUID: null
                }]
            },
            {
                id: 'stdin-result',
                localId: null,
                createdAt: 3,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-result',
                    tool_use_id: 'write_stdin:cmd-1',
                    content: {
                        status: 'completed',
                        stdin: 'print(1)\n',
                        call_id: 'cmd-1'
                    },
                    is_error: false,
                    uuid: 'stdin-result-uuid',
                    parentUUID: null
                }]
            }
        ]

        const result = reduceTimeline(root, createReducerContext(new Map()))
        expect(result.blocks).toHaveLength(2)

        expect(result.blocks[0]?.kind).toBe('tool-call')
        expect(result.blocks[1]?.kind).toBe('tool-call')
        if (result.blocks[0]?.kind !== 'tool-call' || result.blocks[1]?.kind !== 'tool-call') {
            throw new Error('Expected tool-call blocks')
        }

        expect(result.blocks[0].tool.name).toBe('exec_command')
        expect(result.blocks[1].tool.name).toBe('write_stdin')
        expect(result.blocks[1].tool.state).toBe('completed')
        expect(result.blocks[1].tool.input).toEqual({
            stdin: 'print(1)\n',
            call_id: 'cmd-1'
        })
    })
})
