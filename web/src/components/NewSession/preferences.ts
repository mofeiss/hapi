import { getBasePermissionModesForFlavor } from '@hapi/protocol'
import type { AgentType } from './types'
import type { PermissionMode } from '@/types/api'

const AGENT_STORAGE_KEY = 'hapi:newSession:agent'
const PERMISSION_MODE_STORAGE_KEY = 'hapi:newSession:permissionMode:v2'
const LEGACY_PERMISSION_MODE_STORAGE_KEY = 'hapi:newSession:permissionMode'
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

function getDefaultPermissionModeForAgent(agent: AgentType): PermissionMode {
    const allowed = getBasePermissionModesForFlavor(agent)
    if (allowed.includes('yolo')) return 'yolo'
    if (allowed.includes('bypassPermissions')) return 'bypassPermissions'
    if (allowed.includes('safe-yolo')) return 'safe-yolo'
    if (allowed.includes('acceptEdits')) return 'acceptEdits'
    if (allowed.includes('default')) return 'default'
    return (allowed[allowed.length - 1] ?? 'default') as PermissionMode
}

function isAllowedPermissionModeForAgent(mode: PermissionMode, agent: AgentType): boolean {
    return getBasePermissionModesForFlavor(agent).includes(mode)
}

export function loadPreferredPermissionMode(agent: AgentType = loadPreferredAgent()): PermissionMode {
    try {
        const stored = localStorage.getItem(PERMISSION_MODE_STORAGE_KEY)
        if (stored && isAllowedPermissionModeForAgent(stored as PermissionMode, agent)) {
            return stored as PermissionMode
        }
    } catch {
        // Ignore storage errors
    }
    return getDefaultPermissionModeForAgent(agent)
}

export function savePreferredPermissionMode(mode: PermissionMode): void {
    try {
        localStorage.setItem(PERMISSION_MODE_STORAGE_KEY, mode)
        localStorage.removeItem(LEGACY_PERMISSION_MODE_STORAGE_KEY)
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
