import { describe, expect, it } from 'vitest';
import { expandHomeDirectory, resolveUserPath } from './userPath';

describe('userPath', () => {
    it('expands standalone tilde to home directory', () => {
        expect(expandHomeDirectory('~', '/Users/tester')).toBe('/Users/tester');
    });

    it('expands tilde-prefixed path to home directory', () => {
        expect(expandHomeDirectory('~/project/hapi', '/Users/tester')).toBe('/Users/tester/project/hapi');
    });

    it('keeps non-tilde paths unchanged', () => {
        expect(expandHomeDirectory('/tmp/project', '/Users/tester')).toBe('/tmp/project');
    });

    it('resolves relative paths against base path', () => {
        expect(resolveUserPath('project/hapi', '/Users/tester')).toBe('/Users/tester/project/hapi');
    });

    it('normalizes mixed home + tilde paths from older sessions', () => {
        expect(
            resolveUserPath('/Users/tester/~/project/hapi', '/tmp/ignored', '/Users/tester')
        ).toBe('/Users/tester/project/hapi');
    });
});
