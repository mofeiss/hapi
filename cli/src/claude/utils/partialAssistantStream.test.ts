import { describe, expect, it } from 'vitest'
import type { SDKAssistantMessage, SDKStreamEventMessage } from '@/claude/sdk'
import { PartialAssistantStreamTracker } from './partialAssistantStream'

describe('PartialAssistantStreamTracker', () => {
    function createTracker() {
        return new PartialAssistantStreamTracker({
            cwd: '/test/project',
            sessionId: () => 'session-1',
            version: '1.0.0',
            gitBranch: 'main'
        })
    }

    it('streams reasoning and text blocks in order', () => {
        const tracker = createTracker()

        const reasoningUpdate = tracker.consume({
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                index: 0,
                delta: {
                    type: 'thinking_delta',
                    thinking: 'plan'
                }
            }
        } satisfies SDKStreamEventMessage)

        expect(reasoningUpdate).not.toBeNull()
        expect(reasoningUpdate?.logMessage.type).toBe('assistant')
        expect(reasoningUpdate && reasoningUpdate.logMessage.type === 'assistant'
            ? reasoningUpdate.logMessage.message?.content
            : null
        ).toEqual([
            {
                type: 'thinking',
                thinking: 'plan'
            }
        ])

        const textUpdate = tracker.consume({
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                index: 1,
                delta: {
                    type: 'text_delta',
                    text: 'hello'
                }
            }
        } satisfies SDKStreamEventMessage)

        expect(textUpdate?.messageId).toBe(reasoningUpdate?.messageId)
        expect(textUpdate && textUpdate.logMessage.type === 'assistant'
            ? textUpdate.logMessage.message?.content
            : null
        ).toEqual([
            {
                type: 'thinking',
                thinking: 'plan'
            },
            {
                type: 'text',
                text: 'hello'
            }
        ])
    })

    it('reuses the same message id for the final assistant message', () => {
        const tracker = createTracker()

        const partial = tracker.consume({
            type: 'stream_event',
            parent_tool_use_id: 'tool-1',
            event: {
                type: 'content_block_delta',
                index: 0,
                delta: {
                    type: 'text_delta',
                    text: 'child'
                }
            }
        } satisfies SDKStreamEventMessage)

        expect(partial).not.toBeNull()

        const claimedId = tracker.claimMessageId({
            type: 'assistant',
            parent_tool_use_id: 'tool-1',
            message: {
                role: 'assistant',
                content: [
                    {
                        type: 'text',
                        text: 'child'
                    }
                ]
            }
        } satisfies SDKAssistantMessage)

        expect(claimedId).toBe(partial?.messageId)
        expect(tracker.claimMessageId({
            type: 'assistant',
            parent_tool_use_id: 'tool-1',
            message: {
                role: 'assistant',
                content: []
            }
        } satisfies SDKAssistantMessage)).toBeUndefined()
    })

    it('ignores non-text partial blocks', () => {
        const tracker = createTracker()

        const result = tracker.consume({
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                index: 0,
                delta: {
                    type: 'input_json_delta',
                    partial_json: '{"foo":"bar"}'
                }
            }
        } satisfies SDKStreamEventMessage)

        expect(result).toBeNull()
    })
})
