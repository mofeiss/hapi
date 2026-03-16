import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getTelegramWebApp, isTelegramApp } from '@/hooks/useTelegram'
import { initializeTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { useAuthSource } from '@/hooks/useAuthSource'
import { useServerUrl } from '@/hooks/useServerUrl'
import { useSSE } from '@/hooks/useSSE'
import { useSyncingState } from '@/hooks/useSyncingState'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useVisibilityReporter } from '@/hooks/useVisibilityReporter'
import { useViewportHeight } from '@/hooks/useViewportHeight'
import { queryKeys } from '@/lib/query-keys'
import { AppContextProvider } from '@/lib/app-context'
import { fetchLatestMessages } from '@/lib/message-window-store'
import { useWorkspaceState } from '@/lib/workspace-store'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useTranslation } from '@/lib/use-translation'
import { VoiceProvider } from '@/lib/voice-context'
import { requireHubUrlForLogin } from '@/lib/runtime-config'
import { LoginPrompt } from '@/components/LoginPrompt'
import { InstallPrompt } from '@/components/InstallPrompt'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SyncingBanner } from '@/components/SyncingBanner'
import { ReconnectingBanner } from '@/components/ReconnectingBanner'
import { VoiceErrorBanner } from '@/components/VoiceErrorBanner'
import { LoadingState } from '@/components/LoadingState'
import { ToastContainer } from '@/components/ToastContainer'
import { ToastProvider, useToast } from '@/lib/toast-context'
import type { SyncEvent } from '@/types/api'

type ToastEvent = Extract<SyncEvent, { type: 'toast' }>

const REQUIRE_SERVER_URL = requireHubUrlForLogin()
const READY_FOR_INPUT_TITLE = 'Ready for input'

function isBrowserViewActive(): boolean {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return false
    }
    return document.visibilityState === 'visible' && document.hasFocus()
}

async function showSystemToastNotification(event: ToastEvent): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false
    }
    if (Notification.permission !== 'granted') {
        return false
    }

    const url = event.data.url ?? (event.data.sessionId ? `/sessions/${event.data.sessionId}` : '/')
    const options: NotificationOptions = {
        body: event.data.body,
        tag: event.data.sessionId ? `toast-${event.data.sessionId}-${event.data.title}` : `toast-${event.data.title}`,
        data: { url }
    }

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready
            await registration.showNotification(event.data.title, options)
            return true
        }

        const notification = new Notification(event.data.title, options)
        notification.onclick = () => {
            window.focus()
            window.location.assign(url)
        }
        return true
    } catch (error) {
        console.error('Failed to show system notification:', error)
        return false
    }
}

export function App() {
    return (
        <ToastProvider>
            <AppInner />
        </ToastProvider>
    )
}

