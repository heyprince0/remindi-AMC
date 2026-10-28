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
      if (buttonRef.current) setButtonContent(buttonRef.current, false)
      buttonRef.current = null
    }

    const setButtonContent = (button: HTMLButtonElement, listening: boolean) => {
      button.replaceChildren()
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      icon.setAttribute('viewBox', '0 0 24 24')
      icon.setAttribute('fill', 'none')
      icon.setAttribute('stroke', 'currentColor')
      icon.setAttribute('stroke-width', '2')
      icon.setAttribute('stroke-linecap', 'round')
      icon.setAttribute('stroke-linejoin', 'round')
      icon.setAttribute('aria-hidden', 'true')
      icon.classList.add('voice-dictation-icon')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', listening ? 'M18 6 6 18M6 6l12 12' : 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3 M8 22h8')
      icon.append(path)
      button.append(icon, document.createTextNode(listening ? 'Stop' : 'Dictate'))
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
      setButtonContent(button, true)
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
      setButtonContent(button, false)
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
