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
  User, ChevronRight, ChevronLeft, CheckCircle2, Loader2, AlertCircle
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

const TABS: {
  id: Tab
  label: string
  description: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
}[] = [
  {
    id: "company",
    label: "Company",
    description: "Profile, logo & stamp",
    icon: <Building2 className="size-5" />,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "WhatsApp language & service types",
    icon: <SlidersHorizontal className="size-5" />,
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    id: "account",
    label: "Account",
    description: "Personal info & logout",
    icon: <User className="size-5" />,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, role, loading: authLoading, orgId } = useAuth()

  // Desktop: activeTab always set. Mobile: null = show menu list
  const [activeTab, setActiveTab] = useState<Tab | null>(null)

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

  // Set desktop default on mount only (avoids SSR mismatch)
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768
    if (isDesktop) setActiveTab("company")
  }, [])

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

  // ── Tab content (shared between mobile & desktop) ──
  const renderTabContent = (tab: Tab) => {
    if (tab === "company") {
      return (
        <>
          <CompanyProfileSettings />
          <StampSignatureSettings />
        </>
      )
    }

    if (tab === "preferences") {
      return (
        <div className="flex flex-col gap-6">
          {/* WhatsApp Language */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Languages className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-base">WhatsApp Language</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Language for reminder messages sent to customers
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
                      "relative flex flex-col items-start px-3 py-3 rounded-xl border text-sm font-medium transition-all",
                      waLanguage === l.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background active:bg-secondary text-foreground"
                    )}
                  >
                    {waLanguage === l.value && (
                      <CheckCircle2 className="absolute top-2 right-2 size-3.5 text-primary" />
                    )}
                    <span className="text-lg leading-none mb-1">{l.native}</span>
                    <span className="text-xs text-muted-foreground font-normal">{l.label ?? l.value}</span>
                  </button>
                ))}
              </div>
              <Button onClick={handleSaveLanguage} disabled={savingLang} className="w-full sm:w-auto">
                {savingLang ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                {savingLang ? 'Saving…' : 'Save Language'}
              </Button>
            </CardContent>
          </Card>

          {/* Service Types */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="size-5 text-blue-600 dark:text-blue-400" />
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
                <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/60 text-sm text-muted-foreground">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>Only the organization owner can update service types.</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SERVICE_TYPES.map(service => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={cn(
                          "relative px-3 py-3 rounded-xl border text-sm font-medium transition-all text-left",
                          selectedServices.includes(service)
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-background active:bg-secondary text-foreground"
                        )}
                      >
                        {selectedServices.includes(service) && (
                          <CheckCircle2 className="absolute top-2 right-2 size-3 text-primary" />
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
                  <Button onClick={handleSaveServices} disabled={savingServices} className="w-full sm:w-auto">
                    {savingServices ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                    {savingServices ? 'Saving…' : 'Save Services'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    if (tab === "account") {
      return (
        <div className="flex flex-col gap-6">
          {isOwner ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <User className="size-5 text-purple-600 dark:text-purple-400" />
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
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-sm">Company Name</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm flex items-center gap-1.5">
                    Email
                    <span className="text-xs text-muted-foreground font-normal">(not editable)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="h-11 bg-secondary/60 cursor-not-allowed"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Nashik"
                      className="h-11"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
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

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              <CardDescription className="text-xs">
                Actions here affect your access immediately
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="text-sm font-medium text-foreground">Sign out of your account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You will be redirected to the login page
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full sm:w-auto h-11 sm:h-9"
                >
                  {loggingOut
                    ? <Loader2 className="mr-2 size-4 animate-spin" />
                    : <LogOut className="mr-2 size-4" />}
                  {loggingOut ? 'Logging out…' : 'Log Out'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  const activeTabMeta = TABS.find(t => t.id === activeTab)

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">

        {/* ════════════════════════════════════════
            MOBILE LAYOUT
            ════════════════════════════════════════ */}
        <div className="md:hidden">

          {/* Mobile — Menu list (no tab selected) */}
          {activeTab === null && (
            <div className="flex flex-col gap-1">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage your business profile and preferences
                </p>
              </div>

              {/* Settings menu rows — iOS-style */}
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-card">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-secondary transition-colors"
                  >
                    {/* Icon */}
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center shrink-0",
                      tab.iconBg
                    )}>
                      <span className={tab.iconColor}>{tab.icon}</span>
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tab.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{tab.description}</p>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mobile — Tab content view (tab selected) */}
          {activeTab !== null && (
            <div className="flex flex-col gap-4">
              {/* Back header */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="flex items-center gap-1 text-primary text-sm font-medium py-1 -ml-1"
                >
                  <ChevronLeft className="size-4" />
                  Settings
                </button>
              </div>

              {/* Section title */}
              <div className="flex items-center gap-3 pb-2">
                {activeTabMeta && (
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center shrink-0",
                    activeTabMeta.iconBg
                  )}>
                    <span className={activeTabMeta.iconColor}>{activeTabMeta.icon}</span>
                  </div>
                )}
                <h1 className="text-xl font-bold text-foreground">{activeTabMeta?.label}</h1>
              </div>

              {/* Content */}
              {renderTabContent(activeTab)}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════
            DESKTOP LAYOUT
            ════════════════════════════════════════ */}
        <div className="hidden md:block">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your business profile and preferences
            </p>
          </div>

          <div className="flex gap-6 items-start">
            {/* Desktop sidebar */}
            <nav className="w-56 shrink-0 flex flex-col gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors w-full group",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    activeTab === tab.id
                      ? "bg-white/20"
                      : tab.iconBg
                  )}>
                    <span className={cn(
                      activeTab === tab.id ? "text-white" : tab.iconColor
                    )}>
                      {tab.icon}
                    </span>
                  </div>
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
                    "size-3.5 shrink-0 transition-opacity",
                    activeTab === tab.id ? "opacity-100 text-primary-foreground" : "opacity-0 group-hover:opacity-60"
                  )} />
                </button>
              ))}
            </nav>

            {/* Desktop content */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              {activeTab && renderTabContent(activeTab)}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
