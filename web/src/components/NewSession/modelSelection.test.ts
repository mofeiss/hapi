import { describe, expect, it } from 'vitest'

import { selectNewSessionModel } from './modelSelection'

const options = [
    { value: 'gpt-5.5', label: 'GPT-5.5' },
    { value: 'gpt-5.4', label: 'GPT-5.4' }
]

describe('selectNewSessionModel', () => {
    it('keeps a valid cached model for the current agent', () => {
        expect(selectNewSessionModel({
            currentModel: 'gpt-5.4',
            preferredModel: 'gpt-5.4',
            modelOptions: options
        })).toBe('gpt-5.4')
    })

    it('uses the first sorted model when there is no cached model for the current agent', () => {
        expect(selectNewSessionModel({
            currentModel: '',
            preferredModel: null,
            modelOptions: options
        })).toBe('gpt-5.5')
    })

    it('uses the first sorted model when the cached model is not in the current list', () => {
        expect(selectNewSessionModel({
            currentModel: 'gpt-5.4',
            preferredModel: 'gpt-5.4',
            modelOptions: [
                { value: 'gpt-5.5', label: 'GPT-5.5' }
            ]
        })).toBe('gpt-5.5')
    })
})
