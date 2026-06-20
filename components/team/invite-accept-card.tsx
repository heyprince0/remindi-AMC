'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface InviteDetails {
  email: string
  businessName: string
  inviterName: string
  role: 'admin' | 'member'
  status: 'valid' | 'expired' | 'revoked' | 'accepted'
}

interface InviteAcceptCardProps {
  token: string
  inviteDetails: InviteDetails | null
  loading: boolean
  userEmail?: string
}

export function InviteAcceptCard({
  token,
  inviteDetails,
  loading,
  userEmail,
}: InviteAcceptCardProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [showSignupForm, setShowSignupForm] = useState(false)

  const isLoggedIn = !!userEmail
  const emailMatches = userEmail?.toLowerCase() === inviteDetails?.email.toLowerCase()

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!inviteDetails) {
    return (
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Invite Not Found</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or has already been used.
          </p>
          <Button className="w-full" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (inviteDetails.status === 'expired') {
    return (
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Invite Expired</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This invite has expired. Please contact {inviteDetails.inviterName} to request a new invite.
          </p>
          <Button className="w-full" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (inviteDetails.status === 'revoked') {
    return (
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Invite Revoked</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This invite has been revoked. Please contact {inviteDetails.inviterName} for more information.
          </p>
          <Button className="w-full" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (inviteDetails.status === 'accepted') {
    return (
      <Card className="w-full max-w-md border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle>Already Accepted</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This invite has already been accepted. You're now part of {inviteDetails.businessName}.
          </p>
          <Button className="w-full" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Valid invite
  if (!isLoggedIn) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {inviteDetails.businessName}</CardTitle>
          <CardDescription>
            {inviteDetails.inviterName} invited you to join as a {inviteDetails.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showSignupForm ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm">
                  <span className="font-semibold">Role:</span>{' '}
                  <Badge variant={inviteDetails.role === 'admin' ? 'default' : 'secondary'}>
                    {inviteDetails.role === 'admin' ? 'Admin' : 'Member'}
                  </Badge>
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  You&apos;ll be joining as a {inviteDetails.role}.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => setShowSignupForm(true)}
                size="lg"
              >
                Create Account & Join
              </Button>
            </div>
          ) : (
            <SignupForm
              email={inviteDetails.email}
              loading={accepting}
              onSubmit={async (data) => {
                setAccepting(true)
                try {
                  // Sign up
                  const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: data.email,
                    password: data.password,
                  })

                  if (authError) throw authError
                  if (!authData.user) throw new Error('Failed to create account')

                  // Accept invite
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session?.access_token) {
                    throw new Error('Failed to get session')
                  }

                  const response = await fetch('/api/invites/accept', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ token }),
                  })

                  if (!response.ok) {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to accept invite')
                  }

                  toast.success('Account created and invite accepted!')
                  router.push('/dashboard')
                } catch (error) {
                  console.error('Error:', error)
                  toast.error(error instanceof Error ? error.message : 'Failed to complete signup')
                } finally {
                  setAccepting(false)
                }
              }}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  // User is logged in
  if (!emailMatches) {
    return (
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Email Mismatch</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are currently logged in as <span className="font-semibold">{userEmail}</span>, but this invite is for{' '}
            <span className="font-semibold">{inviteDetails.email}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Please log out and log in with the correct account, or use the signup link.
          </p>
          <Button className="w-full" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join {inviteDetails.businessName}</CardTitle>
        <CardDescription>
          {inviteDetails.inviterName} invited you to join as a {inviteDetails.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm">
            <span className="font-semibold">You&apos;re logged in as:</span> {userEmail}
          </p>
          <p className="text-sm mt-2">
            <span className="font-semibold">Role:</span>{' '}
            <Badge variant={inviteDetails.role === 'admin' ? 'default' : 'secondary'}>
              {inviteDetails.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </p>
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={async () => {
            setAccepting(true)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (!session?.access_token) {
                throw new Error('Failed to get session')
              }

              const response = await fetch('/api/invites/accept', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ token }),
              })

              if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to accept invite')
              }

              toast.success('Invite accepted! Joining...')
              router.push('/dashboard')
            } catch (error) {
              console.error('Error:', error)
              toast.error(error instanceof Error ? error.message : 'Failed to accept invite')
            } finally {
              setAccepting(false)
            }
          }}
          disabled={accepting}
        >
          {accepting ? 'Accepting...' : 'Accept Invite'}
        </Button>
      </CardContent>
    </Card>
  )
}

interface SignupFormProps {
  email: string
  loading: boolean
  onSubmit: (data: { email: string; password: string; fullName: string }) => Promise<void>
}

function SignupForm({ email, loading, onSubmit }: SignupFormProps) {
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast.error('Please enter a password')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    await onSubmit({ email, password, fullName })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-muted"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Your name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Account & Join'}
      </Button>
    </form>
  )
}
