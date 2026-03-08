const RUNNER_ENV_SANITIZED_FLAG = 'HAPI_RUNNER_ENV_SANITIZED';
const CLAUDE_SESSION_ENV_KEYS = ['CLAUDECODE'] as const;

function isEnabledFlag(value: string | undefined): boolean {
    if (!value) {
        return false;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return !['0', 'false', 'no', 'off'].includes(normalized);
}

export function getRunnerEnvironmentContamination(env: NodeJS.ProcessEnv = process.env): string[] {
    return CLAUDE_SESSION_ENV_KEYS.filter((key) => isEnabledFlag(env[key]));
}

export function hasRunnerEnvironmentContamination(env: NodeJS.ProcessEnv = process.env): boolean {
    return getRunnerEnvironmentContamination(env).length > 0;
}

export function shouldRelaunchRunnerWithCleanEnv(env: NodeJS.ProcessEnv = process.env): boolean {
    return hasRunnerEnvironmentContamination(env) && env[RUNNER_ENV_SANITIZED_FLAG] !== '1';
}

export function createCleanRunnerEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const nextEnv: NodeJS.ProcessEnv = {
        ...env,
        [RUNNER_ENV_SANITIZED_FLAG]: '1'
    };

    for (const key of CLAUDE_SESSION_ENV_KEYS) {
        delete nextEnv[key];
    }

    return nextEnv;
}
