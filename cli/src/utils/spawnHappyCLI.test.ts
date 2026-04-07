import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { SpawnOptions } from 'child_process'

const spawnMock = vi.fn(() => ({ pid: 1234 } as any))

vi.mock('child_process', () => ({
    spawn: spawnMock,
}))

vi.mock('@/projectPath', () => ({
    isBunCompiled: vi.fn(() => false),
    projectPath: vi.fn(() => '/Users/ofeiss/project/hapi/cli'),
}))

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn(),
    },
}))

vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
    return {
        ...actual,
        existsSync: vi.fn(() => true),
    }
})

describe('spawnHappyCLI', () => {
    const originalBunVersion = process.versions.bun

    beforeEach(() => {
        spawnMock.mockClear()
        ;(process.versions as Record<string, string | undefined>).bun = '1.3.6'
    })

    afterEach(() => {
        if (typeof originalBunVersion === 'string') {
            ;(process.versions as Record<string, string | undefined>).bun = originalBunVersion
        } else {
            delete (process.versions as Record<string, string | undefined>).bun
        }
    })

    it('keeps requested cwd for dev bun subprocesses while still passing bun --cwd projectRoot', async () => {
        const { spawnHappyCLI } = await import('./spawnHappyCLI')

        const options: SpawnOptions = {
            cwd: '/Users/ofeiss/project/dogclaw',
            env: { TEST_ENV: '1' },
        }

        spawnHappyCLI(['codex', '--started-by', 'runner'], options)

        expect(spawnMock).toHaveBeenCalledTimes(1)
        const [command, args, spawnOptions] = spawnMock.mock.calls[0] as unknown as [string, string[], SpawnOptions]
        expect(command).toBe(process.execPath)
        expect(args.slice(0, 2)).toEqual(['--cwd', '/Users/ofeiss/project/hapi/cli'])
        expect(spawnOptions.cwd).toBe('/Users/ofeiss/project/dogclaw')
        expect(spawnOptions.env).toMatchObject({
            TEST_ENV: '1',
            HAPI_TARGET_CWD: '/Users/ofeiss/project/dogclaw',
        })
    })
})
