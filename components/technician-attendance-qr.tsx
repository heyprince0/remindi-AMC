'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, QrCode, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  orgId: string
  companyName?: string
}

// QR payload — the scanner looks for this exact path + param
function buildCheckinUrl(orgId: string) {
  return `https://remindi.online/attendance/checkin?org=${orgId}`
}

export function TechnicianAttendanceQr({ orgId, companyName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!orgId) return
    setReady(false)
    setError(false)

    async function generate() {
      try {
        const QRCode = (await import('qrcode')).default
        const canvas = canvasRef.current
        if (!canvas) return

        await QRCode.toCanvas(canvas, buildCheckinUrl(orgId), {
          width: 280,
          margin: 2,
          color: { dark: '#09090b', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        })
        setReady(true)
      } catch (err) {
        console.error('QR generation failed:', err)
        setError(true)
      }
    }

    void generate()
  }, [orgId])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Build a printable version with label below the QR
    const printCanvas = document.createElement('canvas')
    const padding = 32
    const labelHeight = 80
    printCanvas.width = canvas.width + padding * 2
    printCanvas.height = canvas.height + padding * 2 + labelHeight
    const ctx = printCanvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, printCanvas.width, printCanvas.height)
    ctx.drawImage(canvas, padding, padding)

    // Company name label
    ctx.fillStyle = '#09090b'
    ctx.textAlign = 'center'
    const cx = printCanvas.width / 2
    if (companyName) {
      ctx.font = 'bold 20px system-ui, sans-serif'
      ctx.fillText(companyName, cx, canvas.height + padding + 32)
    }
    ctx.font = '14px system-ui, sans-serif'
    ctx.fillStyle = '#71717a'
    ctx.fillText('Scan to mark attendance', cx, canvas.height + padding + (companyName ? 56 : 40))

    const link = document.createElement('a')
    link.download = `${(companyName || 'attendance').replace(/\s+/g, '-').toLowerCase()}-qr.png`
    link.href = printCanvas.toDataURL('image/png')
    link.click()
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
        <QrCode className="size-10 opacity-30" />
        <p>Could not generate QR code. Install the <code className="text-xs">qrcode</code> package:</p>
        <code className="rounded bg-muted px-2 py-1 text-xs">npm install qrcode @types/qrcode</code>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-2xl border border-border bg-white p-4 shadow-sm">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`block transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Attendance QR code"
        />
      </div>

      {companyName && (
        <p className="text-sm font-medium text-foreground">{companyName}</p>
      )}
      <p className="text-xs text-muted-foreground text-center max-w-[240px]">
        Print this and stick it at your office entrance. Technicians scan it daily to mark attendance.
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={!ready}
        className="gap-2"
      >
        <Download className="size-4" />
        Download QR
      </Button>
    </div>
  )
}
