"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase, type DeliveryChallan } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"

export default function DeliveryChallansPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [rows, setRows] = useState<DeliveryChallan[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [profileDialog, setProfileDialog] = useState(false)
  const [deleteRow, setDeleteRow] = useState<DeliveryChallan | null>(null)

  useEffect(() => { if (user?.id) supabase.from("memberships").select("org_id").eq("user_id", user.id).single().then(({ data }) => setOrgId(data?.org_id ?? null)) }, [user?.id])
  useEffect(() => { if (!orgId) return; supabase.from("delivery_challans").select("*").eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).then(({ data, error }) => { if (error) toast.error("Failed to load delivery challans"); setRows((data as DeliveryChallan[]) || []); setLoading(false) }) }, [orgId])

  const filtered = useMemo(() => rows.filter(row => [row.challan_no, row.customer_name, row.subject].some(value => (value || "").toLowerCase().includes(search.toLowerCase()))), [rows, search])
  const newChallan = async () => {
    if (!orgId) return
    const { data, error } = await supabase.from("company_profile").select("company_name,address,phone").eq("org_id", orgId).maybeSingle()
    if (error || !data?.company_name?.trim() || !data.address?.trim() || !data.phone?.trim()) setProfileDialog(true)
    else router.push("/delivery-challans/new")
  }
  const remove = async () => { if (!deleteRow || !orgId) return; const { error } = await supabase.from("delivery_challans").update({ deleted_at: new Date().toISOString() }).eq("id", deleteRow.id).eq("org_id", orgId); if (error) toast.error("Failed to delete challan"); else { setRows(rows.filter(row => row.id !== deleteRow.id)); toast.success("Delivery challan deleted") }; setDeleteRow(null) }

  return <DashboardLayout><div className="flex flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Delivery Challans</h1><p className="text-muted-foreground">Create and manage delivery challans</p></div><Button onClick={newChallan}><Plus data-icon="inline-start" />New Challan</Button></div><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search challan, customer, or subject" value={search} onChange={e => setSearch(e.target.value)} /></div><Card><CardHeader><CardTitle>All Challans</CardTitle></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-muted-foreground">Loading delivery challans...</p> : filtered.length === 0 ? <p className="py-8 text-center text-muted-foreground">No delivery challans found.</p> : <><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Challan No</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Subject</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map(row => <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/delivery-challans/${row.id}`)}><TableCell className="font-medium">{row.challan_no}</TableCell><TableCell>{row.customer_name}</TableCell><TableCell>{new Date(row.challan_date).toLocaleDateString("en-IN")}</TableCell><TableCell>{row.subject || "-"}</TableCell><TableCell className="text-right" onClick={e => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => router.push(`/delivery-challans/${row.id}`)}><FileText />View</DropdownMenuItem><DropdownMenuItem onClick={() => router.push(`/delivery-challans/${row.id}/edit`)}><Pencil />Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => setDeleteRow(row)}><Trash2 />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-col gap-3 md:hidden">{filtered.map(row => <Card key={row.id} className="cursor-pointer" onClick={() => router.push(`/delivery-challans/${row.id}`)}><CardContent className="flex items-start justify-between gap-3 p-4"><div><p className="font-semibold">{row.challan_no}</p><p>{row.customer_name}</p><p className="text-sm text-muted-foreground">{row.subject || "No subject"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(row.challan_date).toLocaleDateString("en-IN")}</p></div><Badge variant="secondary">{row.status || "draft"}</Badge></CardContent></Card>)}</div></>}</CardContent></Card></div><AlertDialog open={!!deleteRow} onOpenChange={open => !open && setDeleteRow(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete delivery challan?</AlertDialogTitle><AlertDialogDescription>This will hide the challan from your list.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Dialog open={profileDialog} onOpenChange={setProfileDialog}><DialogContent><DialogHeader><DialogTitle>Complete your company profile</DialogTitle><DialogDescription>Add company name, address, and phone in Settings before creating a delivery challan.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setProfileDialog(false)}>Cancel</Button><Button asChild><Link href="/settings">Go to Settings</Link></Button></DialogFooter></DialogContent></Dialog></DashboardLayout>
}
