import chalk from 'chalk'
import { authAndSetupMachineIfNeeded } from '@/ui/auth'
import { initializeToken } from '@/ui/tokenInit'
import { maybeAutoStartServer } from '@/utils/autoStartServer'
import type { CommandDefinition } from './types'
import type { CodexPermissionMode } from '@hapi/protocol/types'
import type { ReasoningEffort } from '@/codex/appServerTypes'
import { isDiagnosticLoggingEnabled } from '@/config/diagnosticLogging'

function isCodexPermissionMode(value: string): value is CodexPermissionMode {
    return value === 'default'
        || value === 'read-only'
        || value === 'safe-yolo'
        || value === 'yolo'
}

function isReasoningEffort(value: string): value is ReasoningEffort {
    return value === 'none'
        || value === 'minimal'
        || value === 'low'
        || value === 'medium'
        || value === 'high'
        || value === 'xhigh'
}

export const codexCommand: CommandDefinition = {
    name: 'codex',
    requiresRuntimeAssets: true,
    run: async ({ commandArgs }) => {
        try {
            const { runCodex } = await import('@/codex/runCodex')

            const options: {
                startedBy?: 'runner' | 'terminal'
                codexArgs?: string[]
                permissionMode?: CodexPermissionMode
                resumeSessionId?: string
                model?: string
                reasoningEffort?: ReasoningEffort
            } = {}
            const unknownArgs: string[] = []

            for (let i = 0; i < commandArgs.length; i++) {
                const arg = commandArgs[i]
                if (i === 0 && arg === 'resume') {
                    const candidate = commandArgs[i + 1]
                    if (!candidate || candidate.startsWith('-')) {
                        throw new Error('resume requires a session id')
                    }
                    options.resumeSessionId = candidate
                    i += 1
                    continue
                }
                if (arg === '--started-by') {
                    options.startedBy = commandArgs[++i] as 'runner' | 'terminal'
                } else if (arg === '--hapi-starting-mode') {
                    // Codex determines starting mode from startedBy; consume this internal flag.
                    i += 1
                } else if (arg === '--yolo' || arg === '--dangerously-bypass-approvals-and-sandbox') {
                    options.permissionMode = 'yolo'
                    unknownArgs.push(arg)
                } else if (arg === '--permission-mode') {
                    const mode = commandArgs[++i]
                    if (!mode || !isCodexPermissionMode(mode)) {
                        throw new Error('Invalid --permission-mode for codex')
                    }
                    options.permissionMode = mode
                } else if (arg.startsWith('--permission-mode=')) {
                    const mode = arg.slice('--permission-mode='.length)
                    if (!isCodexPermissionMode(mode)) {
                        throw new Error('Invalid --permission-mode for codex')
                    }
                    options.permissionMode = mode
                } else if (arg === '--model') {
                    const model = commandArgs[++i]
                    if (!model) {
                        throw new Error('Missing --model value')
                    }
                    options.model = model
                    unknownArgs.push('--model', model)
                } else if (arg === '--reasoning-effort') {
                    const reasoningEffort = commandArgs[++i]
                    if (!reasoningEffort || !isReasoningEffort(reasoningEffort)) {
                        throw new Error('Invalid --reasoning-effort for codex')
                    }
                    options.reasoningEffort = reasoningEffort
                } else if (arg.startsWith('--reasoning-effort=')) {
                    const reasoningEffort = arg.slice('--reasoning-effort='.length)
                    if (!isReasoningEffort(reasoningEffort)) {
                        throw new Error('Invalid --reasoning-effort for codex')
                    }
                    options.reasoningEffort = reasoningEffort
                } else {
                    unknownArgs.push(arg)
                }
            }
            if (unknownArgs.length > 0) {
                options.codexArgs = unknownArgs
            }

            await initializeToken()
            await maybeAutoStartServer()
            await authAndSetupMachineIfNeeded()
            await runCodex(options)
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
            if (isDiagnosticLoggingEnabled()) {
                console.error(error)
            }
            process.exit(1)
        }
    }
}
