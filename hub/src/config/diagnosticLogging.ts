import { configuration } from '../configuration'

export function isDiagnosticLoggingEnabled(): boolean {
    return configuration.diagnosticLogging
}
