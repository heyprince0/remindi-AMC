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
  User, ChevronRight, ChevronLeft, CheckCircle2, Loader2,
  AlertCircle, QrCode,
} from "lucide-react"
import { toast } from "sonner"
import { CompanyProfileSettings } from "./company-profile"
import { StampSignatureSettings } from "@/components/stamp-signature-settings"
import {
  WHATSAPP_LANGUAGES, DEFAULT_WHATSAPP_LANGUAGE,
  normalizeWhatsAppLanguage, type WhatsAppLanguage
} from "@/lib/whatsapp-messages"
import { cn } from "@/lib/utils"
import { TechnicianAttendanceQr } from "@/components/technician-attendance-qr"

const SERVICE_TYPES = [
  'AC', 'Lift', 'RO Water Purifier', 'CCTV',
  'Pest Control', 'Generator', 'Fire Safety', 'UPS', 'Other'
]

type Tab = "company" | "preferences" | "attendance" | "account"

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
    id: "attendance",
    label: "Attendance QR",
    description: "Print & stick for technician check-ins",
    icon: <QrCode className="size-5" />,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
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

  useEffect(() => {
    const isDesktop = window.innerWidth >= 768
    if (isDesktop) setActiveTab("company")
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/login"); return }
    if (role && role !== "admin") {
      toast.error("You don't have permission to access Settings")
      router.push("/")
    }
  }, [authLoading, user, role, router])

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

  // ── Tab content renderer ──────────────────────────────────────────────────

  function renderTabContent(tab: Tab) {
    if (tab === "company") {
      return (
        <div className="flex flex-col gap-6">
          <CompanyProfileSettings />
          {orgId && <StampSignatureSettings orgId={orgId} />}
        </div>
      )
    }

    if (tab === "preferences") {
      return (
        <div className="flex flex-col gap-6">
          {/* WhatsApp language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Languages className="size-4" />
                WhatsApp Language
              </CardTitle>
              <CardDescription className="text-xs">
                Language used for automated reminder messages sent to your customers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {WHATSAPP_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setWaLanguage(lang.code as WhatsAppLanguage)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors",
                      waLanguage === lang.code
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {waLanguage === lang.code && <CheckCircle2 className="size-3.5 ml-1" />}
                  </button>
                ))}
              </div>
              <Button onClick={handleSaveLanguage} disabled={savingLang} className="w-full sm:w-auto">
                {savingLang ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                {savingLang ? 'Saving…' : 'Save Language'}
              </Button>
            </CardContent>
          </Card>

          {/* Service types */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Service Types</CardTitle>
              <CardDescription className="text-xs">
                Select the services your business provides.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map((service) => (
                  <button
                    key={service}
                    onClick={() => toggleService(service)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selectedServices.includes(service)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {service}
                  </button>
                ))}
              </div>
              <Button onClick={handleSaveServices} disabled={savingServices} className="w-full sm:w-auto">
                {savingServices ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                {savingServices ? 'Saving…' : 'Save Services'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    // ── ATTENDANCE QR TAB (NEW) ───────────────────────────────────────────
    if (tab === "attendance") {
      return (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5 text-orange-600" />
                Attendance QR Code
              </CardTitle>
              <CardDescription>
                Download and print this QR code. Stick it at your office or site entrance
                so technicians can scan it daily to log their attendance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orgId ? (
                <TechnicianAttendanceQr
                  orgId={orgId}
                  companyName={profile?.company_name ?? undefined}
                />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                  <span>Download and print the QR code above. Stick it at your entrance.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                  <span>Each technician opens the Remindi app, goes to their profile, and taps <strong className="text-foreground">Scan Attendance QR</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                  <span>They point the camera at the QR. Attendance is logged instantly — once per day per technician.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
                  <span>View full attendance records in <strong className="text-foreground">Attendance</strong> in the sidebar.</span>
                </li>
              </ol>
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
                <CardTitle className="text-base">Personal Information</CardTitle>
                <CardDescription className="text-xs">
                  Your name and contact details as the organisation owner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Your full name"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm">Phone</Label>
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
                  <span>Personal information settings are only available to the organisation owner.</span>
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

        {/* ════════ MOBILE ════════ */}
        <div className="md:hidden">
          {activeTab === null && (
            <div className="flex flex-col gap-1">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage your business profile and preferences
                </p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-card">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-secondary transition-colors"
                  >
                    <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", tab.iconBg)}>
                      <span className={tab.iconColor}>{tab.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tab.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{tab.description}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab !== null && (
            <div className="flex flex-col gap-4">
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
              <div className="flex items-center gap-3 pb-2">
                {activeTabMeta && (
                  <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", activeTabMeta.iconBg)}>
                    <span className={activeTabMeta.iconColor}>{activeTabMeta.icon}</span>
                  </div>
                )}
                <h1 className="text-xl font-bold text-foreground">{activeTabMeta?.label}</h1>
              </div>
              {renderTabContent(activeTab)}
            </div>
          )}
        </div>

        {/* ════════ DESKTOP ════════ */}
        <div className="hidden md:block">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your business profile and preferences
            </p>
          </div>

          <div className="flex gap-6 items-start">
            {/* Sidebar */}
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
                    activeTab === tab.id ? "bg-white/20" : tab.iconBg
                  )}>
                    <span className={cn(activeTab === tab.id ? "text-white" : tab.iconColor)}>
                      {tab.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium leading-none", activeTab === tab.id ? "text-primary-foreground" : "text-foreground")}>
                      {tab.label}
                    </p>
                    <p className={cn("text-xs mt-0.5 truncate", activeTab === tab.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {tab.description}
                    </p>
                  </div>
                  <ChevronRight className={cn("size-3.5 shrink-0 transition-opacity", activeTab === tab.id ? "opacity-100 text-primary-foreground" : "opacity-0 group-hover:opacity-60")} />
                </button>
              ))}
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              {activeTab && renderTabContent(activeTab)}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
