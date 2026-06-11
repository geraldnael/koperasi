/**
 * printElement — cetak konten elemen tertentu di window baru (tanpa sidebar/menu).
 * Otomatis mendeteksi apakah konten berupa tabel lebar (landscape) atau laporan sempit (portrait).
 */
export function printElement(elementId: string, title = '', subtitle = '') {
  const el = document.getElementById(elementId)
  if (!el) { alert(`Area cetak #${elementId} tidak ditemukan.`); return }

  // Klona & bersihkan elemen interaktif
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.no-print, button, input, select').forEach(e => e.remove())
  // Tampilkan elemen khusus print
  clone.querySelectorAll('.print-only').forEach(e => (e as HTMLElement).style.display = 'inline')

  // Deteksi apakah tabel lebar → landscape, laporan sempit → portrait
  const hasWideTable = el.querySelector('table') !== null &&
    (el.querySelector('table')?.querySelectorAll('th').length ?? 0) > 8
  const pageSize = hasWideTable ? 'A3 landscape' : 'A4 portrait'

  const win = window.open('', '_blank', 'width=1400,height=900')
  if (!win) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }

  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    /* ── Page setup ── */
    @page { size: ${pageSize}; margin: 1cm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 9pt;
      color: #0f172a;
      background: white;
      padding: 0;
    }

    /* ── Header ── */
    .print-header {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #334155;
    }
    .print-header h1 {
      font-size: 14pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .print-header p {
      font-size: 9pt;
      color: #64748b;
    }

    /* ── Tabel ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: ${hasWideTable ? '7pt' : '9pt'};
    }
    th, td {
      padding: ${hasWideTable ? '2.5px 4px' : '5px 10px'};
      border: 1px solid #94a3b8;
      vertical-align: middle;
    }
    th {
      background: #1e3a5f !important;
      color: white !important;
      font-weight: 700;
      text-align: center;
      font-size: ${hasWideTable ? '6.5pt' : '8.5pt'};
    }
    tbody tr:nth-child(even) td { background: #f0f4f8; }
    tbody tr:nth-child(odd)  td { background: #ffffff; }
    tfoot td, tfoot th {
      background: #e2e8f0 !important;
      color: #0f172a !important;
      font-weight: 700;
    }

    /* ── Laporan keuangan (non-tabel) ── */
    .lap-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 9pt;
    }
    .lap-row.indent-1 > *:first-child { padding-left: 16px; }
    .lap-row.indent-2 > *:first-child { padding-left: 32px; }
    .lap-row.subtotal {
      font-weight: 600;
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
    }
    .lap-row.total {
      font-weight: 700;
      font-size: 10pt;
      border-top: 2px solid #334155;
      border-bottom: 2px solid #334155;
      padding: 6px 0;
    }
    .card {
      border: 1px solid #94a3b8;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    /* ── Alignment ── */
    .text-right, [class*="text-right"], .td-num { text-align: right !important; }
    .text-center { text-align: center !important; }
    .font-bold, .font-semibold, [class*="font-bold"], [class*="font-semibold"] { font-weight: 700 !important; }
    .font-medium { font-weight: 600 !important; }

    /* ── Warna teks ── */
    .text-blue-700    { color: #1d4ed8 !important; }
    .text-emerald-700 { color: #047857 !important; }
    .text-amber-700   { color: #b45309 !important; }
    .text-violet-700  { color: #6d28d9 !important; }
    .text-rose-700    { color: #9f1239 !important; }
    .text-red-600     { color: #dc2626 !important; }
    .text-emerald-600 { color: #059669 !important; }
    .text-blue-600    { color: #2563eb !important; }
    .text-slate-700   { color: #334155 !important; }
    .text-slate-500   { color: #64748b !important; }
    .text-slate-400, .text-slate-300, .text-slate-200 { color: #94a3b8 !important; }

    /* ── Warna background ── */
    .bg-amber-50, [class*="amber-50"]   { background: #fffbeb !important; }
    .bg-blue-50,  [class*="blue-50"]    { background: #eff6ff !important; }
    .bg-emerald-50,[class*="emerald-50"]{ background: #ecfdf5 !important; }
    .bg-slate-50, [class*="slate-50"]   { background: #f8fafc !important; }
    .bg-slate-100 { background: #f1f5f9 !important; }

    /* ── Badge/tag ── */
    .rounded { border-radius: 3px; }
    [class*="text-\\[8px\\]"], [class*="text-\\[9px\\]"] { font-size: 6pt; }

    /* ── Sembunyikan ── */
    .no-print, button, input, select, nav, aside { display: none !important; }
    .print-only { display: inline !important; }

    /* ── Num format ── */
    .num, .font-mono, [class*="font-mono"] { font-family: 'Courier New', monospace; }

    /* ── Page break ── */
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <div class="print-header">
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
  </div>
  ${clone.innerHTML}
</body>
</html>`)

  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 900)
}
