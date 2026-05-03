import type { Machine } from '@/types/api'
import { readStorageJson, writeStorageJson } from '@/lib/storage'

export const MACHINE_REMARKS_STORAGE_KEY = 'hapi:machine-remarks'

export function getMachineTitle(machine: Machine | null | undefined, fallback = 'Unknown'): string {
    if (machine?.metadata?.displayName) return machine.metadata.displayName
    if (machine?.metadata?.host) return machine.metadata.host
    if (machine?.id) return machine.id.slice(0, 8)
    return fallback
}

export function loadMachineRemarks(): Record<string, string> {
    return readStorageJson<Record<string, string>>('local', MACHINE_REMARKS_STORAGE_KEY) ?? {}
}

export function saveMachineRemarks(remarks: Record<string, string>): void {
    writeStorageJson('local', MACHINE_REMARKS_STORAGE_KEY, remarks)
}

export function getMachineDisplayTitle(
    machine: Machine | null | undefined,
    remarks: Record<string, string> = loadMachineRemarks(),
    fallback = 'Unknown'
): string {
    if (machine?.id) {
        const remark = remarks[machine.id]?.trim()
        if (remark) return remark
    }
    return getMachineTitle(machine, fallback)
}
