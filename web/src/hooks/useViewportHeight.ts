import { useEffect } from 'react'

function isIOSStandalonePWA(): boolean {
    if (typeof window === 'undefined') {
        return false
    }

    const ua = window.navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    return isIOS && isStandalone
}

function updateViewportHeightVar(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return
    }

    const visualViewportHeight = window.visualViewport?.height
    const innerHeight = window.innerHeight
    const isIOSStandalone = isIOSStandalonePWA()
    const baseHeight = visualViewportHeight ?? innerHeight
    const height = Math.round(baseHeight)

    if (height > 0) {
        document.documentElement.style.setProperty('--app-viewport-height', `${height}px`)

        if (isIOSStandalone) {
            document.documentElement.style.setProperty(
                '--app-root-height',
                `calc(${height}px + max(env(safe-area-inset-bottom) - 25px, 0px))`,
            )
        } else {
            document.documentElement.style.setProperty('--app-root-height', `${height}px`)
        }
    }
}

export function useViewportHeight(): void {
    useEffect(() => {
        updateViewportHeightVar()

        const handleResize = () => {
            updateViewportHeightVar()
        }

        window.addEventListener('resize', handleResize)
        window.visualViewport?.addEventListener('resize', handleResize)
        window.visualViewport?.addEventListener('scroll', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            window.visualViewport?.removeEventListener('resize', handleResize)
            window.visualViewport?.removeEventListener('scroll', handleResize)
        }
    }, [])
}
