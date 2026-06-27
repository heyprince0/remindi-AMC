"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")

  // Fetch invite details
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/invites/token/${token}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.message || "Invalid or expired invitation")
          return
        }
        setInvite(data)
        setEmail(data.email) // pre‑fill email
      } catch (err) {
        setError("Failed to load invitation")
      } finally {
        setLoading(false)
      }
    }
    fetchInvite()
  }, [token])

  // Handle accept (sign‑in or sign‑up)
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    setAccepting(true)
    try {
      let authResponse
      if (mode === "signin") {
        authResponse = await supabase.auth.signInWithPassword({ email, password })
      } else {
        authResponse = await supabase.auth.signUp({ email, password })
      }

      if (authResponse.error) {
        toast.error(authResponse.error.message)
        setAccepting(false)
        return
      }

      const user = authResponse.data.user
      if (!user) {
        toast.error("Failed to authenticate")
        setAccepting(false)
        return
      }

      // 1. Mark invite as accepted
      const { error: updateError } = await supabase
        .from("invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("token", token)

      if (updateError) {
        console.error("Failed to update invite:", updateError)
        toast.error("Failed to accept invitation")
        setAccepting(false)
        return
      }

      // 2. Create membership (with display_name)
      const { error: membershipError } = await supabase
        .from("memberships")
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          display_name: invite.display_name, // <-- copy the admin‑set name
          created_at: new Date().toISOString(),
        })

      if (membershipError) {
        console.error("Failed to create membership:", membershipError)
        toast.error("Failed to join organization")
        setAccepting(false)
        return
      }

      toast.success("You've joined the team!")
      router.push("/dashboard")
    } catch (err) {
      console.error(err)
      toast.error("Something went wrong")
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join <strong>{invite.businessName}</strong> as a{" "}
            <strong>{invite.role}</strong>.
            <br />
            {invite.inviterName} has invited you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {mode === "signin" ? "Password" : "Create Password"}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signin" ? "Enter your password" : "Create a password"}
                required
              />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-blue-600 hover:underline"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={accepting}>
              {accepting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                `Accept Invitation & ${mode === "signin" ? "Sign in" : "Sign up"}`
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
