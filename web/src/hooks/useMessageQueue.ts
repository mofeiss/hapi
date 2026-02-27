import { useCallback, useEffect, useState } from 'react'

export type QueuedMessage = {
    text: string
    timestamp: number
}

export function useMessageQueue(
    isAgentRunning: boolean,
    onSend: (text: string) => void,
) {
    const [queue, setQueue] = useState<QueuedMessage[]>([])

    const enqueue = useCallback((text: string) => {
        setQueue((prev) => [...prev, { text, timestamp: Date.now() }])
    }, [])

    const clear = useCallback(() => {
        setQueue([])
    }, [])

    const flushNow = useCallback(() => {
        setQueue((prev) => {
            if (prev.length > 0) {
                const merged = prev.map((m) => m.text).join('\n')
                onSend(merged)
            }
            return []
        })
    }, [onSend])

    // When agent is idle and queue has items, flush them.
    // This replaces the previous transition-based detection (running → idle via ref)
    // which had a race condition: if isAgentRunning went false before the setQueue
    // update was processed by React, the transition was "consumed" on an empty queue,
    // and subsequent queue updates were never flushed.
    useEffect(() => {
        if (!isAgentRunning && queue.length > 0) {
            const merged = queue.map((m) => m.text).join('\n')
            setQueue([])
            onSend(merged)
        }
    }, [isAgentRunning, queue, onSend])

    return { queue, enqueue, clear, flushNow }
}
