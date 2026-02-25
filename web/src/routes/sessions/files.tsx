import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FileSearchItem, GitFileStatus } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { DirectoryTree } from '@/components/SessionFiles/DirectoryTree'
import { useAppContext } from '@/lib/app-context'
import { useGitStatusFiles } from '@/hooks/queries/useGitStatusFiles'
import { useSession } from '@/hooks/queries/useSession'
import { useSessionFileSearch } from '@/hooks/queries/useSessionFileSearch'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { decodeBase64 } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { langAlias, useShikiHighlighter } from '@/lib/shiki'
import { useTranslation } from '@/lib/use-translation'

function RefreshIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 3 21 9 15 9" />
        </svg>
    )
}

function SearchIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    )
}

function GitBranchIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
    )
}

function FolderIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    )
}

function StatusBadge(props: { status: GitFileStatus['status'] }) {
    const { label, color } = useMemo(() => {
        switch (props.status) {
            case 'added':
                return { label: 'A', color: 'var(--app-git-staged-color)' }
            case 'deleted':
                return { label: 'D', color: 'var(--app-git-deleted-color)' }
            case 'renamed':
                return { label: 'R', color: 'var(--app-git-renamed-color)' }
            case 'untracked':
                return { label: '?', color: 'var(--app-git-untracked-color)' }
            case 'conflicted':
                return { label: 'U', color: 'var(--app-git-deleted-color)' }
            default:
                return { label: 'M', color: 'var(--app-git-unstaged-color)' }
        }
    }, [props.status])

    return (
        <span
            className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color, borderColor: color }}
        >
            {label}
        </span>
    )
}

function LineChanges(props: { added: number; removed: number }) {
    if (!props.added && !props.removed) return null

    return (
        <span className="flex items-center gap-1 text-[11px] font-mono">
            {props.added ? (
                <span className="text-[var(--app-diff-added-text)]">+{props.added}</span>
            ) : null}
            {props.removed ? (
                <span className="text-[var(--app-diff-removed-text)]">-{props.removed}</span>
            ) : null}
        </span>
    )
}

function GitFileRow(props: {
    file: GitFileStatus
    onOpen: () => void
    showDivider: boolean
}) {
    const subtitle = props.file.filePath || 'project root'

    return (
        <button
            type="button"
            onClick={props.onOpen}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--app-subtle-bg)] transition-colors ${props.showDivider ? 'border-b border-[var(--app-divider)]' : ''}`}
        >
            <FileIcon fileName={props.file.fileName} size={22} />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{props.file.fileName}</div>
                <div className="truncate text-xs text-[var(--app-hint)]">{subtitle}</div>
            </div>
            <div className="flex items-center gap-2">
                <LineChanges added={props.file.linesAdded} removed={props.file.linesRemoved} />
                <StatusBadge status={props.file.status} />
            </div>
        </button>
    )
}

function SearchResultRow(props: {
    file: FileSearchItem
    onOpen: () => void
    showDivider: boolean
}) {
    const subtitle = props.file.filePath || 'project root'
    const icon = props.file.fileType === 'file'
        ? <FileIcon fileName={props.file.fileName} size={22} />
        : <FolderIcon className="text-[var(--app-link)]" />

    return (
        <button
            type="button"
            onClick={props.onOpen}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--app-subtle-bg)] transition-colors ${props.showDivider ? 'border-b border-[var(--app-divider)]' : ''}`}
        >
            {icon}
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{props.file.fileName}</div>
                <div className="truncate text-xs text-[var(--app-hint)]">{subtitle}</div>
            </div>
        </button>
    )
}

function FileListSkeleton(props: { label: string; rows?: number }) {
    const titleWidths = ['w-1/3', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5']
    const subtitleWidths = ['w-1/2', 'w-2/3', 'w-3/4', 'w-1/3']
    const rows = props.rows ?? 6

    return (
        <div className="p-3 animate-pulse space-y-3" role="status" aria-live="polite">
            <span className="sr-only">{props.label}</span>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={`skeleton-row-${index}`} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded bg-[var(--app-subtle-bg)]" />
                    <div className="flex-1 space-y-2">
                        <div className={`h-3 ${titleWidths[index % titleWidths.length]} rounded bg-[var(--app-subtle-bg)]`} />
                        <div className={`h-2 ${subtitleWidths[index % subtitleWidths.length]} rounded bg-[var(--app-subtle-bg)]`} />
                    </div>
                </div>
            ))}
        </div>
    )
}

