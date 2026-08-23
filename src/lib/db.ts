/**
 * db.ts — Semua operasi database Supabase
 * Setiap fungsi punya fallback localStorage jika offline/belum dikonfigurasi
 */
import { supabase, isOnline } from './supabase'
import type { Identitas, JurnalEntry, ArsipTahun } from '../types'
import type { SaldoSimpanan, Anggota } from '../store/useAppStore'

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
  // Ambil SEMUA baris dengan cara "paging" (500 per halaman), bukan sekali
  // fetch — Supabase API punya batas maksimal jumlah baris per request
  // (default project ini 1000), jadi kalau data jurnal sudah lebih banyak
  // dari itu, entri yang lama akan kepotong/tidak ke-load kalau cuma fetch
  // sekali. Dengan loop ini, berapapun jumlah datanya nanti (ribuan
  // sekalipun) akan tetap ke-fetch semua secara bertahap.
  const pageSize = 500 // sengaja di bawah limit manapun yang wajar
  let from = 0
  let all: any[] = []
  while (true) {
    const { data, error } = await supabase
      .from('jurnal')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) { console.error(`Gagal fetch jurnal (halaman mulai ${from}):`, error); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    from += pageSize
    if (data.length < pageSize) break // ini halaman terakhir, berhenti
  }
  return all.map(r => ({
    id:             r.id,
    tanggal:        r.tanggal,
    nobukti:        r.nobukti,
    keterangan:     r.keterangan ?? '',
    rows:           r.rows,
    total:          Number(r.total),
    jasaSukSynced:  r.jasa_suk_synced ?? false,
  }))
}

export async function dbAddJurnal(entry: Omit<JurnalEntry, 'id'>, isAutoNoBukti?: boolean): Promise<{ id: number; nobukti: string }> {
  if (!isOnline()) return { id: Date.now(), nobukti: entry.nobukti }
  const { data, error } = await supabase.from('jurnal').insert({
    tanggal:    entry.tanggal,
    // Mode auto → kirim NULL, biar trigger di database yang mengunci nomor
    // final secara atomik SAAT INSERT ini benar-benar terjadi (bukan
    // sebelumnya saat user baru klik tombol "auto" di form).
    nobukti:    isAutoNoBukti ? null : entry.nobukti,
    keterangan: entry.keterangan,
    rows:       entry.rows,
    total:      entry.total,
    // Jurnal baru selalu dianggap "synced" — dampaknya ke saldo jasa (akun
    // 2.1.12) langsung diterapkan saat itu juga oleh addJurnal di store.
    jasa_suk_synced: true,
  }).select('id, nobukti').single()
  if (error) {
    // Postgres code 23505 = unique_violation → nobukti sudah dipakai entri lain
    // (misal 2 user submit hampir bersamaan). Tandai error ini secara jelas
    // supaya UI bisa kasih pesan yang mudah dimengerti, bukan error teknis mentah.
    if (error.code === '23505') {
      const dupErr = new Error('DUPLICATE_NOBUKTI')
      dupErr.name = 'DuplicateNoBuktiError'
      throw dupErr
    }
    throw error
  }
  // nobukti final dikembalikan dari server (bisa beda dari preview kalau
  // mode auto, karena baru dikunci betulan sekarang oleh trigger)
  return { id: data.id, nobukti: data.nobukti }
}

// Preview nomor bukti berikutnya — HANYA untuk ditampilkan di form, TIDAK
// memajukan sequence di database. Nomor final baru benar-benar dikunci saat
// entri disimpan (lihat dbAddJurnal + trigger assign_nobukti_on_insert).
export async function dbPeekNextNobukti(): Promise<string> {
  if (!isOnline()) return `JU-${Date.now().toString().slice(-3)}`
  const { data, error } = await supabase.rpc('peek_next_nobukti')
  if (error) throw error
  return data as string
}

export async function dbUpdateJurnal(id: number, entry: Omit<JurnalEntry, 'id'>) {
  if (!isOnline()) return
  const { error } = await supabase.from('jurnal').update({
    tanggal:    entry.tanggal,
    nobukti:    entry.nobukti,
    keterangan: entry.keterangan,
    rows:       entry.rows,
    total:      entry.total,
    // Setelah diedit, dampak jasa (akun 2.1.12) sudah pasti diproses ulang
    // sepenuhnya oleh updateJurnal di store — tandai synced.
    jasa_suk_synced: true,
  }).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      const dupErr = new Error('DUPLICATE_NOBUKTI')
      dupErr.name = 'DuplicateNoBuktiError'
      throw dupErr
    }
    throw error
  }
}

// Tandai sekumpulan jurnal lama sebagai "sudah disinkronkan" dampak jasa
// (2.1.12)-nya, dipakai oleh fitur "Sinkronkan Saldo Jasa dari Jurnal Lama"
// setelah preview-nya dikonfirmasi dan diterapkan ke saldo anggota.
export async function dbMarkJurnalJasaSukSynced(ids: number[]) {
  if (!isOnline() || ids.length === 0) return
  await supabase.from('jurnal').update({ jasa_suk_synced: true }).in('id', ids)
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

// ── ANGGOTA ───────────────────────────────────────────────────────────────
export async function dbGetAnggota(): Promise<Anggota[]> {
  if (!isOnline()) return []
  const { data, error } = await supabase.from('anggota').select('*').order('id', { ascending: true })
  if (error || !data) return []
  return data.map(r => ({
    id: r.id, noAnggota: r.no_anggota ?? String(r.id),
    nama: r.nama, alamat: r.alamat ?? '', telepon: r.telepon ?? '', email: r.email ?? '',
  }))
}

export async function dbAddAnggota(a: Anggota): Promise<void> {
  if (!isOnline()) return
  const { error } = await supabase.from('anggota').insert({
    id: a.id, no_anggota: a.noAnggota, nama: a.nama, alamat: a.alamat, telepon: a.telepon, email: a.email,
  })
  if (error) throw error
}

export async function dbUpdateAnggota(id: number, data: Partial<Omit<Anggota, 'id'>>) {
  if (!isOnline()) return
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.noAnggota !== undefined) payload.no_anggota = data.noAnggota
  if (data.nama      !== undefined) payload.nama       = data.nama
  if (data.alamat    !== undefined) payload.alamat     = data.alamat
  if (data.telepon   !== undefined) payload.telepon    = data.telepon
  if (data.email     !== undefined) payload.email      = data.email
  const { error } = await supabase.from('anggota').update(payload).eq('id', id)
  if (error) throw error
}

export async function dbDeleteAnggota(id: number) {
  if (!isOnline()) return
  const { error } = await supabase.from('anggota').delete().eq('id', id)
  if (error) throw error
}

// Isi awal tabel anggota di Supabase dari daftar master lokal — hanya
// dijalankan sekali otomatis kalau tabel `anggota` remote masih kosong,
// supaya 484 nama anggota awal ikut tersinkron ke server (bukan cuma di
// browser). Dipakai saat online pertama kali.
export async function dbSeedAnggotaIfEmpty(list: Anggota[]) {
  if (!isOnline() || list.length === 0) return false
  const { count } = await supabase.from('anggota').select('id', { count: 'exact', head: true })
  if (count && count > 0) return false
  const rows = list.map(a => ({
    id: a.id, no_anggota: a.noAnggota, nama: a.nama,
    alamat: a.alamat, telepon: a.telepon, email: a.email,
  }))
  const { error } = await supabase.from('anggota').insert(rows)
  if (error) { console.error('Seed anggota error:', error); return false }
  return true
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
