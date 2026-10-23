"use client"

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Pen, Trash2, RotateCcw } from "lucide-react"

export interface SignaturePadRef {
  getDataURL: () => string | null  // returns PNG base64 or null if blank
  clear: () => void
  isEmpty: () => boolean
}

interface SignaturePadProps {
  label: string                          // "Technician" or "Customer"
  existingUrl?: string | null            // URL to show if already signed
  onChange?: (dataURL: string | null) => void
  disabled?: boolean
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, existingUrl, onChange, disabled = false }, ref) => {
    const canvasRef  = useRef<HTMLCanvasElement>(null)
    const drawing    = useRef(false)
    const hasStrokes = useRef(false)

    const [mode, setMode] = useState<"preview" | "drawing">(
      existingUrl ? "preview" : "drawing"
    )

    // ── Expose methods to parent ───────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (!hasStrokes.current) return null
        return canvasRef.current?.toDataURL("image/png") ?? null
      },
      clear: () => {
        clearCanvas()
        hasStrokes.current = false
        onChange?.(null)
      },
      isEmpty: () => !hasStrokes.current,
    }))

    // ── Canvas setup ────────────────────────────────────────────────────────

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Retina/HiDPI support
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)

      ctx.strokeStyle = "#1a1a1a"
      ctx.lineWidth   = 2.2
      ctx.lineCap     = "round"
      ctx.lineJoin    = "round"
    }, [])

    useEffect(() => {
      if (mode === "drawing") setupCanvas()
    }, [mode, setupCanvas])

    const clearCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    // ── Pointer helpers (unified mouse + touch) ────────────────────────────

    const getXY = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect()
      if ("touches" in e) {
        const t = e.touches[0]
        return { x: t.clientX - rect.left, y: t.clientY - rect.top }
      }
      return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
    }

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      e.preventDefault()
      drawing.current = true
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const { x, y } = getXY(e, canvas)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current || disabled) return
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const { x, y } = getXY(e, canvas)
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    const endDraw = () => {
      if (!drawing.current) return
      drawing.current = false
      hasStrokes.current = true
      const dataURL = canvasRef.current?.toDataURL("image/png") ?? null
      onChange?.(dataURL)
    }

    // ── Clear handler ──────────────────────────────────────────────────────

    const handleClear = () => {
      clearCanvas()
      hasStrokes.current = false
      onChange?.(null)
    }

    const handleReSign = () => {
      setMode("drawing")
      onChange?.(null)
      // Give canvas time to mount before setup
      setTimeout(() => { setupCanvas() }, 50)
    }

    // ── Render ─────────────────────────────────────────────────────────────

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {mode === "drawing" && hasStrokes.current && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
            >
              <RotateCcw className="size-3" />
              Clear
            </button>
          )}
          {mode === "preview" && (
            <button
              type="button"
              onClick={handleReSign}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Pen className="size-3" />
              Re-sign
            </button>
          )}
        </div>

        {/* Preview mode — shows existing saved signature */}
        {mode === "preview" && existingUrl && (
          <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden h-28 flex items-center justify-center">
            <img
              src={existingUrl}
              alt={`${label} signature`}
              className="max-h-24 max-w-full object-contain"
            />
            <span className="absolute bottom-1.5 left-2.5 text-[10px] text-muted-foreground">
              {label} signature
            </span>
          </div>
        )}

        {/* Drawing mode */}
        {mode === "drawing" && (
          <div
            className={`
              relative rounded-xl border-2 overflow-hidden bg-white
              ${disabled ? "border-border opacity-60" : "border-border hover:border-primary/40 transition-colors"}
            `}
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              className="block w-full"
              style={{ height: "112px", cursor: disabled ? "not-allowed" : "crosshair" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {/* Placeholder */}
            {!hasStrokes.current && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 select-none">
                <Pen className="size-4 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground/60">
                  {disabled ? "Signature disabled" : "Sign here"}
                </p>
              </div>
            )}
            {/* Label baseline */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-dashed border-muted-foreground/20 mx-3 mb-5" />
            <p className="absolute bottom-1.5 left-3 text-[10px] text-muted-foreground/50 pointer-events-none">
              {label}
            </p>
          </div>
        )}
      </div>
    )
  }
)
SignaturePad.displayName = "SignaturePad"
export default SignaturePad
