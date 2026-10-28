'use client'

import { useEffect, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { toast } from 'sonner'

type DictationField = HTMLInputElement | HTMLTextAreaElement

export function VoiceDictation() {
  const activeFieldRef = useRef<DictationField | null>(null)
  const recognitionRef = useRef<any>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const isSupported = () => Boolean(window.SpeechRecognition || (window as any).webkitSpeechRecognition)

    const stop = () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      activeFieldRef.current = null
      buttonRef.current?.removeAttribute('data-listening')
      if (buttonRef.current) buttonRef.current.innerHTML = ''
      buttonRef.current = null
    }

    const dictate = (field: DictationField, button: HTMLButtonElement) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        toast.error('Speech recognition is not supported in this browser. Try Chrome or Edge.')
        return
      }
      if (activeFieldRef.current === field) {
        stop()
        return
      }
      if (activeFieldRef.current) stop()

      const recognition = new SpeechRecognition()
      recognition.lang = 'en-IN'
      recognition.continuous = field instanceof HTMLTextAreaElement
      recognition.interimResults = false
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(' ')
        const isLongText = field instanceof HTMLTextAreaElement
        const value = isLongText && field.value ? `${field.value} ${transcript}` : transcript
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set
        setter?.call(field, value)
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
      }
      recognition.onerror = (event: any) => {
        if (event.error !== 'aborted') toast.error(`Microphone error: ${event.error}`)
        stop()
      }
      recognition.onend = stop
      recognitionRef.current = recognition
      activeFieldRef.current = field
      buttonRef.current = button
      button.setAttribute('data-listening', 'true')
      button.innerHTML = ''
      button.append(Object.assign(document.createElement('span'), { textContent: 'Listening...' }))
      recognition.start()
    }

    const attach = (field: DictationField) => {
      if (field.dataset.voiceDictation || !field.closest('form')) return
      if (field.disabled || field.readOnly || (field instanceof HTMLInputElement && ['date', 'number', 'select'].includes(field.type))) return
      field.dataset.voiceDictation = 'true'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'voice-dictation-button'
      button.setAttribute('aria-label', 'Dictate into this field')
      button.textContent = 'Dictate'
      button.addEventListener('click', () => dictate(field, button))
      field.insertAdjacentElement('afterend', button)
    }

    const scan = () => document.querySelectorAll<DictationField>('form input[data-slot="input"], form textarea[data-slot="textarea"]').forEach(attach)
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      stop()
      document.querySelectorAll('[data-voice-dictation]').forEach((field) => field.removeAttribute('data-voice-dictation'))
      document.querySelectorAll('.voice-dictation-button').forEach((button) => button.remove())
    }
  }, [])

  return null
}

export { Mic, MicOff }
