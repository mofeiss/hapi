import { describe, expect, it } from 'vitest'

import type { Machine } from '@/types/api'
import { buildNewSessionMachineOptions } from './machineOptions'

const t = (key: string) => key

function machine(id: string, host: string): Machine {
    return {
        id,
        active: true,
        updatedAt: Date.now(),
        metadata: {
            host,
            platform: 'darwin',
            happyCliVersion: '0.1.0'
        }
    }
}

describe('buildNewSessionMachineOptions', () => {
    it('uses hub machine display names for new session machine labels', () => {
        const machineWithName = machine('machine-1', 'MacBook-Pro')
        machineWithName.metadata!.displayName = 'Desk Mini'

        const options = buildNewSessionMachineOptions({
            isLoading: false,
            machines: [machineWithName],
            t
        })

        expect(options).toEqual([
            { value: 'machine-1', label: 'Desk Mini' }
        ])
    })
})
