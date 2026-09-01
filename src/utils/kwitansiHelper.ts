import type { JurnalEntry, Identitas, Akun } from '../types'
import { AKUN_KAS_BANK } from './accounting'
import { fmt } from './accounting'

// ─── Angka → terbilang (Bahasa Indonesia) ──────────────────────────────────
const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas']

function terbilangRatusan(n: number): string {
  if (n === 0) return ''
  if (n < 12) return SATUAN[n]
  if (n < 20) return terbilangRatusan(n - 10) + ' belas'
  if (n < 100) return terbilangRatusan(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilangRatusan(n % 10) : '')
  if (n < 200) return 'seratus' + (n % 100 ? ' ' + terbilangRatusan(n % 100) : '')
  if (n < 1000) return terbilangRatusan(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilangRatusan(n % 100) : '')
  return ''
}

/** Ubah angka menjadi teks terbilang Bahasa Indonesia, mis. 951256 → "sembilan ratus lima puluh satu ribu dua ratus lima puluh enam" */
export function terbilang(num: number): string {
  const n = Math.round(Math.abs(num))
  if (n === 0) return 'nol'

  const bagian: string[] = []
  const triliun = Math.floor(n / 1_000_000_000_000)
  const miliar  = Math.floor((n % 1_000_000_000_000) / 1_000_000_000)
  const juta    = Math.floor((n % 1_000_000_000) / 1_000_000)
  const ribu    = Math.floor((n % 1_000_000) / 1_000)
  const ratusan = n % 1_000

  if (triliun) bagian.push(`${terbilangRatusan(triliun)} triliun`)
  if (miliar)  bagian.push(`${terbilangRatusan(miliar)} miliar`)
  if (juta)    bagian.push(`${terbilangRatusan(juta)} juta`)
  if (ribu === 1) bagian.push('seribu')
  else if (ribu)  bagian.push(`${terbilangRatusan(ribu)} ribu`)
  if (ratusan) bagian.push(terbilangRatusan(ratusan))

  return bagian.join(' ').replace(/\s+/g, ' ').trim()
}

export function terbilangRupiah(num: number): string {
  const t = terbilang(num)
  return t.charAt(0).toUpperCase() + t.slice(1) + ' rupiah'
}

// ─── Deteksi & bangun daftar baris kas/bank dari satu entri jurnal ─────────
interface BarisKasBank {
  nama: string
  arah: 'MASUK' | 'KELUAR'
  jumlah: number
  akunKasBank: string
  akunLawan: string
}

function namaAkun(kode: string, allCOA: Akun[]): string {
  const a = allCOA.find(x => x.kode === kode)
  return a ? `${a.kode} — ${a.nama}` : kode
}

export function isKasBankEntry(entry: JurnalEntry): boolean {
  return entry.rows.some(r => AKUN_KAS_BANK.includes(r.kode_d) || AKUN_KAS_BANK.includes(r.kode_k))
}

function barisKasBankDariEntry(entry: JurnalEntry): BarisKasBank[] {
  const hasil: BarisKasBank[] = []
  entry.rows.forEach(r => {
    // Prioritas nama untuk kwitansi: Pihak (khusus kas/bank) → Nama Anggota → Keterangan jurnal
    const nama = (r.pihak || '').trim() || (r.ket || '').trim() || entry.keterangan || '-'
    if (AKUN_KAS_BANK.includes(r.kode_d) && r.debet > 0) {
      hasil.push({ nama, arah: 'MASUK', jumlah: r.debet, akunKasBank: r.kode_d, akunLawan: r.kode_k })
    }
    if (AKUN_KAS_BANK.includes(r.kode_k) && r.kredit > 0) {
      hasil.push({ nama, arah: 'KELUAR', jumlah: r.kredit, akunKasBank: r.kode_k, akunLawan: r.kode_d })
    }
  })
  return hasil
}

/**
 * Cetak kwitansi / bukti penerimaan-pengeluaran kas & bank untuk satu entri
 * jurnal. Hanya berlaku kalau entri memang menyentuh akun Kas (1.1.1) atau
 * Bank (1.1.2) — cek dulu dengan isKasBankEntry() sebelum memanggil ini.
 * Kalau satu entri punya beberapa baris kas/bank (jarang terjadi), akan
 * dicetak beberapa kwitansi sekaligus (satu per halaman).
 */
