import { describe, expect, it } from 'vitest'
import { formatSessionModelLabel } from '@/components/SessionModelBadge'

describe('formatSessionModelLabel', () => {
    it('returns null when model is missing', () => {
        expect(formatSessionModelLabel({ reasoningEffort: 'medium' })).toBeNull()
    })

    it('returns model when reasoning effort is missing', () => {
        expect(formatSessionModelLabel({ model: 'gpt-5.3-codex' })).toBe('gpt-5.3-codex')
    })

    it('formats model with reasoning effort', () => {
        expect(
            formatSessionModelLabel({ model: 'gpt-5.3-codex', reasoningEffort: 'xhigh' })
        ).toBe('gpt-5.3-codex/xhigh')
    })

    it('normalizes reasoning effort casing', () => {
        expect(
            formatSessionModelLabel({ model: 'gpt-5.3-codex', reasoningEffort: 'HIGH' })
        ).toBe('gpt-5.3-codex/high')
    })

    it('falls back to model for unsupported reasoning effort', () => {
        expect(
            formatSessionModelLabel({ model: 'gpt-5.3-codex', reasoningEffort: 'extreme' })
        ).toBe('gpt-5.3-codex')
    })

    it('uses fallback model when metadata model is missing', () => {
        expect(
            formatSessionModelLabel({}, { fallbackModel: 'sonnet' })
        ).toBe('sonnet')
    })

    it('maps default fallback model to auto', () => {
        expect(
            formatSessionModelLabel({}, { fallbackModel: 'default' })
        ).toBe('auto')
    })
})
