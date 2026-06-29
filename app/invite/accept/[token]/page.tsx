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
import Link from "next/link"

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
        setEmail(data.email)
      } catch (err) {
        setError("Failed to load invitation")
      } finally {
        setLoading(false)
      }
    }
    fetchInvite()
  }, [token])

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
        const msg = authResponse.error.message
        if (msg.includes("Invalid login credentials")) {
          toast.error("Invalid password. Please check your password or reset it.")
        } else if (msg.includes("User not found")) {
          toast.error("No account found with this email. Please sign up instead.")
        } else if (msg.includes("Email not confirmed")) {
          toast.error("Please confirm your email before signing in. Check your inbox.")
        } else if (msg.includes("already registered") || msg.includes("already been used")) {
          toast.error("This email is already registered. Please sign in instead.")
        } else {
          toast.error(msg)
        }
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

      // 2. Create membership
      const { error: membershipError } = await supabase
        .from("memberships")
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          display_name: invite.display_name,
          created_at: new Date().toISOString(),
        })

      if (membershipError) {
        console.error("Failed to create membership:", membershipError)
        toast.error("Failed to join organization")
        setAccepting(false)
        return
      }

      toast.success("You've joined the team!")

      // ✅ FIX: Redirect to root (dashboard) instead of /dashboard
      router.push("/")
    } catch (err) {
      console.error(err)
      toast.error("Something went wrong")
    } finally {
      setAccepting(false)
    }
  }

  // ... (rest of the component – loading, error states, JSX) remains unchanged
}