export function printKwitansi(entry: JurnalEntry, identitas: Identitas, allCOA: Akun[]) {
  const daftar = barisKasBankDariEntry(entry)
  if (daftar.length === 0) {
    alert('Jurnal ini tidak menyentuh akun Kas atau Bank.')
    return
  }

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }

  const kwitansiHtml = daftar.map((b, i) => `
    <div class="kwitansi ${i < daftar.length - 1 ? 'page-break' : ''}">
      <div class="kw-header">
        <div>
          <h1>${identitas.nama || 'KOPERASI'}</h1>
          <p>${identitas.alamat || ''}${identitas.kelurahan ? ', ' + identitas.kelurahan : ''}${identitas.kecamatan ? ', ' + identitas.kecamatan : ''}${identitas.kota ? ', ' + identitas.kota : ''}</p>
        </div>
        <div class="kw-badge ${b.arah === 'MASUK' ? 'masuk' : 'keluar'}">
          ${b.arah === 'MASUK' ? 'BUKTI PENERIMAAN' : 'BUKTI PENGELUARAN'}
        </div>
      </div>

      <h2 class="kw-title">KWITANSI</h2>

      <table class="kw-meta">
        <tr><td class="lbl">No. Bukti</td><td>: <strong>${entry.nobukti}</strong></td>
            <td class="lbl">Tanggal</td><td>: <strong>${entry.tanggal}</strong></td></tr>
      </table>

      <table class="kw-body">
        <tr>
          <td class="lbl">${b.arah === 'MASUK' ? 'Sudah terima dari' : 'Telah dibayarkan kepada'}</td>
          <td>: <strong>${b.nama}</strong></td>
        </tr>
        <tr>
          <td class="lbl">Uang sejumlah</td>
          <td>: <strong class="kw-nominal">Rp ${fmt(b.jumlah)}</strong></td>
        </tr>
        <tr>
          <td class="lbl">Terbilang</td>
          <td>: <em>${terbilangRupiah(b.jumlah)}</em></td>
        </tr>
        <tr>
          <td class="lbl">Untuk pembayaran</td>
          <td>: ${entry.keterangan || '-'}</td>
        </tr>
      </table>

      <table class="kw-akun">
        <tr><td class="lbl">Akun ${b.arah === 'MASUK' ? 'Penerimaan' : 'Pengeluaran'}</td><td>: ${namaAkun(b.akunKasBank, allCOA)}</td></tr>
        <tr><td class="lbl">Akun Lawan</td><td>: ${namaAkun(b.akunLawan, allCOA)}</td></tr>
      </table>

      <div class="kw-ttd">
        <div>
          <p>Dibuat oleh,</p>
          <div class="ttd-space"></div>
          <p><strong>${identitas.bendahara || 'Bendahara'}</strong></p>
          <p class="jabatan">Bendahara</p>
        </div>
        <div>
          <p>${b.arah === 'MASUK' ? 'Yang menyerahkan,' : 'Penerima,'}</p>
          <div class="ttd-space"></div>
          <p><strong>${b.nama}</strong></p>
          <p class="jabatan">&nbsp;</p>
        </div>
        <div>
          <p>Mengetahui,</p>
          <div class="ttd-space"></div>
          <p><strong>${identitas.ketua || 'Ketua'}</strong></p>
          <p class="jabatan">Ketua</p>
        </div>
      </div>
    </div>
  `).join('')

  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Kwitansi — ${entry.nobukti}</title>
<style>
  @page { size: A5 portrait; margin: 1.2cm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 10.5pt; color: #0f172a; }
  .kwitansi { border: 2px solid #334155; border-radius: 6px; padding: 18px; margin-bottom: 14px; }
  .page-break { page-break-after: always; }
  .kw-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #334155; padding-bottom: 8px; margin-bottom: 8px; gap: 8px; }
  .kw-header h1 { font-size: 12pt; text-transform: uppercase; letter-spacing: 0.3px; }
  .kw-header p { font-size: 8pt; color: #64748b; margin-top: 2px; }
  .kw-badge { font-size: 8pt; font-weight: 700; padding: 4px 10px; border-radius: 4px; white-space: nowrap; height: fit-content; }
  .kw-badge.masuk  { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  .kw-badge.keluar { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .kw-title { text-align: center; letter-spacing: 4px; font-size: 15pt; margin: 10px 0 14px; text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  td { padding: 3px 4px; vertical-align: top; font-size: 10pt; }
  .lbl { width: 150px; color: #334155; white-space: nowrap; }
  .kw-nominal { font-size: 12pt; }
  .kw-akun td { font-size: 8.5pt; color: #475569; }
  .kw-akun .lbl { width: 150px; }
  .kw-ttd { display: flex; justify-content: space-between; text-align: center; margin-top: 24px; gap: 8px; }
  .kw-ttd > div { flex: 1; font-size: 9pt; }
  .ttd-space { height: 50px; }
  .jabatan { font-size: 8pt; color: #64748b; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  ${kwitansiHtml}
</body>
</html>`)

  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 900)
}
