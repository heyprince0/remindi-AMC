"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

interface InviteDetails {
  email: string
  role: string
  businessName: string
  inviterName: string
  expiresAt: string
  status: string
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user } = useAuth()

  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signupPassword, setSignupPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [emailWarning, setEmailWarning] = useState<string | null>(null)

  // Fetch invite details — no auth needed for this, it's a public endpoint
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await fetch(`/api/invites/${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.message || "Failed to load invitation")
          return
        }

        setInviteDetails(data)

        if (user?.email && user.email !== data.email) {
          setEmailWarning(
            `This invitation was sent to ${data.email}, but you're logged in as ${user.email}. Please log out and sign in with the invited email, or create a new account below.`
          )
        }
      } catch (err) {
        console.error("[invite/accept] Error fetching invite:", err)
        setError("Failed to load invitation. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchInvite()
    }
  }, [token, user?.email])

  // Helper: call accept route with the current session's access token
  const callAcceptRoute = async (accessToken: string) => {
    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    })
    return response
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!signupPassword || !confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }

    if (signupPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (signupPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (!inviteDetails?.email) {
      toast.error("Invite details not loaded")
      return
    }

    setSubmitting(true)

    try {
      // Sign up with the invited email (pre-filled, locked)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteDetails.email,
        password: signupPassword,
      })

      if (authError) {
        toast.error(authError.message || "Failed to create account")
        return
      }

      // After signup, the session is immediately available in the response
      const accessToken = authData.session?.access_token

      if (!accessToken) {
        // Supabase requires email confirmation — user needs to verify first
        toast.success(
          "Account created! Please check your email to confirm your account, then click the invite link again to accept."
        )
        return
      }

      // Session available immediately (email confirmation disabled) — accept now
      const acceptResponse = await callAcceptRoute(accessToken)

      if (!acceptResponse.ok) {
        const acceptData = await acceptResponse.json()
        toast.error(acceptData.message || "Account created but failed to accept invitation")
        return
      }

      toast.success("Account created and invitation accepted! Welcome to the team.")
      router.push("/")
    } catch (err) {
      console.error("[invite/accept] Error in signup flow:", err)
      toast.error("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptAsUser = async () => {
    if (!user?.id) {
      toast.error("You must be logged in")
      return
    }

    if (emailWarning) {
      toast.error("Email mismatch — please use the correct account to accept this invite")
      return
    }

    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error("Your session has expired. Please log in again.")
        return
      }

      const acceptResponse = await callAcceptRoute(session.access_token)

      if (!acceptResponse.ok) {
        const acceptData = await acceptResponse.json()
        toast.error(acceptData.message || "Failed to accept invitation")
        return
      }

      toast.success("Invitation accepted! Welcome to the team.")
      router.push("/")
    } catch (err) {
      console.error("[invite/accept] Error accepting invite:", err)
      toast.error("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">Loading invitation...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {error || "This invitation could not be found or has expired."}
            </p>
            <Link href="https://remindi.online" target="_blank" className="block">
              <Button variant="outline" className="w-full">
                Visit Remindi
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <CardTitle>Accept Team Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join <strong>{inviteDetails.businessName}</strong> by{" "}
            <strong>{inviteDetails.inviterName}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invite Details */}
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium text-sm">{inviteDetails.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-medium text-sm capitalize">{inviteDetails.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invitation expires</p>
              <p className="font-medium text-sm">
                {new Date(inviteDetails.expiresAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Email Warning */}
          {emailWarning && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">{emailWarning}</p>
            </div>
          )}

          {/* Signup Form (not logged in) */}
          {!user ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteDetails.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  This email address cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter a strong password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  disabled={submitting}
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                style={{ backgroundColor: "#2ea4e6" }}
              >
                {submitting ? "Creating account..." : "Create Account & Accept"}
              </Button>
            </form>
          ) : (
            // Logged-in accept flow
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  You&apos;re logged in as <strong>{user.email}</strong>
                </p>
              </div>
              <Button
                onClick={handleAcceptAsUser}
                disabled={submitting || !!emailWarning}
                className="w-full"
                style={{ backgroundColor: "#2ea4e6" }}
              >
                {submitting ? "Accepting..." : "Accept Invitation"}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
