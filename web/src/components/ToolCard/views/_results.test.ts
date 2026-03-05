import { describe, expect, it } from 'vitest'
import { extractPlanModeMessage, sanitizeReadResultText } from '@/components/ToolCard/views/_results'

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

    it('strips claude-style line number prefixes in read output', () => {
        const input = [
            '     1→##',
            '     2→# Host Database',
            '     3→127.0.0.1\tlocalhost',
            '    10→127.0.0.1 m'
        ].join('\n')

        const output = sanitizeReadResultText(input)
        expect(output).toBe([
            '##',
            '# Host Database',
            '127.0.0.1\tlocalhost',
            '127.0.0.1 m'
        ].join('\n'))
    })

    it('does not strip isolated arrow-like normal lines', () => {
        const input = [
            'normal line',
            'x = y -> z',
            'another line'
        ].join('\n')

        expect(sanitizeReadResultText(input)).toBe(input)
    })
})

describe('extractPlanModeMessage', () => {
    it('extracts message from object result', () => {
        const result = {
            message: 'Entered plan mode. You should now focus on exploring the codebase.'
        }

        expect(extractPlanModeMessage(result)).toBe(result.message)
    })

    it('extracts message from InputValidationError string payload', () => {
        const result = [
            'InputValidationError: [',
            '  {',
            '    "code": "unrecognized_keys",',
            '    "keys": [',
            '      "bad_field"',
            '    ],',
            '    "path": [],',
            '    "message": "Unrecognized key: \\"bad_field\\""',
            '  }',
            ']'
        ].join('\n')

        expect(extractPlanModeMessage(result)).toBe('Unrecognized key: "bad_field"')
    })

    it('returns null when no message can be parsed', () => {
        expect(extractPlanModeMessage('InputValidationError: not-a-json-payload')).toBeNull()
    })
})
