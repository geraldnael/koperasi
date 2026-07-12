/**
 * db.ts — Semua operasi database Supabase
 * Setiap fungsi punya fallback localStorage jika offline/belum dikonfigurasi
 */
import { supabase, isOnline } from './supabase'
import type { Identitas, JurnalEntry, ArsipTahun } from '../types'
import type { SaldoSimpanan } from '../store/useAppStore'

// ── IDENTITAS ─────────────────────────────────────────────────────────────
export async function dbGetIdentitas(): Promise<Identitas | null> {
  if (!isOnline()) return null
  const { data } = await supabase.from('identitas').select('data').eq('id', 1).single()
  return data?.data ?? null
}

export async function dbSetIdentitas(identitas: Identitas) {
  if (!isOnline()) return
  await supabase.from('identitas').upsert({ id: 1, data: identitas, updated_at: new Date().toISOString() })
}

// ── SALDO AWAL ────────────────────────────────────────────────────────────
export async function dbGetSaldoAwal(): Promise<Record<string, number>> {
  if (!isOnline()) return {}
  const { data } = await supabase.from('saldo_awal').select('kode, nilai')
  if (!data) return {}
  return Object.fromEntries(data.map(r => [r.kode, Number(r.nilai)]))
}

export async function dbSetSaldoAwal(saldo: Record<string, number>) {
  if (!isOnline()) return
  const rows = Object.entries(saldo).map(([kode, nilai]) => ({
    kode, nilai, updated_at: new Date().toISOString()
  }))
  if (rows.length === 0) return
  await supabase.from('saldo_awal').upsert(rows, { onConflict: 'kode' })
}

export async function dbUpdateSaldoAkun(kode: string, nilai: number) {
  if (!isOnline()) return
  await supabase.from('saldo_awal').upsert(
    { kode, nilai, updated_at: new Date().toISOString() },
    { onConflict: 'kode' }
  )
}

// ── JURNAL ────────────────────────────────────────────────────────────────
export async function dbGetJurnal(): Promise<JurnalEntry[]> {
  if (!isOnline()) return []
  const { data } = await supabase
    .from('jurnal')
    .select('*')
    .order('tanggal', { ascending: false })
    .order('id', { ascending: false })
  if (!data) return []
  return data.map(r => ({
    id:         r.id,
    tanggal:    r.tanggal,
    nobukti:    r.nobukti,
    keterangan: r.keterangan ?? '',
    rows:       r.rows,
    total:      Number(r.total),
  }))
}

export async function dbAddJurnal(entry: Omit<JurnalEntry, 'id'>): Promise<number> {
  if (!isOnline()) return Date.now()
  const { data, error } = await supabase.from('jurnal').insert({
    tanggal:    entry.tanggal,
    nobukti:    entry.nobukti,
    keterangan: entry.keterangan,
    rows:       entry.rows,
    total:      entry.total,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export async function dbUpdateJurnal(id: number, entry: Omit<JurnalEntry, 'id'>) {
  if (!isOnline()) return
  await supabase.from('jurnal').update({
    tanggal:    entry.tanggal,
    nobukti:    entry.nobukti,
    keterangan: entry.keterangan,
    rows:       entry.rows,
    total:      entry.total,
  }).eq('id', id)
}

export async function dbDeleteJurnal(id: number) {
  if (!isOnline()) return
  await supabase.from('jurnal').delete().eq('id', id)
}

// ── SALDO SIMPANAN ────────────────────────────────────────────────────────
export async function dbGetSaldoSimpanan(): Promise<SaldoSimpanan[]> {
  if (!isOnline()) return []
  const { data } = await supabase.from('saldo_simpanan').select('*')
  if (!data) return []
  return data.map(r => ({
    anggotaId: r.anggota_no,
    pokok:     Number(r.pokok),
    wajib:     Number(r.wajib),
    wajib_khs: Number(r.wajib_khs),
    sukarela:  Number(r.sukarela),
    jasa_suk:  Number(r.jasa_suk),
    tht:       Number(r.tht),
    jasa_tht:  Number(r.jasa_tht),
    pinjaman:  Number(r.pinjaman),
  }))
}

export async function dbUpdateSaldoSimpanan(s: SaldoSimpanan) {
  if (!isOnline()) return
  await supabase.from('saldo_simpanan').upsert({
    anggota_no: s.anggotaId,
    pokok:      s.pokok,
    wajib:      s.wajib,
    wajib_khs:  s.wajib_khs,
    sukarela:   s.sukarela,
    jasa_suk:   s.jasa_suk,
    tht:        s.tht,
    jasa_tht:   s.jasa_tht,
    pinjaman:   s.pinjaman,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'anggota_no' })
}

// ── SALDO PIUTANG ─────────────────────────────────────────────────────────
export async function dbGetSaldoPiutang(): Promise<{ anggotaId: number; saldoAwal: number; saldoAwalJasa: number }[]> {
  if (!isOnline()) return []
  const { data } = await supabase.from('saldo_piutang').select('*')
  if (!data) return []
  return data.map(r => ({
    anggotaId:     r.anggota_no,
    saldoAwal:     Number(r.saldo_awal),
    saldoAwalJasa: Number(r.saldo_awal_jasa ?? 0),
  }))
}

export async function dbUpdateSaldoPiutang(anggotaId: number, saldoAwal: number, saldoAwalJasa = 0) {
  if (!isOnline()) return
  await supabase.from('saldo_piutang').upsert(
    { anggota_no: anggotaId, saldo_awal: saldoAwal, saldo_awal_jasa: saldoAwalJasa, updated_at: new Date().toISOString() },
    { onConflict: 'anggota_no' }
  )
}

// ── ARSIP TAHUN (Tutup Buku) ────────────────────────────────────────────────
// Tabel opsional — kalau belum dibuat di Supabase, fungsi ini otomatis no-op
// dan arsip tetap tersimpan lokal (localStorage) lewat zustand persist.
export async function dbGetArsipTahun(): Promise<Record<string, ArsipTahun>> {
  if (!isOnline()) return {}
  try {
    const { data, error } = await supabase.from('arsip_tahun').select('tahun, data')
    if (error || !data) return {}
    return Object.fromEntries(data.map(r => [r.tahun, r.data]))
  } catch {
    return {}
  }
}

export async function dbSetArsipTahun(tahun: string, arsip: ArsipTahun) {
  if (!isOnline()) return
  try {
    await supabase.from('arsip_tahun').upsert({
      tahun, data: arsip, updated_at: new Date().toISOString(),
    }, { onConflict: 'tahun' })
  } catch {
    // Tabel belum ada / offline — arsip tetap aman di localStorage
  }
}

// Hapus semua jurnal tahun berjalan sekaligus (dipakai saat Tutup Buku)
export async function dbClearAllJurnal(ids: number[]) {
  if (!isOnline() || ids.length === 0) return
  await supabase.from('jurnal').delete().in('id', ids)
}

// ── GRANULAR FETCH (untuk realtime partial update) ────────────────────────
// Dipanggil dari App.tsx saat menerima event realtime dari tabel tertentu,
// sehingga tidak perlu fetch ulang semua tabel setiap ada perubahan sekecil apapun.

export async function dbGetSaldoAwalSingle(kode: string): Promise<number | null> {
  if (!isOnline()) return null
  const { data } = await supabase.from('saldo_awal').select('nilai').eq('kode', kode).single()
  return data ? Number(data.nilai) : null
}
