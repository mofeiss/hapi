import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearPendingSessionMode, getPendingSessionMode, resolveSessionPermissionMode, setPendingSessionMode } from './pending-session-mode-store'

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

    it('prefers pending permission mode when session has not synced yet', () => {
        expect(resolveSessionPermissionMode(undefined, undefined, {
            permissionMode: 'yolo',
            basePermissionMode: 'yolo'
        })).toEqual({
            permissionMode: 'yolo',
            basePermissionMode: 'yolo'
        })
    })

    it('keeps current session mode once it matches pending mode', () => {
        expect(resolveSessionPermissionMode('plan', undefined, {
            permissionMode: 'plan',
            basePermissionMode: 'default'
        })).toEqual({
            permissionMode: 'plan',
            basePermissionMode: 'default'
        })
    })
})
