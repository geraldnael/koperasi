import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Identitas, JurnalEntry, ArsipTahun } from '../types'
import { ANGGOTA_MASTER } from '../data/anggota'
import { computeSaldos } from '../utils/accounting'
import { COA } from '../utils/coa'
import {
  dbGetIdentitas, dbSetIdentitas,
  dbGetSaldoAwal, dbSetSaldoAwal, dbUpdateSaldoAkun,
  dbGetJurnal, dbAddJurnal, dbUpdateJurnal, dbDeleteJurnal, dbClearAllJurnal,
  dbGetSaldoSimpanan, dbUpdateSaldoSimpanan,
  dbGetSaldoPiutang, dbUpdateSaldoPiutang,
  dbGetArsipTahun, dbSetArsipTahun,
  dbGetAnggota, dbAddAnggota, dbUpdateAnggota, dbDeleteAnggota, dbSeedAnggotaIfEmpty,
} from '../lib/db'

// ── Types ─────────────────────────────────────────────────────────────────
export interface Anggota {
  id: number
  noAnggota: string
  nama: string
  alamat: string
  telepon: string
  email: string
}

export interface SaldoSimpanan {
  anggotaId: number
  pokok: number
  wajib: number
  wajib_khs: number
  sukarela: number
  jasa_suk: number
  tht: number
  jasa_tht: number
  pinjaman: number
}

export interface PiutangSP {
  anggotaId: number
  saldoAwal: number      // saldo awal pokok
  saldoAwalJasa: number  // saldo awal jasa
}

export interface SaldoToko {
  anggotaId: number
  saldoAwal: number
}

export interface SHUConfig {
  pctJasaSimpanan: number
  pctJasaPinjaman: number
  pctCadangan: number
  pctPengurus: number
  pctPendidikan: number
  pctKaryawan: number
  pctSosial: number
}

// ── Store interface ───────────────────────────────────────────────────────
interface AppStore {
  identitas: Identitas
  anggota: Anggota[]
  nextAnggotaId: number
  customCOA: import('../types').Akun[]
  saldoAwal: Record<string, number>
  jurnal: JurnalEntry[]
  nextJurnalId: number
  saldoSimpanan: SaldoSimpanan[]
  piutangSP: PiutangSP[]
  saldoToko: SaldoToko[]
  shuConfig: SHUConfig
  syncStatus: 'idle' | 'loading' | 'synced' | 'error'
  arsipTahun: Record<string, ArsipTahun>
  tutupBukuStatus: 'idle' | 'processing' | 'done' | 'error'

  // actions
  setIdentitas: (data: Identitas) => void
  addAnggota: (a: Omit<Anggota, 'id'>) => Promise<void>
  updateAnggota: (id: number, data: Partial<Omit<Anggota, 'id'>>) => void
  deleteAnggota: (id: number) => void
  setCustomCOA: (akun: import('../types').Akun[]) => void
  setSaldoAwal: (saldo: Record<string, number>) => void
  updateSaldoAkun: (kode: string, val: number) => void
  addJurnal: (entry: Omit<JurnalEntry, 'id'>) => Promise<void>
  updateJurnal: (id: number, entry: Omit<JurnalEntry, 'id'>) => Promise<void>
  deleteJurnal: (id: number) => Promise<void>
  updateSaldoSimpanan: (anggotaId: number, data: Partial<Omit<SaldoSimpanan, 'anggotaId'>>) => void
  updatePiutangSP: (anggotaId: number, saldo: number, saldoJasa?: number) => void
  updateSaldoToko: (anggotaId: number, saldo: number) => void
  setSHUConfig: (cfg: Partial<SHUConfig>) => void
  syncFromSupabase: () => Promise<void>
  syncArsipTahun: () => Promise<void>
  tutupBuku: (tahunBaru: string, awalBaru: string, akhirBaru: string) => Promise<{ ok: boolean; message: string }>
  resetAll: () => void
}

