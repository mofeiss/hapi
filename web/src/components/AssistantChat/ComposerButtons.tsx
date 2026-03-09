import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

function MicrophoneIcon() {
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
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
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

function CopyIcon() {
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
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
}

function CheckIcon() {
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
            <path d="M20 6 9 17l-5-5" />
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

function EffortIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 19a9 9 0 1 1 15 0" />
            <path d="M12 13V8" />
            <path d="m12 13 4-2" />
            <path d="M8 17h8" />
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

function SelectButtonLabel(props: {
    label: string
    align?: 'center' | 'left'
}) {
    const labelAlignClass = props.align === 'left' ? 'text-left' : 'text-center'

    return (
        <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-none ${labelAlignClass}`}>
            {props.label}
        </span>
    )
}

function getDropdownStyle(pos: { bottom: number; left: number; minWidth: number }) {
    return {
        bottom: pos.bottom,
        left: pos.left,
        minWidth: `${Math.max(pos.minWidth, 120)}px`,
        width: 'max-content',
        maxWidth: 'calc(100vw - 16px)'
    }
}

function MiniSelect(props: {
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    disabled?: boolean
    icon?: React.ReactNode
    labelAlign?: 'center' | 'left'
}) {
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ bottom: 0, left: 0, minWidth: 120 })

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
                minWidth: rect.width,
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
                className={`flex h-8 min-w-0 max-w-full shrink items-center gap-1 overflow-hidden whitespace-nowrap rounded-full px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    open
                        ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                        : 'bg-[var(--app-fg)]/[0.04] text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                }`}
            >
                {props.icon ? <span className="shrink-0">{props.icon}</span> : null}
                <SelectButtonLabel
                    label={selectedLabel}
                    align={props.labelAlign}
                />
                <span className="shrink-0">
                    <ChevronDownIcon />
                </span>
            </button>
            {open ? createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[120px] rounded-lg bg-[var(--app-secondary-bg)] border border-[var(--app-divider)] shadow-lg overflow-hidden z-[9999]"
                    style={getDropdownStyle(pos)}
                >
                    {props.options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--app-bg)] ${
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

function CodexModelReasoningPermissionPill(props: {
    showModel: boolean
    model: string
    modelOptions: { value: string; label: string }[]
    onModelChange: (value: string) => void
    showReasoning: boolean
    reasoningEffort: string
    reasoningOptions: { value: string; label: string }[]
    onReasoningChange: (value: string) => void
    showPermission: boolean
    permissionMode: string
    permissionOptions: { value: string; label: string }[]
    onPermissionChange: (value: string) => void
    disabled?: boolean
}) {
    const [openMenu, setOpenMenu] = useState<'model' | 'reasoning' | 'permission' | null>(null)
    const modelButtonRef = useRef<HTMLButtonElement>(null)
    const reasoningButtonRef = useRef<HTMLButtonElement>(null)
    const permissionButtonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ bottom: 0, left: 0, minWidth: 120 })

    useEffect(() => {
        if (!openMenu) return
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            const clickedModelButton = modelButtonRef.current?.contains(target) ?? false
            const clickedReasoningButton = reasoningButtonRef.current?.contains(target) ?? false
            const clickedPermissionButton = permissionButtonRef.current?.contains(target) ?? false
            const clickedDropdown = dropdownRef.current?.contains(target) ?? false

            if (!clickedModelButton && !clickedReasoningButton && !clickedPermissionButton && !clickedDropdown) {
                setOpenMenu(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [openMenu])

    const openDropdown = useCallback((menu: 'model' | 'reasoning' | 'permission') => {
        const anchor = menu === 'model'
            ? modelButtonRef.current
            : menu === 'reasoning'
                ? reasoningButtonRef.current
                : permissionButtonRef.current
        if (!anchor) return
        const rect = anchor.getBoundingClientRect()
        setPos({
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            minWidth: rect.width,
        })
        setOpenMenu((prev) => prev === menu ? null : menu)
    }, [])

    const modelLabel = props.modelOptions.find((option) => option.value === props.model)?.label ?? props.model
    const reasoningLabel = props.reasoningOptions.find((option) => option.value === props.reasoningEffort)?.label ?? props.reasoningEffort
    const permissionLabel = props.permissionOptions.find((option) => option.value === props.permissionMode)?.label ?? props.permissionMode
    const activeOptions = openMenu === 'reasoning'
        ? props.reasoningOptions
        : openMenu === 'permission'
            ? props.permissionOptions
            : props.modelOptions
    const activeValue = openMenu === 'reasoning'
        ? props.reasoningEffort
        : openMenu === 'permission'
            ? props.permissionMode
            : props.model
    const handleOptionSelect = (value: string) => {
        if (openMenu === 'reasoning') {
            props.onReasoningChange(value)
        } else if (openMenu === 'permission') {
            props.onPermissionChange(value)
        } else {
            props.onModelChange(value)
        }
        setOpenMenu(null)
    }
    const showModelDivider = props.showModel && (props.showReasoning || props.showPermission)
    const showReasoningDivider = props.showReasoning && props.showPermission

    return (
        <>
            <div className="flex h-8 min-w-0 max-w-full shrink items-center overflow-hidden rounded-full bg-[var(--app-fg)]/[0.04]">
                {props.showModel ? (
                    <button
                        ref={modelButtonRef}
                        type="button"
                        disabled={props.disabled}
                        onClick={() => openDropdown('model')}
                        className={`flex h-full min-w-0 shrink items-center gap-1 px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            openMenu === 'model'
                                ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <span className="shrink-0">
                            <ModelIcon />
                        </span>
                        <SelectButtonLabel
                            label={modelLabel}
                            align="left"
                        />
                        <span className="shrink-0">
                            <ChevronDownIcon />
                        </span>
                    </button>
                ) : null}
                {showModelDivider ? (
                    <div className="h-3.5 w-px shrink-0 bg-[var(--app-fg)]/10" />
                ) : null}
                {props.showReasoning ? (
                    <button
                        ref={reasoningButtonRef}
                        type="button"
                        disabled={props.disabled}
                        onClick={() => openDropdown('reasoning')}
                        className={`flex h-full min-w-0 shrink items-center gap-1 px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            openMenu === 'reasoning'
                                ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <span className="shrink-0">
                            <EffortIcon />
                        </span>
                        <SelectButtonLabel
                            label={reasoningLabel}
                            align="left"
                        />
                        <span className="shrink-0">
                            <ChevronDownIcon />
                        </span>
                    </button>
                ) : null}
                {showReasoningDivider ? (
                    <div className="h-3.5 w-px shrink-0 bg-[var(--app-fg)]/10" />
                ) : null}
                {props.showPermission ? (
                    <button
                        ref={permissionButtonRef}
                        type="button"
                        disabled={props.disabled}
                        onClick={() => openDropdown('permission')}
                        className={`flex h-full min-w-0 shrink items-center gap-1 px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            openMenu === 'permission'
                                ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <span className="shrink-0">
                            <ShieldIcon />
                        </span>
                        <SelectButtonLabel
                            label={permissionLabel}
                            align="left"
                        />
                        <span className="shrink-0">
                            <ChevronDownIcon />
                        </span>
                    </button>
                ) : null}
            </div>
            {openMenu ? createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[120px] rounded-lg border border-[var(--app-divider)] bg-[var(--app-secondary-bg)] shadow-lg overflow-hidden z-[9999]"
                    style={getDropdownStyle(pos)}
                >
                    {activeOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--app-bg)] ${
                                option.value === activeValue ? 'text-[var(--app-link)] font-medium' : 'text-[var(--app-fg)]'
                            }`}
                            onClick={() => handleOptionSelect(option.value)}
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

function ClaudeModelPermissionPlanPill(props: {
    showModel: boolean
    model: string
    modelOptions: { value: string; label: string }[]
    onModelChange: (value: string) => void
    showPermission: boolean
    permissionMode: string
    permissionOptions: { value: string; label: string }[]
    onPermissionChange: (value: string) => void
    showPlan: boolean
    isPlanActive: boolean
    onPlanToggle: () => void
    disabled?: boolean
}) {
    const [openMenu, setOpenMenu] = useState<'model' | 'permission' | null>(null)
    const modelButtonRef = useRef<HTMLButtonElement>(null)
    const permissionButtonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ bottom: 0, left: 0, minWidth: 120 })

    useEffect(() => {
        if (!openMenu) return
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            const clickedModelButton = modelButtonRef.current?.contains(target) ?? false
            const clickedPermissionButton = permissionButtonRef.current?.contains(target) ?? false
            const clickedDropdown = dropdownRef.current?.contains(target) ?? false

            if (!clickedModelButton && !clickedPermissionButton && !clickedDropdown) {
                setOpenMenu(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [openMenu])

    const openDropdown = useCallback((menu: 'model' | 'permission') => {
        const anchor = menu === 'model' ? modelButtonRef.current : permissionButtonRef.current
        if (!anchor) return
        const rect = anchor.getBoundingClientRect()
        setPos({
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            minWidth: rect.width,
        })
        setOpenMenu((prev) => prev === menu ? null : menu)
    }, [])

    const modelLabel = props.modelOptions.find((option) => option.value === props.model)?.label ?? props.model
    const permissionLabel = props.permissionOptions.find((option) => option.value === props.permissionMode)?.label ?? props.permissionMode
    const activeOptions = openMenu === 'permission' ? props.permissionOptions : props.modelOptions
    const activeValue = openMenu === 'permission' ? props.permissionMode : props.model

    const handleOptionSelect = (value: string) => {
        if (openMenu === 'permission') {
            props.onPermissionChange(value)
        } else {
            props.onModelChange(value)
        }
        setOpenMenu(null)
    }

    return (
        <>
            <div className="flex h-8 min-w-0 max-w-full shrink items-center overflow-hidden rounded-full bg-[var(--app-fg)]/[0.04]">
                {props.showModel ? (
                    <button
                        ref={modelButtonRef}
                        type="button"
                        disabled={props.disabled}
                        onClick={() => openDropdown('model')}
                        className={`flex h-full min-w-0 shrink items-center gap-1 px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            openMenu === 'model'
                                ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <span className="shrink-0">
                            <ModelIcon />
                        </span>
                        <SelectButtonLabel label={modelLabel} align="left" />
                        <span className="shrink-0">
                            <ChevronDownIcon />
                        </span>
                    </button>
                ) : null}

                {props.showModel && (props.showPermission || props.showPlan) ? (
                    <div className="h-3.5 w-px shrink-0 bg-[var(--app-fg)]/10" />
                ) : null}

                {props.showPermission ? (
                    <button
                        ref={permissionButtonRef}
                        type="button"
                        disabled={props.disabled}
                        onClick={() => openDropdown('permission')}
                        className={`flex h-full min-w-0 shrink items-center gap-1 px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            openMenu === 'permission'
                                ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <span className="shrink-0">
                            <ShieldIcon />
                        </span>
                        <SelectButtonLabel label={permissionLabel} align="left" />
                        <span className="shrink-0">
                            <ChevronDownIcon />
                        </span>
                    </button>
                ) : null}

                {props.showPermission && props.showPlan ? (
                    <div className="h-3.5 w-px shrink-0 bg-[var(--app-fg)]/10" />
                ) : null}

                {props.showPlan ? (
                    <button
                        type="button"
                        aria-label="Plan Mode"
                        title="Plan Mode"
                        disabled={props.disabled}
                        onClick={props.onPlanToggle}
                        className={`flex h-full min-w-0 shrink items-center gap-1 px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            props.isPlanActive
                                ? 'bg-[var(--app-badge-warning-text)]/15 text-[var(--app-badge-warning-text)]'
                                : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        <span className="shrink-0">
                            <PlanIcon />
                        </span>
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-none">Plan</span>
                    </button>
                ) : null}
            </div>

            {openMenu ? createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[120px] rounded-lg border border-[var(--app-divider)] bg-[var(--app-secondary-bg)] shadow-lg overflow-hidden z-[9999]"
                    style={getDropdownStyle(pos)}
                >
                    {activeOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--app-bg)] ${
                                option.value === activeValue ? 'text-[var(--app-link)] font-medium' : 'text-[var(--app-fg)]'
                            }`}
                            onClick={() => handleOptionSelect(option.value)}
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

function FlushIcon() {
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
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
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

function ClearInputIcon() {
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
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}

function UnifiedButton(props: {
    canSend: boolean
    controlsDisabled: boolean
    showAbortButton: boolean
    abortDisabled: boolean
    isAborting: boolean
    hasQueue: boolean
    onSend: () => void
    onAbort: () => void
    onFlush?: () => void
}) {
    const { t } = useTranslation()

    const hasText = props.canSend
    const showFlush = !hasText && props.hasQueue

    const handleClick = () => {
        if (showFlush && props.onFlush) {
            props.onFlush()
        } else if (props.showAbortButton) {
            props.onAbort()
        } else if (hasText) {
            props.onSend()
        }
    }

    let icon: React.ReactNode
    let className: string
    let ariaLabel: string

    if (showFlush) {
        icon = <FlushIcon />
        className = 'bg-black text-white'
        ariaLabel = t('queue.flushNow')
    } else if (props.showAbortButton) {
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

    const isDisabled = showFlush
        ? false
        : props.showAbortButton
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

function CopyInputButton(props: { inputText: string }) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const canCopy = props.inputText.length > 0

    useEffect(() => {
        if (!copied) return
        const timer = window.setTimeout(() => setCopied(false), 1200)
        return () => window.clearTimeout(timer)
    }, [copied])

    const handleCopy = useCallback(async () => {
        if (!canCopy || !navigator.clipboard?.writeText) return
        try {
            await navigator.clipboard.writeText(props.inputText)
            setCopied(true)
        } catch (error) {
            console.error('Failed to copy composer text:', error)
        }
    }, [canCopy, props.inputText])

    const label = copied ? t('composer.copied') : t('composer.copy')

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={!canCopy}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-fg)]/[0.04] text-[var(--app-fg)]/60 transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleCopy() }}
        >
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
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
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ bottom: 0, left: 0, minWidth: 120 })

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
                minWidth: rect.width,
            })
        }
        setOpen(!open)
    }, [open])

    const selectedLabel = props.permissionOptions.find(o => o.value === props.permissionMode)?.label ?? props.permissionMode
    const showBoth = props.showPermission && props.showPlan

    return (
        <>
            <div className="flex h-8 min-w-0 max-w-full shrink items-center overflow-hidden rounded-full bg-[var(--app-fg)]/[0.04]">
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
                        <span className="shrink-0">
                            <ShieldIcon />
                        </span>
                        <SelectButtonLabel label={selectedLabel} align="left" />
                        <span className="shrink-0">
                            <ChevronDownIcon />
                        </span>
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
                        <span className="shrink-0">
                            <PlanIcon />
                        </span>
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-none">Plan</span>
                    </button>
                ) : null}
            </div>
            {open && props.showPermission ? createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed min-w-[120px] rounded-lg bg-[var(--app-secondary-bg)] border border-[var(--app-divider)] shadow-lg overflow-hidden z-[9999]"
                    style={getDropdownStyle(pos)}
                >
                    {props.permissionOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--app-bg)] ${
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
    showClaudeModelSelect: boolean
    claudeModel: string
    claudeModelOptions: { value: string; label: string }[]
    onClaudeModelChange: (value: string) => void
    showCodexModelSelect: boolean
    codexModel: string
    codexModelOptions: { value: string; label: string }[]
    onCodexModelChange: (value: string) => void
    showCodexReasoningSelect: boolean
    codexReasoningEffort: string
    codexReasoningOptions: { value: string; label: string }[]
    onCodexReasoningEffortChange: (value: string) => void
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
    showCopyButton: boolean
    inputText: string
    voiceEnabled: boolean
    voiceStatus: ConversationStatus
    voiceMicMuted?: boolean
    onVoiceToggle: (options?: { discard?: boolean }) => void
    onVoiceMicToggle?: () => void
    canClear: boolean
    onClear: () => void
    onSend: () => void
    hasQueue?: boolean
    onFlush?: () => void
}) {
    const { t } = useTranslation()
    const isVoiceConnected = props.voiceStatus === 'connected'
    const isCodexControlsVisible = props.showCodexModelSelect || props.showCodexReasoningSelect

    return (
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ComposerPrimitive.AddAttachment
                    aria-label={t('composer.attach')}
                    title={t('composer.attach')}
                    disabled={props.controlsDisabled}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--app-fg)]/60 transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50"
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

                {props.showClaudeModelSelect ? (
                    <ClaudeModelPermissionPlanPill
                        showModel={props.claudeModelOptions.length > 0}
                        model={props.claudeModel}
                        modelOptions={props.claudeModelOptions}
                        onModelChange={props.onClaudeModelChange}
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

                {isCodexControlsVisible && (
                    (props.showCodexModelSelect && props.codexModelOptions.length > 0)
                    || (props.showCodexReasoningSelect && props.codexReasoningOptions.length > 0)
                    || (props.showPermissionSelect && props.permissionModeOptions.length > 0)
                ) ? (
                    <CodexModelReasoningPermissionPill
                        showModel={props.showCodexModelSelect && props.codexModelOptions.length > 0}
                        model={props.codexModel}
                        modelOptions={props.codexModelOptions}
                        onModelChange={props.onCodexModelChange}
                        showReasoning={props.showCodexReasoningSelect && props.codexReasoningOptions.length > 0}
                        reasoningEffort={props.codexReasoningEffort}
                        reasoningOptions={props.codexReasoningOptions}
                        onReasoningChange={props.onCodexReasoningEffortChange}
                        showPermission={props.showPermissionSelect && props.permissionModeOptions.length > 0 && !props.showClaudeModelSelect}
                        permissionMode={props.permissionMode}
                        permissionOptions={props.permissionModeOptions}
                        onPermissionChange={props.onPermissionModeChange}
                        disabled={props.controlsDisabled}
                    />
                ) : null}

                {!props.showClaudeModelSelect && !isCodexControlsVisible && ((props.showPermissionSelect && props.permissionModeOptions.length > 0) || props.showPlanToggle) ? (
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

                {isCodexControlsVisible && props.showPlanToggle ? (
                    <PermissionPlanPill
                        showPermission={false}
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
                        voiceIcon = <MicrophoneIcon />
                        voiceLabel = t('composer.voice')
                    }

                    return (
                        <button
                            type="button"
                            aria-label={voiceLabel}
                            title={voiceLabel}
                            disabled={props.controlsDisabled && !isVoiceActive}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isVoiceActive
                                    ? 'bg-black text-white hover:bg-black/80'
                                    : 'bg-[var(--app-fg)]/[0.04] text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                            }`}
                            onClick={() => props.onVoiceToggle()}
                        >
                            {voiceIcon}
                        </button>
                    )
                })() : null}

                {props.showCopyButton ? (
                    <CopyInputButton inputText={props.inputText} />
                ) : null}

                <button
                    type="button"
                    aria-label={t('composer.clear')}
                    title={t('composer.clear')}
                    disabled={props.controlsDisabled || !props.canClear}
                    onClick={props.onClear}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-fg)]/[0.04] text-[var(--app-fg)]/60 transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <ClearInputIcon />
                </button>

                {isVoiceConnected && props.onVoiceMicToggle ? (
                    <button
                        type="button"
                        aria-label={props.voiceMicMuted ? t('voice.unmute') : t('voice.mute')}
                        title={props.voiceMicMuted ? t('voice.unmute') : t('voice.mute')}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
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

            <div className="flex shrink-0 items-center gap-1">
                <UnifiedButton
                    canSend={props.canSend}
                    controlsDisabled={props.controlsDisabled}
                    showAbortButton={props.showAbortButton}
                    abortDisabled={props.abortDisabled}
                    isAborting={props.isAborting}
                    hasQueue={props.hasQueue ?? false}
                    onSend={props.onSend}
                    onAbort={props.onAbort}
                    onFlush={props.onFlush}
                />
            </div>
        </div>
    )
}