const MAX_COPYABLE_FILE_BYTES = 1_000_000

function resolveLanguage(path: string): string | undefined {
    const parts = path.split('.')
    if (parts.length <= 1) return undefined
    const ext = parts[parts.length - 1]?.toLowerCase()
    if (!ext) return undefined
    return langAlias[ext] ?? ext
}

function isBinaryContent(content: string): boolean {
    if (!content) return false
    if (content.includes('\0')) return true
    const nonPrintable = content.split('').filter((char) => {
        const code = char.charCodeAt(0)
        return code < 32 && code !== 9 && code !== 10 && code !== 13
    }).length
    return nonPrintable / content.length > 0.1
}

function getUtf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).length
}

function BackArrowIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function InlineDiffDisplay(props: { diffContent: string }) {
    const lines = props.diffContent.split('\n')

    return (
        <div className="overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-bg)]">
            {lines.map((line, index) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++')
                const isRemove = line.startsWith('-') && !line.startsWith('---')
                const isHunk = line.startsWith('@@')
                const isHeader = line.startsWith('+++') || line.startsWith('---')

                const className = [
                    'whitespace-pre-wrap px-3 py-0.5 text-xs font-mono',
                    isAdd ? 'bg-[var(--app-diff-added-bg)] text-[var(--app-diff-added-text)]' : '',
                    isRemove ? 'bg-[var(--app-diff-removed-bg)] text-[var(--app-diff-removed-text)]' : '',
                    isHunk ? 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)] font-semibold' : '',
                    isHeader ? 'text-[var(--app-hint)] font-semibold' : ''
                ].filter(Boolean).join(' ')

                const style = isAdd
                    ? { borderLeft: '2px solid var(--app-git-staged-color)' }
                    : isRemove
                        ? { borderLeft: '2px solid var(--app-git-deleted-color)' }
                        : undefined

                return (
                    <div key={`${index}-${line}`} className={className} style={style}>
                        {line || ' '}
                    </div>
                )
            })}
        </div>
    )
}

function FileContentSkeleton() {
    const widths = ['w-full', 'w-11/12', 'w-5/6', 'w-3/4', 'w-2/3', 'w-4/5']

    return (
        <div role="status" aria-live="polite">
            <span className="sr-only">Loading file…</span>
            <div className="animate-pulse space-y-2 rounded-md border border-[var(--app-border)] bg-[var(--app-code-bg)] p-3">
                {Array.from({ length: 12 }).map((_, index) => (
                    <div key={`file-skeleton-${index}`} className={`h-3 ${widths[index % widths.length]} rounded bg-[var(--app-subtle-bg)]`} />
                ))}
            </div>
        </div>
    )
}

