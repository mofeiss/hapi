import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ComposerPrimitive } from '@assistant-ui/react'
import type { ConversationStatus } from '@/realtime/types'
import { useTranslation } from '@/lib/use-translation'

function VoiceAssistantIcon({ animated = false }: { animated?: boolean } = {}) {
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
        >
            {animated ? (
                <>
                    <path d="M4 11v2">
                        <animate attributeName="d" values="M4 11v2;M4 8v8;M4 11v2" dur="0.8s" repeatCount="indefinite" begin="0s" />
                    </path>
                    <path d="M8 9v6">
                        <animate attributeName="d" values="M8 9v6;M8 5v14;M8 9v6" dur="0.8s" repeatCount="indefinite" begin="0.15s" />
                    </path>
                    <path d="M12 6v12">
                        <animate attributeName="d" values="M12 6v12;M12 3v18;M12 6v12" dur="0.8s" repeatCount="indefinite" begin="0.3s" />
                    </path>
                    <path d="M16 9v6">
                        <animate attributeName="d" values="M16 9v6;M16 5v14;M16 9v6" dur="0.8s" repeatCount="indefinite" begin="0.45s" />
                    </path>
                    <path d="M20 11v2">
                        <animate attributeName="d" values="M20 11v2;M20 8v8;M20 11v2" dur="0.8s" repeatCount="indefinite" begin="0.6s" />
                    </path>
                </>
            ) : (
                <>
                    <path d="M12 6v12" />
                    <path d="M8 9v6" />
                    <path d="M16 9v6" />
                    <path d="M4 11v2" />
                    <path d="M20 11v2" />
                </>
            )}
        </svg>
    )
}

function SpeakerIcon(props: { muted?: boolean }) {
    if (props.muted) {
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
            >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
        )
    }

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
        >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
    )
}

function SwitchToRemoteIcon() {
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
        >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
    )
}

function PlanIcon() {
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
        >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
        </svg>
    )
}

function ChevronDownIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

function ModelIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        </svg>
    )
}

function ShieldIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
    )
}

