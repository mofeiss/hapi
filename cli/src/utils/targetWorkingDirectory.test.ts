import { afterEach, describe, expect, it } from 'vitest'
import { resolveTargetWorkingDirectory } from './targetWorkingDirectory'

const originalTargetCwd = process.env.HAPI_TARGET_CWD

afterEach(() => {
    if (typeof originalTargetCwd === 'string') {
        process.env.HAPI_TARGET_CWD = originalTargetCwd
    } else {
        delete process.env.HAPI_TARGET_CWD
    }
})

describe('resolveTargetWorkingDirectory', () => {
    it('returns process cwd when HAPI_TARGET_CWD is unset', () => {
        delete process.env.HAPI_TARGET_CWD
        expect(resolveTargetWorkingDirectory()).toBe(process.cwd())
    })

    it('returns trimmed HAPI_TARGET_CWD when set', () => {
        process.env.HAPI_TARGET_CWD = '  /Users/ofeiss/project  '
        expect(resolveTargetWorkingDirectory()).toBe('/Users/ofeiss/project')
    })
})