function AppInner() {
    const { t } = useTranslation()
    const { serverUrl, baseUrl, setServerUrl, clearServerUrl } = useServerUrl()
    const { authSource, isLoading: isAuthSourceLoading, setAccessToken } = useAuthSource(baseUrl)
    const { token, api, isLoading: isAuthLoading, error: authError, needsBinding, bind } = useAuth(authSource, baseUrl)
    const goBack = useAppGoBack()
    const pathname = useLocation({ select: (location) => location.pathname })
    const workspace = useWorkspaceState()
    const router = useRouter()
    const { addToast } = useToast()

    useViewportHeight()

    useEffect(() => {
        const tg = getTelegramWebApp()
        tg?.ready()
        tg?.expand()
        initializeTheme()
    }, [])

    useEffect(() => {
        const tg = getTelegramWebApp()
        const backButton = tg?.BackButton
        if (!backButton) return

        if (pathname === '/' || pathname === '/sessions') {
            backButton.offClick(goBack)
            backButton.hide()
            return
        }

        backButton.show()
        backButton.onClick(goBack)
        return () => {
            backButton.offClick(goBack)
            backButton.hide()
        }
    }, [goBack, pathname])
    const queryClient = useQueryClient()
    const selectedSessionId = workspace.tab === 'sessions' ? workspace.selectedSessionId : null
    const { isSyncing, startSync, endSync } = useSyncingState()
    const [sseDisconnected, setSseDisconnected] = useState(false)
    const syncTokenRef = useRef(0)
    const isFirstConnectRef = useRef(true)
    const baseUrlRef = useRef(baseUrl)
    const pushPromptedRef = useRef(false)
    const { isSupported: isPushSupported, permission: pushPermission, requestPermission, subscribe } = usePushNotifications(api)

    useEffect(() => {
        if (baseUrlRef.current === baseUrl) {
            return
        }
        baseUrlRef.current = baseUrl
        isFirstConnectRef.current = true
        syncTokenRef.current = 0
        queryClient.clear()
    }, [baseUrl, queryClient])

    // Clean up URL params after successful auth (for direct access links)
    useEffect(() => {
        if (!token || !api) return
        const { pathname, search, hash, state } = router.history.location
        const searchParams = new URLSearchParams(search)
        if (!searchParams.has('server') && !searchParams.has('hub') && !searchParams.has('token')) {
            return
        }
        searchParams.delete('server')
        searchParams.delete('hub')
        searchParams.delete('token')
        const nextSearch = searchParams.toString()
        const nextHref = `${pathname}${nextSearch ? `?${nextSearch}` : ''}${hash}`
        router.history.replace(nextHref, state)
    }, [token, api, router])

    useEffect(() => {
        if (!api || !token) {
            pushPromptedRef.current = false
            return
        }
        if (isTelegramApp() || !isPushSupported) {
            return
        }
        if (pushPromptedRef.current) {
            return
        }
        pushPromptedRef.current = true

        const run = async () => {
            if (pushPermission === 'granted') {
                await subscribe()
                return
            }
            if (pushPermission === 'default') {
                const granted = await requestPermission()
                if (granted) {
                    await subscribe()
                }
            }
        }

        void run()
    }, [api, isPushSupported, pushPermission, requestPermission, subscribe, token])

    const handleSseConnect = useCallback(() => {
        // Clear disconnected state on successful connection
        setSseDisconnected(false)

        // Increment token to track this specific connection
        const token = ++syncTokenRef.current

        // Only force show banner on first connect (page load)
        // Subsequent connects (session switches) use non-forced mode
        // which only shows banner when returning from background
        if (isFirstConnectRef.current) {
            isFirstConnectRef.current = false
            startSync({ force: true })
        } else {
            startSync()
        }
        const invalidations = [
            queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
            ...(selectedSessionId ? [
                queryClient.invalidateQueries({ queryKey: queryKeys.session(selectedSessionId) })
            ] : [])
        ]
        const refreshMessages = (selectedSessionId && api)
            ? fetchLatestMessages(api, selectedSessionId)
            : Promise.resolve()
        Promise.all([...invalidations, refreshMessages])
            .catch((error) => {
                console.error('Failed to invalidate queries on SSE connect:', error)
            })
            .finally(() => {
                // Only end sync if this is still the latest connection
                if (syncTokenRef.current === token) {
                    endSync()
                }
            })
    }, [api, queryClient, selectedSessionId, startSync, endSync])

    const handleSseDisconnect = useCallback(() => {
        // Only show reconnecting banner if we've already connected once
        if (!isFirstConnectRef.current) {
            setSseDisconnected(true)
        }
    }, [])

    const handleSseEvent = useCallback(() => {}, [])
    const handleToast = useCallback((event: ToastEvent) => {
        if (event.data.title === READY_FOR_INPUT_TITLE) {
            if (isBrowserViewActive()) {
                return
            }
            void showSystemToastNotification(event)
            return
        }

        addToast({
            title: event.data.title,
            body: event.data.body,
            sessionId: event.data.sessionId,
            url: event.data.url
        })
    }, [addToast])

    const eventSubscription = useMemo(() => {
        if (selectedSessionId) {
            return { sessionId: selectedSessionId }
        }
        return { all: true }
    }, [selectedSessionId])

    const { subscriptionId } = useSSE({
        enabled: Boolean(api && token),
        token: token ?? '',
        baseUrl,
        subscription: eventSubscription,
        onConnect: handleSseConnect,
        onDisconnect: handleSseDisconnect,
        onEvent: handleSseEvent,
        onToast: handleToast
    })

    useVisibilityReporter({
        api,
        subscriptionId,
        enabled: Boolean(api && token)
    })

    // Loading auth source
    if (isAuthSourceLoading) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <LoadingState label={t('loading')} className="text-sm" />
            </div>
        )
    }

    // No auth source (browser environment, not logged in)
    if (!authSource) {
        return (
            <LoginPrompt
                onLogin={setAccessToken}
                baseUrl={baseUrl}
                serverUrl={serverUrl}
                setServerUrl={setServerUrl}
                clearServerUrl={clearServerUrl}
                requireServerUrl={REQUIRE_SERVER_URL}
            />
        )
    }

    if (needsBinding) {
        return (
            <LoginPrompt
                mode="bind"
                onBind={bind}
                baseUrl={baseUrl}
                serverUrl={serverUrl}
                setServerUrl={setServerUrl}
                clearServerUrl={clearServerUrl}
                requireServerUrl={REQUIRE_SERVER_URL}
                error={authError ?? undefined}
            />
        )
    }

    // Authenticating (also covers the gap before useAuth effect starts)
    if (isAuthLoading || (authSource && !token && !authError)) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <LoadingState label={t('authorizing')} className="text-sm" />
            </div>
        )
    }

    // Auth error
    if (authError || !token || !api) {
        // If using access token and auth failed, show login again
        if (authSource.type === 'accessToken') {
            return (
                <LoginPrompt
                    onLogin={setAccessToken}
                    baseUrl={baseUrl}
                    serverUrl={serverUrl}
                    setServerUrl={setServerUrl}
                    clearServerUrl={clearServerUrl}
                    requireServerUrl={REQUIRE_SERVER_URL}
                    error={authError ?? t('login.error.authFailed')}
                />
            )
        }

        // Telegram auth failed
        return (
            <div className="p-4 space-y-3">
                <div className="text-base font-semibold">{t('login.title')}</div>
                <div className="text-sm text-red-600">
                    {authError ?? t('login.error.authFailed')}
                </div>
                <div className="text-xs text-[var(--app-hint)]">
                    Open this page from Telegram using the bot's "Open App" button (not "Open in browser").
                </div>
            </div>
        )
    }

    return (
        <AppContextProvider value={{ api, token, baseUrl }}>
            <VoiceProvider>
                <SyncingBanner isSyncing={isSyncing} />
                <ReconnectingBanner isReconnecting={sseDisconnected && !isSyncing} />
                <VoiceErrorBanner />
                <OfflineBanner />
                <div className="h-full flex flex-col">
                    <Outlet />
                </div>
                <ToastContainer />
                <InstallPrompt />
            </VoiceProvider>
        </AppContextProvider>
    )
}
