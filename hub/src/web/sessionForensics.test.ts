import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Session } from '@hapi/protocol/schemas'
import { buildSessionForensics } from './sessionForensics'

describe('buildSessionForensics', () => {
    const tempRoot = join(tmpdir(), `hapi-session-forensics-${Date.now()}`)

    beforeEach(async () => {
        await mkdir(tempRoot, { recursive: true })
    })

    afterEach(async () => {
        await rm(tempRoot, { recursive: true, force: true })
    })

    it('resolves Claude session and HAPI log paths without shelling out', async () => {
        const homeDir = join(tempRoot, 'home')
        const happyHomeDir = join(tempRoot, 'hapidev')
        const projectPath = join(homeDir, '.claude', 'projects', '-Users-test')
        const logsDir = join(happyHomeDir, 'logs')
        const claudeSessionId = 'claude-session-1'

        await mkdir(projectPath, { recursive: true })
        await mkdir(logsDir, { recursive: true })
        await writeFile(join(projectPath, `${claudeSessionId}.jsonl`), '{}\n')
        await writeFile(join(logsDir, '2026-03-18-05-28-11-pid-12345.log'), 'log')

        const engine = {
            getMachine: () => ({
                metadata: {
                    homeDir,
                    happyHomeDir
                }
            })
        }

        const session: Session = {
            id: 'hapi-session-1',
            namespace: 'default',
            seq: 1,
            createdAt: 1,
            updatedAt: 2,
            active: true,
            activeAt: 2,
            metadata: {
                path: '/Users/test',
                host: 'm.local',
                machineId: 'machine-1',
                flavor: 'claude',
                claudeSessionId,
                hostPid: 12345
            },
            metadataVersion: 1,
            agentState: null,
            agentStateVersion: 1,
            thinking: false,
            thinkingAt: 0
        }

        const result = await buildSessionForensics(engine as any, session)

        expect(result).toEqual({
            hapiHomeDir: happyHomeDir,
            hapiLogsDir: logsDir,
            resolvedHapiLogFile: join(logsDir, '2026-03-18-05-28-11-pid-12345.log'),
            agentSessionSearchRoot: projectPath,
            resolvedAgentSessionFile: join(projectPath, `${claudeSessionId}.jsonl`),
            claudeProjectPath: projectPath,
            claudeSessionId
        })
    })

    it('resolves Codex session files under the sessions root', async () => {
        const homeDir = join(tempRoot, 'home')
        const happyHomeDir = join(tempRoot, 'hapidev')
        const codexSessionsRoot = join(homeDir, '.codex', 'sessions')
        const nestedDir = join(codexSessionsRoot, '2026', '03', '18')
        const logsDir = join(happyHomeDir, 'logs')
        const codexSessionId = '019cfdb3-1b12-7250-b334-85e4beac7ffe'
        const codexFile = join(nestedDir, `rollout-2026-03-18T05-28-19-${codexSessionId}.jsonl`)

        await mkdir(nestedDir, { recursive: true })
        await mkdir(logsDir, { recursive: true })
        await writeFile(codexFile, '{}\n')
        await writeFile(join(logsDir, '2026-03-18-05-28-11-pid-86667.log'), 'log')

        const engine = {
            getMachine: () => ({
                metadata: {
                    homeDir,
                    happyHomeDir
                }
            })
        }

        const session: Session = {
            id: 'hapi-session-2',
            namespace: 'default',
            seq: 1,
            createdAt: 1,
            updatedAt: 2,
            active: true,
            activeAt: 2,
            metadata: {
                path: '/Users/test',
                host: 'm.local',
                machineId: 'machine-1',
                flavor: 'codex',
                codexSessionId,
                hostPid: 86667
            },
            metadataVersion: 1,
            agentState: null,
            agentStateVersion: 1,
            thinking: false,
            thinkingAt: 0
        }

        const result = await buildSessionForensics(engine as any, session)

        expect(result).toEqual({
            hapiHomeDir: happyHomeDir,
            hapiLogsDir: logsDir,
            resolvedHapiLogFile: join(logsDir, '2026-03-18-05-28-11-pid-86667.log'),
            agentSessionSearchRoot: codexSessionsRoot,
            resolvedAgentSessionFile: codexFile,
            codexSessionsRoot,
            codexSessionId
        })
    })
})
