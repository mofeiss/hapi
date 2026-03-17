import { describe, expect, it } from 'vitest'
import { getReasoningRenderText, parseReasoningText, summarizeReasoning } from '@/lib/reasoning'

describe('reasoning helpers', () => {
    it('extracts title and body from leading bold heading', () => {
        expect(parseReasoningText('**Evaluating task strategy**\n\nCheck the current branch.')).toEqual({
            title: 'Evaluating task strategy',
            body: 'Check the current branch.'
        })
    })

    it('uses title as preview when a heading is present', () => {
        expect(summarizeReasoning('**Evaluating task strategy**\n\nCheck the current branch.')).toBe('Evaluating task strategy')
    })

    it('renders only the body when a heading is present', () => {
        expect(getReasoningRenderText('**Evaluating task strategy**\n\nCheck the current branch.')).toBe('Check the current branch.')
    })

    it('falls back to original reasoning text when no heading is present', () => {
        const text = 'Check the current branch and recent changes.'
        expect(parseReasoningText(text)).toEqual({
            title: null,
            body: text
        })
        expect(summarizeReasoning(text)).toBe(text)
        expect(getReasoningRenderText(text)).toBe(text)
    })
})

