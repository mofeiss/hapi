import { describe, expect, it } from 'vitest'
import type { NormalizedMessage } from '@/chat/types'
import { traceMessages } from '@/chat/tracer'

describe('traceMessages sidechain mapping', () => {
    it('maps sidechains to individual Agent tool call ids within the same message', () => {
        const rootMessage: NormalizedMessage = {
            id: 'root-agent-message',
            localId: null,
            createdAt: 1,
            role: 'agent',
            isSidechain: false,
            content: [
                {
                    type: 'tool-call',
                    id: 'agent-tool-time',
                    name: 'Agent',
                    input: {
                        topic: '查询当前时间',
                        prompt: '请查询并告诉我现在的准确时间（包括日期和时区信息）。用中文回答。'
                    },
                    description: null,
                    uuid: 'tool-uuid-1',
                    parentUUID: null
                },
                {
                    type: 'tool-call',
                    id: 'agent-tool-beijing',
                    name: 'Agent',
                    input: {
                        topic: '查询北京明天天气',
                        prompt: '请查询北京明天（2026年3月11日）的天气预报，包括温度、天气状况、风力等信息。用中文回答。'
                    },
                    description: null,
                    uuid: 'tool-uuid-2',
                    parentUUID: null
                },
                {
                    type: 'tool-call',
                    id: 'agent-tool-chengdu',
                    name: 'Agent',
                    input: {
                        topic: '查询成都明天天气',
                        prompt: '请查询成都明天（2026年3月11日）的天气预报，包括温度、天气状况、风力等信息。用中文回答。'
                    },
                    description: null,
                    uuid: 'tool-uuid-3',
                    parentUUID: null
                }
            ]
        }

        const sidechainMessages: NormalizedMessage[] = [
            {
                id: 'sidechain-root-time',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: true,
                content: [{
                    type: 'sidechain',
                    uuid: 'sidechain-uuid-time',
                    prompt: '请查询并告诉我现在的准确时间（包括日期和时区信息）。用中文回答。'
                }]
            },
            {
                id: 'sidechain-root-beijing',
                localId: null,
                createdAt: 3,
                role: 'agent',
                isSidechain: true,
                content: [{
                    type: 'sidechain',
                    uuid: 'sidechain-uuid-beijing',
                    prompt: '请查询北京明天（2026年3月11日）的天气预报，包括温度、天气状况、风力等信息。用中文回答。'
                }]
            },
            {
                id: 'sidechain-root-chengdu',
                localId: null,
                createdAt: 4,
                role: 'agent',
                isSidechain: true,
                content: [{
                    type: 'sidechain',
                    uuid: 'sidechain-uuid-chengdu',
                    prompt: '请查询成都明天（2026年3月11日）的天气预报，包括温度、天气状况、风力等信息。用中文回答。'
                }]
            }
        ]

        const traced = traceMessages([rootMessage, ...sidechainMessages])

        expect(traced.find((msg) => msg.id === 'sidechain-root-time')?.sidechainId).toBe('agent-tool-time')
        expect(traced.find((msg) => msg.id === 'sidechain-root-beijing')?.sidechainId).toBe('agent-tool-beijing')
        expect(traced.find((msg) => msg.id === 'sidechain-root-chengdu')?.sidechainId).toBe('agent-tool-chengdu')
    })
})
