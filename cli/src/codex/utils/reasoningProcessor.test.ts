import { describe, expect, it } from 'vitest'
import { ReasoningProcessor } from './reasoningProcessor'

describe('ReasoningProcessor', () => {
    it('preserves titled reasoning metadata in the final tool result', () => {
        const outputs: unknown[] = []
        const processor = new ReasoningProcessor((message) => {
            outputs.push(message)
        })

        processor.processDelta('**Considering tool usage**\n\nIt seems')
        processor.complete('**Considering tool usage**\n\nIt seems that I should only call the tool once.')

        expect(outputs).toHaveLength(2)
        expect(outputs[0]).toMatchObject({
            type: 'tool-call',
            name: 'CodexReasoning',
            input: {
                title: 'Considering tool usage'
            }
        })
        expect(outputs[1]).toMatchObject({
            type: 'tool-call-result',
            output: {
                title: 'Considering tool usage',
                content: 'It seems that I should only call the tool once.',
                status: 'completed'
            }
        })
    })
})

