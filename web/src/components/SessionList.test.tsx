import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionList } from './SessionList'
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
})
