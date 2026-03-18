import { configuration } from '../configuration'

type DiagnosticLoggingListener = (enabled: boolean) => void

let runtimeOverride: boolean | null = null
const listeners = new Set<DiagnosticLoggingListener>()

export function getDiagnosticLoggingInitialValue(): boolean {
    return configuration.diagnosticLogging
}

export function getDiagnosticLoggingRuntimeValue(): boolean {
    return runtimeOverride ?? getDiagnosticLoggingInitialValue()
}

export function setDiagnosticLoggingRuntimeValue(enabled: boolean): boolean {
    if (getDiagnosticLoggingRuntimeValue() === enabled && runtimeOverride !== null) {
        return false
    }

    runtimeOverride = enabled
    for (const listener of listeners) {
        try {
            listener(enabled)
        } catch {
            // Ignore listener failures so diagnostics control never blocks runtime.
        }
    }
    return true
}

export function hasDiagnosticLoggingRuntimeOverride(): boolean {
    return runtimeOverride !== null
}

export function onDiagnosticLoggingRuntimeChange(listener: DiagnosticLoggingListener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

