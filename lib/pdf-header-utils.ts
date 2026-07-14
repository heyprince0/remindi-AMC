import jsPDF from "jspdf"
import type { CompanyProfile } from "./supabase"

/**
 * Renders the single logo header layout for PDFs
 * Layout: Logo on left, vertical divider, company info on right, contact strip at bottom
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

  if (!companyProfile) {
    return y
  }

  // ===== LEFT SECTION: LOGO =====
  const logoSize = 28 // Logo width in mm
  const logoX = margin
  const logoY = y + 3

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoSize, logoSize)
  }

  // ===== VERTICAL DIVIDER =====
  const dividerX = logoX + logoSize + 3
  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.8)
  doc.line(dividerX, y, dividerX, y + 34)

  // ===== RIGHT SECTION: TEXT CONTENT =====
  const contentX = dividerX + 4
  const contentMaxW = pageW - contentX - margin

  // Company name (ALL CAPS, bold, large, in theme color)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(tr, tg, tb)
  const companyNameLines = doc.splitTextToSize(
    (companyProfile.company_name || "").toUpperCase(),
    contentMaxW
  )
  doc.text(companyNameLines, contentX, y + 4)

  // Tagline (below company name, bold, black, smaller)
  let contentY = y + 4 + (companyNameLines.length * 4) + 2
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  if (companyProfile.tagline) {
    const taglineLines = doc.splitTextToSize(companyProfile.tagline, contentMaxW)
    doc.text(taglineLines, contentX, contentY)
    contentY += taglineLines.length * 4 + 2
  }

  // Specialization / services line (e.g. "Specialist in: ...")
  const specialization = (companyProfile as any).specialization || (companyProfile as any).services
  if (specialization) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    const specText = `Specialist in: ${specialization}`
    const specLines = doc.splitTextToSize(specText, contentMaxW)
    doc.text(specLines, contentX, contentY)
    contentY += specLines.length * 4 + 2
  }

  // Certification / approval badge line (e.g. "GOVERNMENT APPROVED")
  const certification = (companyProfile as any).certification || (companyProfile as any).approval_badge
  if (certification) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    const certText = String(certification).toUpperCase()
    const certWidth = doc.getTextWidth(certText)
    // Center within the full header width, like the reference design
    const certX = margin + (pageW - margin * 2 - certWidth) / 2
    doc.text(certText, certX, contentY)
    contentY += 6
  }

  // ===== HORIZONTAL RULE =====
  // Header height is dynamic: at least 36mm (to fit the logo), but grows if
  // extra content (specialization/certification lines) needs more room.
  const minHeaderBottom = y + 36
  const contentHeaderBottom = contentY + 2
  y = Math.max(minHeaderBottom, contentHeaderBottom)
  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 4

  // ===== FOOTER STRIP: 2-COLUMN LAYOUT =====
  const footerLeftX = margin
  const footerRightX = pageW / 2 + 5 // Right column starts at midpage

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)

  let footerY = y

  // LEFT COLUMN: Address & Email
  if (companyProfile.address) {
    doc.text(companyProfile.address, footerLeftX, footerY)
    footerY += 3
  }

  const locationStr = [companyProfile.city, companyProfile.state, companyProfile.zip_code]
    .filter(Boolean)
    .join(", ")
  if (locationStr) {
    doc.text(locationStr, footerLeftX, footerY)
    footerY += 3
  }

  if (companyProfile.email) {
    doc.setTextColor(80, 80, 80)
    doc.text(`Email: ${companyProfile.email}`, footerLeftX, footerY)
    footerY += 3
  }

  // RIGHT COLUMN: Contacts & Website
  let footerRightY = y

  // Contact persons (up to 2, stacked vertically)
  // For now, we'll show the phone number if available
  if (companyProfile.phone) {
    doc.setTextColor(40, 40, 40)
    doc.setFont("helvetica", "bold")
    doc.text("Contact:", footerRightX, footerRightY)
    footerRightY += 3

    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    doc.text(companyProfile.phone, footerRightX, footerRightY)
    footerRightY += 3
  }

  // Website
  if (companyProfile.email) {
    // Try to extract domain or show a generic "Web" label
    doc.setTextColor(80, 80, 80)
    const domain = companyProfile.email.split("@")[1] || ""
    if (domain) {
      doc.text(`Web: www.${domain.replace("gmail.com", "company.com")}`, footerRightX, footerRightY)
    }
  }

  // ===== RETURN NEW Y POSITION =====
  return y + 10
}
