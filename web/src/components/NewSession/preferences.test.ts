import { beforeEach, describe, expect, it } from 'vitest'
import {
    loadPreferredAgent,
    loadPreferredDirectory,
    loadPreferredModel,
    loadPreferredPermissionMode,
    loadPreferredPlanActive,
    loadPreferredReasoningEffort,
    loadPreferredSessionType,
    loadPreferredWorktreeName,
    savePreferredAgent,
    savePreferredDirectory,
    savePreferredModel,
    savePreferredPermissionMode,
    savePreferredPlanActive,
    savePreferredReasoningEffort,
    savePreferredSessionType,
    savePreferredWorktreeName,
} from './preferences'

describe('NewSession preferences', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('loads defaults when storage is empty', () => {
        expect(loadPreferredAgent()).toBe('claude')
        expect(loadPreferredPermissionMode()).toBe('bypassPermissions')
        expect(loadPreferredPermissionMode('codex')).toBe('yolo')
        expect(loadPreferredPlanActive()).toBe(false)
        expect(loadPreferredDirectory()).toBe('~')
        expect(loadPreferredModel()).toBe('default')
        expect(loadPreferredReasoningEffort()).toBe('auto')
        expect(loadPreferredSessionType()).toBe('simple')
        expect(loadPreferredWorktreeName()).toBe('')
    })

    it('loads saved values from storage', () => {
        localStorage.setItem('hapi:newSession:agent', 'codex')
        localStorage.setItem('hapi:newSession:model', 'gpt-5.4')
        localStorage.setItem('hapi:newSession:reasoningEffort', 'high')
        localStorage.setItem('hapi:newSession:permissionMode:v2', 'safe-yolo')
        localStorage.setItem('hapi:newSession:planActive', 'true')
        localStorage.setItem('hapi:newSession:directory', '/Users/ofeiss/project/hapi')
        localStorage.setItem('hapi:newSession:sessionType', 'worktree')
        localStorage.setItem('hapi:newSession:worktreeName', 'feature/new-ui')

        expect(loadPreferredAgent()).toBe('codex')
        expect(loadPreferredModel()).toBe('gpt-5.4')
        expect(loadPreferredReasoningEffort()).toBe('high')
        expect(loadPreferredPermissionMode()).toBe('safe-yolo')
        expect(loadPreferredPlanActive()).toBe(true)
        expect(loadPreferredDirectory()).toBe('/Users/ofeiss/project/hapi')
        expect(loadPreferredSessionType()).toBe('worktree')
        expect(loadPreferredWorktreeName()).toBe('feature/new-ui')
    })

    it('falls back to highest mode for target agent when saved mode is not allowed', () => {
        localStorage.setItem('hapi:newSession:permissionMode:v2', 'bypassPermissions')
        expect(loadPreferredPermissionMode('codex')).toBe('yolo')
    })

    it('ignores legacy permission key and uses new defaults', () => {
        localStorage.setItem('hapi:newSession:permissionMode', 'default')
        expect(loadPreferredPermissionMode('codex')).toBe('yolo')
    })

    it('falls back to default agent on invalid stored value', () => {
        localStorage.setItem('hapi:newSession:agent', 'unknown-agent')

        expect(loadPreferredAgent()).toBe('claude')
    })

    it('persists new values to storage', () => {
        savePreferredAgent('codex')
        savePreferredPermissionMode('bypassPermissions')
        savePreferredPlanActive(true)
        savePreferredDirectory('/tmp')
        savePreferredModel('gpt-5.4')
        savePreferredReasoningEffort('xhigh')
        savePreferredSessionType('worktree')
        savePreferredWorktreeName('feature/remember-me')

        expect(localStorage.getItem('hapi:newSession:agent')).toBe('codex')
        expect(localStorage.getItem('hapi:newSession:permissionMode:v2')).toBe('bypassPermissions')
        expect(localStorage.getItem('hapi:newSession:planActive')).toBe('true')
        expect(localStorage.getItem('hapi:newSession:directory')).toBe('/tmp')
        expect(localStorage.getItem('hapi:newSession:model')).toBe('gpt-5.4')
        expect(localStorage.getItem('hapi:newSession:reasoningEffort')).toBe('xhigh')
        expect(localStorage.getItem('hapi:newSession:sessionType')).toBe('worktree')
        expect(localStorage.getItem('hapi:newSession:worktreeName')).toBe('feature/remember-me')
    })

    it('falls back when saved reasoning/session type values are invalid', () => {
        localStorage.setItem('hapi:newSession:reasoningEffort', 'invalid')
        localStorage.setItem('hapi:newSession:sessionType', 'invalid')

        expect(loadPreferredReasoningEffort()).toBe('auto')
        expect(loadPreferredSessionType()).toBe('simple')
    })
})
