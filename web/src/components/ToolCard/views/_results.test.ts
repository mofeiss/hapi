import { describe, expect, it } from 'vitest'
import { sanitizeReadResultText } from '@/components/ToolCard/views/_results'

describe('sanitizeReadResultText', () => {
    it('removes system reminder block from read output', () => {
        const input = [
            'first line',
            '<system-reminder>',
            'Whenever you read a file...',
            '</system-reminder>',
            'second line'
        ].join('\n')

        const output = sanitizeReadResultText(input)
        expect(output).toBe('first line\n\nsecond line')
    })

    it('keeps normal text unchanged', () => {
        const input = 'line a\nline b'
        expect(sanitizeReadResultText(input)).toBe(input)
    })

    it('returns empty text when only reminder exists', () => {
        const input = '<system-reminder>\ninternal text\n</system-reminder>'
        expect(sanitizeReadResultText(input)).toBe('')
    })
})
