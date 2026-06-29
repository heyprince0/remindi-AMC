"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        toast.error("Invalid or expired reset link")
        router.push("/login")
        setValidating(false)
        return
      }
      setValidating(false)
    }
    checkSession()
  }, [router])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Password updated! Please sign in.")
      // Sign out to clear the reset session and force re-login
      await supabase.auth.signOut()
      router.push("/login")
    }
    setLoading(false)
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
