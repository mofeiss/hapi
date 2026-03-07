import { describe, expect, it } from 'vitest'
import { formatTurnDurationCompact, getAssistantTurnDurationInfo } from '@/components/AssistantChat/messages/messageDuration'

describe('formatTurnDurationCompact', () => {
    it('formats seconds with S as the smallest unit', () => {
        expect(formatTurnDurationCompact(0)).toBe('0S')
        expect(formatTurnDurationCompact(800)).toBe('1S')
        expect(formatTurnDurationCompact(59_400)).toBe('59S')
    })

    it('carries into minutes, hours, and days', () => {
        expect(formatTurnDurationCompact(65_000)).toBe('1M 05S')
        expect(formatTurnDurationCompact(3_660_000)).toBe('1H 01M')
        expect(formatTurnDurationCompact(97_200_000)).toBe('1D 03H')
    })
})

describe('getAssistantTurnDurationInfo', () => {
    it('uses the nearest prior non-cli user prompt as the turn start', () => {
        const range = getAssistantTurnDurationInfo([
            {
                role: 'user',
                createdAt: new Date(1_000),
                metadata: { custom: { kind: 'user' } }
            },
            {
                role: 'user',
                createdAt: new Date(2_000),
                metadata: { custom: { kind: 'cli-output', source: 'user' } }
            },
            {
                role: 'assistant',
                createdAt: new Date(5_000),
                metadata: { custom: { kind: 'assistant' } }
            }
        ], 2)

        expect(range).toEqual({
            startAt: 1_000,
            fallbackEndAt: 5_000,
            finalEndAt: null,
            turnEndIndex: 2
        })
    })

    it('uses turn-duration event as the final turn end when available', () => {
        const range = getAssistantTurnDurationInfo([
            {
                role: 'user',
                createdAt: new Date(1_000),
                metadata: { custom: { kind: 'user' } }
            },
            {
                role: 'assistant',
                createdAt: new Date(2_000),
                metadata: { custom: { kind: 'tool', toolCallId: 'tool-1' } }
            },
            {
                role: 'assistant',
                createdAt: new Date(4_000),
                metadata: { custom: { kind: 'assistant' } }
            },
            {
                role: 'system',
                createdAt: new Date(4_100),
                metadata: { custom: { kind: 'event', event: { type: 'turn-duration', durationMs: 9_000 } } }
            }
        ], 2)

        expect(range).toEqual({
            startAt: 1_000,
            fallbackEndAt: 4_100,
            finalEndAt: 10_000,
            turnEndIndex: 3
        })
    })
})
