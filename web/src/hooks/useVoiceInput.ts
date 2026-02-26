import { useCallback, useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import { getElevenLabsCodeFromPreference } from '@/lib/languages'

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing'

export function useVoiceInput(api: ApiClient) {
    const [status, setStatus] = useState<VoiceInputStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const onTranscriptRef = useRef<((text: string) => void) | null>(null)

    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop()
        }
    }, [])

    const startRecording = useCallback(async () => {
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
            // Stop all tracks to release microphone
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

    const toggle = useCallback(() => {
        if (status === 'recording') {
            stopRecording()
        } else if (status === 'idle') {
            startRecording()
        }
        // Do nothing if transcribing
    }, [status, startRecording, stopRecording])

    const setOnTranscript = useCallback((cb: (text: string) => void) => {
        onTranscriptRef.current = cb
    }, [])

    return { status, error, toggle, setOnTranscript }
}
