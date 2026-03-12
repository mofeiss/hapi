import { getBasePermissionModesForFlavor } from '@hapi/protocol'
import type { AgentType } from './types'
import type { PermissionMode } from '@/types/api'

const AGENT_STORAGE_KEY = 'hapi:newSession:agent'
const MODEL_STORAGE_KEY = 'hapi:newSession:model'
const REASONING_EFFORT_STORAGE_KEY = 'hapi:newSession:reasoningEffort'
const PERMISSION_MODE_STORAGE_KEY = 'hapi:newSession:permissionMode:v2'
const LEGACY_PERMISSION_MODE_STORAGE_KEY = 'hapi:newSession:permissionMode'
const PLAN_ACTIVE_STORAGE_KEY = 'hapi:newSession:planActive'
const DIRECTORY_STORAGE_KEY = 'hapi:newSession:directory'
const SESSION_TYPE_STORAGE_KEY = 'hapi:newSession:sessionType'
const WORKTREE_NAME_STORAGE_KEY = 'hapi:newSession:worktreeName'

const VALID_AGENTS: AgentType[] = ['claude', 'codex']
const VALID_REASONING_EFFORTS = ['auto', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const

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

export function loadPreferredModel(): string {
    try {
        const stored = localStorage.getItem(MODEL_STORAGE_KEY)
        if (stored && stored.trim()) {
            return stored
        }
    } catch {
        // Ignore storage errors
    }
    return 'auto'
}

export function savePreferredModel(model: string): void {
    const trimmed = model.trim()
    if (!trimmed) {
        return
    }
    try {
        localStorage.setItem(MODEL_STORAGE_KEY, trimmed)
    } catch {
        // Ignore storage errors
    }
}

export function loadPreferredReasoningEffort(): (typeof VALID_REASONING_EFFORTS)[number] {
    try {
        const stored = localStorage.getItem(REASONING_EFFORT_STORAGE_KEY)
        if (stored && VALID_REASONING_EFFORTS.includes(stored as (typeof VALID_REASONING_EFFORTS)[number])) {
            return stored as (typeof VALID_REASONING_EFFORTS)[number]
        }
    } catch {
        // Ignore storage errors
    }
    return 'auto'
}

export function savePreferredReasoningEffort(value: (typeof VALID_REASONING_EFFORTS)[number]): void {
    try {
        localStorage.setItem(REASONING_EFFORT_STORAGE_KEY, value)
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

export function loadPreferredDirectory(): string {
    try {
        const stored = localStorage.getItem(DIRECTORY_STORAGE_KEY)
        if (stored && stored.trim()) {
            return stored
        }
    } catch {
        // Ignore storage errors
    }
    return '~'
}

export function savePreferredDirectory(directory: string): void {
    const trimmed = directory.trim()
    if (!trimmed) {
        return
    }

    try {
        localStorage.setItem(DIRECTORY_STORAGE_KEY, trimmed)
    } catch {
        // Ignore storage errors
    }
}

export function loadPreferredSessionType(): 'simple' | 'worktree' {
    try {
        const stored = localStorage.getItem(SESSION_TYPE_STORAGE_KEY)
        if (stored === 'simple' || stored === 'worktree') {
            return stored
        }
    } catch {
        // Ignore storage errors
    }
    return 'simple'
}

export function savePreferredSessionType(sessionType: 'simple' | 'worktree'): void {
    try {
        localStorage.setItem(SESSION_TYPE_STORAGE_KEY, sessionType)
    } catch {
        // Ignore storage errors
    }
}

export function loadPreferredWorktreeName(): string {
    try {
        const stored = localStorage.getItem(WORKTREE_NAME_STORAGE_KEY)
        if (typeof stored === 'string') {
            return stored
        }
    } catch {
        // Ignore storage errors
    }
    return ''
}

export function savePreferredWorktreeName(worktreeName: string): void {
    try {
        localStorage.setItem(WORKTREE_NAME_STORAGE_KEY, worktreeName)
    } catch {
        // Ignore storage errors
    }
}