function MiniSelect(props: {
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    disabled?: boolean
    icon?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ bottom: 0, left: 0 })

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const handleToggle = useCallback(() => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPos({
                bottom: window.innerHeight - rect.top + 4,
                left: rect.left,
            })
        }
        setOpen(!open)
    }, [open])

    const selectedLabel = props.options.find((o) => o.value === props.value)?.label ?? props.value

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                disabled={props.disabled}
                onClick={handleToggle}
                className={`flex items-center gap-1 h-8 px-2 rounded-full text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    open
                        ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                        : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                }`}
            >
                {props.icon}
                <span className="inline-grid">
                    {props.options.map(o => <span key={o.value} className="col-start-1 row-start-1 invisible">{o.label}</span>)}
                    <span className="col-start-1 row-start-1">{selectedLabel}</span>
                </span>
                <ChevronDownIcon />
            </button>
            {open ? createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[120px] rounded-lg bg-[var(--app-secondary-bg)] border border-[var(--app-divider)] shadow-lg overflow-hidden z-[9999]"
                    style={{ bottom: pos.bottom, left: pos.left }}
                >
                    {props.options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--app-bg)] ${
                                option.value === props.value ? 'text-[var(--app-link)] font-medium' : 'text-[var(--app-fg)]'
                            }`}
                            onClick={() => {
                                props.onChange(option.value)
                                setOpen(false)
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>,
                document.body
            ) : null}
        </>
    )
}

function AttachmentIcon() {
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
        >
            <path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" />
        </svg>
    )
}

function AbortIcon(props: { spinning: boolean }) {
    if (props.spinning) {
        return (
            <svg
                className="animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" />
            </svg>
        )
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="currentColor"
        >
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4-2.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-4Z" />
        </svg>
    )
}

function SendIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
        </svg>
    )
}

function StopIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
    )
}

function LoadingIcon() {
    return (
        <svg
            className="animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" />
        </svg>
    )
}

function UnifiedButton(props: {
    canSend: boolean
    controlsDisabled: boolean
    showAbortButton: boolean
    abortDisabled: boolean
    isAborting: boolean
    onSend: () => void
    onAbort: () => void
}) {
    const { t } = useTranslation()

    const hasText = props.canSend

    const handleClick = () => {
        if (props.showAbortButton) {
            props.onAbort()
        } else if (hasText) {
            props.onSend()
        }
    }

    let icon: React.ReactNode
    let className: string
    let ariaLabel: string

    if (props.showAbortButton) {
        icon = <AbortIcon spinning={props.isAborting} />
        className = 'bg-black text-white'
        ariaLabel = t('composer.abort')
    } else if (hasText) {
        icon = <SendIcon />
        className = 'bg-black text-white'
        ariaLabel = t('composer.send')
    } else {
        icon = <SendIcon />
        className = 'bg-[#C0C0C0] text-white'
        ariaLabel = t('composer.send')
    }

    const isDisabled = props.showAbortButton
        ? props.abortDisabled
        : (props.controlsDisabled || !hasText)

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isDisabled}
            aria-label={ariaLabel}
            title={ariaLabel}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {icon}
        </button>
    )
}

function QrCodeButton() {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                aria-label={t('composer.mobileAccess')}
                title={t('composer.mobileAccess')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-fg)]/[0.04] text-[var(--app-fg)]/60 transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]"
                onClick={() => setOpen(true)}
            >
                <SwitchToRemoteIcon />
            </button>
            {open ? createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    onClick={() => setOpen(false)}
                >
                    <div className="fixed inset-0 bg-black/30" />
                    <div
                        className="relative rounded-2xl bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <QRCodeSVG value={window.location.href} size={200} />
                        <p className="mt-3 max-w-[200px] text-center text-xs text-gray-500">
                            {t('composer.scanToOpen')}
                        </p>
                    </div>
                </div>,
                document.body
            ) : null}
        </>
    )
}

function PermissionPlanPill(props: {
    showPermission: boolean
    permissionMode: string
    permissionOptions: { value: string; label: string }[]
    onPermissionChange: (value: string) => void
    showPlan: boolean
    isPlanActive: boolean
    onPlanToggle: () => void
    disabled?: boolean
}) {
    const { t: _t } = useTranslation()
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ bottom: 0, left: 0 })

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const handleToggle = useCallback(() => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPos({
                bottom: window.innerHeight - rect.top + 4,
                left: rect.left,
            })
        }
        setOpen(!open)
    }, [open])

    const selectedLabel = props.permissionOptions.find(o => o.value === props.permissionMode)?.label ?? props.permissionMode
    const shortLabel = selectedLabel.split(' ')[0]
    const showBoth = props.showPermission && props.showPlan

    return (
        <>
            <div className="flex items-center h-8 rounded-full overflow-hidden bg-[var(--app-fg)]/[0.04]">
                {props.showPermission ? (
                    <button
                        ref={buttonRef}
                        type="button"
                        disabled={props.disabled}
                        onClick={handleToggle}
                        className={`flex items-center gap-1 h-full px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            open
                                ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <ShieldIcon />
                        <span className="inline-grid">
                            {props.permissionOptions.map(o => <span key={o.value} className="col-start-1 row-start-1 invisible">{o.label.split(' ')[0]}</span>)}
                            <span className="col-start-1 row-start-1">{shortLabel}</span>
                        </span>
                        <ChevronDownIcon />
                    </button>
                ) : null}
                {showBoth ? (
                    <div className="w-px h-3.5 bg-[var(--app-fg)]/10 shrink-0" />
                ) : null}
                {props.showPlan ? (
                    <button
                        type="button"
                        aria-label="Plan Mode"
                        title="Plan Mode"
                        disabled={props.disabled}
                        onClick={props.onPlanToggle}
                        className={`flex items-center gap-1 h-full px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            props.isPlanActive
                                ? 'bg-[var(--app-badge-warning-text)]/15 text-[var(--app-badge-warning-text)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <PlanIcon />
                        <span>Plan</span>
                    </button>
                ) : null}
            </div>
            {open && props.showPermission ? createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[120px] rounded-lg bg-[var(--app-secondary-bg)] border border-[var(--app-divider)] shadow-lg overflow-hidden z-[9999]"
                    style={{ bottom: pos.bottom, left: pos.left }}
                >
                    {props.permissionOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--app-bg)] ${
                                option.value === props.permissionMode ? 'text-[var(--app-link)] font-medium' : 'text-[var(--app-fg)]'
                            }`}
                            onClick={() => {
                                props.onPermissionChange(option.value)
                                setOpen(false)
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>,
                document.body
            ) : null}
        </>
    )
}

