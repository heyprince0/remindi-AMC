import jsPDF from "jspdf"
import type { CompanyProfile } from "./supabase"

/**
 * Renders the single logo header layout for PDFs
 * Layout: Logo on left, vertical divider, company info on right
 * Address in left column, Phone + Email in right column
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
  const logoSize = 30
  const logoX = margin
  const logoY = y + 2
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoSize, logoSize)
  }

  // ----- VERTICAL DIVIDER (drawn after full height is known, see below) -----
  const dividerX = logoX + logoSize + 5

  // ----- RIGHT SECTION: company name, tagline, address, contacts -----
  const contentX = dividerX + 6
  const contentMaxW = pageW - contentX - margin

  // Company name
  doc.setFontSize(17)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(tr, tg, tb)
  const companyNameLines = doc.splitTextToSize(
    (companyProfile.company_name || "").toUpperCase(),
    contentMaxW
  )
  doc.text(companyNameLines, contentX, y + 5)

  // Tagline — slightly muted grey, italic, so it doesn't compete with the name
  let contentY = y + 5 + (companyNameLines.length * 5.5) + 3
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(90, 90, 90)
  if (companyProfile.tagline) {
    const taglineLines = doc.splitTextToSize(companyProfile.tagline, contentMaxW)
    doc.text(taglineLines, contentX, contentY)
    contentY += taglineLines.length * 4.5 + 3.5
  }

  // Thin hairline separating tagline from contact details, for visual rhythm
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.2)
  doc.line(contentX, contentY - 1.5, pageW - margin, contentY - 1.5)

  // Address & contacts — clean two-column layout
  const col1Width = contentMaxW * 0.58
  const col2X = contentX + col1Width + 6
  const labelColW = 14 // fixed width for "PHONE" / "EMAIL" labels so values align

  // Left column: Address
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(70, 70, 70)

  const addressLine = companyProfile.address || ""
  const locationLine = [companyProfile.city, companyProfile.state, companyProfile.zip_code]
    .filter(Boolean)
    .join(", ")
  const addrLines: string[] = []
  if (addressLine) addrLines.push(...doc.splitTextToSize(addressLine, col1Width))
  if (locationLine) addrLines.push(...doc.splitTextToSize(locationLine, col1Width))
  doc.text(addrLines, contentX, contentY, { lineHeightFactor: 1.35 })

  // Right column: Phone & Email — bold small-caps labels in theme color, aligned values
  let col2Y = contentY
  const rightRowGap = 5

  if (companyProfile.phone) {
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(tr, tg, tb)
    doc.text("PHONE", col2X, col2Y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(70, 70, 70)
    doc.text(companyProfile.phone, col2X + labelColW, col2Y)
    col2Y += rightRowGap
  }

  if (companyProfile.email) {
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(tr, tg, tb)
    doc.text("EMAIL", col2X, col2Y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(70, 70, 70)
    const emailLines = doc.splitTextToSize(
      companyProfile.email,
      pageW - margin - (col2X + labelColW)
    )
    doc.text(emailLines, col2X + labelColW, col2Y)
    col2Y += emailLines.length * 4.5
  }

  // Settle final content bottom from both columns
  const leftBottom = contentY + addrLines.length * 4.7
  const rightBottom = col2Y
  contentY = Math.max(leftBottom, rightBottom) + 5

  // ----- HEADER BOTTOM / DIVIDER LINE -----
  const minHeaderBottom = startY + 38
  const contentHeaderBottom = contentY + 2
  y = Math.max(minHeaderBottom, contentHeaderBottom)

  // Vertical divider drawn last, now that final header height is known,
  // so it spans the full header instead of a fixed guessed height
  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.6)
  doc.line(dividerX, startY, dividerX, y - 3)

  // Bottom accent rule — slightly thicker for a polished, branded finish
  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.7)
  doc.line(margin, y, pageW - margin, y)
  y += 6 // breathing room before the next section

  return y
}
