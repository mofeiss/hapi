import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { NoticeModal } from '@/components/ui/NoticeModal'
import { useToast } from '@/lib/toast-context'
import { useTranslation } from '@/lib/use-translation'

const TOAST_DURATION_MS = 3000

export function ToastContainer() {
    const navigate = useNavigate()
    const pathname = useLocation({ select: (location) => location.pathname })
    const { t } = useTranslation()
    const { toasts, removeToast } = useToast()
    const [progress, setProgress] = useState(1)
    const [isPaused, setIsPaused] = useState(false)
    const remainingMsRef = useRef(TOAST_DURATION_MS)
    const startedAtRef = useRef<number | null>(null)
    const animationFrameRef = useRef<number | null>(null)

    const currentToast = toasts[0] ?? null

    useEffect(() => {
        if (!currentToast || currentToast.blocking) {
            setProgress(1)
            setIsPaused(false)
            remainingMsRef.current = TOAST_DURATION_MS
            startedAtRef.current = null
            return
        }

        if (startedAtRef.current === null) {
            startedAtRef.current = Date.now()
        }

        if (isPaused) {
            return
        }

        const tick = () => {
            const startedAt = startedAtRef.current
            if (startedAt === null) {
                return
            }

            const elapsed = Date.now() - startedAt
            const remaining = Math.max(0, remainingMsRef.current - elapsed)
            setProgress(Math.max(0, remaining / TOAST_DURATION_MS))

            if (remaining <= 0) {
                removeToast(currentToast.id)
                animationFrameRef.current = null
                return
            }

            animationFrameRef.current = window.requestAnimationFrame(tick)
        }

        animationFrameRef.current = window.requestAnimationFrame(tick)

        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current)
                animationFrameRef.current = null
            }
        }
    }, [currentToast, isPaused, removeToast])

    useEffect(() => {
        if (!currentToast || currentToast.blocking) {
            return
        }

        setProgress(1)
        setIsPaused(false)
        remainingMsRef.current = TOAST_DURATION_MS
        startedAtRef.current = Date.now()
    }, [currentToast?.id, currentToast?.blocking])

    const blockingToast = useMemo(() => {
        return toasts.find((toast) => toast.blocking) ?? null
    }, [toasts])

    if (!currentToast) {
        return null
    }

    const activeToast = blockingToast ?? currentToast
    const isBlocking = Boolean(activeToast.blocking)

    const handleConfirm = () => {
        removeToast(activeToast.id)
        if (activeToast.sessionId) {
            const targetPath = `/sessions/${activeToast.sessionId}`
            if (pathname === targetPath) {
                return
            }
            void navigate({
                to: '/sessions/$sessionId',
                params: { sessionId: activeToast.sessionId }
            })
            return
        }

        if (activeToast.url) {
            if (activeToast.url === pathname) {
                return
            }
            void navigate({ to: activeToast.url })
        }
    }

    const handleDismiss = () => {
        removeToast(activeToast.id)
    }

    const handlePauseAutoDismiss = () => {
        if (isBlocking || isPaused) {
            return
        }

        const startedAt = startedAtRef.current
        if (startedAt !== null) {
            const elapsed = Date.now() - startedAt
            remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed)
        }
        startedAtRef.current = null
        setIsPaused(true)
    }

    const handleResumeAutoDismiss = () => {
        if (isBlocking || !isPaused) {
            return
        }

        startedAtRef.current = Date.now()
        setIsPaused(false)
    }

    return (
        <div
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-live={isBlocking ? 'assertive' : 'polite'}
        >
            {isBlocking ? (
                <div className="pointer-events-auto absolute inset-0 bg-black/18 backdrop-blur-[1px]" />
            ) : null}
            <div className={isBlocking ? 'pointer-events-auto relative z-10' : 'relative z-10 mt-6'}>
                <NoticeModal
                    title={activeToast.title}
                    body={activeToast.body}
                    variant={activeToast.variant ?? 'default'}
                    blocking={isBlocking}
                    confirmLabel={isBlocking ? t('button.confirm') : t('button.view')}
                    dismissLabel={isBlocking ? undefined : t('button.dismiss')}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPauseAutoDismiss={handlePauseAutoDismiss}
                    onResumeAutoDismiss={handleResumeAutoDismiss}
                    autoDismissMs={isBlocking ? undefined : TOAST_DURATION_MS}
                    progress={isBlocking ? undefined : progress}
                />
            </div>
        </div>
    )
}
