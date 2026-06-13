import { COA } from './coa'
import type { JurnalEntry } from '../types'
import type { Akun } from '../types'

// Load COA including custom edits from localStorage
function getAllCOA(): Akun[] {
  try {
    const custom: Akun[] = JSON.parse(localStorage.getItem('sia-koperasi-custom-coa') || '[]')
    // Merge: custom overrides standard COA
    const merged = [...COA]
    custom.forEach(ca => {
      const idx = merged.findIndex(a => a.kode === ca.kode)
      if (idx >= 0) merged[idx] = ca
      else merged.push(ca)
    })
    return merged
  } catch { return COA }
}

/** Format number to Indonesian Rupiah */
export const fmt = (n: number | undefined | null): string => {
  if (n === undefined || n === null) return '-'
  return new Intl.NumberFormat('id-ID').format(Math.round(n))
}

/** Format with Rp prefix */
export const fmtRp = (n: number): string => `Rp ${fmt(n)}`

/** Compute current balance for every account */
export function computeSaldos(
  saldoAwal: Record<string, number>,
  jurnal: JurnalEntry[]
): Record<string, number> {
  const allCOA = getAllCOA()
  const saldo: Record<string, number> = {}

  // seed from saldo awal
  allCOA.forEach(a => { saldo[a.kode] = saldoAwal[a.kode] ?? 0 })

  jurnal.forEach(j => {
    j.rows.forEach(r => {
      // Handle both positive and negative values
      if (r.kode_d && r.debet !== 0 && r.debet !== undefined) {
        saldo[r.kode_d] = (saldo[r.kode_d] ?? 0) + (r.debet || 0)
      }
      if (r.kode_k && r.kredit !== 0 && r.kredit !== undefined) {
        const akun = allCOA.find(a => a.kode === r.kode_k)
        if (akun) {
          if (akun.tipe === 'D') {
            saldo[r.kode_k] = (saldo[r.kode_k] ?? 0) - (r.kredit || 0)
          } else {
            saldo[r.kode_k] = (saldo[r.kode_k] ?? 0) + (r.kredit || 0)
          }
        } else {
          // Unknown akun (custom) - just add
          saldo[r.kode_k] = (saldo[r.kode_k] ?? 0) + (r.kredit || 0)
        }
      }
    })
  })

  return saldo
}

/** Running balance for buku besar */
export interface BukuBesarRow {
  tanggal: string
  referensi: string
  keterangan: string
  debet: number | null
  kredit: number | null
  saldo: number
  tipe: 'saldo_awal' | 'mutasi'
}

export function getBukuBesar(
  kode: string,
  saldoAwal: Record<string, number>,
  jurnal: JurnalEntry[],
  dari?: string,
  sampai?: string
): BukuBesarRow[] {
  const allCOA = getAllCOA()
  const akun = allCOA.find(a => a.kode === kode)
  if (!akun) return []

  const sb = saldoAwal[kode] ?? 0
  let saldo = sb
  const rows: BukuBesarRow[] = []

  rows.push({
    tanggal: '-', referensi: '-', keterangan: 'Saldo Awal',
    debet: null, kredit: null, saldo: sb, tipe: 'saldo_awal',
  })

  const filtered = jurnal.filter(j => {
    if (dari && j.tanggal < dari) return false
    if (sampai && j.tanggal > sampai) return false
    return true
  })

  filtered.forEach(j => {
    j.rows.forEach(r => {
      if (r.kode_d === kode && r.debet) {
        saldo += r.debet
        rows.push({ tanggal: j.tanggal, referensi: j.nobukti, keterangan: j.keterangan, debet: r.debet, kredit: null, saldo, tipe: 'mutasi' })
      }
      if (r.kode_k === kode && r.kredit) {
        if (akun.tipe === 'D') saldo -= r.kredit
        else saldo += r.kredit
        rows.push({ tanggal: j.tanggal, referensi: j.nobukti, keterangan: j.keterangan, debet: null, kredit: r.kredit, saldo, tipe: 'mutasi' })
      }
    })
  })

  return rows
}

