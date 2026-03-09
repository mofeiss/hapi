import { describe, expect, it } from 'vitest'
import {
    clearPendingSessionInitialMessage,
    consumePendingSessionInitialMessage,
    peekPendingSessionInitialMessage,
    setPendingSessionInitialMessage,
} from './pending-session-initial-message-store'

describe('pending-session-initial-message-store', () => {
    it('stores a pending message and consumes it once', () => {
        setPendingSessionInitialMessage('session-1', { text: 'hello world' })

        expect(consumePendingSessionInitialMessage('session-1')).toEqual({
            text: 'hello world'
        })
        expect(consumePendingSessionInitialMessage('session-1')).toBeNull()
    })

    it('stores attachment-only payloads', () => {
        setPendingSessionInitialMessage('session-attachments', {
            text: '   ',
            attachments: [{
                id: 'att-1',
                filename: 'spec.png',
                mimeType: 'image/png',
                size: 42,
                path: 'draft:att-1',
                previewUrl: 'data:image/png;base64,xxx'
            }]
        })

        expect(consumePendingSessionInitialMessage('session-attachments')).toEqual({
            text: '',
            attachments: [{
                id: 'att-1',
                filename: 'spec.png',
                mimeType: 'image/png',
                size: 42,
                path: 'draft:att-1',
                previewUrl: 'data:image/png;base64,xxx'
            }]
        })
    })

    it('ignores blank session ids and messages', () => {
        setPendingSessionInitialMessage('', { text: 'hello world' })
        setPendingSessionInitialMessage('session-2', { text: '   ' })

        expect(consumePendingSessionInitialMessage('')).toBeNull()
        expect(consumePendingSessionInitialMessage('session-2')).toBeNull()
    })

    it('peeks without clearing until explicitly removed', () => {
        setPendingSessionInitialMessage('session-3', { text: 'hello again' })

        expect(peekPendingSessionInitialMessage('session-3')).toEqual({
            text: 'hello again'
        })
        expect(peekPendingSessionInitialMessage('session-3')).toEqual({
            text: 'hello again'
        })

        clearPendingSessionInitialMessage('session-3')
        expect(peekPendingSessionInitialMessage('session-3')).toBeNull()
    })
})
