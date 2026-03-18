import { getDiagnosticLoggingRuntimeValue } from './diagnosticLoggingRuntime'

export function isDiagnosticLoggingEnabled(): boolean {
    return getDiagnosticLoggingRuntimeValue()
}
