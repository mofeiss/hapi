/**
 * Main query implementation for Claude Code SDK
 * Handles spawning Claude process and managing message streams
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { Stream } from './stream'
import {
    type QueryOptions,
    type QueryPrompt,
    type SDKMessage,
    type ControlResponseHandler,
    type SDKControlRequest,
    type ControlRequest,
    type SDKControlResponse,
    type CanCallToolCallback,
    type CanUseToolControlRequest,
    type CanUseToolControlResponse,
    type ControlCancelRequest,
    type PermissionResult,
    AbortError
} from './types'
import { getDefaultClaudeCodePath, logDebug, streamToStdin } from './utils'
import { withBunRuntimeEnv } from '@/utils/bunRuntime'
import { killProcessByChildProcess } from '@/utils/process'
import { stripNewlinesForWindowsShellArg } from '@/utils/shellEscape'
import type { Writable } from 'node:stream'
import { logger } from '@/ui/logger'
import { appendMcpConfigArg } from '../utils/mcpConfig'

const MAX_STDERR_TAIL_CHARS = 4000
const MAX_USER_VISIBLE_STDERR_CHARS = 500

function appendTail(current: string, chunk: Buffer | string, maxChars: number = MAX_STDERR_TAIL_CHARS): string {
    const text = chunk.toString()
    if (!text) {
        return current
    }
    const combined = current + text
    return combined.length > maxChars ? combined.slice(-maxChars) : combined
}

function sanitizeForSingleLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function buildCommandDisplay(command: string, args: string[]): string {
    return [command, ...args].join(' ')
}

function buildStderrSummary(stderrTail: string): string | null {
    const normalized = sanitizeForSingleLine(stderrTail)
    if (!normalized) {
        return null
    }
    if (normalized.length <= MAX_USER_VISIBLE_STDERR_CHARS) {
        return normalized
    }
    return `${normalized.slice(0, MAX_USER_VISIBLE_STDERR_CHARS - 3)}...`
}

function createClaudeProcessError(
    message: string,
    details: {
        command: string
        args: string[]
        exitCode?: number | null
        signal?: NodeJS.Signals | null
        stderrTail?: string
    },
    cause?: unknown
): Error {
    const error = cause === undefined ? new Error(message) : new Error(message, { cause })
    Object.assign(error, { details })
    return error
}

/**
 * Query class manages Claude Code process interaction
 */
export class Query implements AsyncIterableIterator<SDKMessage> {
    private pendingControlResponses = new Map<string, ControlResponseHandler>()
    private cancelControllers = new Map<string, AbortController>()
    private sdkMessages: AsyncIterableIterator<SDKMessage>
    private inputStream = new Stream<SDKMessage>()
    private canCallTool?: CanCallToolCallback

    constructor(
        private childStdin: Writable | null,
        private childStdout: NodeJS.ReadableStream,
        private processExitPromise: Promise<void>,
        canCallTool?: CanCallToolCallback
    ) {
        this.canCallTool = canCallTool
        this.readMessages()
        this.sdkMessages = this.readSdkMessages()
    }

    /**
     * Set an error on the stream
     */
    setError(error: Error): void {
        this.inputStream.error(error)
    }

    /**
     * AsyncIterableIterator implementation
     */
    next(...args: [] | [undefined]): Promise<IteratorResult<SDKMessage>> {
        return this.sdkMessages.next(...args)
    }

    return(value?: any): Promise<IteratorResult<SDKMessage>> {
        if (this.sdkMessages.return) {
            return this.sdkMessages.return(value)
        }
        return Promise.resolve({ done: true, value: undefined })
    }

    throw(e: any): Promise<IteratorResult<SDKMessage>> {
        if (this.sdkMessages.throw) {
            return this.sdkMessages.throw(e)
        }
        return Promise.reject(e)
    }

    [Symbol.asyncIterator](): AsyncIterableIterator<SDKMessage> {
        return this.sdkMessages
    }