export function ComposerButtons(props: {
    canSend: boolean
    controlsDisabled: boolean
    showModelSelect: boolean
    modelMode: string
    modelModeOptions: { value: string; label: string }[]
    onModelModeChange: (value: string) => void
    showPermissionSelect: boolean
    permissionMode: string
    permissionModeOptions: { value: string; label: string }[]
    onPermissionModeChange: (value: string) => void
    showPlanToggle: boolean
    isPlanActive: boolean
    onPlanToggle: () => void
    showAbortButton: boolean
    abortDisabled: boolean
    isAborting: boolean
    onAbort: () => void
    showQrButton: boolean
    voiceEnabled: boolean
    voiceStatus: ConversationStatus
    voiceMicMuted?: boolean
    onVoiceToggle: () => void
    onVoiceMicToggle?: () => void
    onSend: () => void
}) {
    const { t } = useTranslation()
    const isVoiceConnected = props.voiceStatus === 'connected'

    return (
        <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
                <ComposerPrimitive.AddAttachment
                    aria-label={t('composer.attach')}
                    title={t('composer.attach')}
                    disabled={props.controlsDisabled}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-fg)]/60 transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <AttachmentIcon />
                </ComposerPrimitive.AddAttachment>

                {props.showModelSelect && props.modelModeOptions.length > 0 ? (
                    <MiniSelect
                        value={props.modelMode}
                        options={props.modelModeOptions}
                        onChange={props.onModelModeChange}
                        disabled={props.controlsDisabled}
                        icon={<ModelIcon />}
                    />
                ) : null}

                {(props.showPermissionSelect && props.permissionModeOptions.length > 0) || props.showPlanToggle ? (
                    <PermissionPlanPill
                        showPermission={props.showPermissionSelect && props.permissionModeOptions.length > 0}
                        permissionMode={props.permissionMode}
                        permissionOptions={props.permissionModeOptions}
                        onPermissionChange={props.onPermissionModeChange}
                        showPlan={props.showPlanToggle}
                        isPlanActive={props.isPlanActive}
                        onPlanToggle={props.onPlanToggle}
                        disabled={props.controlsDisabled}
                    />
                ) : null}

                {props.voiceEnabled || isVoiceConnected || props.voiceStatus === 'connecting' ? (() => {
                    const isConnecting = props.voiceStatus === 'connecting'
                    const isVoiceActive = isConnecting || isVoiceConnected

                    let voiceIcon: React.ReactNode
                    let voiceLabel: string
                    if (isConnecting) {
                        voiceIcon = <LoadingIcon />
                        voiceLabel = t('voice.connecting')
                    } else if (isVoiceConnected) {
                        voiceIcon = <VoiceAssistantIcon animated />
                        voiceLabel = t('composer.stop')
                    } else {
                        voiceIcon = <VoiceAssistantIcon />
                        voiceLabel = t('composer.voice')
                    }

                    return (
                        <button
                            type="button"
                            aria-label={voiceLabel}
                            title={voiceLabel}
                            disabled={props.controlsDisabled && !isVoiceActive}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isVoiceActive
                                    ? 'bg-black text-white hover:bg-black/80'
                                    : 'bg-[var(--app-fg)]/[0.04] text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                            }`}
                            onClick={props.onVoiceToggle}
                        >
                            {voiceIcon}
                        </button>
                    )
                })() : null}

                {props.showQrButton ? (
                    <QrCodeButton />
                ) : null}

                {isVoiceConnected && props.onVoiceMicToggle ? (
                    <button
                        type="button"
                        aria-label={props.voiceMicMuted ? t('voice.unmute') : t('voice.mute')}
                        title={props.voiceMicMuted ? t('voice.unmute') : t('voice.mute')}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                            props.voiceMicMuted
                                ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                        onClick={props.onVoiceMicToggle}
                    >
                        <SpeakerIcon muted={props.voiceMicMuted} />
                    </button>
                ) : null}
            </div>

            <UnifiedButton
                canSend={props.canSend}
                controlsDisabled={props.controlsDisabled}
                showAbortButton={props.showAbortButton}
                abortDisabled={props.abortDisabled}
                isAborting={props.isAborting}
                onSend={props.onSend}
                onAbort={props.onAbort}
            />
        </div>
    )
}
