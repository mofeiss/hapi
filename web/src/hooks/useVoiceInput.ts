import { useCallback, useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import { getElevenLabsCodeFromPreference } from '@/lib/languages'

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing'
export type VoiceCorrectionAvailability = 'unknown' | 'available' | 'unavailable'
export type VoiceToggleOptions = {
    discard?: boolean
}

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
    resultIndex: number
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    abort(): void
    onresult: ((ev: SpeechRecognitionEvent) => void) | null
    onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    onspeechstart?: (() => void) | null
    onspeechend?: (() => void) | null
    onsoundstart?: (() => void) | null
    onsoundend?: (() => void) | null
}

declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognition
        webkitSpeechRecognition?: new () => SpeechRecognition
    }
}

function getSpeechRecognitionClass(): (new () => SpeechRecognition) | null {
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function shouldUseWebSpeech(): boolean {
    return getSpeechRecognitionClass() !== null
}

function getVoiceLang(): string {
    const pref = localStorage.getItem('hapi-voice-lang')
    if (pref) return pref // e.g. 'zh-CN', 'en-US'
    return navigator.language || 'en-US'
}

function mergeFinalAndInterim(finalText: string, interimText: string): string {
    const left = finalText.trim()
    const right = interimText.trim()
    if (!left) return right
    if (!right) return left

    const maxOverlap = Math.min(left.length, right.length)
    for (let overlap = maxOverlap; overlap > 0; overlap--) {
        if (left.endsWith(right.slice(0, overlap))) {
            return left + right.slice(overlap)
        }
    }

    return left + right
}

function computeDeltaRaw(prevRaw: string, currentRaw: string): string {
    const prev = prevRaw.trim()
    const curr = currentRaw.trim()
    if (!prev) return curr
    if (!curr) return ''
    if (curr === prev) return ''

    let prefix = 0
    const max = Math.min(prev.length, curr.length)
    while (prefix < max && prev[prefix] === curr[prefix]) {
        prefix++
    }

    return curr.slice(prefix).trim()
}

const PREFIX_COMPARE_SEPARATOR_RE = /[\s，。,！!？?；;：:"“”'‘’、]/u
const MIN_PREV_RAW_LENGTH_FOR_STABILITY = 6
const MIN_PREV_CORRECTED_LENGTH_FOR_STABILITY = 4
const CORRECTION_DEBOUNCE_MS = 260
const CORRECTION_AFTER_SPEECH_END_MS = 110
const CORRECTION_AFTER_FINAL_RESULT_MS = 40
const WEBSPEECH_EARLY_END_MS = 1200
const FALLBACK_TIMESLICE_MS = 500
const ENABLE_VOICE_DEBUG_EVENTS = false

function buildComparableText(text: string): { normalized: string; indexMap: number[] } {
    let normalized = ''
    const indexMap: number[] = []
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (PREFIX_COMPARE_SEPARATOR_RE.test(ch)) continue
        normalized += ch
        indexMap.push(i)
    }
    return { normalized, indexMap }
}

function getComparableLength(text: string): number {
    return buildComparableText(text).normalized.length
}

function buildCorrectionContext(
    currentRawFull: string,
    prevRawCandidate: string,
    prevCorrectedCandidate: string
): {
    currentRawFull: string
    prevRawFull?: string
    prevCorrectedFull?: string
    deltaRaw?: string
    latestSegment?: string
} {
    const current = currentRawFull.trim()
    const prevRaw = prevRawCandidate.trim()
    const prevCorrected = prevCorrectedCandidate.trim()

    const canUsePrevContext = (
        prevRaw.length >= MIN_PREV_RAW_LENGTH_FOR_STABILITY
        && prevCorrected.length >= MIN_PREV_CORRECTED_LENGTH_FOR_STABILITY
    )

    const basePrevRaw = canUsePrevContext ? prevRaw : ''
    const deltaRaw = computeDeltaRaw(basePrevRaw, current)
    const latestSegment = deltaRaw || current

    return {
        currentRawFull: current,
        prevRawFull: canUsePrevContext ? prevRaw : undefined,
        prevCorrectedFull: canUsePrevContext ? prevCorrected : undefined,
        deltaRaw: deltaRaw || undefined,
        latestSegment: latestSegment || undefined
    }
}

function stripLikelyDuplicatedPrefix(corrected: string, currentRaw: string): string {
    const corr = corrected.trim()
    const raw = currentRaw.trim()
    if (!corr || !raw || corr === raw) return corr

    const corrComparable = buildComparableText(corr)
    const rawComparable = buildComparableText(raw)
    const corrNorm = corrComparable.normalized
    const rawNorm = rawComparable.normalized

    if (!corrNorm || !rawNorm || corrNorm === rawNorm) return corr

    const maxDupLen = Math.min(2, rawNorm.length)
    for (let dupLen = 1; dupLen <= maxDupLen; dupLen++) {
        const duplicatedHead = rawNorm.slice(0, dupLen)
        const expectedPrefix = duplicatedHead + rawNorm
        if (!corrNorm.startsWith(expectedPrefix)) continue

        const cutOriginalIndex = corrComparable.indexMap[dupLen]
        if (typeof cutOriginalIndex !== 'number' || cutOriginalIndex <= 0 || cutOriginalIndex > 8) {
            return corr
        }

        const cleaned = corr.slice(cutOriginalIndex).trim()
        if (cleaned) {
            return cleaned
        }
    }

    return corr
}

export function useVoiceInput(api: ApiClient) {
    const [status, setStatus] = useState<VoiceInputStatus>('idle')
    const statusRef = useRef<VoiceInputStatus>('idle')
    statusRef.current = status
    const [error, setError] = useState<string | null>(null)
    const [rawText, setRawText] = useState('')
    const [correctedText, setCorrectedText] = useState('')
    const [correctionAvailability, setCorrectionAvailability] = useState<VoiceCorrectionAvailability>('unknown')
    const [correctionUnavailableReason, setCorrectionUnavailableReason] = useState<string | null>(null)
    const onTranscriptRef = useRef<((text: string) => void) | null>(null)
    const onInterimRef = useRef<((text: string) => void) | null>(null)
    const onRawRef = useRef<((text: string) => void) | null>(null)

    // Web Speech API refs
    const recognitionRef = useRef<SpeechRecognition | null>(null)
    const activeRecordingIdRef = useRef(0)
    const recordingIdCounterRef = useRef(0)
    const stopOptionsRef = useRef<VoiceToggleOptions>({ discard: false })
    const correctionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const rawTextRef = useRef('')
    const correctedTextRef = useRef('')
    const lastRequestedRawRef = useRef('')
    const correctionInFlightRef = useRef(false)
    const correctionPendingRef = useRef(false)
    const allowRealtimeCorrectionRef = useRef(false)
    const correctionAvailabilityRef = useRef<VoiceCorrectionAvailability>('unknown')

    // MediaRecorder fallback refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const fallbackChunksRef = useRef<Blob[]>([])
    const fallbackChunkVersionRef = useRef(0)
    const fallbackProcessedVersionRef = useRef(0)
    const fallbackTranscribeInFlightRef = useRef(false)
    const fallbackRealtimeTranscribeDisabledRef = useRef(false)
    const fallbackMimeTypeRef = useRef('audio/webm')
    const startFallbackRef = useRef<(() => Promise<void>) | null>(null)
    const webSpeechBackupRecorderRef = useRef<MediaRecorder | null>(null)
    const webSpeechBackupStreamRef = useRef<MediaStream | null>(null)
    const webSpeechBackupChunksRef = useRef<Blob[]>([])
    const webSpeechBackupStopPromiseRef = useRef<Promise<Blob | null> | null>(null)
    const webSpeechBackupResolveRef = useRef<((blob: Blob | null) => void) | null>(null)

    const supportsWebSpeech = useRef(shouldUseWebSpeech())
    const userAgentRef = useRef(typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '')

    const logVoiceDebug = useCallback((event: string, payload: Record<string, unknown> = {}) => {
        if (!ENABLE_VOICE_DEBUG_EVENTS) {
            return
        }
        void api.logVoiceDebugEvent(event, {
            ...payload,
            status: statusRef.current,
            supportsWebSpeech: supportsWebSpeech.current
        }).catch(() => {
            // Keep voice flow isolated from diagnostics failures.
        })
    }, [api])

    const resolveWebSpeechBackupStop = useCallback((blob: Blob | null) => {
        const resolve = webSpeechBackupResolveRef.current
        webSpeechBackupResolveRef.current = null
        if (resolve) {
            resolve(blob)
        }
    }, [])

    const cleanupWebSpeechBackupRefs = useCallback(() => {
        webSpeechBackupRecorderRef.current = null
        webSpeechBackupStreamRef.current = null
        webSpeechBackupChunksRef.current = []
        webSpeechBackupStopPromiseRef.current = null
        webSpeechBackupResolveRef.current = null
    }, [])

    const getRecorderMimeType = useCallback(() => {
        if (typeof MediaRecorder === 'undefined') {
            return 'audio/webm'
        }
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            return 'audio/webm;codecs=opus'
        }
        if (MediaRecorder.isTypeSupported('audio/webm')) {
            return 'audio/webm'
        }
        return 'audio/mp4'
    }, [])

    const stopWebSpeechBackupRecorder = useCallback(async (): Promise<Blob | null> => {
        const recorder = webSpeechBackupRecorderRef.current
        const stopPromise = webSpeechBackupStopPromiseRef.current
        if (!recorder || !stopPromise) {
            cleanupWebSpeechBackupRefs()
            return null
        }

        try {
            if (recorder.state !== 'inactive') {
                recorder.stop()
            } else {
                const chunks = webSpeechBackupChunksRef.current
                const mimeType = recorder.mimeType || getRecorderMimeType()
                resolveWebSpeechBackupStop(
                    chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null
                )
            }
            return await stopPromise
        } catch {
            return null
        } finally {
            const stream = webSpeechBackupStreamRef.current
            stream?.getTracks().forEach((track) => track.stop())
            cleanupWebSpeechBackupRefs()
        }
    }, [cleanupWebSpeechBackupRefs, getRecorderMimeType, resolveWebSpeechBackupStop])

    const startWebSpeechBackupRecorder = useCallback(async (recordingId: number) => {
        if (typeof MediaRecorder === 'undefined') return
        if (!navigator.mediaDevices?.getUserMedia) return

        await stopWebSpeechBackupRecorder()

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            logVoiceDebug('voice.webspeech.backup.getUserMedia.success', { recordingId })
        } catch {
            logVoiceDebug('voice.webspeech.backup.getUserMedia.error', { recordingId })
            return
        }

        if (activeRecordingIdRef.current !== recordingId || stopOptionsRef.current.discard) {
            stream.getTracks().forEach((track) => track.stop())
            return
        }

        const mimeType = getRecorderMimeType()
        const chunks: Blob[] = []
        let resolveStop: (blob: Blob | null) => void = () => {}
        const stopPromise = new Promise<Blob | null>((resolve) => {
            resolveStop = resolve
        })

        let recorder: MediaRecorder
        try {
            recorder = new MediaRecorder(stream, { mimeType })
        } catch {
            stream.getTracks().forEach((track) => track.stop())
            return
        }

        webSpeechBackupRecorderRef.current = recorder
        webSpeechBackupStreamRef.current = stream
        webSpeechBackupChunksRef.current = chunks
        webSpeechBackupStopPromiseRef.current = stopPromise
        webSpeechBackupResolveRef.current = resolveStop

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data)
            }
        }

        recorder.onerror = () => {
            resolveWebSpeechBackupStop(null)
        }

        recorder.onstop = () => {
            const blob = chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null
            resolveWebSpeechBackupStop(blob)
        }

        try {
            recorder.start()
            logVoiceDebug('voice.webspeech.backup.recorder.started', { recordingId, mimeType })
        } catch {
            stream.getTracks().forEach((track) => track.stop())
            cleanupWebSpeechBackupRefs()
            logVoiceDebug('voice.webspeech.backup.recorder.start-failed', { recordingId, mimeType })
        }
    }, [cleanupWebSpeechBackupRefs, getRecorderMimeType, logVoiceDebug, resolveWebSpeechBackupStop, stopWebSpeechBackupRecorder])

    const updateCorrectionAvailability = useCallback((next: VoiceCorrectionAvailability) => {
        if (correctionAvailabilityRef.current === next) {
            return
        }
        correctionAvailabilityRef.current = next
        setCorrectionAvailability(next)
    }, [])

    const beginRecordingSession = useCallback((): number => {
        const nextId = recordingIdCounterRef.current + 1
        recordingIdCounterRef.current = nextId
        activeRecordingIdRef.current = nextId
        stopOptionsRef.current = { discard: false }
        allowRealtimeCorrectionRef.current = true
        correctionInFlightRef.current = false
        correctionPendingRef.current = false
        lastRequestedRawRef.current = ''
        rawTextRef.current = ''
        correctedTextRef.current = ''
        fallbackChunksRef.current = []
        fallbackChunkVersionRef.current = 0
        fallbackProcessedVersionRef.current = 0
        fallbackTranscribeInFlightRef.current = false
        fallbackRealtimeTranscribeDisabledRef.current = false
        if (correctionDebounceTimerRef.current) {
            clearTimeout(correctionDebounceTimerRef.current)
            correctionDebounceTimerRef.current = null
        }
        correctionAvailabilityRef.current = 'unknown'
        setRawText('')
        setCorrectedText('')
        setCorrectionAvailability('unknown')
        setCorrectionUnavailableReason(null)
        logVoiceDebug('voice.session.begin', {
            recordingId: nextId,
            userAgent: userAgentRef.current,
            hasSpeechRecognition: Boolean(getSpeechRecognitionClass()),
            hasMediaRecorder: typeof MediaRecorder !== 'undefined',
            hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia)
        })
        return nextId
    }, [logVoiceDebug])

    const isActiveRecording = useCallback((recordingId: number): boolean => {
        return activeRecordingIdRef.current === recordingId
    }, [])

    const clearScheduledRealtimeCorrection = useCallback(() => {
        if (correctionDebounceTimerRef.current) {
            clearTimeout(correctionDebounceTimerRef.current)
            correctionDebounceTimerRef.current = null
        }
    }, [])

    const updateRawText = useCallback((text: string) => {
        const next = text.trim()
        rawTextRef.current = next
        setRawText(next)
        onRawRef.current?.(next)
    }, [])

    const updateCorrectedText = useCallback((text: string, emitInterim: boolean) => {
        const prev = correctedTextRef.current.trim()
        const incoming = text.trim()
        const next = emitInterim && prev && getComparableLength(incoming) < getComparableLength(prev)
            ? prev
            : incoming

        correctedTextRef.current = next
        setCorrectedText(next)
        if (emitInterim && next) {
            onInterimRef.current?.(next)
        }
    }, [])

    const runSingleCorrection = useCallback(async (context: {
        currentRawFull: string
        prevRawFull?: string
        prevCorrectedFull?: string
        deltaRaw?: string
        latestSegment?: string
    }, recordingId: number): Promise<{ text: string; unavailable: boolean }> => {
        try {
            const result = await api.correctVoiceText({
                currentRawFull: context.currentRawFull,
                prevRawFull: context.prevRawFull,
                prevCorrectedFull: context.prevCorrectedFull,
                deltaRaw: context.deltaRaw,
                latestSegment: context.latestSegment
            })
            if (!isActiveRecording(recordingId)) {
                return { text: context.currentRawFull, unavailable: false }
            }

            if (result.reason === 'voice-correction-not-configured') {
                allowRealtimeCorrectionRef.current = false
                setCorrectionUnavailableReason(result.reason)
                updateCorrectionAvailability('unavailable')
                return { text: context.currentRawFull, unavailable: true }
            }

            setCorrectionUnavailableReason(null)
            updateCorrectionAvailability('available')
            const corrected = typeof result.text === 'string' ? result.text.trim() : ''
            const deduped = stripLikelyDuplicatedPrefix(corrected, context.currentRawFull)
            return { text: deduped || context.currentRawFull, unavailable: false }
        } catch (err) {
            if (isActiveRecording(recordingId)) {
                setError(err instanceof Error ? err.message : 'Correction failed')
            }
            return { text: context.currentRawFull, unavailable: false }
        }
    }, [api, isActiveRecording, updateCorrectionAvailability])

    const maybeRequestRealtimeCorrection = useCallback(async (recordingId: number) => {
        if (!isActiveRecording(recordingId)) return
        if (!allowRealtimeCorrectionRef.current) return
        if (stopOptionsRef.current.discard) return

        const currentRaw = rawTextRef.current.trim()
        if (!currentRaw) return

        const previousRequestedRaw = lastRequestedRawRef.current
        if (currentRaw === previousRequestedRaw) return

        // Web Speech interim results can temporarily retract text.
        // For realtime preview, only request correction when progress is non-decreasing.
        if (
            previousRequestedRaw
            && getComparableLength(currentRaw) < getComparableLength(previousRequestedRaw)
        ) {
            return
        }

        if (correctionInFlightRef.current) {
            correctionPendingRef.current = true
            return
        }

        correctionInFlightRef.current = true
        const prevRawForRequest = previousRequestedRaw
        const prevCorrectedForRequest = correctedTextRef.current.trim()
        lastRequestedRawRef.current = currentRaw

        try {
            const corrected = await runSingleCorrection(
                buildCorrectionContext(currentRaw, prevRawForRequest, prevCorrectedForRequest),
                recordingId
            )
            if (!isActiveRecording(recordingId)) return
            if (!allowRealtimeCorrectionRef.current) return
            if (corrected.unavailable) return
            updateCorrectedText(corrected.text, true)
        } finally {
            correctionInFlightRef.current = false
            if (correctionPendingRef.current) {
                correctionPendingRef.current = false
                void maybeRequestRealtimeCorrection(recordingId)
            }
        }
    }, [isActiveRecording, runSingleCorrection, updateCorrectedText])

    const scheduleRealtimeCorrection = useCallback((recordingId: number, delayMs: number) => {
        if (!isActiveRecording(recordingId)) return
        if (!allowRealtimeCorrectionRef.current) return
        if (stopOptionsRef.current.discard) return

        clearScheduledRealtimeCorrection()
        correctionDebounceTimerRef.current = setTimeout(() => {
            correctionDebounceTimerRef.current = null
            void maybeRequestRealtimeCorrection(recordingId)
        }, delayMs)
    }, [clearScheduledRealtimeCorrection, isActiveRecording, maybeRequestRealtimeCorrection])

    const finishRecordingSession = useCallback((recordingId: number) => {
        if (!isActiveRecording(recordingId)) return
        logVoiceDebug('voice.session.finish', {
            recordingId,
            rawLength: rawTextRef.current.length,
            correctedLength: correctedTextRef.current.length,
            discard: stopOptionsRef.current.discard === true
        })
        clearScheduledRealtimeCorrection()
        allowRealtimeCorrectionRef.current = false
        activeRecordingIdRef.current = 0
        stopOptionsRef.current = { discard: false }
        fallbackChunksRef.current = []
        fallbackChunkVersionRef.current = 0
        fallbackProcessedVersionRef.current = 0
        fallbackTranscribeInFlightRef.current = false
        fallbackRealtimeTranscribeDisabledRef.current = false
        void stopWebSpeechBackupRecorder()
        onInterimRef.current?.('')
        setStatus('idle')
    }, [clearScheduledRealtimeCorrection, isActiveRecording, logVoiceDebug, stopWebSpeechBackupRecorder])

    const processFinalTranscript = useCallback(async (rawText: string, recordingId: number) => {
        if (!isActiveRecording(recordingId)) return

        const text = rawText.trim()
        const discard = stopOptionsRef.current.discard === true
        logVoiceDebug('voice.final.process', {
            recordingId,
            textLength: text.length,
            discard
        })

        if (discard || !text) {
            finishRecordingSession(recordingId)
            return
        }

        clearScheduledRealtimeCorrection()
        allowRealtimeCorrectionRef.current = false
        updateRawText(text)
        setStatus('transcribing')
        let finalCorrectedText = text
        if (correctionAvailabilityRef.current !== 'unavailable') {
            const prevRawForFinal = lastRequestedRawRef.current
            const prevCorrectedForFinal = correctedTextRef.current.trim()
            const correction = await runSingleCorrection(
                buildCorrectionContext(text, prevRawForFinal, prevCorrectedForFinal),
                recordingId
            )
            finalCorrectedText = correction.text
        }
        if (!isActiveRecording(recordingId)) return

        updateCorrectedText(finalCorrectedText, false)

        if (finalCorrectedText.trim()) {
            onTranscriptRef.current?.(finalCorrectedText.trim())
        }

        finishRecordingSession(recordingId)
    }, [clearScheduledRealtimeCorrection, finishRecordingSession, isActiveRecording, logVoiceDebug, runSingleCorrection, updateCorrectedText, updateRawText])

    // --- Web Speech API path ---
    const startWebSpeech = useCallback(() => {
        const SpeechRecognitionClass = getSpeechRecognitionClass()
        if (!SpeechRecognitionClass) return

        setError(null)
        const recordingId = beginRecordingSession()
        let finalTranscript = ''
        let latestInterim = ''
        let loggedFirstResult = false
        let lastRecognitionError: string | null = null
        const webSpeechStartedAt = Date.now()
        logVoiceDebug('voice.webspeech.start', {
            recordingId,
            lang: getVoiceLang()
        })
        void startWebSpeechBackupRecorder(recordingId)

        const recognition = new SpeechRecognitionClass()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = getVoiceLang()
        recognitionRef.current = recognition

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            if (!isActiveRecording(recordingId)) return
            if (stopOptionsRef.current.discard) return

            let interim = ''
            let final = ''
            let hasFinalSegment = false
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    final += transcript
                    hasFinalSegment = true
                } else {
                    interim += transcript
                }
            }

            if (final) {
                finalTranscript += final
            }

            latestInterim = interim
            const draft = mergeFinalAndInterim(finalTranscript, interim)
            if (draft) {
                if (!loggedFirstResult) {
                    loggedFirstResult = true
                    logVoiceDebug('voice.webspeech.first-result', {
                        recordingId,
                        draftLength: draft.length,
                        hasFinalSegment
                    })
                }
                updateRawText(draft)
                scheduleRealtimeCorrection(
                    recordingId,
                    hasFinalSegment ? CORRECTION_AFTER_FINAL_RESULT_MS : CORRECTION_DEBOUNCE_MS
                )
            }
        }

        const handleSpeechBoundary = () => {
            if (!isActiveRecording(recordingId)) return
            if (stopOptionsRef.current.discard) return
            scheduleRealtimeCorrection(recordingId, CORRECTION_AFTER_SPEECH_END_MS)
        }
        recognition.onspeechend = handleSpeechBoundary
        recognition.onsoundend = handleSpeechBoundary

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (!isActiveRecording(recordingId)) return
            lastRecognitionError = event.error
            logVoiceDebug('voice.webspeech.error', {
                recordingId,
                error: event.error
            })
            if (event.error !== 'aborted' && event.error !== 'no-speech' && event.error !== 'network') {
                setError(event.error)
            }
        }

        recognition.onend = async () => {
            if (isActiveRecording(recordingId)) {
                recognitionRef.current = null
            }

            const mergedTranscript = mergeFinalAndInterim(finalTranscript, latestInterim).trim()
            let finalText = mergedTranscript
            const elapsedMs = Date.now() - webSpeechStartedAt
            logVoiceDebug('voice.webspeech.end', {
                recordingId,
                mergedLength: mergedTranscript.length,
                elapsedMs,
                lastError: lastRecognitionError ?? 'none'
            })

            if (!finalText && !stopOptionsRef.current.discard) {
                const backupBlob = await stopWebSpeechBackupRecorder()
                logVoiceDebug('voice.webspeech.backup.stop', {
                    recordingId,
                    backupBlobSize: backupBlob?.size ?? 0
                })
                if (backupBlob && backupBlob.size > 0 && isActiveRecording(recordingId)) {
                    try {
                        setStatus('transcribing')
                        const language = getElevenLabsCodeFromPreference(
                            localStorage.getItem('hapi-voice-lang')
                        )
                        const result = await api.transcribeAudio(backupBlob, language)
                        finalText = (result.text ?? '').trim()
                        logVoiceDebug('voice.webspeech.backup.transcribe.result', {
                            recordingId,
                            textLength: finalText.length,
                            languageCode: result.language_code ?? 'unknown'
                        })
                        if (finalText) {
                            updateRawText(finalText)
                        }
                    } catch (err) {
                        logVoiceDebug('voice.webspeech.backup.transcribe.error', {
                            recordingId,
                            message: err instanceof Error ? err.message : 'Transcription failed'
                        })
                        if (isActiveRecording(recordingId)) {
                            setError(err instanceof Error ? err.message : 'Transcription failed')
                        }
                    }
                }
            } else {
                void stopWebSpeechBackupRecorder()
            }

            const shouldSwitchToFallback = (
                !stopOptionsRef.current.discard
                && !finalText
                && !loggedFirstResult
                && (lastRecognitionError === 'network' || elapsedMs <= WEBSPEECH_EARLY_END_MS)
            )
            if (shouldSwitchToFallback) {
                supportsWebSpeech.current = false
                logVoiceDebug('voice.webspeech.runtime-disabled', {
                    recordingId,
                    elapsedMs,
                    reason: lastRecognitionError ?? 'early-end-no-result'
                })
            }

            await processFinalTranscript(finalText, recordingId)

            if (shouldSwitchToFallback && activeRecordingIdRef.current === 0) {
                logVoiceDebug('voice.webspeech.auto-restart-fallback', { recordingId })
                setTimeout(() => {
                    void startFallbackRef.current?.()
                }, 0)
            }
        }

        try {
            recognition.start()
            setStatus('recording')
            logVoiceDebug('voice.webspeech.started', { recordingId })
        } catch (err) {
            void stopWebSpeechBackupRecorder()
            activeRecordingIdRef.current = 0
            stopOptionsRef.current = { discard: false }
            setStatus('idle')
            setError(err instanceof Error ? err.message : 'Failed to start speech recognition')
            logVoiceDebug('voice.webspeech.start-failed', {
                recordingId,
                message: err instanceof Error ? err.message : 'Failed to start speech recognition'
            })
        }
    }, [api, beginRecordingSession, isActiveRecording, logVoiceDebug, processFinalTranscript, scheduleRealtimeCorrection, startWebSpeechBackupRecorder, stopWebSpeechBackupRecorder, updateRawText])

    const stopWebSpeech = useCallback((options?: VoiceToggleOptions) => {
        stopOptionsRef.current = { discard: options?.discard === true }
        clearScheduledRealtimeCorrection()
        logVoiceDebug('voice.webspeech.stop-requested', {
            discard: stopOptionsRef.current.discard === true
        })
        recognitionRef.current?.stop()
    }, [clearScheduledRealtimeCorrection, logVoiceDebug])

    const processFallbackChunkQueue = useCallback(async (recordingId: number) => {
        if (!isActiveRecording(recordingId)) return
        if (fallbackRealtimeTranscribeDisabledRef.current) return
        if (fallbackTranscribeInFlightRef.current) return

        fallbackTranscribeInFlightRef.current = true
        const language = getElevenLabsCodeFromPreference(
            localStorage.getItem('hapi-voice-lang')
        )

        try {
            while (isActiveRecording(recordingId)) {
                if (stopOptionsRef.current.discard) {
                    fallbackChunksRef.current = []
                    fallbackChunkVersionRef.current = 0
                    fallbackProcessedVersionRef.current = 0
                    break
                }

                const targetVersion = fallbackChunkVersionRef.current
                if (targetVersion <= fallbackProcessedVersionRef.current) {
                    break
                }

                const aggregateBlob = new Blob(
                    fallbackChunksRef.current,
                    { type: fallbackMimeTypeRef.current || 'audio/webm' }
                )
                if (aggregateBlob.size <= 0) {
                    fallbackProcessedVersionRef.current = targetVersion
                    continue
                }

                try {
                    const result = await api.transcribeAudio(aggregateBlob, language)
                    if (!isActiveRecording(recordingId) || stopOptionsRef.current.discard) {
                        return
                    }

                    const chunkText = (result.text ?? '').trim()
                    logVoiceDebug('voice.fallback.transcribe.aggregate-result', {
                        recordingId,
                        chunkVersion: targetVersion,
                        blobSize: aggregateBlob.size,
                        textLength: chunkText.length,
                        languageCode: result.language_code ?? 'unknown'
                    })
                    fallbackProcessedVersionRef.current = targetVersion

                    if (!chunkText) continue

                    const merged = chunkText.trim()
                    if (!merged || merged === rawTextRef.current) continue

                    updateRawText(merged)
                    scheduleRealtimeCorrection(recordingId, CORRECTION_AFTER_FINAL_RESULT_MS)
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Transcription failed'
                    logVoiceDebug('voice.fallback.transcribe.aggregate-error', {
                        recordingId,
                        chunkVersion: targetVersion,
                        blobSize: aggregateBlob.size,
                        message
                    })

                    if (/corrupt|playable audio|unsupported|invalid/i.test(message)) {
                        fallbackRealtimeTranscribeDisabledRef.current = true
                        logVoiceDebug('voice.fallback.realtime-disabled', {
                            recordingId,
                            reason: 'corrupted-aggregate-chunk'
                        })
                        break
                    }
                }
            }
        } finally {
            fallbackTranscribeInFlightRef.current = false
        }
    }, [api, isActiveRecording, logVoiceDebug, scheduleRealtimeCorrection, updateRawText])

    const waitForFallbackDrain = useCallback(async (recordingId: number) => {
        while (isActiveRecording(recordingId)) {
            if (
                !fallbackTranscribeInFlightRef.current
                && fallbackProcessedVersionRef.current >= fallbackChunkVersionRef.current
            ) {
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 30))
        }
    }, [isActiveRecording])

    // --- MediaRecorder + ElevenLabs fallback path ---
    const startFallback = useCallback(async () => {
        setError(null)
        fallbackChunksRef.current = []
        fallbackChunkVersionRef.current = 0
        fallbackProcessedVersionRef.current = 0
        fallbackRealtimeTranscribeDisabledRef.current = false
        const recordingId = beginRecordingSession()
        logVoiceDebug('voice.fallback.start', { recordingId })

        if (typeof MediaRecorder === 'undefined') {
            activeRecordingIdRef.current = 0
            stopOptionsRef.current = { discard: false }
            setError('MediaRecorder is not supported in this browser')
            logVoiceDebug('voice.fallback.unsupported-media-recorder', { recordingId })
            return
        }

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            logVoiceDebug('voice.fallback.getUserMedia.success', { recordingId })
        } catch {
            activeRecordingIdRef.current = 0
            stopOptionsRef.current = { discard: false }
            setError('Microphone permission denied')
            logVoiceDebug('voice.fallback.getUserMedia.error', { recordingId })
            return
        }

        const mimeType = getRecorderMimeType()
        fallbackMimeTypeRef.current = mimeType

        const recorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
            if (!isActiveRecording(recordingId)) return
            if (stopOptionsRef.current.discard) return
            if (e.data.size <= 0) return

            fallbackChunksRef.current.push(e.data)
            fallbackChunkVersionRef.current += 1
            logVoiceDebug('voice.fallback.chunk.captured', {
                recordingId,
                chunkSize: e.data.size,
                chunkVersion: fallbackChunkVersionRef.current
            })
            void processFallbackChunkQueue(recordingId)
        }

        recorder.onstop = async () => {
            if (!isActiveRecording(recordingId)) return
            stream.getTracks().forEach((t) => t.stop())

            if (stopOptionsRef.current.discard) {
                finishRecordingSession(recordingId)
                return
            }

            logVoiceDebug('voice.fallback.recorder.stop', {
                recordingId,
                capturedChunks: fallbackChunksRef.current.length,
                chunkVersion: fallbackChunkVersionRef.current,
                mimeType
            })

            try {
                await processFallbackChunkQueue(recordingId)
                await waitForFallbackDrain(recordingId)
                if (!isActiveRecording(recordingId)) return
                let finalRaw = rawTextRef.current.trim()
                if (!finalRaw && fallbackChunksRef.current.length > 0) {
                    const language = getElevenLabsCodeFromPreference(
                        localStorage.getItem('hapi-voice-lang')
                    )
                    const finalBlob = new Blob(
                        fallbackChunksRef.current,
                        { type: fallbackMimeTypeRef.current || mimeType }
                    )
                    if (finalBlob.size > 0) {
                        try {
                            const finalResult = await api.transcribeAudio(finalBlob, language)
                            finalRaw = (finalResult.text ?? '').trim()
                            logVoiceDebug('voice.fallback.final.transcribe.result', {
                                recordingId,
                                blobSize: finalBlob.size,
                                textLength: finalRaw.length,
                                languageCode: finalResult.language_code ?? 'unknown'
                            })
                            if (finalRaw) {
                                updateRawText(finalRaw)
                            }
                        } catch (err) {
                            logVoiceDebug('voice.fallback.final.transcribe.error', {
                                recordingId,
                                blobSize: finalBlob.size,
                                message: err instanceof Error ? err.message : 'Transcription failed'
                            })
                        }
                    }
                }
                logVoiceDebug('voice.fallback.finalize', {
                    recordingId,
                    finalRawLength: finalRaw.length
                })
                await processFinalTranscript(finalRaw, recordingId)
            } catch (err) {
                logVoiceDebug('voice.fallback.finalize.error', {
                    recordingId,
                    message: err instanceof Error ? err.message : 'Transcription failed'
                })
                if (isActiveRecording(recordingId)) {
                    setError(err instanceof Error ? err.message : 'Transcription failed')
                    finishRecordingSession(recordingId)
                }
            }
        }

        recorder.start(FALLBACK_TIMESLICE_MS)
        setStatus('recording')
        logVoiceDebug('voice.fallback.recorder.started', {
            recordingId,
            mimeType,
            timesliceMs: FALLBACK_TIMESLICE_MS
        })
    }, [api, beginRecordingSession, finishRecordingSession, getRecorderMimeType, isActiveRecording, logVoiceDebug, processFallbackChunkQueue, processFinalTranscript, updateRawText, waitForFallbackDrain])
    startFallbackRef.current = startFallback

    const stopFallback = useCallback((options?: VoiceToggleOptions) => {
        stopOptionsRef.current = { discard: options?.discard === true }
        logVoiceDebug('voice.fallback.stop-requested', {
            discard: stopOptionsRef.current.discard === true
        })
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop()
        }
    }, [logVoiceDebug])

    // --- Unified toggle ---
    const toggle = useCallback((options?: VoiceToggleOptions) => {
        logVoiceDebug('voice.toggle', {
            currentStatus: status,
            discard: options?.discard === true,
            path: supportsWebSpeech.current ? 'webspeech' : 'fallback'
        })
        if (status === 'recording') {
            if (supportsWebSpeech.current) {
                stopWebSpeech(options)
            } else {
                stopFallback(options)
            }
        } else if (status === 'idle') {
            if (supportsWebSpeech.current) {
                startWebSpeech()
            } else {
                startFallback()
            }
        }
    }, [logVoiceDebug, status, startWebSpeech, stopWebSpeech, startFallback, stopFallback])

    const setOnTranscript = useCallback((cb: (text: string) => void) => {
        onTranscriptRef.current = cb
    }, [])

    const setOnInterim = useCallback((cb: (text: string) => void) => {
        onInterimRef.current = cb
    }, [])

    const setOnRaw = useCallback((cb: (text: string) => void) => {
        onRawRef.current = cb
    }, [])

    return {
        status,
        error,
        rawText,
        correctedText,
        correctionAvailability,
        correctionUnavailableReason,
        toggle,
        setOnTranscript,
        setOnInterim,
        setOnRaw
    }
}