    /**
     * Read messages from Claude process stdout
     */
    private async readMessages(): Promise<void> {
        const rl = createInterface({ input: this.childStdout })

        try {
            for await (const line of rl) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line) as SDKMessage | SDKControlResponse

                        if (message.type === 'control_response') {
                            const controlResponse = message as SDKControlResponse
                            const handler = this.pendingControlResponses.get(controlResponse.response.request_id)
                            if (handler) {
                                handler(controlResponse.response)
                            }
                            continue
                        } else if (message.type === 'control_request') {
                            await this.handleControlRequest(message as unknown as CanUseToolControlRequest)
                            continue
                        } else if (message.type === 'control_cancel_request') {
                            this.handleControlCancelRequest(message as unknown as ControlCancelRequest)
                            continue
                        }

                        this.inputStream.enqueue(message)
                    } catch (e) {
                        logger.debug(line)
                    }
                }
            }
            await this.processExitPromise
        } catch (error) {
            this.inputStream.error(error as Error)
        } finally {
            this.inputStream.done()
            this.cleanupControllers()
            rl.close()
        }
    }

    /**
     * Async generator for SDK messages
     */
    private async *readSdkMessages(): AsyncIterableIterator<SDKMessage> {
        for await (const message of this.inputStream) {
            yield message
        }
    }

    /**
     * Send interrupt request to Claude
     */
    async interrupt(): Promise<void> {
        if (!this.childStdin) {
            throw new Error('Interrupt requires --input-format stream-json')
        }

        await this.request({
            subtype: 'interrupt'
        }, this.childStdin)
    }

    /**
     * Send control request to Claude process
     */
    private request(request: ControlRequest, childStdin: Writable): Promise<SDKControlResponse['response']> {
        const requestId = Math.random().toString(36).substring(2, 15)
        const sdkRequest: SDKControlRequest = {
            request_id: requestId,
            type: 'control_request',
            request
        }

        return new Promise((resolve, reject) => {
            this.pendingControlResponses.set(requestId, (response) => {
                if (response.subtype === 'success') {
                    resolve(response)
                } else {
                    reject(new Error(response.error))
                }
            })

            childStdin.write(JSON.stringify(sdkRequest) + '\n')
        })
    }

    /**
     * Handle incoming control requests for tool permissions
     * Replicates the exact logic from the SDK's handleControlRequest method
     */
    private async handleControlRequest(request: CanUseToolControlRequest): Promise<void> {
        if (!this.childStdin) {
            logDebug('Cannot handle control request - no stdin available')
            return
        }

        const controller = new AbortController()
        this.cancelControllers.set(request.request_id, controller)

        try {
            const response = await this.processControlRequest(request, controller.signal)
            const controlResponse: CanUseToolControlResponse = {
                type: 'control_response',
                response: {
                    subtype: 'success',
                    request_id: request.request_id,
                    response
                }
            }
            this.childStdin.write(JSON.stringify(controlResponse) + '\n')
        } catch (error) {
            const controlErrorResponse: CanUseToolControlResponse = {
                type: 'control_response',
                response: {
                    subtype: 'error',
                    request_id: request.request_id,
                    error: error instanceof Error ? error.message : String(error)
                }
            }
            this.childStdin.write(JSON.stringify(controlErrorResponse) + '\n')
        } finally {
            this.cancelControllers.delete(request.request_id)
        }
    }

    /**
     * Handle control cancel requests
     * Replicates the exact logic from the SDK's handleControlCancelRequest method
     */
    private handleControlCancelRequest(request: ControlCancelRequest): void {
        const controller = this.cancelControllers.get(request.request_id)
        if (controller) {
            controller.abort()
            this.cancelControllers.delete(request.request_id)
        }
    }

    /**
     * Process control requests based on subtype
     * Replicates the exact logic from the SDK's processControlRequest method
     */
    private async processControlRequest(request: CanUseToolControlRequest, signal: AbortSignal): Promise<PermissionResult> {
        if (request.request.subtype === 'can_use_tool') {
            if (!this.canCallTool) {
                throw new Error('canCallTool callback is not provided.')
            }
            return this.canCallTool(request.request.tool_name, request.request.input, {
                signal
            })
        }
        
        throw new Error('Unsupported control request subtype: ' + request.request.subtype)
    }

    /**
     * Cleanup method to abort all pending control requests
     */
    private cleanupControllers(): void {
        for (const [requestId, controller] of this.cancelControllers.entries()) {
            controller.abort()
            this.cancelControllers.delete(requestId)
        }
    }
}

