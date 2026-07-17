'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null)

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/invites/token/${token}`)
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 410) {
            const status = data.status
            if (status === 'accepted') {
              toast.info("You've already accepted this invitation.")
              router.push('/')
              return
            } else if (status === 'expired') {
              setError('This invitation has expired. Please contact the admin for a new one.')
            } else if (status === 'revoked') {
              setError('This invitation has been revoked.')
            } else {
              setError(data.message || 'Invalid or expired invitation')
            }
            setLoading(false)
            return
          }
          setError(data.message || 'Invalid or expired invitation')
          setLoading(false)
          return
        }
        setInvite(data)
        setEmail(data.email)

        try {
          const checkRes = await fetch(`/api/invites/check-email?email=${encodeURIComponent(data.email)}`)
          if (checkRes.ok) {
            const checkData = await checkRes.json()
            setIsExistingUser(checkData.exists || false)
          } else {
            console.error("check-email endpoint returned", checkRes.status)
            setIsExistingUser(false)
          }
        } catch (checkErr) {
          console.error("check-email request failed:", checkErr)
          setIsExistingUser(false)
        }
        setLoading(false)
      } catch (err) {
        setError("Failed to load invitation")
        setLoading(false)
      }
    }
    fetchInvite()
  }, [token, router])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }
    setAccepting(true)
    try {
      let authResponse
      if (isExistingUser) {
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
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("token", token)

      if (updateError) {
        console.error("Failed to update invite:", updateError)
        toast.error("Failed to accept invitation")
        setAccepting(false)
        return
      }

      // 2. Handle membership – upsert to avoid duplicates and update role
      const membershipData = {
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role,
        display_name: invite.display_name || null,
        email: invite.email,
        updated_at: new Date().toISOString(),
      }

      // Check if membership already exists
      const { data: existingMembership, error: checkError } = await supabase
        .from("memberships")
        .select("id, role")
        .eq("org_id", invite.org_id)
        .eq("user_id", user.id)
        .maybeSingle()

      let membershipError = null
      if (existingMembership) {
        // Update existing membership (especially role)
        const { error: updateMembershipError } = await supabase
          .from("memberships")
          .update({
            role: invite.role,
            display_name: invite.display_name || null,
            email: invite.email,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingMembership.id)

        membershipError = updateMembershipError
      } else {
        // Insert new membership
        const { error: insertError } = await supabase
          .from("memberships")
          .insert({
            org_id: invite.org_id,
            user_id: user.id,
            role: invite.role,
            display_name: invite.display_name || null,
            email: invite.email,
            created_at: new Date().toISOString(),
          })

        membershipError = insertError
      }

      if (membershipError) {
        console.error("Failed to create/update membership:", membershipError)
        toast.error("Failed to join organization")
        setAccepting(false)
        return
      }

      // 3. Link technician if this invite has a technician_id
      if (invite.technician_id) {
        const { error: linkError } = await supabase
          .from("technicians")
          .update({ linked_user_id: user.id })
          .eq("id", invite.technician_id)
          .is("linked_user_id", null) // only link if not already linked

        if (linkError) {
          console.error("Failed to link technician:", linkError)
          // Not critical, we can still continue
        } else {
          console.log(`✅ Technician ${invite.technician_id} linked to user ${user.id}`)
        }
      }

      toast.success("You've joined the team!")

      // 4. Redirect based on role
      if (invite.role === 'technician' && invite.technician_id) {
        router.push(`/technicians/${invite.technician_id}`)
      } else if (invite.role === 'technician') {
        router.push('/technicians')
      } else {
        router.push('/')
      }
    } catch (err) {
      console.error(err)
      toast.error("Something went wrong")
    } finally {
      setAccepting(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("No email address available")
      return
    }
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?redirect=${encodeURIComponent(`/invite/accept/${token}`)}`,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Password reset email sent! Check your inbox.")
      }
    } catch (err) {
      toast.error("Failed to send reset email")
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>This invitation could not be found. It may have been removed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const showSignIn = isExistingUser === true
  const showSignUp = isExistingUser === false

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join {invite.businessName} as a {invite.role}.
            <br />
            <span className="text-sm text-muted-foreground">{invite.inviterName} has invited you.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled className="bg-gray-100" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{showSignIn ? "Password" : "Create Password"}</Label>
              <Input
                id="password"
                type="password"
                placeholder={showSignIn ? "Enter your password" : "Create a password (min 6 characters)"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {showSignIn && (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={handleForgotPassword}
                disabled={resetting}
              >
                {resetting ? "Sending..." : "Forgot password?"}
              </Button>
            )}

            {showSignUp && (
              <p className="text-sm text-muted-foreground">
                Create a password to set up your account and join the team.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={accepting}>
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                showSignIn ? "Accept & Sign In" : "Accept & Create Account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
