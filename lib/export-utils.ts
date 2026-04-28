
// lib/export-utils.ts — Exportação CSV e PDF (usa xlsx + jspdf já instalados)

// ── CSV Export ────────────────────────────────────────────────
export function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── CSV Import ────────────────────────────────────────────────
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

// ── PDF Export (jspdf + autotable) ───────────────────────────
export async function exportPDF(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][][],
  footerLines?: string[]
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFillColor(8, 11, 20)
  doc.rect(0, 0, 297, 40, 'F')
  doc.setTextColor(245, 158, 11)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(160, 160, 180)
  doc.text(subtitle, 14, 26)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 33)

  // Table
  autoTable(doc, {
    head: [headers],
    body: rows as any,
    startY: 45,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 40] },
    headStyles: { fillColor: [8, 11, 20], textColor: [245, 158, 11], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  })

  // Footer
  if (footerLines?.length) {
    const finalY = (doc as any).lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 120)
    footerLines.forEach((l, i) => doc.text(l, 14, finalY + i * 6))
  }

  doc.save(filename)
}