/**
 * Main query function to interact with Claude Code
 */
export function query(config: {
    prompt: QueryPrompt
    options?: QueryOptions
}): Query {
    const {
        prompt,
        options: {
            additionalDirectories = [],
            allowedTools = [],
            appendSystemPrompt,
            customSystemPrompt,
            cwd,
            disallowedTools = [],
            maxTurns,
            mcpServers,
            pathToClaudeCodeExecutable = getDefaultClaudeCodePath(),
            permissionMode = 'default',
            continue: continueConversation,
            resume,
            model,
            fallbackModel,
            settingsPath,
            strictMcpConfig,
            canCallTool
        } = {}
    } = config

    // Set entrypoint if not already set
    if (!process.env.CLAUDE_CODE_ENTRYPOINT) {
        process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    }

    // Build command arguments
    const args = ['--output-format', 'stream-json', '--verbose', '--include-partial-messages']
    let cleanupMcpConfig: (() => void) | null = null

    if (customSystemPrompt) args.push('--system-prompt', stripNewlinesForWindowsShellArg(customSystemPrompt))
    if (appendSystemPrompt) args.push('--append-system-prompt', stripNewlinesForWindowsShellArg(appendSystemPrompt))
    if (maxTurns) args.push('--max-turns', maxTurns.toString())
    if (model) args.push('--model', model)
    if (canCallTool) {
        if (typeof prompt === 'string') {
            throw new Error('canCallTool callback requires --input-format stream-json. Please set prompt as an AsyncIterable.')
        }
        args.push('--permission-prompt-tool', 'stdio')
    }
    if (continueConversation) args.push('--continue')
    if (resume) args.push('--resume', resume)
    if (settingsPath) args.push('--settings', settingsPath)
    if (allowedTools.length > 0) args.push('--allowedTools', allowedTools.join(','))
    if (disallowedTools.length > 0) args.push('--disallowedTools', disallowedTools.join(','))
    if (additionalDirectories.length > 0) args.push('--add-dir', ...additionalDirectories)
    if (strictMcpConfig) args.push('--strict-mcp-config')
    if (permissionMode) args.push('--permission-mode', permissionMode)

    if (fallbackModel) {
        if (model && fallbackModel === model) {
            throw new Error('Fallback model cannot be the same as the main model. Please specify a different model for fallbackModel option.')
        }
        args.push('--fallback-model', fallbackModel)
    }

    // Handle prompt input
    if (typeof prompt === 'string') {
        args.push('--print', stripNewlinesForWindowsShellArg(prompt.trim()))
    } else {
        args.push('--input-format', 'stream-json')
    }

    // Determine how to spawn Claude Code
    // - If it's just 'claude' command → spawn('claude', args) with shell on Windows
    // - If it's a full path to binary or script → spawn(path, args)
    const isCommandOnly = pathToClaudeCodeExecutable === 'claude'
    
    // Validate executable path (skip for command-only mode)
    if (!isCommandOnly && !existsSync(pathToClaudeCodeExecutable)) {
        throw new ReferenceError(`Claude Code executable not found at ${pathToClaudeCodeExecutable}. Is options.pathToClaudeCodeExecutable set?`)
    }

    const spawnCommand = pathToClaudeCodeExecutable
    const spawnArgs = args

    cleanupMcpConfig = appendMcpConfigArg(spawnArgs, mcpServers)

    // Spawn Claude Code process
    const spawnEnv = withBunRuntimeEnv(process.env, { allowBunBeBun: false })
    const commandDisplay = buildCommandDisplay(spawnCommand, spawnArgs)
    logDebug(`Spawning Claude Code process: ${commandDisplay}`)

    const child = spawn(spawnCommand, spawnArgs, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        signal: config.options?.abort,
        env: spawnEnv,
        // Use shell: false with absolute path from getDefaultClaudeCodePath()
        // This avoids cmd.exe resolution issues on Windows
        shell: false
    }) as ChildProcessWithoutNullStreams

    let stderrTail = ''
    child.stderr.on('data', (data) => {
        stderrTail = appendTail(stderrTail, data)
        if (process.env.DEBUG) {
            console.error('Claude Code stderr:', data.toString())
        }
    })

    // Handle stdin
    let childStdin: Writable | null = null
    if (typeof prompt === 'string') {
        child.stdin.end()
    } else {
        streamToStdin(prompt, child.stdin, config.options?.abort)
        childStdin = child.stdin
    }

    // Setup cleanup
    const cleanup = () => {
        if (!child.killed) {
            void killProcessByChildProcess(child)
        }
    }

    config.options?.abort?.addEventListener('abort', cleanup)
    process.on('exit', cleanup)

    // Handle process exit
    const processExitPromise = new Promise<void>((resolve) => {
        child.on('close', (code, signal) => {
            if (config.options?.abort?.aborted) {
                query.setError(new AbortError('Claude Code process aborted by user'))
                resolve()
                return
            }

            const stderrSummary = buildStderrSummary(stderrTail)
            if (signal) {
                const messageParts = [`Claude Code process terminated with signal ${signal}.`]
                if (stderrSummary) {
                    messageParts.push(`stderr: ${stderrSummary}`)
                }
                logger.debug('[Claude SDK] Claude process terminated by signal', {
                    signal,
                    stderrTail,
                    command: spawnCommand,
                    args: spawnArgs
                })
                query.setError(createClaudeProcessError(messageParts.join(' '), {
                    command: spawnCommand,
                    args: spawnArgs,
                    signal,
                    stderrTail
                }))
                resolve()
                return
            }

            if (code !== 0) {
                const messageParts = [`Claude Code process exited with code ${code}.`]
                if (stderrSummary) {
                    messageParts.push(`stderr: ${stderrSummary}`)
                }
                logger.debug('[Claude SDK] Claude process exited with non-zero code', {
                    exitCode: code,
                    stderrTail,
                    command: spawnCommand,
                    args: spawnArgs
                })
                query.setError(createClaudeProcessError(messageParts.join(' '), {
                    command: spawnCommand,
                    args: spawnArgs,
                    exitCode: code,
                    stderrTail
                }))
                resolve()
                return
            }

            logger.debug('[Claude SDK] Claude process exited successfully', {
                command: spawnCommand,
                args: spawnArgs
            })
            if (code === 0) {
                resolve()
            }
        })
    })

    // Create query instance
    const query = new Query(childStdin, child.stdout, processExitPromise, canCallTool)

    // Handle process errors
    child.on('error', (error) => {
        cleanupMcpConfig?.()
        if (config.options?.abort?.aborted) {
            query.setError(new AbortError('Claude Code process aborted by user'))
        } else {
            const stderrSummary = buildStderrSummary(stderrTail)
            const messageParts = [`Failed to spawn Claude Code process: ${error.message}.`]
            if (stderrSummary) {
                messageParts.push(`stderr: ${stderrSummary}`)
            }
            logger.debug('[Claude SDK] Failed to spawn Claude process', {
                error,
                stderrTail,
                command: spawnCommand,
                args: spawnArgs,
                commandDisplay
            })
            query.setError(createClaudeProcessError(messageParts.join(' '), {
                command: spawnCommand,
                args: spawnArgs,
                stderrTail
            }, error))
        }
    })

    // Cleanup on exit
    processExitPromise.finally(() => {
        cleanup()
        config.options?.abort?.removeEventListener('abort', cleanup)
        if (process.env.CLAUDE_SDK_MCP_SERVERS) {
            delete process.env.CLAUDE_SDK_MCP_SERVERS
        }
        cleanupMcpConfig?.()
    })

    return query
}
