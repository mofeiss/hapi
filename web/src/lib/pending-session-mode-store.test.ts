import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearPendingSessionMode, getPendingSessionMode, setPendingSessionMode } from './pending-session-mode-store'

describe('pending-session-mode-store', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        clearPendingSessionMode('session-1')
    })

    afterEach(() => {
        clearPendingSessionMode('session-1')
        vi.useRealTimers()
    })

    it('returns null for expired entries without mutating during read', () => {
        setPendingSessionMode('session-1', {
            permissionMode: 'acceptEdits'
        })

        vi.advanceTimersByTime(2 * 60 * 1000 + 1)

        expect(getPendingSessionMode('session-1')).toBeNull()
        expect(getPendingSessionMode('session-1')).toBeNull()
    })
})
