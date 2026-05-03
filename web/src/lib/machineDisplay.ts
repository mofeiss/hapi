import type { Machine } from '@/types/api'

export function getMachineTitle(machine: Machine | null | undefined, fallback = 'Unknown'): string {
    if (machine?.metadata?.displayName) return machine.metadata.displayName
    if (machine?.metadata?.host) return machine.metadata.host
    if (machine?.id) return machine.id.slice(0, 8)
    return fallback
}

export function getMachineDisplayTitle(
    machine: Machine | null | undefined,
    _unused?: unknown,
    fallback = 'Unknown'
): string {
    return getMachineTitle(machine, fallback)
}
