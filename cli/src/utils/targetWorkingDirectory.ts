export function resolveTargetWorkingDirectory(): string {
    const target = process.env.HAPI_TARGET_CWD?.trim()
    if (target) {
        return target
    }
    return process.cwd()
}
