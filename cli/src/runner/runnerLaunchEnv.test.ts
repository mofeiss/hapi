import { describe, expect, it } from 'vitest';
import {
    createCleanRunnerEnvironment,
    getRunnerEnvironmentContamination,
    hasRunnerEnvironmentContamination,
    shouldRelaunchRunnerWithCleanEnv
} from './runnerLaunchEnv';

describe('runnerLaunchEnv', () => {
    it('detects claude session contamination from CLAUDECODE', () => {
        expect(hasRunnerEnvironmentContamination({ CLAUDECODE: '1' })).toBe(true);
        expect(getRunnerEnvironmentContamination({ CLAUDECODE: '1' })).toEqual(['CLAUDECODE']);
    });

    it('ignores disabled CLAUDECODE values', () => {
        expect(hasRunnerEnvironmentContamination({ CLAUDECODE: '0' })).toBe(false);
        expect(hasRunnerEnvironmentContamination({ CLAUDECODE: 'false' })).toBe(false);
    });

    it('creates a clean runner environment and marks it as sanitized', () => {
        const cleanEnv = createCleanRunnerEnvironment({
            CLAUDECODE: '1',
            HOME: '/root'
        });

        expect(cleanEnv.CLAUDECODE).toBeUndefined();
        expect(cleanEnv.HOME).toBe('/root');
        expect(cleanEnv.HAPI_RUNNER_ENV_SANITIZED).toBe('1');
        expect(shouldRelaunchRunnerWithCleanEnv(cleanEnv)).toBe(false);
    });
});
