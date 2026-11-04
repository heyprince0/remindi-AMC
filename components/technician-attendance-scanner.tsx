'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, XCircle, Loader2, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// ── Helpers ──────────────────────────────────────────────────────────────────

function orgIdFromPayload(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.pathname !== '/attendance/checkin') return null
    return url.searchParams.get('org')
  } catch {
    return null
  }
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** The technician's own `technicians.id` (not user id) */
  technicianId: string
}

type ScanResult =
  | { type: 'success'; message: string }
  | { type: 'already'; message: string }
  | { type: 'error'; message: string }

// ── Component ─────────────────────────────────────────────────────────────────

export function TechnicianAttendanceScanner({ technicianId }: Props) {
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  // ── Stop camera ────────────────────────────────────────────────────────────
  async function stop() {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => undefined)
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setStarted(false)
  }

  // ── Check-in logic ─────────────────────────────────────────────────────────
  async function checkin(orgId: string) {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setResult({ type: 'error', message: 'Please sign in to Remindi before checking in.' })
        return
      }

      // Confirm that this technician belongs to the scanned org
      const { data: tech, error: techErr } = await supabase
        .from('technicians')
        .select('id, org_id')
        .eq('id', technicianId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (techErr || !tech) {
        setResult({ type: 'error', message: 'This QR code does not belong to your organisation.' })
        return
      }

      // Insert attendance record — unique constraint handles duplicate
      const { error: insertErr } = await supabase
        .from('technician_attendance')
        .insert({
          org_id: orgId,
          technician_id: technicianId,
          attendance_date: todayIST(),
          scanned_at: new Date().toISOString(),
        })

      if (insertErr?.code === '23505') {
        setResult({ type: 'already', message: 'Already checked in today.' })
      } else if (insertErr) {
        setResult({ type: 'error', message: 'Could not log attendance. Please try again.' })
      } else {
        setResult({ type: 'success', message: 'Attendance logged successfully!' })
      }
    } catch (err) {
      console.error('Checkin error:', err)
      setResult({ type: 'error', message: 'An unexpected error occurred.' })
    } finally {
      setBusy(false)
      await stop()
    }
  }

  // ── Start camera ───────────────────────────────────────────────────────────
  async function start() {
    setResult(null)
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('tech-attendance-qr-reader')
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded) => {
          const orgId = orgIdFromPayload(decoded)
          if (!orgId) {
            setResult({ type: 'error', message: 'That QR code is not a Remindi attendance code.' })
            await stop()
            return
          }
          await checkin(orgId)
        },
        () => undefined,
      )
      setStarted(true)
    } catch {
      setResult({ type: 'error', message: 'Camera access unavailable. Allow camera permissions and try again.' })
      scannerRef.current = null
    }
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => { void stop() }, [])

  // ── Result icon ────────────────────────────────────────────────────────────
  const ResultIcon = result?.type === 'success' || result?.type === 'already'
    ? CheckCircle2
    : XCircle

  const resultColor =
    result?.type === 'success' ? 'text-green-600 dark:text-green-400 bg-green-500/10 border-transparent'
    : result?.type === 'already' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-transparent'
    : 'text-red-600 dark:text-red-400 bg-red-500/10 border-transparent'

  return (
    <div className="flex flex-col gap-4">
      {/* Scanner viewfinder */}
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <div
          id="tech-attendance-qr-reader"
          className="w-full"
          aria-label="QR scanner viewfinder"
        />
        {/* Scan line animation when active */}
        {started && !busy && (
          <div
            className="pointer-events-none absolute inset-x-4 top-0 h-0.5 bg-primary/70 animate-bounce"
            style={{ animationDuration: '2s' }}
          />
        )}
      </div>

      {/* Result message */}
      {result && (
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${resultColor}`}>
          <ResultIcon className="size-4 shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}

      {/* Controls */}
      {busy ? (
        <Button disabled className="w-full gap-2">
          <Loader2 className="size-4 animate-spin" />
          Logging attendance...
        </Button>
      ) : started ? (
        <Button variant="outline" onClick={() => void stop()} className="w-full gap-2">
          <XCircle className="size-4" />
          Stop scanner
        </Button>
      ) : (
        <Button onClick={() => void start()} className="w-full gap-2">
          <Camera className="size-4" />
          {result ? 'Scan again' : 'Start camera'}
        </Button>
      )}

      {!started && !result && (
        <p className="text-center text-xs text-muted-foreground">
          Point your camera at the attendance QR code at your office entrance.
        </p>
      )}
    </div>
  )
}
