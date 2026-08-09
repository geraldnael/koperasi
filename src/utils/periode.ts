import type { JurnalEntry } from '../types'

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function daysInMonth(tahun: number, bulan: number): number {
  return new Date(tahun, bulan, 0).getDate()
}

export function startOfMonthStr(tahun: number, bulan: number): string {
  return `${tahun}-${String(bulan).padStart(2, '0')}-01`
}

export function endOfMonthStr(tahun: number, bulan: number): string {
  const d = daysInMonth(tahun, bulan)
  return `${tahun}-${String(bulan).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "2026-01-15" → "15 Januari 2026" */
export function formatTanggalIndo(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`
}

/** Kumpulkan tahun-tahun yang ada di data jurnal, untuk pilihan dropdown tahun */
export function getTahunTersedia(jurnal: JurnalEntry[], tahunIdentitas: string): string[] {
  const set = new Set<string>()
  jurnal.forEach(j => { if (j.tanggal && j.tanggal.length >= 4) set.add(j.tanggal.slice(0, 4)) })
  if (tahunIdentitas) set.add(tahunIdentitas)
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

/**
 * Tahun default yang PALING MASUK AKAL untuk filter: tahun terbaru yang
 * BENERAN ADA di data jurnal (bukan asal ambil dari menu Identitas — kalau
 * field tahun di Identitas tidak sinkron dengan tanggal transaksi asli,
 * filter bulan bisa salah tahun dan hasilnya kelihatan kosong padahal
 * datanya ada).
 */
export function getTahunTerbaru(jurnal: JurnalEntry[], tahunIdentitas: string): string {
  const jurnalYears = new Set<string>()
  jurnal.forEach(j => { if (j.tanggal && j.tanggal.length >= 4) jurnalYears.add(j.tanggal.slice(0, 4)) })
  if (jurnalYears.size > 0) {
    return Array.from(jurnalYears).sort((a, b) => b.localeCompare(a))[0]
  }
  return tahunIdentitas
}
