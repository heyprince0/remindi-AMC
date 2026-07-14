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

  // ----- LOGO (larger) -----
  const logoSize = 32   // increased for better visibility
  const logoX = margin
  const logoY = y + 2
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoSize, logoSize)
  }

  // ----- VERTICAL DIVIDER -----
  const dividerX = logoX + logoSize + 4
  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.8)
  doc.line(dividerX, y, dividerX, y + 38)  // taller to match content

  // ----- RIGHT SECTION: company name, tagline, address, contacts -----
  const contentX = dividerX + 6
  const contentMaxW = pageW - contentX - margin

  // Company name (larger)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(tr, tg, tb)
  const companyNameLines = doc.splitTextToSize(
    (companyProfile.company_name || "").toUpperCase(),
    contentMaxW
  )
  doc.text(companyNameLines, contentX, y + 4)

  // Tagline (larger, bold)
  let contentY = y + 4 + (companyNameLines.length * 5) + 3
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  if (companyProfile.tagline) {
    const taglineLines = doc.splitTextToSize(companyProfile.tagline, contentMaxW)
    doc.text(taglineLines, contentX, contentY)
    contentY += taglineLines.length * 5 + 2
  }

  // Address & contacts in a clean two‑column layout
  const col1Width = contentMaxW * 0.6
  const col2X = contentX + col1Width + 4

  // Left column: Address (normal weight, 9.5pt)
  doc.setFontSize(13)
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

  // Right column: Phone & Email (bold labels, normal values)
  let col2Y = contentY
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)

  if (companyProfile.phone) {
    doc.text("Phone:", col2X, col2Y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(40, 40, 40)
    doc.text(companyProfile.phone, col2X + 18, col2Y) // indent after label
    col2Y += 3.5
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
  }

  if (companyProfile.email) {
    doc.text("Email:", col2X, col2Y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(40, 40, 40)
    // Split email if too long for the column width
    const emailLines = doc.splitTextToSize(companyProfile.email, contentMaxW - (col2X - contentX))
    doc.text(emailLines, col2X + 18, col2Y)
    col2Y += emailLines.length * 3.5
  }

  // Update contentY to the maximum of left and right columns
  const leftBottom = contentY + addrLines.length * 5
  const rightBottom = col2Y
  contentY = Math.max(leftBottom, rightBottom) + 4

  // ----- HORIZONTAL LINE -----
  // Header bottom: ensure enough room (logo height is 32 + margins)
  const minHeaderBottom = startY + 38
  const contentHeaderBottom = contentY + 2
  y = Math.max(minHeaderBottom, contentHeaderBottom)

  doc.setDrawColor(tr, tg, tb)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 10  // space after the line

  return y
}