/** Neraca calculation */
export function calcNeraca(saldos: Record<string, number>, shuBersih?: number) {
  const r = (k: string) => saldos[k] ?? 0
  const sum = (ks: string[]) => ks.reduce((a, k) => a + r(k), 0)

  const kasBank         = sum(['1.1.1','1.1.2'])
  const piutangBruto    = sum(['1.1.4','1.1.5'])
  const penyisihan      = r('1.1.7')
  const piutangNeto     = piutangBruto - penyisihan
  const persediaan      = r('1.1.8') + r('1.1.9') - r('1.1.10') + r('1.1.11')
  const asetLancarLain  = sum(['1.1.12','1.1.13','1.1.14'])
  const totalAsetLancar = kasBank + piutangNeto + persediaan + asetLancarLain

  const investasi         = sum(['1.2.1','1.2.2','1.2.3','1.2.4','1.2.5','1.2.6'])
  const asetTetapBruto    = sum(['1.2.7','1.2.8','1.2.9','1.2.10'])
  const akumPenyusutan    = r('1.2.11') + r('1.2.12') + r('1.2.13')
  const asetTetapNeto     = asetTetapBruto - akumPenyusutan
  const totalAsetTdkLancar= investasi + asetTetapNeto
  const totalAset         = totalAsetLancar + totalAsetTdkLancar

  const kewJkPendek  = sum(['2.1.1','2.1.2','2.1.3','2.1.4','2.1.5','2.1.6','2.1.7','2.1.8','2.1.9','2.1.10','2.1.11','2.1.12','2.1.13','2.1.14'])
  const kewJkPanjang = sum(['2.2.1','2.2.2','2.2.3','2.2.4'])
  const totalKewajiban = kewJkPendek + kewJkPanjang

  const sp  = r('3.1.1'), sw = r('3.1.2'), hibah = r('3.1.3')
  const cad = r('3.1.4'), shuLL = r('3.1.5')
  // SHU Periode Berjalan: gunakan nilai dari calcSHU jika ada, fallback ke saldo akun 3.1.6
  const shuPB = shuBersih !== undefined ? shuBersih : r('3.1.6')
  const totalEkuitas = sp + sw + hibah + cad + shuLL + shuPB
  const totalKewEk   = totalKewajiban + totalEkuitas

  return {
    kasBank, piutangNeto, persediaan, asetLancarLain, totalAsetLancar,
    investasi, asetTetapNeto, totalAsetTdkLancar, totalAset,
    kewJkPendek, kewJkPanjang, totalKewajiban,
    sp, sw, hibah, cad, shuLL, shuPB, totalEkuitas, totalKewEk,
    seimbang: Math.abs(totalAset - totalKewEk) < 1,
  }
}


/** Laba/Rugi (SHU) calculation */
export function calcSHU(saldos: Record<string, number>) {
  const r = (k: string) => saldos[k] ?? 0
  const sum = (ks: string[]) => ks.reduce((a, k) => a + r(k), 0)

  const pendJasaBunga = r('4.1.1')
  const pendAdm       = r('4.1.2')
  const pendDenda     = r('4.1.3')
  const penjToko      = r('4.1.4') - r('4.1.6')
  const pendKons      = r('4.1.5')
  const totalPendUsaha = pendJasaBunga + pendAdm + pendDenda + penjToko + pendKons

  const hpp         = r('5.1.1')
  const bebanBunga  = r('5.1.2')
  const bebanJual   = sum(['5.1.3','5.1.4','5.1.5','5.1.6'])
  const labaKotor   = totalPendUsaha - (hpp + bebanBunga + bebanJual)

  const bebanAdm = sum(['5.1.7','5.1.8','5.1.9','5.1.10','5.1.11','5.1.12','5.1.13','5.1.14','5.1.15'])
  const bebanKop = sum(['5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'])
  const shuUsaha = labaKotor - bebanAdm - bebanKop

  const pendLuar  = sum(['4.2.1','4.2.2','4.2.3'])
  const bebanLuar = sum(['5.2.1','5.2.2','5.2.3'])
  const shuBersih = shuUsaha + pendLuar - bebanLuar

  return {
    pendJasaBunga, pendAdm, pendDenda, penjToko, pendKons, totalPendUsaha,
    hpp, bebanBunga, bebanJual, labaKotor,
    bebanAdm, bebanKop, shuUsaha,
    pendLuar, bebanLuar, shuBersih,
  }
}

