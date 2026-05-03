import type { Machine } from '@/types/api'
import { getMachineDisplayTitle } from '@/lib/machineDisplay'

export function buildNewSessionMachineOptions(args: {
    isLoading?: boolean
    machines: Machine[]
    t: (key: string) => string
}): { value: string; label: string }[] {
    if (args.isLoading) {
        return [{ value: '', label: args.t('loading.machines') }]
    }
    if (args.machines.length === 0) {
        return [{ value: '', label: args.t('misc.noMachines') }]
    }

    return args.machines.map((machine) => ({
        value: machine.id,
        label: getMachineDisplayTitle(machine, undefined, '')
    }))
}
