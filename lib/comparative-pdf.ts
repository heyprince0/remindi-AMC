import { PDFDocument } from "pdf-lib"

export async function mergePdfs(
  mainDocBytes: ArrayBuffer,
  attachedPageUrls: string[],
): Promise<Uint8Array> {
  const merged = await PDFDocument.load(mainDocBytes)

  for (const url of attachedPageUrls) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch attached PDF (${response.status})`)
    const source = await PDFDocument.load(await response.arrayBuffer())
    const pages = await merged.copyPages(source, source.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
  }

  return merged.save()
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