/** Arus Kas (Direct Method) */
export function calcArusKas(saldos: Record<string, number>, saldoAwal: Record<string, number>) {
  const r = (k: string) => saldos[k] ?? 0
  const sa = (k: string) => saldoAwal[k] ?? 0
  const sum = (ks: string[]) => ks.reduce((a, k) => a + r(k), 0)

  const penerimaanOp = r('4.1.1') + r('4.1.2') + r('4.1.3') + r('4.1.4') + r('4.1.5')
                     + r('2.1.8') + r('2.1.9') + r('2.2.3')
  const pengeluaranOp = r('5.1.1') + sum(['5.1.2','5.1.3','5.1.4','5.1.5','5.1.6',
                         '5.1.7','5.1.8','5.1.9','5.1.10','5.1.12','5.1.13','5.1.14',
                         '5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'])
  const netOperasi = penerimaanOp - pengeluaranOp

  const investIn  = r('4.2.2')
  const investOut = r('1.2.4') + r('1.2.5') + r('1.2.6') + r('1.2.7')
  const netInvestasi = investIn - investOut

  const pendanIn  = r('3.1.1') + r('3.1.2') + r('3.1.3') + r('2.2.4')
  const pendanOut = 0
  const netPendanaan = pendanIn - pendanOut

  const kasAwal  = (sa('1.1.1') ?? 0) + (sa('1.1.2') ?? 0)
  const kasAkhir = r('1.1.1') + r('1.1.2')

  return {
    penerimaanOp, pengeluaranOp, netOperasi,
    investIn, investOut, netInvestasi,
    pendanIn, pendanOut, netPendanaan,
    kasAwal, kasAkhir,
    netKas: netOperasi + netInvestasi + netPendanaan,
  }
}

// ─── Akun simpanan yang relevan ───────────────────────────────────────────
export const AKUN_KAS_BANK = ['1.1.1', '1.1.2']
export const AKUN_SIMPANAN_MAP: Record<string, 'wajib' | 'wajib_khs' | 'sukarela' | 'jasa_suk' | 'tht' | 'jasa_tht'> = {
  '3.1.2':  'wajib',     // Simpanan Wajib (Ekuitas)
  '2.1.10': 'wajib_khs', // Simpanan Wajib Khusus
  '2.1.9':  'sukarela',  // Simpanan Sukarela
  '5.1.2':  'jasa_suk',  // Beban Bunga Simpanan Sukarela
  '2.1.14': 'tht',       // Tabungan Hari Tua
  '4.2.3':  'jasa_tht',  // Keuntungan Di Luar Usaha Lainnya (Jasa THT)
}

export interface MutasiSimpananBulan {
  wajib:    number
  wajib_khs: number
  sukarela: number
  jasa_suk: number
  tht:      number
  jasa_tht: number
}

export type MutasiSimpananAnggota = Record<string, Record<number, MutasiSimpananBulan>>
// key = nama anggota (lowercase), value = Record<bulan 1-12, mutasi>

/**
 * Hitung mutasi simpanan per anggota per bulan dari jurnal.
 * Logic sama persis dengan formula SUMIFS di sheet SIMPANAN Excel:
 *   - Setoran: debet ∈ {1.1.1,1.1.2} DAN kredit ∈ akun simpanan, nama = anggota, bulan = M
 *   - Penarikan: debet ∈ akun simpanan DAN kredit ∈ {1.1.1,1.1.2}, nama = anggota, bulan = M
 * Net = setoran - penarikan
 */
export function calcSimpananBulanan(jurnal: JurnalEntry[]): MutasiSimpananAnggota {
  const result: MutasiSimpananAnggota = {}

  const emptyBulan = (): MutasiSimpananBulan => ({ wajib: 0, wajib_khs: 0, sukarela: 0, jasa_suk: 0, tht: 0, jasa_tht: 0 })

  jurnal.forEach(j => {
    if (!j.tanggal) return
    const bulan = new Date(j.tanggal).getMonth() + 1

    j.rows.forEach(r => {
      const nama = (r.ket || '').trim()
      if (!nama) return

      const debet  = r.debet  || 0
      const kredit = r.kredit || 0
      if (!debet && !kredit) return

      const key = nama.toLowerCase()
      if (!result[key]) result[key] = {}
      if (!result[key][bulan]) result[key][bulan] = emptyBulan()

      const mut = result[key][bulan]

      // Tentukan jenis simpanan dari akun yang terlibat
      // Cek akun kredit dulu (simpanan biasanya di sisi kredit)
      const jenisDariKredit = AKUN_SIMPANAN_MAP[r.kode_k]
      const jenisDariDebet  = AKUN_SIMPANAN_MAP[r.kode_d]
      // Fallback: jika akun tidak dikenali, masukkan ke 'wajib'
      const jenis: keyof MutasiSimpananBulan = jenisDariKredit || jenisDariDebet || 'wajib'

      if (kredit > 0) {
        // Kredit → simpanan anggota BERTAMBAH (setoran)
        mut[jenis] += kredit
      }
      if (debet > 0) {
        // Debet → simpanan anggota BERKURANG (penarikan)
        mut[jenis] -= debet
      }
    })
  })

  return result
}

