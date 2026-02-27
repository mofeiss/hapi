import { useCallback, useEffect, useRef, useState } from 'react'

export type QueuedMessage = {
    text: string
    timestamp: number
}

export function useMessageQueue(
    isAgentRunning: boolean,
    onSend: (text: string) => void,
) {
    const [queue, setQueue] = useState<QueuedMessage[]>([])
    const prevRunningRef = useRef(isAgentRunning)

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

    // When agent transitions from running → idle, flush the queue
    useEffect(() => {
        const wasRunning = prevRunningRef.current
        prevRunningRef.current = isAgentRunning

        if (wasRunning && !isAgentRunning && queue.length > 0) {
            const merged = queue.map((m) => m.text).join('\n')
            setQueue([])
            onSend(merged)
        }
    }, [isAgentRunning, queue, onSend])

    return { queue, enqueue, clear, flushNow }
}
