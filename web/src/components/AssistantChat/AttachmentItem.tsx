import { createContext, useContext, useState } from 'react'
import { AttachmentPrimitive, useThreadComposerAttachment } from '@assistant-ui/react'
import { Spinner } from '@/components/Spinner'
import { isImageMimeType } from '@/lib/fileAttachments'

// Context for composer-level image preview coordination
export const ComposerImagePreviewContext = createContext<{
    openPreview: (attachmentId: string) => void
} | null>(null)

function ErrorIcon() {
    return (
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
        </svg>
    )
}

function RemoveIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="3" y1="3" x2="9" y2="9" />
            <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
    )
}

export function AttachmentItem() {
    const attachment = useThreadComposerAttachment()
    const { name, status } = attachment
    const attachmentId = (attachment as { id?: string }).id ?? ''
    const contentType = (attachment as { contentType?: string }).contentType ?? ''
    const previewUrl = (attachment as { previewUrl?: string }).previewUrl
    const isImage = isImageMimeType(contentType) && !!previewUrl
    const isUploading = status.type === 'running'
    const isError = status.type === 'incomplete'

    const previewCtx = useContext(ComposerImagePreviewContext)

    const handleClick = () => {
        if (isImage && previewCtx) {
            previewCtx.openPreview(attachmentId)
        }
    }

    return (
        <AttachmentPrimitive.Root
            className="flex items-center gap-2 rounded-lg bg-[var(--app-subtle-bg)] px-3 py-2 text-base text-[var(--app-fg)] cursor-pointer"
            onClick={isImage ? handleClick : undefined}
        >
            {isImage ? (
                <div className="flex-shrink-0 overflow-hidden rounded">
                    <img
                        src={previewUrl}
                        alt={name}
                        className="h-6 w-6 object-cover"
                    />
                </div>
            ) : null}
            {isUploading ? <Spinner size="sm" label={null} className="text-[var(--app-hint)]" /> : null}
            {isError ? (
                <span className="text-red-500">
                    <ErrorIcon />
                </span>
            ) : null}
            <span className="max-w-[150px] truncate">{name}</span>
            <AttachmentPrimitive.Remove
                className="ml-auto flex h-5 w-5 items-center justify-center rounded text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)]"
                aria-label="Remove attachment"
                title="Remove attachment"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                <RemoveIcon />
            </AttachmentPrimitive.Remove>
        </AttachmentPrimitive.Root>
    )
}
