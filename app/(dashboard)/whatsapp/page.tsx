'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Info, Loader2, MessageCircle, ShieldCheck, Unplug } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

type Account = { whatsapp_number: string | null; status: string | null; connected_at: string | null }
type Log = { id: string; customer_name: string | null; customer_phone: string | null; status: string | null; created_at: string | null; error_message: string | null }
type Stats = { total_sent: number; delivered: number; failed: number }

const template = 'Hi {{customer_name}}, your {{service_type}} service has been completed on {{completion_date}}. Thank you for choosing {{business_name}} for your service needs.'

export default function WhatsAppPage() {
  const { user } = useAuth()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [stats, setStats] = useState<Stats>({ total_sent: 0, delivered: 0, failed: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState('')

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true); setError(null)
    const { data: membership, error: membershipError } = await supabase.from('memberships').select('org_id').eq('user_id', user.id).limit(1).single()
    if (membershipError || !membership?.org_id) { setError('Could not determine your organization.'); setLoading(false); return }
    setOrgId(membership.org_id)
    const { data: waAccount, error: accountError } = await supabase.from('whatsapp_accounts').select('whatsapp_number,status,connected_at').eq('org_id', membership.org_id).maybeSingle()
    if (accountError) { setError('Could not load WhatsApp connection.'); setLoading(false); return }
    setAccount(waAccount)
    if (waAccount?.status === 'active') {
      const [{ data: logData }, { data: statData }] = await Promise.all([
        supabase.from('whatsapp_logs').select('id,customer_name,customer_phone,status,created_at,error_message').eq('org_id', membership.org_id).order('created_at', { ascending: false }).limit(10),
        supabase.from('whatsapp_logs_stats').select('total_sent,delivered,failed').eq('org_id', membership.org_id).maybeSingle(),
      ])
      setLogs((logData as Log[]) || [])
      if (statData) setStats({ total_sent: Number(statData.total_sent || 0), delivered: Number(statData.delivered || 0), failed: Number(statData.failed || 0) })
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadData() }, [loadData])

  const postOtp = async (path: string, body: object) => {
    setSubmitting(true); setDialogError('')
    try { const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Something went wrong'); return result } catch (e) { setDialogError(e instanceof Error ? e.message : 'Something went wrong'); return null } finally { setSubmitting(false) }
  }

  const sendOtp = async () => { if (!orgId) return; const result = await postOtp('/api/whatsapp/initiate-otp', { orgId, phoneNumber: `+91${phone}` }); if (result) setStep(2) }
  const verifyOtp = async () => { if (!orgId) return; const result = await postOtp('/api/whatsapp/verify-otp', { orgId, phoneNumber: `+91${phone}`, otp }); if (result) { setDialogOpen(false); toast.success('WhatsApp Connected!'); loadData() } }
  const disconnect = async () => { if (!orgId) return; const { error: updateError } = await supabase.from('whatsapp_accounts').update({ status: 'disconnected' }).eq('org_id', orgId); if (updateError) toast.error('Could not disconnect WhatsApp'); else { toast.success('WhatsApp disconnected'); setDisconnectOpen(false); loadData() } }

  if (loading) return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8"><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-96" /><Skeleton className="h-80 w-full" /></main>
  if (error) return <main className="mx-auto max-w-6xl p-8"><Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card></main>

  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex items-center gap-2"><MessageCircle className="size-7 text-[#25D366]" /><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">WhatsApp Automation</h1></div><p className="text-muted-foreground">Automatically notify your customers when their service is completed</p></div><Badge className="w-fit bg-[#25D366]/15 text-[#159447] hover:bg-[#25D366]/20"><ShieldCheck className="mr-1 size-3" />Powered by WhatsApp Business</Badge></header>
    {!account || account.status !== 'active' ? <Card className="mx-auto w-full max-w-2xl"><CardContent className="flex flex-col items-center gap-5 p-6 text-center md:p-10"><div className="flex size-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20"><MessageCircle className="size-8" /></div><div><h2 className="text-xl font-semibold">Start Sending WhatsApp Notifications</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">Connect your WhatsApp Business number and automatically notify customers when their service is completed</p></div><div className="w-full rounded-xl bg-[#25D366]/10 p-4 text-left"><p className="mb-2 text-xs font-medium text-[#159447]">Your customers will receive this message:</p><div className="max-w-md rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">Hi Rahul, your RO Service has been completed on 28 July 2026. Thank you for choosing Sharma RO Services for your service needs.</div></div><Button className="bg-[#25D366] text-white hover:bg-[#1ebc5b]" onClick={() => { setDialogOpen(true); setStep(1); setDialogError('') }}>Connect WhatsApp Number</Button></CardContent></Card> : <ConnectedView account={account} stats={stats} logs={logs} onDisconnect={() => setDisconnectOpen(true)} />}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{step === 1 ? 'Connect Your WhatsApp Number' : 'Enter Verification Code'}</DialogTitle><DialogDescription>{step === 1 ? 'Enter the WhatsApp Business number you want to send notifications from' : `Check your WhatsApp for the OTP we sent to +91${phone}`}</DialogDescription></DialogHeader>{step === 1 ? <div className="flex flex-col gap-4"><div className="flex items-center rounded-md border"><span className="px-3 text-sm text-muted-foreground">+91</span><Input className="border-0 shadow-none focus-visible:ring-0" inputMode="numeric" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" /></div>{dialogError && <p className="text-sm text-destructive">{dialogError}</p>}<Button disabled={phone.length !== 10 || submitting} onClick={sendOtp} className="bg-[#25D366] text-white hover:bg-[#1ebc5b]">{submitting && <Loader2 className="mr-2 size-4 animate-spin" />}Send OTP</Button></div> : <div className="flex flex-col gap-4"><Input className="text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />{dialogError && <p className="text-sm text-destructive">{dialogError}</p>}<Button disabled={otp.length !== 6 || submitting} onClick={verifyOtp} className="bg-[#25D366] text-white hover:bg-[#1ebc5b]">{submitting && <Loader2 className="mr-2 size-4 animate-spin" />}Verify & Connect</Button><Button variant="ghost" onClick={() => { setStep(1); setDialogError('') }}>Back</Button></div>}</DialogContent></Dialog>
    <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will disconnect your WhatsApp number and stop all notifications</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={disconnect}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>
}

function ConnectedView({ account, stats, logs, onDisconnect }: { account: Account; stats: Stats; logs: Log[]; onDisconnect: () => void }) {
  return <div className="flex flex-col gap-6"><Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-[#25D366]/15 text-[#159447]"><MessageCircle className="size-5" /></div><div><div className="flex items-center gap-2"><Badge className="bg-[#25D366] text-white hover:bg-[#25D366]"><CheckCircle2 className="mr-1 size-3" />Connected</Badge><span className="font-medium">{account.whatsapp_number}</span></div><p className="mt-1 text-sm text-muted-foreground">Connected on {account.connected_at ? format(new Date(account.connected_at), 'dd MMM yyyy') : '—'}</p></div></div><Button variant="outline" className="w-fit border-destructive text-destructive hover:bg-destructive/10" onClick={onDisconnect}><Unplug className="mr-2 size-4" />Disconnect</Button></CardContent></Card><div className="grid gap-4 sm:grid-cols-3">{[['Total Sent', stats.total_sent], ['Delivered', stats.delivered], ['Failed', stats.failed]].map(([label, value]) => <Card key={label as string}><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl">{value}</CardTitle></CardHeader></Card>)}</div><Card><CardHeader><CardTitle>Recent Notifications</CardTitle><CardDescription>Your latest automated customer messages</CardDescription></CardHeader><CardContent>{logs.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No messages sent yet. Messages will appear here after your first service completion.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{logs.map(log => <TableRow key={log.id}><TableCell className="font-medium">{log.customer_name || '—'}</TableCell><TableCell>{log.customer_phone || '—'}</TableCell><TableCell><Badge variant="outline" className={log.status === 'failed' ? 'border-destructive text-destructive' : 'border-[#25D366] text-[#159447]'}>{log.status || '—'}</Badge></TableCell><TableCell>{log.created_at ? format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a') : '—'}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card><Card><CardHeader><CardTitle>Message Template</CardTitle><CardDescription>This message is sent automatically when a service is marked complete</CardDescription></CardHeader><CardContent><div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{template}</div><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Info className="size-3" />To change this template, contact support</p></CardContent></Card><Card className="border-destructive/40"><CardHeader><CardTitle className="text-destructive">Disconnect WhatsApp</CardTitle><CardDescription>This will stop all automatic WhatsApp notifications to your customers</CardDescription></CardHeader><CardContent><Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={onDisconnect}>Disconnect Number</Button></CardContent></Card></div>
}
