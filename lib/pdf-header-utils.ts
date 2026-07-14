import jsPDF from "jspdf"
import type { CompanyProfile } from "./supabase"

/**
 * Renders the single logo header layout for PDFs
 * Layout: Logo on left, vertical divider, company info on right
 * Address, Email, and Phone all stacked in a single left‑aligned column
 */
export function renderSingleLogoHeader(
  doc: jsPDF,
  companyProfile: CompanyProfile | null,
  startY: number,
  logoBase64: string | null,
  pageW: number,
  margin: number,
  themeRgb: [number, number, number]
): number {
  const [tr, tg, tb] = themeRgb
  let y = startY

  if (!companyProfile) return y

  // ----- LOGO -----
  const logoSize = 32
  const logoX = margin
  const logoY = y + 2
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoSize, logoSize)
  }

  // ----- VERTICAL DIVIDER -----
  const dividerX = logoX + logoSize + 4
  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.8)
  doc.line(dividerX, y, dividerX, y + 38)

  // ----- RIGHT SECTION (single column) -----
  const contentX = dividerX + 6
  const contentMaxW = pageW - contentX - margin

  // Company name
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(tr, tg, tb)
  const companyNameLines = doc.splitTextToSize(
    (companyProfile.company_name || "").toUpperCase(),
    contentMaxW
  )
  doc.text(companyNameLines, contentX, y + 4)

  // Tagline
  let contentY = y + 4 + (companyNameLines.length * 5) + 3
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  if (companyProfile.tagline) {
    const taglineLines = doc.splitTextToSize(companyProfile.tagline, contentMaxW)
    doc.text(taglineLines, contentX, contentY)
    contentY += taglineLines.length * 5 + 2
  }

  // ----- Address block -----
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)

  const addressLine = companyProfile.address || ""
  const locationLine = [companyProfile.city, companyProfile.state, companyProfile.zip_code]
    .filter(Boolean)
    .join(", ")
  const addrLines: string[] = []
  if (addressLine) addrLines.push(...doc.splitTextToSize(addressLine, contentMaxW))
  if (locationLine) addrLines.push(...doc.splitTextToSize(locationLine, contentMaxW))
  doc.text(addrLines, contentX, contentY)

  contentY += addrLines.length * 5 + 2

  // ----- Email -----
  if (companyProfile.email) {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Email:", contentX, contentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(40, 40, 40)
    const emailLines = doc.splitTextToSize(companyProfile.email, contentMaxW - 14)
    doc.text(emailLines, contentX + 14, contentY)
    contentY += emailLines.length * 5 + 2
  }

  // ----- Phone -----
  if (companyProfile.phone) {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Phone:", contentX, contentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(40, 40, 40)
    const phoneLines = doc.splitTextToSize(companyProfile.phone, contentMaxW - 14)
    doc.text(phoneLines, contentX + 14, contentY)
    contentY += phoneLines.length * 5 + 2
  }

  // ----- HORIZONTAL LINE -----
  const minHeaderBottom = startY + 38
  const contentHeaderBottom = contentY + 2
  y = Math.max(minHeaderBottom, contentHeaderBottom)

  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 4   // 🔽 reduced from 10 to 4 – less gap

  return y
}
