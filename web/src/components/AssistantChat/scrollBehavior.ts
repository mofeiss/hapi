export const CHAT_BOTTOM_THRESHOLD_PX = 120

export function getDistanceFromBottom(viewport: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>): number {
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
}

export function isViewportNearBottom(
    viewport: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
    threshold = CHAT_BOTTOM_THRESHOLD_PX
): boolean {
    return getDistanceFromBottom(viewport) < threshold
}
