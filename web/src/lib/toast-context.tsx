import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type Toast = {
    id: string
    title: string
    body: string
    sessionId: string
    url: string
    variant?: 'default' | 'error'
    blocking?: boolean
}

export type ToastContextValue = {
    toasts: Toast[]
    addToast: (toast: Omit<Toast, 'id'>) => void
    removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function createToastId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = createToastId()
        setToasts((prev) => [...prev, { id, ...toast }])
    }, [])

    const value = useMemo<ToastContextValue>(() => ({
        toasts,
        addToast,
        removeToast
    }), [toasts, addToast, removeToast])

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    )
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return ctx
}
