let runtimeOverride: boolean | null = null

export function getDiagnosticLoggingRuntimeOverride(): boolean | null {
    return runtimeOverride
}

export function setDiagnosticLoggingRuntimeOverride(enabled: boolean | null): void {
    runtimeOverride = enabled
}

