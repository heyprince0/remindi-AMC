"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { supabase, type Profile, signOut } from "@/lib/supabase"
import {
  Save, LogOut, Languages, Building2, SlidersHorizontal,
  User, ChevronRight, CheckCircle2, Loader2, AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { CompanyProfileSettings } from "./company-profile"
import { StampSignatureSettings } from "@/components/stamp-signature-settings"
import {
  WHATSAPP_LANGUAGES, DEFAULT_WHATSAPP_LANGUAGE,
  normalizeWhatsAppLanguage, type WhatsAppLanguage
} from "@/lib/whatsapp-messages"
import { cn } from "@/lib/utils"

const SERVICE_TYPES = [
  'AC', 'Lift', 'RO Water Purifier', 'CCTV',
  'Pest Control', 'Generator', 'Fire Safety', 'UPS', 'Other'
]

type Tab = "company" | "preferences" | "account"

const TABS: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "company",
    label: "Company",
    icon: <Building2 className="size-4" />,
    description: "Profile, logo & stamp",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: <SlidersHorizontal className="size-4" />,
    description: "Language & services",
  },
  {
    id: "account",
    label: "Account",
    icon: <User className="size-4" />,
    description: "Personal info & logout",
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, role, loading: authLoading, orgId } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("company")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [waLanguage, setWaLanguage] = useState<WhatsAppLanguage>(DEFAULT_WHATSAPP_LANGUAGE)
  const [savingLang, setSavingLang] = useState(false)
  const [savingServices, setSavingServices] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Redirect non-admin users
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/login"); return }
    if (role && role !== "admin") {
      toast.error("You don't have permission to access Settings")
      router.push("/")
    }
  }, [authLoading, user, role, router])

  // Check ownership
  useEffect(() => {
    const checkOwnership = async () => {
      if (!orgId || !user) return
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', orgId)
          .maybeSingle()
        if (error) throw error
        setIsOwner(data?.owner_id === user.id)
      } catch (err) {
        console.error('Error checking ownership:', err)
        setIsOwner(false)
      }
    }
    checkOwnership()
  }, [orgId, user])

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        if (data) {
          setProfile(data as Profile)
          setFullName(data.full_name || "")
          setCompanyName(data.company_name || "")
          setPhone(data.phone || "")
          setCity(data.city || "")
          setSelectedServices(data.service_types || [])
          setWaLanguage(normalizeWhatsAppLanguage(data.whatsapp_language))
        }
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [user?.id])

  const handleSaveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          company_name: companyName,
          phone,
          city,
          service_types: selectedServices.length > 0 ? selectedServices : null,
        }, { onConflict: 'id' })
      if (error) throw error
      toast.success('Account details saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLanguage = async () => {
    if (!user?.id) return
    setSavingLang(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, whatsapp_language: waLanguage }, { onConflict: 'id' })
      if (error) throw error
      toast.success('WhatsApp language saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save language')
    } finally {
      setSavingLang(false)
    }
  }

  const handleSaveServices = async () => {
    if (!user?.id) return
    setSavingServices(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          service_types: selectedServices.length > 0 ? selectedServices : null,
        }, { onConflict: 'id' })
      if (error) throw error
      toast.success('Service types saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save services')
    } finally {
      setSavingServices(false)
    }
  }

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    )
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to logout')
      setLoggingOut(false)
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Loading settings…</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (role !== "admin") return null

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your business profile and preferences
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* ── Sidebar nav ── */}
          <nav className="w-full md:w-56 shrink-0">
            {/* Mobile: horizontal scroll row */}
            <div className="flex md:hidden gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Desktop: vertical list */}
            <div className="hidden md:flex flex-col gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full group",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "shrink-0",
                    activeTab === tab.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {tab.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium leading-none",
                      activeTab === tab.id ? "text-primary-foreground" : "text-foreground"
                    )}>
                      {tab.label}
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5 truncate",
                      activeTab === tab.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {tab.description}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    "size-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                    activeTab === tab.id && "opacity-100"
                  )} />
                </button>
              ))}
            </div>
          </nav>

          {/* ── Tab content ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* ── COMPANY TAB ── */}
            {activeTab === "company" && (
              <>
                <CompanyProfileSettings />
                <StampSignatureSettings />
              </>
            )}

            {/* ── PREFERENCES TAB ── */}
            {activeTab === "preferences" && (
              <div className="flex flex-col gap-6">

                {/* WhatsApp Language */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <Languages className="size-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">WhatsApp Message Language</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Default language for reminder messages sent to customers
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {WHATSAPP_LANGUAGES.map(l => (
                        <button
                          key={l.value}
                          type="button"
                          onClick={() => setWaLanguage(l.value)}
                          className={cn(
                            "relative flex flex-col items-start px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                            waLanguage === l.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-background hover:bg-secondary text-foreground"
                          )}
                        >
                          {waLanguage === l.value && (
                            <CheckCircle2 className="absolute top-1.5 right-1.5 size-3.5 text-primary" />
                          )}
                          <span className="text-base leading-none mb-1">{l.native}</span>
                          <span className="text-xs text-muted-foreground font-normal">{l.label ?? l.value}</span>
                        </button>
                      ))}
                    </div>
                    <Button onClick={handleSaveLanguage} disabled={savingLang} size="sm">
                      {savingLang ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Save className="mr-2 size-3.5" />}
                      {savingLang ? 'Saving…' : 'Save Language'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Service Types — visible to owner only, or show info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <SlidersHorizontal className="size-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Service Types</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Which services does your business offer?
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isOwner ? (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/60 text-sm text-muted-foreground">
                        <AlertCircle className="size-4 mt-0.5 shrink-0" />
                        <span>Only the organization owner can update service types.</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {SERVICE_TYPES.map(service => (
                            <button
                              key={service}
                              type="button"
                              onClick={() => toggleService(service)}
                              className={cn(
                                "relative px-2 py-2.5 rounded-lg border text-sm font-medium transition-all text-center",
                                selectedServices.includes(service)
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border bg-background hover:bg-secondary text-foreground"
                              )}
                            >
                              {selectedServices.includes(service) && (
                                <span className="absolute top-1 right-1">
                                  <CheckCircle2 className="size-3 text-primary" />
                                </span>
                              )}
                              {service}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedServices.length === 0
                            ? 'No services selected'
                            : `${selectedServices.length} service${selectedServices.length > 1 ? 's' : ''} selected`}
                        </p>
                        <Button onClick={handleSaveServices} disabled={savingServices} size="sm">
                          {savingServices ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Save className="mr-2 size-3.5" />}
                          {savingServices ? 'Saving…' : 'Save Services'}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── ACCOUNT TAB ── */}
            {activeTab === "account" && (
              <div className="flex flex-col gap-6">

                {/* Personal info — owner only */}
                {isOwner ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                          <User className="size-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Personal Information</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Visible to your team members
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="full-name" className="text-sm">Your Name</Label>
                        <Input
                          id="full-name"
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="company-name" className="text-sm">Company Name</Label>
                          <Input
                            id="company-name"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="Your company name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm">
                            Email
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(not editable)</span>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="bg-secondary/60 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                          <Input
                            id="phone"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+91 XXXXX XXXXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-sm">City</Label>
                          <Input
                            id="city"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            placeholder="Nashik"
                          />
                        </div>
                      </div>

                      <Button onClick={handleSaveProfile} disabled={saving} size="sm">
                        {saving ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Save className="mr-2 size-3.5" />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-6">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="size-4 mt-0.5 shrink-0" />
                        <span>Personal information settings are only available to the organization owner.</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Danger zone */}
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                    <CardDescription className="text-xs">
                      Actions here cannot be easily undone
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                      <div>
                        <p className="text-sm font-medium text-foreground">Sign out of your account</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You will be redirected to the login page
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="shrink-0"
                      >
                        {loggingOut
                          ? <Loader2 className="mr-2 size-3.5 animate-spin" />
                          : <LogOut className="mr-2 size-3.5" />}
                        {loggingOut ? 'Logging out…' : 'Log Out'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
