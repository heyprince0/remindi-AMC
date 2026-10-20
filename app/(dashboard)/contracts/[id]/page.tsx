  // ── Shared PDF builder — same pattern as quotation page ────────────────────
  const buildContractReportPdf = async (): Promise<{ doc: jsPDF; filename: string } | null> => {
    if (!contract) return null

    const pageW = 210
    const margin = 15
    const [tr, tg, tb] = hexToRgb(profile?.theme_color ?? "#185FA5")

    // Load logo
    let logoBase64: string | null = null
    let logoFormat: "JPEG" | "PNG" = "PNG"
    if (profile?.logo_url) {
      try {
        const blob = await (await fetch(profile.logo_url)).blob()
        logoFormat = /jpe?g/i.test(blob.type) ? "JPEG" : "PNG"
        logoBase64 = await new Promise<string>((res, rej) => {
          const rd = new FileReader()
          rd.onloadend = () => res(rd.result as string)
          rd.onerror = rej
          rd.readAsDataURL(blob)
        })
      } catch { /* skip logo */ }
    }

    // Load stamp
    let stampBase64: string | null = null
    let stampFormat: "JPEG" | "PNG" = "PNG"
    if (profile?.stamp_url) {
      try {
        const blob = await (await fetch(profile.stamp_url, { cache: "no-store" })).blob()
        stampFormat = /jpe?g/i.test(blob.type) ? "JPEG" : "PNG"
        stampBase64 = await new Promise<string>((res, rej) => {
          const rd = new FileReader()
          rd.onloadend = () => res(rd.result as string)
          rd.onerror = rej
          rd.readAsDataURL(blob)
        })
      } catch { /* skip stamp */ }
    }

    const freqMonths = Math.max(1, Math.round((contract.frequency_days || 30) / 30))
    const sortedHistory = serviceHistory.slice().sort((a, b) =>
      String(b.service_date || "").localeCompare(String(a.service_date || ""))
    )

    const renderReport = (doc: jsPDF): number => {
      let y = margin

      if (profile) {
        y = renderSingleLogoHeader(doc, profile, y, logoBase64, pageW, margin, [tr, tg, tb])
      } else {
        y += 12
      }

      // Title
      doc.setFontSize(15)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(tr, tg, tb)
      doc.text("CONTRACT SERVICE REPORT", pageW - margin, y, { align: "right" })

      y += 5
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80)
      
      // Removed the Ref number here, just showing Generated Date right-aligned
      doc.text(
        "Generated: " + new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        pageW - margin, y, { align: "right" }
      )
      y += 3
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(0.4)
      doc.line(margin, y, pageW - margin, y)
      y += 6

      // Contract & customer details
      autoTable(doc, {
        startY: y,
        head: [["CONTRACT & CUSTOMER DETAILS", ""]],
        body: [
          ["Contract Name", safeStr(contract.contract_name)],
          ["Customer", safeStr(contract.customerName)],
          ["Phone", safeStr(customer?.phone)],
          ["Location", safeStr(contract.location)],
          ["Frequency", `Every ${freqMonths} month${freqMonths !== 1 ? "s" : ""}`],
          ["Price", contract.contracts_price != null ? `Rs. ${Number(contract.contracts_price).toLocaleString("en-IN")}` : "—"],
          ["Status", contract.status],
        ],
        theme: "grid",
        headStyles: { fillColor: [tr, tg, tb], textColor: 255, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: "bold", fillColor: [248, 250, 252] },
          1: { cellWidth: "auto" },
        },
        margin: { left: margin, right: margin },
      })
      y = (doc as any).lastAutoTable.finalY + 6

      // Dates strip
      autoTable(doc, {
        startY: y,
        head: [["LAST SERVICE", "NEXT SERVICE", "CONTRACT END"]],
        body: [[
          formatDate(contract.start_date),
          formatDate(contract.next_service_date),
          formatDate(contract.endDate),
        ]],
        theme: "grid",
        headStyles: { fillColor: [tr, tg, tb], textColor: 255, fontSize: 9, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40], halign: "center" },
        margin: { left: margin, right: margin },
      })
      y = (doc as any).lastAutoTable.finalY + 6

      // Notes
      if (contract.notes) {
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(tr, tg, tb)
        doc.text("NOTES", margin, y)
        y += 4
        doc.setFont("helvetica", "normal")
        doc.setTextColor(80, 80, 80)
        const lines = doc.splitTextToSize(String(contract.notes), pageW - 2 * margin)
        doc.text(lines, margin, y)
        y += lines.length * 4 + 4
      }

      // Service history
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(tr, tg, tb)
      doc.text("SERVICE HISTORY", margin, y)
      y += 3

      if (sortedHistory.length === 0) {
        y += 4
        doc.setFont("helvetica", "italic")
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text("No service records for this contract yet.", margin, y)
        y += 6
      } else {
        autoTable(doc, {
          startY: y,
          head: [["DATE", "TECHNICIAN", "STATUS", "NOTES"]],
          body: sortedHistory.map(r => [
            formatDate(r.service_date),
            safeStr(r.technicianName),
            String(r.status || "").charAt(0).toUpperCase() + String(r.status || "").slice(1),
            safeStr(r.notes || "—"),
          ]),
          theme: "striped",
          headStyles: { fillColor: [tr, tg, tb], textColor: 255, fontSize: 9, fontStyle: "bold" },
          bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 42 },
            2: { cellWidth: 28 },
            3: { cellWidth: "auto" },
          },
          margin: { left: margin, right: margin },
        })
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // Signature block
      let sigY = y + 6
      if (stampBase64) {
        doc.addImage(stampBase64, stampFormat, pageW - margin - 30, sigY, 30, 30)
        sigY += 32
      } else {
        sigY += 10
      }

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.4)
      doc.line(pageW - margin - 45, sigY, pageW - margin, sigY)
      sigY += 4
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(120, 120, 120)
      doc.text("Authorized Signatory", pageW - margin, sigY, { align: "right" })
      doc.text(safeStr(profile?.company_name || senderName), pageW - margin, sigY + 3.5, { align: "right" })

      const footerY = sigY + 12
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text("Generated by Remindi · remindi.online", pageW / 2, footerY, { align: "center" })
      return footerY + 6
    }

    // Measure then render — same trick as quotation
    const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
    const measuredHeight = Math.max(renderReport(scratch), 100)
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, measuredHeight] })
    renderReport(doc)

    const safeName = (contract.contract_name || "contract").replace(/[^a-z0-9]/gi, "_")
    return { doc, filename: `Contract-Report-${safeName}.pdf` }
  }
