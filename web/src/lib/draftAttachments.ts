import type { Attachment, AttachmentAdapter, CompleteAttachment, PendingAttachment } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import { isImageMimeType } from '@/lib/fileAttachments'
import type { AttachmentMetadata } from '@/types/api'

const DRAFT_ATTACHMENT_PATH_PREFIX = 'draft:'
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024

type DraftStoredAttachment = {
    id: string
    file: File
    previewUrl?: string
}

type DraftPendingAttachment = PendingAttachment & {
    path?: string
    previewUrl?: string
}

const draftAttachments = new Map<string, DraftStoredAttachment>()

function makeDraftAttachmentPath(id: string): string {
    return `${DRAFT_ATTACHMENT_PATH_PREFIX}${id}`
}

function parseDraftAttachmentId(path?: string | null): string | null {
    if (!path || !path.startsWith(DRAFT_ATTACHMENT_PATH_PREFIX)) {
        return null
    }

    const id = path.slice(DRAFT_ATTACHMENT_PATH_PREFIX.length).trim()
    return id || null
}

function setDraftAttachment(entry: DraftStoredAttachment): void {
    draftAttachments.set(entry.id, entry)
}

function getDraftAttachment(id: string): DraftStoredAttachment | null {
    return draftAttachments.get(id) ?? null
}

function removeDraftAttachment(id: string): void {
    draftAttachments.delete(id)
}

export function createDraftAttachmentAdapter(): AttachmentAdapter {
    return {
        accept: '*/*',

        async *add({ file }): AsyncGenerator<PendingAttachment> {
            const id = crypto.randomUUID()
            const contentType = file.type || 'application/octet-stream'

            yield {
                id,
                type: 'file',
                name: file.name,
                contentType,
                file,
                status: { type: 'running', reason: 'uploading', progress: 0 }
            }

            if (file.size > MAX_UPLOAD_BYTES) {
                yield {
                    id,
                    type: 'file',
                    name: file.name,
                    contentType,
                    file,
                    status: { type: 'incomplete', reason: 'error' }
                }
                return
            }

            let previewUrl: string | undefined
            if (isImageMimeType(contentType) && file.size <= MAX_PREVIEW_BYTES) {
                previewUrl = await fileToDataUrl(file)
            }

            setDraftAttachment({ id, file, previewUrl })

            yield {
                id,
                type: 'file',
                name: file.name,
                contentType,
                file,
                status: { type: 'requires-action', reason: 'composer-send' },
                path: makeDraftAttachmentPath(id),
                previewUrl
            } as DraftPendingAttachment
        },

        async remove(attachment: Attachment): Promise<void> {
            removeDraftAttachment(attachment.id)
        },

        async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
            const pending = attachment as DraftPendingAttachment
            const metadata: AttachmentMetadata = {
                id: attachment.id,
                filename: attachment.name,
                mimeType: attachment.contentType ?? 'application/octet-stream',
                size: attachment.file?.size ?? 0,
                path: pending.path ?? makeDraftAttachmentPath(attachment.id),
                previewUrl: pending.previewUrl
            }

            return {
                id: attachment.id,
                type: attachment.type,
                name: attachment.name,
                contentType: attachment.contentType,
                status: { type: 'complete' },
                content: [{ type: 'text', text: JSON.stringify({ __attachmentMetadata: metadata }) }]
            }
        }
    }
}

export async function resolveDraftAttachmentMetadata(
    api: ApiClient,
    sessionId: string,
    attachments?: AttachmentMetadata[]
): Promise<AttachmentMetadata[] | undefined> {
    if (!attachments || attachments.length === 0) {
        return undefined
    }

    const resolved: AttachmentMetadata[] = []
    const uploadedPaths: string[] = []
    const consumedDraftIds: string[] = []

    try {
        for (const attachment of attachments) {
            const draftId = parseDraftAttachmentId(attachment.path)
            if (!draftId) {
                resolved.push(attachment)
                continue
            }

            const draft = getDraftAttachment(draftId)
            if (!draft) {
                throw new Error(`Missing draft attachment: ${attachment.filename}`)
            }

            const content = await fileToBase64(draft.file)
            const mimeType = draft.file.type || attachment.mimeType || 'application/octet-stream'
            const result = await api.uploadFile(sessionId, draft.file.name, content, mimeType)

            if (!result.success || !result.path) {
                throw new Error(result.error || `Failed to upload attachment: ${draft.file.name}`)
            }

            uploadedPaths.push(result.path)
            consumedDraftIds.push(draftId)
            resolved.push({
                ...attachment,
                filename: draft.file.name,
                mimeType,
                size: draft.file.size,
                path: result.path,
                previewUrl: attachment.previewUrl ?? draft.previewUrl
            })
        }
    } catch (error) {
        await Promise.all(uploadedPaths.map(async (path) => {
            try {
                await api.deleteUploadFile(sessionId, path)
            } catch {
                // Best effort cleanup.
            }
        }))
        throw error
    }

    consumedDraftIds.forEach(removeDraftAttachment)
    return resolved
}

async function fileToBase64(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1]
            if (!base64) {
                reject(new Error('Failed to read file'))
                return
            }
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

async function fileToDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}
