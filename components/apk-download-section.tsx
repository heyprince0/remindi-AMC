"use client"

import { Download, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePwaInstall } from "@/hooks/use-pwa-install"

export function ApkDownloadSection() {
  const { isInstallable, isInstalled, installApp } = usePwaInstall()

  return (
    <section className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Get the Remindi App</h2>
        <p className="text-muted-foreground mb-6">
          Install Remindi on your phone or desktop — no app store needed.
        </p>

        {isInstalled ? (
          <div className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-primary">
            <Star className="h-4 w-4 fill-primary" />
            Remindi is already installed!
          </div>
        ) : isInstallable ? (
          <Button size="lg" className="gap-2" onClick={installApp}>
            <Download className="h-5 w-5" />
            Install App
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" className="gap-2" disabled>
              <Download className="h-5 w-5" />
              Install App
            </Button>
            <p className="text-xs text-muted-foreground">
              Open in Chrome, or use your browser menu → "Add to Home Screen"
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