function InlineFileView(props: {
    sessionId: string
    filePath: string
    staged?: boolean
    onClose: () => void
}) {
    const { api } = useAppContext()
    const { copied: pathCopied, copy: copyPath } = useCopyToClipboard()
    const { copied: contentCopied, copy: copyContent } = useCopyToClipboard()

    const fileName = props.filePath.split('/').pop() || props.filePath || 'File'

    const diffQuery = useQuery({
        queryKey: queryKeys.gitFileDiff(props.sessionId, props.filePath, props.staged),
        queryFn: async () => {
            if (!api || !props.sessionId || !props.filePath) {
                throw new Error('Missing session or path')
            }
            return await api.getGitDiffFile(props.sessionId, props.filePath, props.staged)
        },
        enabled: Boolean(api && props.sessionId && props.filePath)
    })

    const fileQuery = useQuery({
        queryKey: queryKeys.sessionFile(props.sessionId, props.filePath),
        queryFn: async () => {
            if (!api || !props.sessionId || !props.filePath) {
                throw new Error('Missing session or path')
            }
            return await api.readSessionFile(props.sessionId, props.filePath)
        },
        enabled: Boolean(api && props.sessionId && props.filePath)
    })

    const diffContent = diffQuery.data?.success ? (diffQuery.data.stdout ?? '') : ''
    const diffError = diffQuery.data && !diffQuery.data.success
        ? (diffQuery.data.error ?? diffQuery.data.stderr ?? 'Failed to load diff')
        : null
    const diffSuccess = diffQuery.data?.success === true
    const diffFailed = diffQuery.data?.success === false

    const fileContentResult = fileQuery.data
    const decodedContentResult = fileContentResult?.success && fileContentResult.content
        ? decodeBase64(fileContentResult.content)
        : { text: '', ok: true }
    const decodedContent = decodedContentResult.text
    const binaryFile = fileContentResult?.success
        ? !decodedContentResult.ok || isBinaryContent(decodedContent)
        : false

    const language = useMemo(() => resolveLanguage(props.filePath), [props.filePath])
    const highlighted = useShikiHighlighter(decodedContent, language)
    const contentSizeBytes = useMemo(
        () => (decodedContent ? getUtf8ByteLength(decodedContent) : 0),
        [decodedContent]
    )
    const canCopyContent = fileContentResult?.success === true
        && !binaryFile
        && decodedContent.length > 0
        && contentSizeBytes <= MAX_COPYABLE_FILE_BYTES

    const [displayMode, setDisplayMode] = useState<'diff' | 'file'>('diff')

    useEffect(() => {
        if (diffSuccess && !diffContent) {
            setDisplayMode('file')
            return
        }
        if (diffFailed) {
            setDisplayMode('file')
        }
    }, [diffSuccess, diffFailed, diffContent])

    const loading = diffQuery.isLoading || fileQuery.isLoading
    const fileError = fileContentResult && !fileContentResult.success
        ? ((fileContentResult as { error?: string }).error ?? 'Failed to read file')
        : null
    const diffErrorMessage = diffError ? `Diff unavailable: ${diffError}` : null

    return (
        <div>
            <div className="flex items-center gap-2 border-b border-[var(--app-divider)] px-3 py-2">
                <button
                    type="button"
                    onClick={props.onClose}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                >
                    <BackArrowIcon />
                </button>
                <FileIcon fileName={fileName} size={20} />
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--app-hint)]">{props.filePath}</span>
                <button
                    type="button"
                    onClick={() => copyPath(props.filePath)}
                    className="shrink-0 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                    title="Copy path"
                >
                    {pathCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                </button>
            </div>

            {diffContent ? (
                <div className="flex items-center gap-2 border-b border-[var(--app-divider)] px-3 py-2">
                    <button
                        type="button"
                        onClick={() => setDisplayMode('diff')}
                        className={`rounded px-3 py-1 text-xs font-semibold ${displayMode === 'diff' ? 'bg-[var(--app-button)] text-[var(--app-button-text)] opacity-80' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'}`}
                    >
                        Diff
                    </button>
                    <button
                        type="button"
                        onClick={() => setDisplayMode('file')}
                        className={`rounded px-3 py-1 text-xs font-semibold ${displayMode === 'file' ? 'bg-[var(--app-button)] text-[var(--app-button-text)] opacity-80' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'}`}
                    >
                        File
                    </button>
                </div>
            ) : null}

            <div className="p-4">
                {diffErrorMessage ? (
                    <div className="mb-3 rounded-md bg-amber-500/10 p-2 text-xs text-[var(--app-hint)]">
                        {diffErrorMessage}
                    </div>
                ) : null}
                {loading ? (
                    <FileContentSkeleton />
                ) : fileError ? (
                    <div className="text-sm text-[var(--app-hint)]">{fileError}</div>
                ) : binaryFile ? (
                    <div className="text-sm text-[var(--app-hint)]">
                        This looks like a binary file. It cannot be displayed.
                    </div>
                ) : displayMode === 'diff' && diffContent ? (
                    <InlineDiffDisplay diffContent={diffContent} />
                ) : displayMode === 'file' ? (
                    decodedContent ? (
                        <div className="relative">
                            {canCopyContent ? (
                                <button
                                    type="button"
                                    onClick={() => copyContent(decodedContent)}
                                    className="absolute right-2 top-2 z-10 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                                    title="Copy file content"
                                >
                                    {contentCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                </button>
                            ) : null}
                            <pre className="shiki overflow-auto rounded-md bg-[var(--app-code-bg)] p-3 pr-8 text-xs font-mono">
                                <code>{highlighted ?? decodedContent}</code>
                            </pre>
                        </div>
                    ) : (
                        <div className="text-sm text-[var(--app-hint)]">File is empty.</div>
                    )
                ) : (
                    <div className="text-sm text-[var(--app-hint)]">No changes to display.</div>
                )}
            </div>
        </div>
    )
}

