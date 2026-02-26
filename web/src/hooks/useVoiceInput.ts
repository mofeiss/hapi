import { useCallback, useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import { getElevenLabsCodeFromPreference } from '@/lib/languages'

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing'

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

export function useVoiceInput(api: ApiClient) {
    const [status, setStatus] = useState<VoiceInputStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const onTranscriptRef = useRef<((text: string) => void) | null>(null)
    const onInterimRef = useRef<((text: string) => void) | null>(null)

    // Web Speech API refs
    const recognitionRef = useRef<SpeechRecognition | null>(null)
    const finalTranscriptRef = useRef('')

    // MediaRecorder fallback refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const supportsWebSpeech = useRef(getSpeechRecognitionClass() !== null)

    // --- Web Speech API path ---
    const startWebSpeech = useCallback(() => {
        const SpeechRecognitionClass = getSpeechRecognitionClass()
        if (!SpeechRecognitionClass) return

        setError(null)
        finalTranscriptRef.current = ''

        const recognition = new SpeechRecognitionClass()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = getVoiceLang()
        recognitionRef.current = recognition

        recognition.onresult = (event: SpeechRecognitionEvent) => {
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
                finalTranscriptRef.current += final
                onTranscriptRef.current?.(finalTranscriptRef.current)
            }

            if (interim) {
                // Show interim (final so far + current interim)
                onInterimRef.current?.(finalTranscriptRef.current + interim)
            }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error !== 'aborted' && event.error !== 'no-speech') {
                setError(event.error)
            }
        }

        recognition.onend = () => {
            recognitionRef.current = null
            // Emit final transcript
            if (finalTranscriptRef.current) {
                onTranscriptRef.current?.(finalTranscriptRef.current)
            }
            onInterimRef.current?.('')
            setStatus('idle')
        }

        recognition.start()
        setStatus('recording')
    }, [])

    const stopWebSpeech = useCallback(() => {
        recognitionRef.current?.stop()
    }, [])

    // --- MediaRecorder + ElevenLabs fallback path ---
    const startFallback = useCallback(async () => {
        setError(null)
        chunksRef.current = []

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
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
            stream.getTracks().forEach((t) => t.stop())
            const blob = new Blob(chunksRef.current, { type: mimeType })
            if (blob.size === 0) {
                setStatus('idle')
                return
            }

            setStatus('transcribing')
            try {
                const language = getElevenLabsCodeFromPreference(
                    localStorage.getItem('hapi-voice-lang')
                )
                const result = await api.transcribeAudio(blob, language)
                const text = result.text.trim()
                if (text) {
                    onTranscriptRef.current?.(text)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Transcription failed')
            } finally {
                setStatus('idle')
            }
        }

        recorder.start()
        setStatus('recording')
    }, [api])

    const stopFallback = useCallback(() => {
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop()
        }
    }, [])

    // --- Unified toggle ---
    const toggle = useCallback(() => {
        if (status === 'recording') {
            if (supportsWebSpeech.current) {
                stopWebSpeech()
            } else {
                stopFallback()
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

    return { status, error, toggle, setOnTranscript, setOnInterim }
}
