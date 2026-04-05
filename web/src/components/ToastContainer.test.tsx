import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContainer } from './ToastContainer'

const navigateMock = vi.fn()
const removeToastMock = vi.fn()
let pathname = '/sessions/session-1'
let toasts = [
    {
        id: 'toast-1',
        title: 'permission required',
        body: 'Waiting for approval…',
        sessionId: 'session-1',
        url: '',
        blocking: false as const
    }
]

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigateMock,
    useLocation: ({ select }: { select: (location: { pathname: string }) => string }) => select({ pathname })
}))

vi.mock('@/lib/toast-context', () => ({
    useToast: () => ({
        toasts,
        addToast: vi.fn(),
        removeToast: removeToastMock
    })
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}))

vi.mock('@/components/ui/NoticeModal', () => ({
    NoticeModal: (props: { confirmLabel: string; onConfirm?: () => void }) => (
        <button type="button" onClick={props.onConfirm}>{props.confirmLabel}</button>
    )
}))

describe('ToastContainer', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        pathname = '/sessions/session-1'
        toasts = [
            {
                id: 'toast-1',
                title: 'permission required',
                body: 'Waiting for approval…',
                sessionId: 'session-1',
                url: '',
                blocking: false
            }
        ]
        navigateMock.mockReset()
        removeToastMock.mockReset()
    })

    it('dismisses same-session permission toast without re-navigating the current page', () => {
        render(<ToastContainer />)

        fireEvent.click(screen.getByRole('button', { name: 'button.view' }))

        expect(removeToastMock).toHaveBeenCalledWith('toast-1')
        expect(navigateMock).not.toHaveBeenCalled()
    })

    it('navigates when the permission toast targets a different session', () => {
        pathname = '/sessions/session-1'
        toasts = [
            {
                id: 'toast-2',
                title: 'permission required',
                body: 'Waiting for approval…',
                sessionId: 'session-2',
                url: '',
                blocking: false
            }
        ]

        render(<ToastContainer />)

        fireEvent.click(screen.getByRole('button', { name: 'button.view' }))

        expect(removeToastMock).toHaveBeenCalledWith('toast-2')
        expect(navigateMock).toHaveBeenCalledWith({
            to: '/sessions/$sessionId',
            params: { sessionId: 'session-2' }
        })
    })
})
