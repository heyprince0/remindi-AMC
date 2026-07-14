import jsPDF from "jspdf"
import type { CompanyProfile } from "./supabase"

/**
 * Renders the single logo header layout for PDFs
 * Layout: Logo on left, vertical divider, company info on right
 * Address + Email in left column, Phone in right column
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

  // ----- RIGHT SECTION -----
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

  // ----- TWO-COLUMN LAYOUT -----
  const col1Width = contentMaxW * 0.6
  const col2X = contentX + col1Width + 4

  // Left column: Address + Email
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)

  const addressLine = companyProfile.address || ""
  const locationLine = [companyProfile.city, companyProfile.state, companyProfile.zip_code]
    .filter(Boolean)
    .join(", ")
  const addrLines: string[] = []
  if (addressLine) addrLines.push(...doc.splitTextToSize(addressLine, col1Width))
  if (locationLine) addrLines.push(...doc.splitTextToSize(locationLine, col1Width))
  doc.text(addrLines, contentX, contentY)

  // Email (just below the address)
  let leftBottom = contentY + addrLines.length * 5
  if (companyProfile.email) {
    leftBottom += 2 // small gap before email
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Email:", contentX, leftBottom)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(40, 40, 40)
    const emailLines = doc.splitTextToSize(companyProfile.email, col1Width - 12) // 12mm indent for "Email:"
    doc.text(emailLines, contentX + 12, leftBottom) // indent after label
    leftBottom += emailLines.length * 5
  }

  // Right column: Phone (only)
  let col2Y = contentY
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  if (companyProfile.phone) {
    doc.text("Phone:", col2X, col2Y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(40, 40, 40)
    const phoneLines = doc.splitTextToSize(companyProfile.phone, contentMaxW - (col2X - contentX) - 12)
    doc.text(phoneLines, col2X + 12, col2Y)
    col2Y += phoneLines.length * 5
  }

  // Determine the bottom of the content (tallest column)
  const rightBottom = col2Y
  contentY = Math.max(leftBottom, rightBottom) + 4

  // ----- HORIZONTAL LINE -----
  const minHeaderBottom = startY + 38
  const contentHeaderBottom = contentY + 2
  y = Math.max(minHeaderBottom, contentHeaderBottom)

  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 10   // 👈 gap after the line (changed from 6 to 10)

  return y
}
