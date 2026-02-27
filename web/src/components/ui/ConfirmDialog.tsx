import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/use-translation'

type ConfirmDialogProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    description: string
    confirmLabel: string
    confirmingLabel: string
    onConfirm: () => void | Promise<void>
    isPending: boolean
    destructive?: boolean
    /** When set, shows a "don't ask again" checkbox. On confirm with it checked, saves preference to localStorage under this key. */
    dontAskAgainKey?: string
}

export function ConfirmDialog(props: ConfirmDialogProps) {
    const { t } = useTranslation()
    const {
        isOpen,
        onClose,
        title,
        description,
        confirmLabel,
        confirmingLabel,
        onConfirm,
        isPending,
        destructive = false,
        dontAskAgainKey
    } = props

    const [error, setError] = useState<string | null>(null)
    const [dontAskAgain, setDontAskAgain] = useState(false)

    // Clear error and checkbox when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setError(null)
            setDontAskAgain(false)
        }
    }, [isOpen])

    const handleConfirm = async () => {
        setError(null)
        try {
            if (dontAskAgain && dontAskAgainKey) {
                try { localStorage.setItem(dontAskAgainKey, '1') } catch { /* ignore */ }
            }
            await onConfirm()
            onClose()
        } catch (err) {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : t('dialog.error.default')
            setError(message)
            // Revert localStorage if action failed
            if (dontAskAgain && dontAskAgainKey) {
                try { localStorage.removeItem(dontAskAgainKey) } catch { /* ignore */ }
            }
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="mt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {error ? (
                    <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                ) : null}

                {dontAskAgainKey ? (
                    <label className="mt-3 flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--app-hint)]">
                        <input
                            type="checkbox"
                            checked={dontAskAgain}
                            onChange={(e) => setDontAskAgain(e.target.checked)}
                            className="h-4 w-4 rounded border-[var(--app-border)] accent-[var(--app-link)]"
                        />
                        {t('dialog.dontAskAgain')}
                    </label>
                ) : null}

                <div className="mt-4 flex gap-2 justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('button.cancel')}
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'secondary'}
                        onClick={handleConfirm}
                        disabled={isPending}
                    >
                        {isPending ? confirmingLabel : confirmLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
