import { useState } from 'react'
import type { AttachmentMetadata } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { isImageMimeType } from '@/lib/fileAttachments'
import { ImagePreviewModal, type PreviewImage } from '@/components/AssistantChat/ImagePreviewModal'

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ImageAttachment(props: { attachment: AttachmentMetadata; onClick: () => void }) {
    const { attachment, onClick } = props
    return (
        <button
            type="button"
            onClick={onClick}
            className="relative overflow-hidden rounded-lg cursor-pointer transition-opacity hover:opacity-90"
        >
            <img
                src={attachment.previewUrl}
                alt={attachment.filename}
                className="max-h-48 max-w-full object-contain"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <span className="text-xs text-white/90 line-clamp-1">
                    {attachment.filename}
                </span>
            </div>
        </button>
    )
}

function FileAttachment(props: { attachment: AttachmentMetadata }) {
    const { attachment } = props
    return (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--app-bg)] px-3 py-2">
            <FileIcon fileName={attachment.filename} size={24} />
            <div className="min-w-0 flex-1">
                <div className="truncate text-base font-medium text-[var(--app-fg)]">
                    {attachment.filename}
                </div>
                <div className="text-xs text-[var(--app-hint)]">
                    {formatFileSize(attachment.size)}
                </div>
            </div>
        </div>
    )
}

export function MessageAttachments(props: { attachments: AttachmentMetadata[] }) {
    const { attachments } = props
    const [previewIndex, setPreviewIndex] = useState(-1)

    if (!attachments || attachments.length === 0) return null

    const images = attachments.filter(a => isImageMimeType(a.mimeType) && a.previewUrl)
    const files = attachments.filter(a => !isImageMimeType(a.mimeType) || !a.previewUrl)

    const previewImages: PreviewImage[] = images.map(a => ({
        src: a.previewUrl!,
        alt: a.filename
    }))

    return (
        <>
            <div className="mt-2 flex flex-col gap-2">
                {images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {images.map((attachment, i) => (
                            <ImageAttachment
                                key={attachment.id}
                                attachment={attachment}
                                onClick={() => setPreviewIndex(i)}
                            />
                        ))}
                    </div>
                )}
                {files.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        {files.map(attachment => (
                            <FileAttachment key={attachment.id} attachment={attachment} />
                        ))}
                    </div>
                )}
            </div>

            {previewIndex >= 0 && (
                <ImagePreviewModal
                    open={previewIndex >= 0}
                    onOpenChange={(open) => { if (!open) setPreviewIndex(-1) }}
                    images={previewImages}
                    selectedIndex={previewIndex}
                    onSelectedIndexChange={setPreviewIndex}
                />
            )}
        </>
    )
}
