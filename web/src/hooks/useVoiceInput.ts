import { useCallback, useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import { getElevenLabsCodeFromPreference } from '@/lib/languages'

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing'
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
    const [error, setError] = useState<string | null>(null)
    const [rawText, setRawText] = useState('')
    const [correctedText, setCorrectedText] = useState('')
    const onTranscriptRef = useRef<((text: string) => void) | null>(null)
    const onInterimRef = useRef<((text: string) => void) | null>(null)
    const onRawRef = useRef<((text: string) => void) | null>(null)

    // Web Speech API refs
    const recognitionRef = useRef<SpeechRecognition | null>(null)
    const activeRecordingIdRef = useRef(0)
    const recordingIdCounterRef = useRef(0)
    const stopOptionsRef = useRef<VoiceToggleOptions>({ discard: false })
    const realtimeCorrectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const rawTextRef = useRef('')
    const correctedTextRef = useRef('')
    const lastRequestedRawRef = useRef('')
    const correctionInFlightRef = useRef(false)
    const correctionPendingRef = useRef(false)
    const allowRealtimeCorrectionRef = useRef(false)

    // MediaRecorder fallback refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const supportsWebSpeech = useRef(getSpeechRecognitionClass() !== null)

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
        setRawText('')
        setCorrectedText('')
        return nextId
    }, [])

    const isActiveRecording = useCallback((recordingId: number): boolean => {
        return activeRecordingIdRef.current === recordingId
    }, [])

    const stopRealtimeCorrectionLoop = useCallback(() => {
        if (realtimeCorrectionTimerRef.current) {
            clearInterval(realtimeCorrectionTimerRef.current)
            realtimeCorrectionTimerRef.current = null
        }
    }, [])

    const updateRawText = useCallback((text: string) => {
        const next = text.trim()
        rawTextRef.current = next
        setRawText(next)
        onRawRef.current?.(next)
    }, [])

    const updateCorrectedText = useCallback((text: string, emitInterim: boolean) => {
        const next = text.trim()
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
    }, recordingId: number): Promise<string> => {
        try {
            const result = await api.correctVoiceText({
                currentRawFull: context.currentRawFull,
                prevRawFull: context.prevRawFull,
                prevCorrectedFull: context.prevCorrectedFull,
                deltaRaw: context.deltaRaw,
                latestSegment: context.latestSegment
            })
            if (!isActiveRecording(recordingId)) {
                return context.currentRawFull
            }
            const corrected = typeof result.text === 'string' ? result.text.trim() : ''
            const deduped = stripLikelyDuplicatedPrefix(corrected, context.currentRawFull)
            return deduped || context.currentRawFull
        } catch (err) {
            if (isActiveRecording(recordingId)) {
                setError(err instanceof Error ? err.message : 'Correction failed')
            }
            return context.currentRawFull
        }
    }, [api, isActiveRecording])

    const maybeRequestRealtimeCorrection = useCallback(async (recordingId: number) => {
        if (!isActiveRecording(recordingId)) return
        if (!allowRealtimeCorrectionRef.current) return
        if (stopOptionsRef.current.discard) return

        const currentRaw = rawTextRef.current.trim()
        if (!currentRaw) return

        if (currentRaw === lastRequestedRawRef.current) return

        if (correctionInFlightRef.current) {
            correctionPendingRef.current = true
            return
        }

        correctionInFlightRef.current = true
        const prevRawForRequest = lastRequestedRawRef.current
        const prevCorrectedForRequest = correctedTextRef.current.trim()
        lastRequestedRawRef.current = currentRaw

        try {
            const corrected = await runSingleCorrection(
                buildCorrectionContext(currentRaw, prevRawForRequest, prevCorrectedForRequest),
                recordingId
            )
            if (!isActiveRecording(recordingId)) return
            if (!allowRealtimeCorrectionRef.current) return
            updateCorrectedText(corrected, true)
        } finally {
            correctionInFlightRef.current = false
            if (correctionPendingRef.current) {
                correctionPendingRef.current = false
                void maybeRequestRealtimeCorrection(recordingId)
            }
        }
    }, [isActiveRecording, runSingleCorrection, updateCorrectedText])

    const startRealtimeCorrectionLoop = useCallback((recordingId: number) => {
        stopRealtimeCorrectionLoop()
        realtimeCorrectionTimerRef.current = setInterval(() => {
            void maybeRequestRealtimeCorrection(recordingId)
        }, 200)
    }, [maybeRequestRealtimeCorrection, stopRealtimeCorrectionLoop])

    const finishRecordingSession = useCallback((recordingId: number) => {
        if (!isActiveRecording(recordingId)) return
        stopRealtimeCorrectionLoop()
        allowRealtimeCorrectionRef.current = false
        activeRecordingIdRef.current = 0
        stopOptionsRef.current = { discard: false }
        onInterimRef.current?.('')
        setStatus('idle')
    }, [isActiveRecording, stopRealtimeCorrectionLoop])

    const processFinalTranscript = useCallback(async (rawText: string, recordingId: number) => {
        if (!isActiveRecording(recordingId)) return

        const text = rawText.trim()
        const discard = stopOptionsRef.current.discard === true

        if (discard || !text) {
            finishRecordingSession(recordingId)
            return
        }

        stopRealtimeCorrectionLoop()
        allowRealtimeCorrectionRef.current = false
        updateRawText(text)
        setStatus('transcribing')
        const prevRawForFinal = lastRequestedRawRef.current
        const prevCorrectedForFinal = correctedTextRef.current.trim()
        const finalCorrectedText = await runSingleCorrection(
            buildCorrectionContext(text, prevRawForFinal, prevCorrectedForFinal),
            recordingId
        )
        if (!isActiveRecording(recordingId)) return

        updateCorrectedText(finalCorrectedText, false)

        if (finalCorrectedText.trim()) {
            onTranscriptRef.current?.(finalCorrectedText.trim())
        }

        finishRecordingSession(recordingId)
    }, [finishRecordingSession, isActiveRecording, runSingleCorrection, stopRealtimeCorrectionLoop, updateCorrectedText, updateRawText])

    // --- Web Speech API path ---
    const startWebSpeech = useCallback(() => {
        const SpeechRecognitionClass = getSpeechRecognitionClass()
        if (!SpeechRecognitionClass) return

        setError(null)
        const recordingId = beginRecordingSession()
        let finalTranscript = ''
        let latestInterim = ''

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
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    final += transcript
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
                updateRawText(draft)
                void maybeRequestRealtimeCorrection(recordingId)
            }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (!isActiveRecording(recordingId)) return
            if (event.error !== 'aborted' && event.error !== 'no-speech') {
                setError(event.error)
            }
        }

        recognition.onend = async () => {
            if (isActiveRecording(recordingId)) {
                recognitionRef.current = null
            }
            await processFinalTranscript(mergeFinalAndInterim(finalTranscript, latestInterim), recordingId)
        }

        try {
            recognition.start()
            setStatus('recording')
            startRealtimeCorrectionLoop(recordingId)
        } catch (err) {
            activeRecordingIdRef.current = 0
            stopOptionsRef.current = { discard: false }
            setStatus('idle')
            setError(err instanceof Error ? err.message : 'Failed to start speech recognition')
        }
    }, [beginRecordingSession, isActiveRecording, maybeRequestRealtimeCorrection, processFinalTranscript, startRealtimeCorrectionLoop, updateRawText])

    const stopWebSpeech = useCallback((options?: VoiceToggleOptions) => {
        stopOptionsRef.current = { discard: options?.discard === true }
        recognitionRef.current?.stop()
    }, [])

    // --- MediaRecorder + ElevenLabs fallback path ---
    const startFallback = useCallback(async () => {
        setError(null)
        chunksRef.current = []
        const recordingId = beginRecordingSession()

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
            activeRecordingIdRef.current = 0
            stopOptionsRef.current = { discard: false }
            setError('Microphone permission denied')
            return
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4'

        const recorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
            if (!isActiveRecording(recordingId)) return
            stream.getTracks().forEach((t) => t.stop())

            if (stopOptionsRef.current.discard) {
                finishRecordingSession(recordingId)
                return
            }

            const blob = new Blob(chunksRef.current, { type: mimeType })
            if (blob.size === 0) {
                finishRecordingSession(recordingId)
                return
            }

            setStatus('transcribing')
            try {
                const language = getElevenLabsCodeFromPreference(
                    localStorage.getItem('hapi-voice-lang')
                )
                const result = await api.transcribeAudio(blob, language)
                if (!isActiveRecording(recordingId)) return
                updateRawText((result.text ?? '').trim())
                await processFinalTranscript(result.text ?? '', recordingId)
            } catch (err) {
                if (isActiveRecording(recordingId)) {
                    setError(err instanceof Error ? err.message : 'Transcription failed')
                    finishRecordingSession(recordingId)
                }
            }
        }

        recorder.start()
        setStatus('recording')
    }, [api, beginRecordingSession, finishRecordingSession, isActiveRecording, processFinalTranscript, updateRawText])

    const stopFallback = useCallback((options?: VoiceToggleOptions) => {
        stopOptionsRef.current = { discard: options?.discard === true }
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop()
        }
    }, [])

    // --- Unified toggle ---
    const toggle = useCallback((options?: VoiceToggleOptions) => {
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
    }, [status, startWebSpeech, stopWebSpeech, startFallback, stopFallback])

    const setOnTranscript = useCallback((cb: (text: string) => void) => {
        onTranscriptRef.current = cb
    }, [])

    const setOnInterim = useCallback((cb: (text: string) => void) => {
        onInterimRef.current = cb
    }, [])

    const setOnRaw = useCallback((cb: (text: string) => void) => {
        onRawRef.current = cb
    }, [])

    return { status, error, rawText, correctedText, toggle, setOnTranscript, setOnInterim, setOnRaw }
}