// ── Defaults ──────────────────────────────────────────────────────────────
const defaultIdentitas: Identitas = {
  nama: 'KOPERASI PEGAWAI DAN PENSIUNAN RUMAH SAKIT SOEHARTO HEERDJAN',
  bh: '-', alamat: 'Jl. Contoh No.1',
  kelurahan: '-', kecamatan: '-', kota: 'Jakarta',
  ketua: '-', bendahara: '-', sekretaris: '-',
  tahun: '2025', awal: '2025-01-01', akhir: '2025-12-31',
}

const defaultSHU: SHUConfig = {
  pctJasaSimpanan: 30, pctJasaPinjaman: 30, pctCadangan: 20,
  pctPengurus: 10, pctPendidikan: 5, pctKaryawan: 3, pctSosial: 2,
}

const defaultAnggota: Anggota[] = ANGGOTA_MASTER.map(a => ({
  id: a.no, noAnggota: String(a.no), nama: a.nama,
  alamat: '', telepon: '', email: '',
}))

// Saldo simpanan dikosongkan — diisi manual per anggota
const defaultSaldoSimpanan: SaldoSimpanan[] = []


// ── Store ─────────────────────────────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      identitas:     defaultIdentitas,
      anggota:       defaultAnggota,
      nextAnggotaId: defaultAnggota.length + 1,
      customCOA:     (() => { try { return JSON.parse(localStorage.getItem('sia-koperasi-custom-coa') || '[]') } catch { return [] } })(),
      saldoAwal:     {},
      jurnal:        [],
      nextJurnalId:  1,
      saldoSimpanan: defaultSaldoSimpanan,
      piutangSP:     [],
      saldoToko:     [],
      shuConfig:     defaultSHU,
      syncStatus:    'idle',
      arsipTahun:    {},
      tutupBukuStatus: 'idle',

      // ── Sync dari Supabase → overwrite state lokal sepenuhnya ────────
      syncFromSupabase: async () => {
        set({ syncStatus: 'loading' })
        try {
          // Isi otomatis 484 nama anggota awal ke server kalau tabel masih
          // kosong (first-run), supaya tidak perlu input manual satu-satu
          await dbSeedAnggotaIfEmpty(get().anggota).catch(() => {})

          const [identitas, saldoAwal, jurnal, saldoSimpanan, piutangSP, anggota] = await Promise.all([
            dbGetIdentitas(),
            dbGetSaldoAwal(),
            dbGetJurnal(),
            dbGetSaldoSimpanan(),
            dbGetSaldoPiutang(),
            dbGetAnggota(),
          ])

          // Selalu overwrite — termasuk saat ada DELETE di device lain
          set({
            syncStatus:    'synced',
            ...(identitas ? { identitas } : {}),
            saldoAwal:     Object.keys(saldoAwal).length > 0 ? saldoAwal : get().saldoAwal,
            jurnal:        jurnal,   // overwrite penuh termasuk hapus
            nextJurnalId:  jurnal.length > 0
                             ? Math.max(...jurnal.map(j => j.id)) + 1
                             : get().nextJurnalId,
            saldoSimpanan: saldoSimpanan.length > 0 ? saldoSimpanan : get().saldoSimpanan,
            piutangSP:     piutangSP.length > 0
                             ? piutangSP
                             : get().piutangSP,
            anggota:       anggota.length > 0 ? anggota : get().anggota,
            nextAnggotaId: anggota.length > 0
                             ? Math.max(...anggota.map(a => a.id)) + 1
                             : get().nextAnggotaId,
          })
        } catch (e) {
          console.error('Sync error:', e)
          set({ syncStatus: 'error' })
        }
      },

      // ── Identitas ─────────────────────────────────────────────────────
      setIdentitas: (data) => {
        set({ identitas: data })
        dbSetIdentitas(data)
      },

      // ── Anggota ───────────────────────────────────────────────────────
      addAnggota: async (a) => {
        // Optimistic update dulu
        const tmpId = get().nextAnggotaId
        set((s) => ({
          anggota: [...s.anggota, { ...a, id: tmpId }],
          nextAnggotaId: s.nextAnggotaId + 1,
        }))
        try {
          const realId = await dbAddAnggota(a)
          set((s) => ({
            anggota: s.anggota.map(x => x.id === tmpId ? { ...x, id: realId } : x),
          }))
        } catch (e) {
          console.error('Gagal simpan anggota ke server:', e)
          alert('Anggota tersimpan di perangkat ini, tapi GAGAL tersinkron ke server (cek koneksi internet). Data bisa hilang saat sinkron ulang — coba simpan lagi setelah koneksi normal.')
        }
      },
      updateAnggota: (id, data) => {
        set((s) => ({
          anggota: s.anggota.map(a => a.id === id ? { ...a, ...data } : a),
        }))
        dbUpdateAnggota(id, data).catch(e => {
          console.error('Gagal update anggota ke server:', e)
          alert('Perubahan tersimpan di perangkat ini, tapi GAGAL tersinkron ke server (cek koneksi internet).')
        })
      },
      deleteAnggota: (id) => {
        set((s) => ({
          anggota: s.anggota.filter(a => a.id !== id),
        }))
        dbDeleteAnggota(id).catch(e => {
          console.error('Gagal hapus anggota di server:', e)
          alert('Anggota terhapus di perangkat ini, tapi GAGAL tersinkron ke server (cek koneksi internet). Anggota bisa muncul lagi saat sinkron ulang.')
        })
      },

      // ── Saldo Awal ────────────────────────────────────────────────────
      setCustomCOA: (akun) => {
        set({ customCOA: akun })
        localStorage.setItem('sia-koperasi-custom-coa', JSON.stringify(akun))
      },
      setSaldoAwal: (saldo) => {
        set({ saldoAwal: saldo })
        dbSetSaldoAwal(saldo).catch(e => {
          console.error('Gagal simpan saldo awal ke server:', e)
          alert('GAGAL menyimpan Saldo Awal ke server (cek koneksi internet). Perubahan bisa hilang saat sinkron ulang — coba simpan lagi setelah koneksi normal.')
        })
      },
      updateSaldoAkun: (kode, val) => {
        set((s) => ({ saldoAwal: { ...s.saldoAwal, [kode]: val } }))
        dbUpdateSaldoAkun(kode, val).catch(e => {
          console.error('Gagal simpan saldo akun ke server:', e)
          alert('GAGAL menyimpan perubahan saldo ke server (cek koneksi internet). Perubahan bisa hilang saat sinkron ulang — coba simpan lagi setelah koneksi normal.')
        })
      },

      // ── Jurnal ────────────────────────────────────────────────────────
      addJurnal: async (entry) => {
        // Optimistic update dulu
        const tmpId = get().nextJurnalId
        set((s) => ({
          jurnal: [{ ...entry, id: tmpId }, ...s.jurnal],
          nextJurnalId: s.nextJurnalId + 1,
        }))
        try {
          // Simpan ke Supabase, update id dengan id asli
          const realId = await dbAddJurnal(entry)
          set((s) => ({
            jurnal: s.jurnal.map(j => j.id === tmpId ? { ...j, id: realId } : j),
          }))
        } catch (e) {
          // GAGAL simpan ke server → batalkan entri optimistik supaya tidak
          // "menghilang diam-diam" saat sinkronisasi berikutnya menimpa state lokal
          console.error('Gagal simpan jurnal ke server:', e)
          set((s) => ({ jurnal: s.jurnal.filter(j => j.id !== tmpId) }))
          alert('GAGAL menyimpan jurnal ke server (cek koneksi internet). Entri ini TIDAK tersimpan — silakan input ulang setelah koneksi normal.')
        }
      },
      updateJurnal: async (id, entry) => {
        const prev = get().jurnal.find(j => j.id === id)
        set((s) => ({
          jurnal: s.jurnal.map(j => j.id === id ? { ...j, ...entry } : j),
        }))
        try {
          await dbUpdateJurnal(id, entry)
        } catch (e) {
          console.error('Gagal update jurnal ke server:', e)
          if (prev) set((s) => ({ jurnal: s.jurnal.map(j => j.id === id ? prev : j) }))
          alert('GAGAL menyimpan perubahan jurnal ke server (cek koneksi internet). Perubahan dibatalkan — silakan coba lagi.')
        }
      },
      deleteJurnal: async (id) => {
        const prev = get().jurnal.find(j => j.id === id)
        set((s) => ({ jurnal: s.jurnal.filter(j => j.id !== id) }))
        try {
          await dbDeleteJurnal(id)
        } catch (e) {
          console.error('Gagal hapus jurnal di server:', e)
          if (prev) set((s) => ({ jurnal: [...s.jurnal, prev].sort((a, b) => b.id - a.id) }))
          alert('GAGAL menghapus jurnal di server (cek koneksi internet). Jurnal dikembalikan — silakan coba lagi.')
        }
      },

      // ── Saldo Simpanan ────────────────────────────────────────────────
      updateSaldoSimpanan: (anggotaId, data) => {
        set((s) => {
          const exists = s.saldoSimpanan.find(x => x.anggotaId === anggotaId)
          const updated = exists
            ? s.saldoSimpanan.map(x => x.anggotaId === anggotaId ? { ...x, ...data } : x)
            : [...s.saldoSimpanan, { anggotaId, pokok:0, wajib:0, wajib_khs:0, sukarela:0, jasa_suk:0, tht:0, jasa_tht:0, pinjaman:0, ...data }]
          // Sync ke Supabase
          const record = updated.find(x => x.anggotaId === anggotaId)
          if (record) dbUpdateSaldoSimpanan(record).catch(e => {
            console.error('Gagal simpan saldo simpanan ke server:', e)
            alert('GAGAL menyimpan saldo simpanan ke server (cek koneksi internet). Perubahan bisa hilang saat sinkron ulang — coba simpan lagi setelah koneksi normal.')
          })
          return { saldoSimpanan: updated }
        })
      },

      // ── Piutang SP ────────────────────────────────────────────────────
      updatePiutangSP: (anggotaId, saldo, saldoJasa) => {
        set((s) => {
          const exists = s.piutangSP.find(p => p.anggotaId === anggotaId)
          const newJasa = saldoJasa ?? (exists?.saldoAwalJasa ?? 0)
          const updated = exists
            ? s.piutangSP.map(p => p.anggotaId === anggotaId
                ? { ...p, saldoAwal: saldo, saldoAwalJasa: newJasa }
                : p)
            : [...s.piutangSP, { anggotaId, saldoAwal: saldo, saldoAwalJasa: newJasa }]
          dbUpdateSaldoPiutang(anggotaId, saldo, newJasa).catch(e => {
            console.error('Gagal simpan saldo piutang ke server:', e)
            alert('GAGAL menyimpan saldo piutang ke server (cek koneksi internet). Perubahan bisa hilang saat sinkron ulang — coba simpan lagi setelah koneksi normal.')
          })
          return { piutangSP: updated }
        })
      },

      // ── Toko ──────────────────────────────────────────────────────────
      updateSaldoToko: (anggotaId, saldo) => set((s) => {
        const exists = s.saldoToko.find(t => t.anggotaId === anggotaId)
        return {
          saldoToko: exists
            ? s.saldoToko.map(t => t.anggotaId === anggotaId ? { ...t, saldoAwal: saldo } : t)
            : [...s.saldoToko, { anggotaId, saldoAwal: saldo }],
        }
      }),

      setSHUConfig: (cfg) => set((s) => ({ shuConfig: { ...s.shuConfig, ...cfg } })),

      // ── Arsip Tahun (arsip hasil Tutup Buku, untuk Neraca Komparatif) ──
      syncArsipTahun: async () => {
        try {
          const remote = await dbGetArsipTahun()
          if (Object.keys(remote).length > 0) {
            set((s) => ({ arsipTahun: { ...s.arsipTahun, ...remote } }))
          }
        } catch (e) {
          console.error('Sync arsip tahun error:', e)
        }
      },

      // ── Tutup Buku — dasar untuk Laporan Posisi Keuangan → Saldo Awal tahun depan ──
      tutupBuku: async (tahunBaru, awalBaru, akhirBaru) => {
        const s = get()
        if (s.jurnal.length === 0) {
          return { ok: false, message: 'Tidak ada jurnal untuk tahun berjalan. Tutup buku dibatalkan.' }
        }
        set({ tutupBukuStatus: 'processing' })
        try {
          const allCOA = (() => {
            const merged = [...COA]
            s.customCOA.forEach(ca => {
              const idx = merged.findIndex(a => a.kode === ca.kode)
              if (idx >= 0) merged[idx] = ca
              else merged.push(ca)
            })
            return merged
          })()

          // 1) Saldo akhir tahun berjalan = hasil akhir Posisi Keuangan saat ini
          const saldoAkhir = computeSaldos(s.saldoAwal, s.jurnal, s.customCOA)

          // 2) Arsipkan tahun berjalan (untuk Neraca Komparatif & audit trail)
          const arsip: ArsipTahun = {
            tahun: s.identitas.tahun,
            identitas: { ...s.identitas },
            saldoAwal: { ...s.saldoAwal },
            saldoAkhir: { ...saldoAkhir },
            jumlahJurnal: s.jurnal.length,
            ditutupPada: new Date().toISOString(),
          }

          // 3) Saldo awal tahun baru:
          //    - Aset / Kewajiban / Ekuitas → dibawa (carry forward) apa adanya dari saldo akhir
          //    - Pendapatan / Beban → akun nominal/sementara, ditutup ke 0 (SHU tahun berjalan
          //      sudah otomatis terakumulasi ke Ekuitas 3.1.6 lewat perhitungan saldo)
          const saldoAwalBaru: Record<string, number> = {}
          allCOA.forEach(a => {
            saldoAwalBaru[a.kode] = (a.grup === 'PENDAPATAN' || a.grup === 'BEBAN')
              ? 0
              : (saldoAkhir[a.kode] ?? 0)
          })

          const identitasBaru: Identitas = {
            ...s.identitas,
            tahun: tahunBaru,
            awal: awalBaru,
            akhir: akhirBaru,
          }

          // 4) Simpan arsip + reset lokal
          set({
            arsipTahun: { ...s.arsipTahun, [arsip.tahun]: arsip },
            saldoAwal: saldoAwalBaru,
            jurnal: [],
            nextJurnalId: 1,
            identitas: identitasBaru,
            tutupBukuStatus: 'done',
          })

          // 5) Sinkron ke Supabase (best-effort, tidak menggagalkan proses lokal jika offline)
          const jurnalIds = s.jurnal.map(j => j.id)
          await Promise.all([
            dbSetArsipTahun(arsip.tahun, arsip),
            dbSetSaldoAwal(saldoAwalBaru),
            dbSetIdentitas(identitasBaru),
            dbClearAllJurnal(jurnalIds),
          ]).catch(e => console.error('Tutup buku sync error:', e))

          return { ok: true, message: `Tutup buku tahun ${arsip.tahun} berhasil. Saldo awal ${tahunBaru} sudah terisi otomatis.` }
        } catch (e) {
          console.error('Tutup buku error:', e)
          set({ tutupBukuStatus: 'error' })
          return { ok: false, message: 'Terjadi kesalahan saat tutup buku. Data tidak diubah.' }
        }
      },

      resetAll: () => set({
        identitas: defaultIdentitas,
        anggota: defaultAnggota,
        nextAnggotaId: defaultAnggota.length + 1,
                customCOA: [],
        saldoAwal: {},
        jurnal: [],
        nextJurnalId: 1,
        saldoSimpanan: defaultSaldoSimpanan,
        piutangSP: [],
        saldoToko: [],
        shuConfig: defaultSHU,
        syncStatus: 'idle',
        arsipTahun: {},
        tutupBukuStatus: 'idle',
      }),
    }),
    { name: 'sia-koperasi-v5' }
  )
)
