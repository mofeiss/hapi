import { describe, expect, it } from 'vitest'
import type { TracedMessage } from '@/chat/tracer'
import { reduceTimeline } from '@/chat/reducerTimeline'

function createReducerContext(groups: Map<string, TracedMessage[]>) {
    return {
        permissionsById: new Map(),
        groups,
        consumedGroupIds: new Set<string>(),
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
            id: 'task-tool-1',
            name: 'Task',
            input: { prompt },
            description: null,
            uuid: 'root-uuid',
            parentUUID: null
        }]
    }
}

describe('reduceTimeline sidechain prompt handling', () => {
    it('does not render sidechain prompt as duplicated user bubble inside Task details', () => {
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
            }
        ]

        const groups = new Map<string, TracedMessage[]>([[taskMessageId, sidechain]])
        const result = reduceTimeline(root, createReducerContext(groups))

        expect(result.blocks).toHaveLength(1)
        expect(result.blocks[0]?.kind).toBe('tool-call')
        if (result.blocks[0]?.kind !== 'tool-call') return

        expect(result.blocks[0].children).toHaveLength(1)
        expect(result.blocks[0].children[0]?.kind).toBe('agent-text')
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
        const result = reduceTimeline(root, createReducerContext(groups))
        const taskBlock = result.blocks[0]

        if (!taskBlock || taskBlock.kind !== 'tool-call') {
            throw new Error('Expected first block to be task tool-call')
        }

        expect(taskBlock.children).toHaveLength(1)
        expect(taskBlock.children[0]?.kind).toBe('user-text')
    })

    it('merges duplicate CodexBash payloads and preserves richer output', () => {
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
                    name: 'CodexBash',
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
                    name: 'CodexBash',
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
})