// ─── Piutang SP per anggota per bulan ────────────────────────────────────
export interface MutasiPiutangBulan {
  pokok: number      // angsuran pokok (Dr Kas/Bank | Cr 1.1.4) per bulan
  jasa: number       // jasa/bunga (Dr Kas/Bank | Cr 4.1.1) per bulan
}

export type MutasiPiutangAnggota = Record<string, {
  saldoAwal: number        // saldo awal pokok
  saldoAwalJasa: number    // saldo awal jasa
  realisasiPokok: number   // pencairan pokok (Dr side)
  realisasiJasa: number    // jasa baru ditetapkan (Cr 4.1.1 tanpa kas = penetapan)
  bulan: Record<number, MutasiPiutangBulan>
  saldoPokok: number       // saldo akhir pokok = SA + realisasiPokok - Σ angsuran pokok
  saldoAkhirJasa: number   // saldo akhir jasa = SAJasa + realisasiJasa - Σ bayar jasa
}>

/**
 * Hitung piutang SP per anggota per bulan dari jurnal.
 * - Debet > 0 → realisasi pokok (piutang bertambah)
 * - Kredit ke 4.1.1 → jasa/bunga per bulan
 * - Kredit lainnya → angsuran pokok per bulan
 * SALDO POKOK AKHIR = saldoAwal + realisasiPokok - Σ pokok
 * SALDO AKHIR JASA  = saldoAwalJasa + realisasiJasa - Σ jasa
 */
export function calcPiutangSPBulanan(
  jurnal: JurnalEntry[],
  saldoAwalPiutang: Record<string, number>,
  saldoAwalJasaMap: Record<string, number>
): MutasiPiutangAnggota {
  const result: MutasiPiutangAnggota = {}

  const ensureAnggota = (nama: string) => {
    const k = nama.toLowerCase()
    if (!result[k]) {
      result[k] = {
        saldoAwal:      saldoAwalPiutang[k] ?? 0,
        saldoAwalJasa:  saldoAwalJasaMap[k] ?? 0,
        realisasiPokok: 0,
        realisasiJasa:  0,
        bulan: {},
        saldoPokok:     saldoAwalPiutang[k] ?? 0,
        saldoAkhirJasa: saldoAwalJasaMap[k] ?? 0,
      }
      for (let b = 1; b <= 12; b++) result[k].bulan[b] = { pokok: 0, jasa: 0 }
    }
    return k
  }

  jurnal.forEach(j => {
    if (!j.tanggal) return
    const bulan = new Date(j.tanggal).getMonth() + 1

    j.rows.forEach(r => {
      const nama = (r.ket || '').trim()
      if (!nama) return

      const debet  = r.debet  || 0
      const kredit = r.kredit || 0
      if (!debet && !kredit) return

      const k = ensureAnggota(nama)

      if (debet > 0) {
        // Debet → realisasi pokok (piutang bertambah)
        result[k].realisasiPokok += debet
      }

      if (kredit > 0) {
        if (r.kode_k === '4.1.1') {
          // Jasa/bunga per bulan
          result[k].bulan[bulan].jasa += kredit
        } else {
          // Angsuran pokok per bulan
          result[k].bulan[bulan].pokok += kredit
        }
      }
    })
  })

  // Hitung saldo akhir
  Object.values(result).forEach(a => {
    const totalPokok = Object.values(a.bulan).reduce((s, b) => s + b.pokok, 0)
    const totalJasa  = Object.values(a.bulan).reduce((s, b) => s + b.jasa, 0)
    a.saldoPokok     = a.saldoAwal + a.realisasiPokok - totalPokok
    a.saldoAkhirJasa = a.saldoAwalJasa + a.realisasiJasa - totalJasa
  })

  return result
}
