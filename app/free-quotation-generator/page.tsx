      // ══════════════════════════════════════════════════════════════════
      //  HEADER — single logo style (identical to paid quotation)
      // ══════════════════════════════════════════════════════════════════
      let logoAdded = false
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, logoFormat, margin, y, 22, 22)
          logoAdded = true
        } catch { /* skip */ }
      }

      const infoX = logoAdded ? margin + 24 : margin

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text((bio.company_name || "Company Name").toUpperCase(), infoX, y + 2)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(120, 120, 120)

      let infoY = y + 8
      if (bio.tagline) { doc.text(bio.tagline, infoX, infoY); infoY += 4 }
      if (bio.address) {
        const addrLines = doc.splitTextToSize(bio.address, pageW - infoX - margin)
        doc.text(addrLines, infoX, infoY)
        infoY += addrLines.length * 4
      }
      const cityLine = [bio.city, bio.state, bio.zip_code].filter(Boolean).join(", ")
      if (cityLine) { doc.text(cityLine, infoX, infoY); infoY += 4 }
      if (bio.phone) { doc.text(`Phone: ${bio.phone}`, infoX, infoY); infoY += 4 }
      if (bio.email) { doc.text(`Email: ${bio.email}`, infoX, infoY); infoY += 4 }
      if (bio.gstin) { doc.text(`GSTIN: ${bio.gstin}`, infoX, infoY) }

      y += 31

      // Theme-coloured separator line
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageW - margin, y)
      y += 6
