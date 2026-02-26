import type { AgentType } from './types'

const AGENT_STORAGE_KEY = 'hapi:newSession:agent'
const PERMISSION_MODE_STORAGE_KEY = 'hapi:newSession:permissionMode'
const PLAN_ACTIVE_STORAGE_KEY = 'hapi:newSession:planActive'

const VALID_AGENTS: AgentType[] = ['claude', 'codex', 'gemini', 'opencode']

export function loadPreferredAgent(): AgentType {
    try {
        const stored = localStorage.getItem(AGENT_STORAGE_KEY)
        if (stored && VALID_AGENTS.includes(stored as AgentType)) {
            return stored as AgentType
        }
    } catch {
        // Ignore storage errors
    }
    return 'claude'
}

export function savePreferredAgent(agent: AgentType): void {
    try {
        localStorage.setItem(AGENT_STORAGE_KEY, agent)
    } catch {
        // Ignore storage errors
    }
}

export function loadPreferredPermissionMode(): import('@/types/api').PermissionMode {
    try {
        const stored = localStorage.getItem(PERMISSION_MODE_STORAGE_KEY)
        if (stored) return stored as import('@/types/api').PermissionMode
    } catch {
        // Ignore storage errors
    }
    return 'default'
}

export function savePreferredPermissionMode(mode: import('@/types/api').PermissionMode): void {
    try {
        localStorage.setItem(PERMISSION_MODE_STORAGE_KEY, mode)
    } catch {
        // Ignore storage errors
    }
}

export function loadPreferredPlanActive(): boolean {
    try {
        return localStorage.getItem(PLAN_ACTIVE_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

export function savePreferredPlanActive(enabled: boolean): void {
    try {
        localStorage.setItem(PLAN_ACTIVE_STORAGE_KEY, enabled ? 'true' : 'false')
    } catch {
        // Ignore storage errors
    }
}
