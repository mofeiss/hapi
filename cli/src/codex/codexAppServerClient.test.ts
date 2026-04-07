import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
    spawn: spawnMock
}));

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn()
    }
}));

vi.mock('@/utils/process', () => ({
    killProcessByChildProcess: vi.fn(async () => undefined)
}));

function createMockProcess(): ChildProcessWithoutNullStreams {
    const stdout = new EventEmitter() as EventEmitter & {
        setEncoding: (encoding: BufferEncoding) => void;
    };
    stdout.setEncoding = vi.fn();

    const stderr = new EventEmitter() as EventEmitter & {
        setEncoding: (encoding: BufferEncoding) => void;
    };
    stderr.setEncoding = vi.fn();

    const stdin = {
        write: vi.fn(),
        end: vi.fn()
    };

    const child = new EventEmitter() as ChildProcessWithoutNullStreams;
    Object.assign(child, {
        stdout,
        stderr,
        stdin,
        pid: 12345,
        kill: vi.fn(),
        killed: false
    });

    return child;
}

describe('CodexAppServerClient', () => {
    beforeEach(() => {
        spawnMock.mockReset();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('spawns codex app-server in the provided working directory', async () => {
        spawnMock.mockReturnValue(createMockProcess());

        const { CodexAppServerClient } = await import('./codexAppServerClient');
        const client = new CodexAppServerClient({ cwd: '/Users/ofeiss/project/dogclaw' });

        await client.connect();

        expect(spawnMock).toHaveBeenCalledTimes(1);
        expect(spawnMock).toHaveBeenCalledWith('codex', ['app-server'], expect.objectContaining({
            cwd: '/Users/ofeiss/project/dogclaw',
            stdio: ['pipe', 'pipe', 'pipe']
        }));
    });
});
