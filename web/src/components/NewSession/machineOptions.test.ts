import { describe, expect, it, beforeEach } from 'vitest'

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
    beforeEach(() => {
        localStorage.clear()
    })

    it('uses machine remarks from local storage for new session machine labels', () => {
        localStorage.setItem('hapi:machine-remarks', JSON.stringify({ 'machine-1': 'Desk Mini' }))

        const options = buildNewSessionMachineOptions({
            isLoading: false,
            machines: [machine('machine-1', 'MacBook-Pro')],
            t
        })

        expect(options).toEqual([
            { value: 'machine-1', label: 'Desk Mini' }
        ])
    })
})
