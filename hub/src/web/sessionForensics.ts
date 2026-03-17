import { access, readdir } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { Metadata, Session, SessionForensics } from '@hapi/protocol/schemas'
import type { Machine, SyncEngine } from '../sync/syncEngine'

function getMachineForSession(engine: SyncEngine, session: Session): Machine | null {
    const machineId = session.metadata?.machineId
    if (!machineId) return null
    return engine.getMachine(machineId) ?? null
}

function getHomeDir(session: Session, machine: Machine | null): string {
    return session.metadata?.homeDir
        ?? machine?.metadata?.homeDir
        ?? homedir()
}

function getHappyHomeDir(session: Session, machine: Machine | null): string | null {
    return session.metadata?.happyHomeDir
        ?? machine?.metadata?.happyHomeDir
        ?? null
}

function getClaudeProjectPath(workspacePath: string, homeDir: string): string {
    const projectId = resolve(workspacePath).replace(/[^a-zA-Z0-9]/g, '-')
    return join(homeDir, '.claude', 'projects', projectId)
}

async function pathExists(path: string | null | undefined): Promise<boolean> {
    if (!path) return false
    try {
        await access(path, fsConstants.F_OK)
        return true
    } catch {
        return false
    }
}

async function resolveClaudeSessionFile(projectPath: string, claudeSessionId: string | undefined): Promise<string | undefined> {
    if (!claudeSessionId) return undefined
    const candidate = join(projectPath, `${claudeSessionId}.jsonl`)
    return await pathExists(candidate) ? candidate : undefined
}

async function resolveLatestHapiLogFile(logsDir: string, hostPid: number | undefined): Promise<string | undefined> {
    if (!hostPid) return undefined
    try {
        const entries = await readdir(logsDir, { withFileTypes: true })
        const matches = entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) => name.includes(`pid-${hostPid}`) && name.endsWith('.log'))
            .sort()

        const latest = matches[matches.length - 1]
        return latest ? join(logsDir, latest) : undefined
    } catch {
        return undefined
    }
}

async function resolveCodexSessionFile(codexSessionsRoot: string, codexSessionId: string | undefined): Promise<string | undefined> {
    if (!codexSessionId) return undefined

    const stack = [codexSessionsRoot]
    while (stack.length > 0) {
        const current = stack.pop()
        if (!current) continue

        let entries
        try {
            entries = await readdir(current, { withFileTypes: true })
        } catch {
            continue
        }

        for (const entry of entries) {
            const fullPath = join(current, entry.name)
            if (entry.isDirectory()) {
                stack.push(fullPath)
                continue
            }
            if (!entry.isFile()) continue
            if (!entry.name.endsWith('.jsonl')) continue
            if (!entry.name.includes(codexSessionId)) continue
            return fullPath
        }
    }

    return undefined
}

export async function buildSessionForensics(engine: SyncEngine, session: Session): Promise<SessionForensics | undefined> {
    const metadata = session.metadata
    if (!metadata) return undefined

    const machine = getMachineForSession(engine, session)
    const homeDir = getHomeDir(session, machine)
    const happyHomeDir = getHappyHomeDir(session, machine)
    const hapiLogsDir = happyHomeDir ? join(happyHomeDir, 'logs') : undefined

    const base: SessionForensics = {
        ...(happyHomeDir ? { hapiHomeDir: happyHomeDir } : {}),
        ...(hapiLogsDir ? { hapiLogsDir } : {})
    }

    if (metadata.flavor === 'claude') {
        const claudeProjectPath = getClaudeProjectPath(metadata.path, homeDir)
        const resolvedAgentSessionFile = await resolveClaudeSessionFile(claudeProjectPath, metadata.claudeSessionId)
        const resolvedHapiLogFile = hapiLogsDir ? await resolveLatestHapiLogFile(hapiLogsDir, metadata.hostPid) : undefined

        return {
            ...base,
            claudeProjectPath,
            agentSessionSearchRoot: claudeProjectPath,
            claudeSessionId: metadata.claudeSessionId,
            ...(resolvedAgentSessionFile ? { resolvedAgentSessionFile } : {}),
            ...(resolvedHapiLogFile ? { resolvedHapiLogFile } : {})
        }
    }

    if (metadata.flavor === 'codex') {
        const codexSessionsRoot = join(homeDir, '.codex', 'sessions')
        const resolvedAgentSessionFile = await resolveCodexSessionFile(codexSessionsRoot, metadata.codexSessionId)
        const resolvedHapiLogFile = hapiLogsDir ? await resolveLatestHapiLogFile(hapiLogsDir, metadata.hostPid) : undefined

        return {
            ...base,
            codexSessionsRoot,
            agentSessionSearchRoot: codexSessionsRoot,
            codexSessionId: metadata.codexSessionId,
            ...(resolvedAgentSessionFile ? { resolvedAgentSessionFile } : {}),
            ...(resolvedHapiLogFile ? { resolvedHapiLogFile } : {})
        }
    }

    return Object.keys(base).length > 0 ? base : undefined
}

export async function attachSessionForensics(engine: SyncEngine, session: Session): Promise<Session> {
    const forensics = await buildSessionForensics(engine, session)
    if (!forensics || !session.metadata) return session

    const metadata: Metadata = {
        ...session.metadata,
        forensics
    }

    return {
        ...session,
        metadata
    }
}

export function getSessionLogName(path: string | undefined): string | undefined {
    if (!path) return undefined
    return basename(path)
}
