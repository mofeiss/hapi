import { homedir } from 'node:os';
import { resolve } from 'node:path';

function normalizeMixedHomePath(inputPath: string, homePath: string): string {
    const normalizedInput = inputPath.replace(/\\/g, '/');
    const normalizedHome = homePath.replace(/\\/g, '/').replace(/\/+$/, '');

    if (normalizedInput === `${normalizedHome}/~`) {
        return homePath;
    }
    if (normalizedInput.startsWith(`${normalizedHome}/~/`)) {
        return resolve(homePath, normalizedInput.slice(normalizedHome.length + 3));
    }
    return inputPath;
}

export function expandHomeDirectory(inputPath: string, homePath: string = homedir()): string {
    if (inputPath === '~') {
        return homePath;
    }
    if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
        return resolve(homePath, inputPath.slice(2));
    }
    return inputPath;
}

export function resolveUserPath(
    inputPath: string,
    basePath: string = process.cwd(),
    homePath: string = homedir()
): string {
    const expanded = expandHomeDirectory(inputPath, homePath);
    const normalized = normalizeMixedHomePath(expanded, homePath);
    return resolve(basePath, normalized);
}
