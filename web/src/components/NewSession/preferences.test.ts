import { beforeEach, describe, expect, it } from 'vitest'
import {
    loadPreferredAgent,
    loadPreferredPermissionMode,
    loadPreferredPlanActive,
    savePreferredAgent,
    savePreferredPermissionMode,
    savePreferredPlanActive,
} from './preferences'

describe('NewSession preferences', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('loads defaults when storage is empty', () => {
        expect(loadPreferredAgent()).toBe('claude')
        expect(loadPreferredPermissionMode()).toBe('default')
        expect(loadPreferredPlanActive()).toBe(false)
    })

    it('loads saved values from storage', () => {
        localStorage.setItem('hapi:newSession:agent', 'codex')
        localStorage.setItem('hapi:newSession:permissionMode', 'bypassPermissions')
        localStorage.setItem('hapi:newSession:planActive', 'true')

        expect(loadPreferredAgent()).toBe('codex')
        expect(loadPreferredPermissionMode()).toBe('bypassPermissions')
        expect(loadPreferredPlanActive()).toBe(true)
    })

    it('falls back to default agent on invalid stored value', () => {
        localStorage.setItem('hapi:newSession:agent', 'unknown-agent')

        expect(loadPreferredAgent()).toBe('claude')
    })

    it('persists new values to storage', () => {
        savePreferredAgent('gemini')
        savePreferredPermissionMode('bypassPermissions')
        savePreferredPlanActive(true)

        expect(localStorage.getItem('hapi:newSession:agent')).toBe('gemini')
        expect(localStorage.getItem('hapi:newSession:permissionMode')).toBe('bypassPermissions')
        expect(localStorage.getItem('hapi:newSession:planActive')).toBe('true')
    })
})