export function FilesPanel({ sessionId }: { sessionId: string }) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const { session } = useSession(api, sessionId)
    const [searchQuery, setSearchQuery] = useState('')

    const [activeTab, setActiveTab] = useState<'changes' | 'directories'>('changes')
    const [selectedFile, setSelectedFile] = useState<{ path: string; staged?: boolean } | null>(null)

    const {
        status: gitStatus,
        error: gitError,
        isLoading: gitLoading,
        refetch: refetchGit
    } = useGitStatusFiles(api, sessionId)

    const shouldSearch = Boolean(searchQuery)

    const searchResults = useSessionFileSearch(api, sessionId, searchQuery, {
        enabled: shouldSearch
    })

    const handleOpenFile = useCallback((path: string, staged?: boolean) => {
        setSelectedFile({ path, staged })
    }, [])

    const handleCloseFile = useCallback(() => {
        setSelectedFile(null)
    }, [])

    const branchLabel = gitStatus?.branch ?? 'detached'
    const showGitErrorBanner = Boolean(gitError)
    const rootLabel = useMemo(() => {
        const base = session?.metadata?.path ?? sessionId
        const parts = base.split(/[/\\]/).filter(Boolean)
        return parts.length ? parts[parts.length - 1] : base
    }, [session?.metadata?.path, sessionId])

    const handleRefresh = useCallback(() => {
        if (searchQuery) {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.sessionFiles(sessionId, searchQuery)
            })
            return
        }

        if (activeTab === 'directories') {
            void queryClient.invalidateQueries({
                queryKey: ['session-directory', sessionId]
            })
            return
        }

        void refetchGit()
    }, [activeTab, queryClient, refetchGit, searchQuery, sessionId])

    const handleTabChange = useCallback((nextTab: 'changes' | 'directories') => {
        setActiveTab(nextTab)
        setSelectedFile(null)
    }, [])

    return (
        <div className="flex h-full flex-col">
            <div className="bg-[var(--app-bg)]">
                <div className="mx-auto w-full max-w-content p-3 border-b border-[var(--app-border)]">
                    <div className="flex items-center gap-2 rounded-md bg-[var(--app-subtle-bg)] px-3 py-2">
                        <SearchIcon className="text-[var(--app-hint)]" />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search files"
                            className="w-full bg-transparent text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none"
                            autoCapitalize="none"
                            autoCorrect="off"
                        />
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                            title="Refresh"
                        >
                            <RefreshIcon />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--app-bg)] border-b border-[var(--app-divider)]" role="tablist">
                <div className="mx-auto w-full max-w-content grid grid-cols-2">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'changes'}
                        onClick={() => handleTabChange('changes')}
                        className={`relative py-3 text-center text-sm font-semibold transition-colors hover:bg-[var(--app-subtle-bg)] ${activeTab === 'changes' ? 'text-[var(--app-fg)]' : 'text-[var(--app-hint)]'}`}
                    >
                        {t('files.tab.changes')}
                        <span
                            className={`absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full ${activeTab === 'changes' ? 'bg-[var(--app-link)]' : 'bg-transparent'}`}
                        />
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'directories'}
                        onClick={() => handleTabChange('directories')}
                        className={`relative py-3 text-center text-sm font-semibold transition-colors hover:bg-[var(--app-subtle-bg)] ${activeTab === 'directories' ? 'text-[var(--app-fg)]' : 'text-[var(--app-hint)]'}`}
                    >
                        {t('files.tab.directories')}
                        <span
                            className={`absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full ${activeTab === 'directories' ? 'bg-[var(--app-link)]' : 'bg-transparent'}`}
                        />
                    </button>
                </div>
            </div>

            {!gitLoading && gitStatus && !searchQuery && activeTab === 'changes' && !selectedFile ? (
                <div className="bg-[var(--app-bg)]">
                    <div className="mx-auto w-full max-w-content px-3 py-2 border-b border-[var(--app-divider)]">
                        <div className="flex items-center gap-2 text-sm">
                            <GitBranchIcon className="text-[var(--app-hint)]" />
                            <span className="font-semibold">{branchLabel}</span>
                        </div>
                        <div className="text-xs text-[var(--app-hint)]">
                            {gitStatus.totalStaged} staged, {gitStatus.totalUnstaged} unstaged
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-content">
                    {selectedFile ? (
                        <InlineFileView
                            key={selectedFile.path}
                            sessionId={sessionId}
                            filePath={selectedFile.path}
                            staged={selectedFile.staged}
                            onClose={handleCloseFile}
                        />
                    ) : showGitErrorBanner && activeTab === 'changes' ? (
                        <div className="border-b border-[var(--app-divider)] bg-amber-500/10 px-3 py-2 text-xs text-[var(--app-hint)]">
                            {gitError}
                        </div>
                    ) : null}
                    {!selectedFile && shouldSearch ? (
                        searchResults.isLoading ? (
                            <FileListSkeleton label="Loading files…" />
                        ) : searchResults.error ? (
                            <div className="p-6 text-sm text-[var(--app-hint)]">{searchResults.error}</div>
                        ) : searchResults.files.length === 0 ? (
                            <div className="p-6 text-sm text-[var(--app-hint)]">
                                {searchQuery ? 'No files match your search.' : 'No files found in this project.'}
                            </div>
                        ) : (
                            <div className="border-t border-[var(--app-divider)]">
                                {searchResults.files.map((file, index) => (
                                    <SearchResultRow
                                        key={`${file.fullPath}-${index}`}
                                        file={file}
                                        onOpen={() => handleOpenFile(file.fullPath)}
                                        showDivider={index < searchResults.files.length - 1}
                                    />
                                ))}
                            </div>
                        )
                    ) : !selectedFile && activeTab === 'directories' ? (
                        <DirectoryTree
                            api={api}
                            sessionId={sessionId}
                            rootLabel={rootLabel}
                            onOpenFile={(path) => handleOpenFile(path)}
                        />
                    ) : !selectedFile && gitLoading ? (
                        <FileListSkeleton label="Loading Git status…" />
                    ) : !selectedFile ? (
                        <div>
                            {gitStatus?.stagedFiles.length ? (
                                <div>
                                    <div className="border-b border-[var(--app-divider)] bg-[var(--app-bg)] px-3 py-2 text-xs font-semibold text-[var(--app-git-staged-color)]">
                                        Staged Changes ({gitStatus.stagedFiles.length})
                                    </div>
                                    {gitStatus.stagedFiles.map((file, index) => (
                                        <GitFileRow
                                            key={`staged-${file.fullPath}-${index}`}
                                            file={file}
                                            onOpen={() => handleOpenFile(file.fullPath, file.isStaged)}
                                            showDivider={index < gitStatus.stagedFiles.length - 1 || gitStatus.unstagedFiles.length > 0}
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {gitStatus?.unstagedFiles.length ? (
                                <div>
                                    <div className="border-b border-[var(--app-divider)] bg-[var(--app-bg)] px-3 py-2 text-xs font-semibold text-[var(--app-git-unstaged-color)]">
                                        Unstaged Changes ({gitStatus.unstagedFiles.length})
                                    </div>
                                    {gitStatus.unstagedFiles.map((file, index) => (
                                        <GitFileRow
                                            key={`unstaged-${file.fullPath}-${index}`}
                                            file={file}
                                            onOpen={() => handleOpenFile(file.fullPath, file.isStaged)}
                                            showDivider={index < gitStatus.unstagedFiles.length - 1}
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {!gitStatus ? (
                                <div className="p-6 text-sm text-[var(--app-hint)]">
                                    Git status unavailable. Use Directories to browse all files, or search.
                                </div>
                            ) : null}

                            {gitStatus && gitStatus.stagedFiles.length === 0 && gitStatus.unstagedFiles.length === 0 ? (
                                <div className="p-6 text-sm text-[var(--app-hint)]">
                                    No changes detected. Use Directories to browse all files, or search.
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export default function FilesPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/files' })
    return <FilesPanel sessionId={sessionId} />
}