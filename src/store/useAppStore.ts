import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Identitas, JurnalEntry } from '../types'
import { ANGGOTA_MASTER } from '../data/anggota'
import { SALDO_SIMPANAN_MASTER } from '../data/simpanan'
import {
  dbGetIdentitas, dbSetIdentitas,
  dbGetSaldoAwal, dbSetSaldoAwal, dbUpdateSaldoAkun,
  dbGetJurnal, dbAddJurnal, dbUpdateJurnal, dbDeleteJurnal,
  dbGetSaldoSimpanan, dbUpdateSaldoSimpanan,
  dbGetSaldoPiutang, dbUpdateSaldoPiutang,
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
  saldoAwal: Record<string, number>
  jurnal: JurnalEntry[]
  nextJurnalId: number
  saldoSimpanan: SaldoSimpanan[]
  piutangSP: PiutangSP[]
  saldoToko: SaldoToko[]
  shuConfig: SHUConfig
  syncStatus: 'idle' | 'loading' | 'synced' | 'error'

  // actions
  setIdentitas: (data: Identitas) => void
  addAnggota: (a: Omit<Anggota, 'id'>) => void
  updateAnggota: (id: number, data: Partial<Omit<Anggota, 'id'>>) => void
  deleteAnggota: (id: number) => void
  setSaldoAwal: (saldo: Record<string, number>) => void
  updateSaldoAkun: (kode: string, val: number) => void
  addJurnal: (entry: Omit<JurnalEntry, 'id'>) => void
  updateJurnal: (id: number, entry: Omit<JurnalEntry, 'id'>) => void
  deleteJurnal: (id: number) => void
  updateSaldoSimpanan: (anggotaId: number, data: Partial<Omit<SaldoSimpanan, 'anggotaId'>>) => void
  updatePiutangSP: (anggotaId: number, saldo: number, saldoJasa?: number) => void
  updateSaldoToko: (anggotaId: number, saldo: number) => void
  setSHUConfig: (cfg: Partial<SHUConfig>) => void
  syncFromSupabase: () => Promise<void>
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

const defaultSaldoSimpanan: SaldoSimpanan[] = SALDO_SIMPANAN_MASTER.map(s => ({
  anggotaId: s.anggotaNo, pokok: s.pokok, wajib: s.wajib,
  wajib_khs: s.wajib_khs, sukarela: s.sukarela, jasa_suk: s.jasa_suk,
  tht: s.tht, jasa_tht: s.jasa_tht, pinjaman: s.pinjaman,
}))

const defaultPiutangSP: PiutangSP[] = SALDO_SIMPANAN_MASTER
  .filter(s => s.pinjaman > 0 || (s.saldoAwalJasa ?? 0) > 0)
  .map(s => ({
    anggotaId:    s.anggotaNo,
    saldoAwal:    s.pinjaman,
    saldoAwalJasa: s.saldoAwalJasa ?? 0,
  }))

// ── Store ─────────────────────────────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      identitas:     defaultIdentitas,
      anggota:       defaultAnggota,
      nextAnggotaId: defaultAnggota.length + 1,
      saldoAwal:     {},
      jurnal:        [],
      nextJurnalId:  1,
      saldoSimpanan: defaultSaldoSimpanan,
      piutangSP:     defaultPiutangSP,
      saldoToko:     [],
      shuConfig:     defaultSHU,
      syncStatus:    'idle',

      // ── Sync dari Supabase → overwrite state lokal sepenuhnya ────────
      syncFromSupabase: async () => {
        set({ syncStatus: 'loading' })
        try {
          const [identitas, saldoAwal, jurnal, saldoSimpanan, piutangSP] = await Promise.all([
            dbGetIdentitas(),
            dbGetSaldoAwal(),
            dbGetJurnal(),
            dbGetSaldoSimpanan(),
            dbGetSaldoPiutang(),
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
      addAnggota: (a) => set((s) => ({
        anggota: [...s.anggota, { ...a, id: s.nextAnggotaId }],
        nextAnggotaId: s.nextAnggotaId + 1,
      })),
      updateAnggota: (id, data) => set((s) => ({
        anggota: s.anggota.map(a => a.id === id ? { ...a, ...data } : a),
      })),
      deleteAnggota: (id) => set((s) => ({
        anggota: s.anggota.filter(a => a.id !== id),
      })),

      // ── Saldo Awal ────────────────────────────────────────────────────
      setSaldoAwal: (saldo) => {
        set({ saldoAwal: saldo })
        dbSetSaldoAwal(saldo)
      },
      updateSaldoAkun: (kode, val) => {
        set((s) => ({ saldoAwal: { ...s.saldoAwal, [kode]: val } }))
        dbUpdateSaldoAkun(kode, val)
      },

      // ── Jurnal ────────────────────────────────────────────────────────
      addJurnal: async (entry) => {
        // Optimistic update dulu
        const tmpId = get().nextJurnalId
        set((s) => ({
          jurnal: [{ ...entry, id: tmpId }, ...s.jurnal],
          nextJurnalId: s.nextJurnalId + 1,
        }))
        // Simpan ke Supabase, update id dengan id asli
        const realId = await dbAddJurnal(entry)
        set((s) => ({
          jurnal: s.jurnal.map(j => j.id === tmpId ? { ...j, id: realId } : j),
        }))
      },
      updateJurnal: (id, entry) => {
        set((s) => ({
          jurnal: s.jurnal.map(j => j.id === id ? { ...j, ...entry } : j),
        }))
        dbUpdateJurnal(id, entry)
      },
      deleteJurnal: (id) => {
        set((s) => ({ jurnal: s.jurnal.filter(j => j.id !== id) }))
        dbDeleteJurnal(id)
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
          if (record) dbUpdateSaldoSimpanan(record)
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
          dbUpdateSaldoPiutang(anggotaId, saldo, newJasa)
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

      resetAll: () => set({
        identitas: defaultIdentitas,
        anggota: defaultAnggota,
        nextAnggotaId: defaultAnggota.length + 1,
        saldoAwal: {},
        jurnal: [],
        nextJurnalId: 1,
        saldoSimpanan: defaultSaldoSimpanan,
        piutangSP: defaultPiutangSP,
        saldoToko: [],
        shuConfig: defaultSHU,
        syncStatus: 'idle',
      }),
    }),
    { name: 'sia-koperasi-v5' }
  )
)
