import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiError } from '@/api/client'
import type { Session } from '@/types/api'
import { useSendMessage } from './useSendMessage'

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            notification: vi.fn(),
        }
    })
}))

const sessionFixture: Session = {
    id: 'session-1',
    namespace: 'default',
    seq: 1,
    createdAt: 1,
    updatedAt: 1,
    active: true,
    activeAt: 1,
    metadata: null,
    metadataVersion: 1,
    agentState: null,
    agentStateVersion: 1,
    thinking: false,
    thinkingAt: 0,
    permissionMode: 'default',
    basePermissionMode: 'default',
    modelMode: 'default'
}

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            }
        }
    })

    return function Wrapper(props: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {props.children}
            </QueryClientProvider>
        )
    }
}

describe('useSendMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('waits for session activation and retries when first send hits inactive race', async () => {
        const api = {
            sendMessage: vi.fn()
                .mockRejectedValueOnce(new ApiError('Session is inactive', 409))
                .mockResolvedValueOnce(undefined),
            waitForSessionActive: vi.fn().mockResolvedValue({ session: sessionFixture })
        }

        const { result } = renderHook(
            () => useSendMessage(api as never, 'session-1'),
            { wrapper: createWrapper() }
        )

        await act(async () => {
            result.current.sendMessage('hello world')
        })

        await waitFor(() => {
            expect(api.waitForSessionActive).toHaveBeenCalledWith('session-1')
            expect(api.sendMessage).toHaveBeenCalledTimes(2)
        })

        expect(api.sendMessage).toHaveBeenNthCalledWith(1, 'session-1', 'hello world', expect.any(String), undefined, undefined)
        expect(api.sendMessage).toHaveBeenNthCalledWith(2, 'session-1', 'hello world', expect.any(String), undefined, undefined)
    })
})
