import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionList } from './SessionList'
import type { ApiClient } from '@/api/client'
import type { SessionSummary } from '@/types/api'

vi.mock('@/hooks/useLongPress', () => ({
    useLongPress: ({ onClick }: { onClick?: () => void }) => ({ onClick }),
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            impact: vi.fn(),
        },
    }),
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        archiveSession: vi.fn(),
        renameSession: vi.fn(),
        deleteSession: vi.fn(),
        isPending: false,
    }),
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            if (key === 'sessions.count') {
                return `${params?.n ?? 0} sessions / ${params?.m ?? 0} groups`
            }
            if (key === 'session.time.justNow') {
                return 'just now'
            }
            return key
        },
    }),
}))

vi.mock('@/lib/session-title-override-store', () => ({
    useSessionTitleOverride: () => null,
}))

vi.mock('@/lib/toast-context', () => ({
    useToast: () => ({
        addToast: vi.fn(),
    }),
}))

vi.mock('@/components/SessionActionMenu', () => ({
    SessionActionMenu: () => null,
}))

vi.mock('@/components/RenameSessionDialog', () => ({
    RenameSessionDialog: () => null,
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}))

vi.mock('@/components/AgentFlavorStatusIcon', () => ({
    AgentFlavorStatusIcon: () => <span data-testid="agent-status-icon" />,
}))

describe('SessionList', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('renders current session and group title styles without legacy fixed-size classes', () => {
        const sessions: SessionSummary[] = [
            {
                id: 'session-1',
                createdAt: new Date('2026-05-30T21:29:32').getTime(),
                active: true,
                thinking: false,
                activeAt: Date.now(),
                updatedAt: Date.now(),
                metadata: {
                    name: 'Alpha session',
                    path: '/Users/ofeiss/project/hapi',
                    host: 'MacBook-Pro',
                    flavor: 'codex',
                },
                todoProgress: null,
                pendingRequestsCount: 0,
            },
        ]

        render(
            <SessionList
                sessions={sessions}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                api={null}
                selectedSessionId={null}
            />
        )

        expect(screen.getByText('Alpha session')).toHaveClass('text-base')
        expect(screen.getByText('Alpha session').className).not.toContain('text-[14px]')
        expect(screen.getByText('MacBook-Pro')).toHaveClass('text-base')
        expect(screen.getByText('MacBook-Pro').className).not.toContain('text-[14px]')
        expect(screen.getByText(new Date('2026-05-30T21:29:32').toLocaleString())).toBeInTheDocument()
        expect(screen.queryByText('codex')).not.toBeInTheDocument()
        expect(screen.getByText('project/hapi')).toBeInTheDocument()
    })

    it('shows machine display names, status dots, and disables new sessions for offline machines', () => {
        const sessions: SessionSummary[] = [
            {
                id: 'session-1',
                createdAt: Date.now(),
                active: true,
                thinking: false,
                activeAt: Date.now(),
                updatedAt: Date.now(),
                metadata: {
                    name: 'Alpha session',
                    path: '/Users/ofeiss/project/hapi',
                    host: 'MacBook-Pro',
                    machineId: 'machine-1',
                    flavor: 'codex',
                },
                todoProgress: null,
                pendingRequestsCount: 0,
            },
        ]
        render(
            <SessionList
                sessions={sessions}
                machines={[
                    {
                        id: 'machine-1',
                        active: false,
                        updatedAt: Date.now(),
                        metadata: {
                            host: 'MacBook-Pro',
                            platform: 'darwin',
                            happyCliVersion: '0.1.0',
                            displayName: 'Desk Mini',
                        },
                    },
                ]}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onNewSessionForHost={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                api={null}
                selectedSessionId={null}
            />
        )

        expect(screen.getByText('Desk Mini')).toBeInTheDocument()
        expect(screen.queryByText('MacBook-Pro')).not.toBeInTheDocument()
        expect(screen.getByLabelText('Desk Mini offline')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'sessions.new Desk Mini' })).toBeDisabled()
    })

    it('renames machines from the context menu through the api', () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Desk Mini')
        const renameMachine = vi.fn().mockResolvedValue(undefined)
        const api = { renameMachine } as unknown as ApiClient
        const sessions: SessionSummary[] = [
            {
                id: 'session-1',
                createdAt: Date.now(),
                active: true,
                thinking: false,
                activeAt: Date.now(),
                updatedAt: Date.now(),
                metadata: {
                    name: 'Alpha session',
                    path: '/Users/ofeiss/project/hapi',
                    host: 'MacBook-Pro',
                    machineId: 'machine-1',
                    flavor: 'codex',
                },
                todoProgress: null,
                pendingRequestsCount: 0,
            },
        ]

        render(
            <SessionList
                sessions={sessions}
                machines={[
                    {
                        id: 'machine-1',
                        active: true,
                        updatedAt: Date.now(),
                        metadata: {
                            host: 'MacBook-Pro',
                            platform: 'darwin',
                            happyCliVersion: '0.1.0',
                        },
                    },
                ]}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onNewSessionForHost={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                api={api}
                selectedSessionId={null}
            />
        )

        fireEvent.contextMenu(screen.getByRole('button', { name: 'MacBook-Pro (1)' }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'machine.action.rename' }))
        expect(promptSpy).toHaveBeenCalled()
        expect(renameMachine).toHaveBeenCalledWith('machine-1', 'Desk Mini')
    })

    it('clears machine custom names from the context menu through the api', () => {
        const renameMachine = vi.fn().mockResolvedValue(undefined)
        const api = { renameMachine } as unknown as ApiClient
        const sessions: SessionSummary[] = [
            {
                id: 'session-1',
                createdAt: Date.now(),
                active: true,
                thinking: false,
                activeAt: Date.now(),
                updatedAt: Date.now(),
                metadata: {
                    name: 'Alpha session',
                    path: '/Users/ofeiss/project/hapi',
                    host: 'MacBook-Pro',
                    machineId: 'machine-1',
                    flavor: 'codex',
                },
                todoProgress: null,
                pendingRequestsCount: 0,
            },
        ]

        render(
            <SessionList
                sessions={sessions}
                machines={[
                    {
                        id: 'machine-1',
                        active: true,
                        updatedAt: Date.now(),
                        metadata: {
                            host: 'MacBook-Pro',
                            platform: 'darwin',
                            happyCliVersion: '0.1.0',
                            displayName: 'Desk Mini',
                        },
                    },
                ]}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onNewSessionForHost={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                api={api}
                selectedSessionId={null}
            />
        )

        fireEvent.contextMenu(screen.getByRole('button', { name: 'Desk Mini (1)' }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'machine.action.clearName' }))
        expect(renameMachine).toHaveBeenCalledWith('machine-1', null)
    })
})
