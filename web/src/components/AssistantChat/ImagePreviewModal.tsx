import { useCallback, useEffect, useMemo } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export type PreviewImage = {
    src: string
    alt?: string
}

const MAX_VISIBLE_THUMBS = 5

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="15" y2="15" />
            <line x1="15" y1="5" x2="5" y2="15" />
        </svg>
    )
}

function ArrowIcon(props: { direction: 'left' | 'right' }) {
    const d = props.direction === 'left' ? 'M15 10H5m0 0l4-4m-4 4l4 4' : 'M5 10h10m0 0l-4-4m4 4l-4 4'
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={d} />
        </svg>
    )
}

export function ImagePreviewModal(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    images: PreviewImage[]
    selectedIndex: number
    onSelectedIndexChange: (index: number) => void
}) {
    const { open, onOpenChange, images, selectedIndex, onSelectedIndexChange } = props
    const current = images[selectedIndex]
    const needsScroll = images.length > MAX_VISIBLE_THUMBS

    // Keep selected thumbnail visible by computing the window offset
    const thumbOffset = useMemo(() => {
        if (images.length <= MAX_VISIBLE_THUMBS) return 0
        const centered = selectedIndex - Math.floor(MAX_VISIBLE_THUMBS / 2)
        return Math.max(0, Math.min(centered, images.length - MAX_VISIBLE_THUMBS))
    }, [selectedIndex, images.length])

    const visibleThumbs = useMemo(() => {
        if (images.length <= MAX_VISIBLE_THUMBS) return images.map((img, i) => ({ img, i }))
        return images.slice(thumbOffset, thumbOffset + MAX_VISIBLE_THUMBS).map((img, j) => ({ img, i: thumbOffset + j }))
    }, [images, thumbOffset])

    const goPrev = useCallback(() => {
        onSelectedIndexChange((selectedIndex - 1 + images.length) % images.length)
    }, [selectedIndex, images.length, onSelectedIndexChange])

    const goNext = useCallback(() => {
        onSelectedIndexChange((selectedIndex + 1) % images.length)
    }, [selectedIndex, images.length, onSelectedIndexChange])

    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
            else if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, goPrev, goNext])

    if (!current) return null

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
                <DialogPrimitive.Content
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center"
                    onClick={() => onOpenChange(false)}
                >
                    <DialogPrimitive.Title className="sr-only">
                        {current.alt || 'Image preview'}
                    </DialogPrimitive.Title>

                    {/* Close button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenChange(false) }}
                        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
                        aria-label="Close preview"
                    >
                        <CloseIcon />
                    </button>

                    {/* Main image area */}
                    <div
                        className="relative flex h-[calc(100vh-100px)] w-full items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={current.src}
                            alt={current.alt || 'Preview'}
                            className="max-h-full max-w-[90vw] rounded-lg object-contain shadow-2xl"
                        />
                    </div>

                    {/* Thumbnail navigation — arrows + thumbnails inline */}
                    <div
                        className="flex h-[68px] flex-shrink-0 items-center justify-center gap-3 px-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Left arrow */}
                        <button
                            onClick={goPrev}
                            className={cn(
                                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/25 hover:text-white',
                                needsScroll && thumbOffset === 0 && selectedIndex === 0 ? 'opacity-30' : ''
                            )}
                            aria-label="Previous image"
                        >
                            <ArrowIcon direction="left" />
                        </button>

                        {/* Visible thumbnails */}
                        <div className="flex items-center gap-2">
                            {visibleThumbs.map(({ img, i }) => (
                                <button
                                    key={i}
                                    onClick={() => onSelectedIndexChange(i)}
                                    className={cn(
                                        'h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all',
                                        i === selectedIndex
                                            ? 'border-white opacity-100 ring-1 ring-white/30'
                                            : 'border-transparent opacity-60 hover:opacity-90'
                                    )}
                                    aria-label={img.alt || `Image ${i + 1}`}
                                >
                                    <img
                                        src={img.src}
                                        alt={img.alt || `Thumbnail ${i + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>

                        {/* Right arrow */}
                        <button
                            onClick={goNext}
                            className={cn(
                                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/25 hover:text-white',
                                needsScroll && thumbOffset + MAX_VISIBLE_THUMBS >= images.length && selectedIndex === images.length - 1 ? 'opacity-30' : ''
                            )}
                            aria-label="Next image"
                        >
                            <ArrowIcon direction="right" />
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
