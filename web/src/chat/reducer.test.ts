import { describe, expect, it } from 'vitest'
import { reduceChatBlocks } from '@/chat/reducer'
import type { NormalizedMessage } from '@/chat/types'

describe('reduceChatBlocks latest usage', () => {
    it('keeps latest context and latest rate limit from separate token_count messages', () => {
        const messages: NormalizedMessage[] = [
            {
                id: 'm1',
                localId: null,
                createdAt: 1,
                role: 'agent',
                isSidechain: false,
                content: [],
                usage: {
                    input_tokens: 15939,
                    output_tokens: 0,
                    context_tokens: 15939,
                    context_window_tokens: 258400
                }
            },
            {
                id: 'm2',
                localId: null,
                createdAt: 2,
                role: 'agent',
                isSidechain: false,
                content: [],
                usage: {
                    input_tokens: 0,
                    output_tokens: 0,
                    rate_limit_used_percent: 2,
                    rate_limit_window_minutes: 300,
                    rate_limit_resets_at: 1775104229
                }
            }
        ]

        const reduced = reduceChatBlocks(messages, null)

        expect(reduced.latestUsage).toEqual({
            inputTokens: 15939,
            outputTokens: 0,
            cacheCreation: 0,
            cacheRead: 0,
            contextSize: 15939,
            contextWindowTokens: 258400,
            rateLimitUsedPercent: 2,
            rateLimitWindowMinutes: 300,
            rateLimitResetsAt: 1775104229,
            timestamp: 2
        })
    })
})
