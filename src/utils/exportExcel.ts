import * as XLSX from 'xlsx'
import type { Identitas } from '../types'

// ── Helper: buat worksheet dari array of arrays ───────────────────────────
function ws(data: (string | number | null)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data)
}

// ── Helper: style kolom lebar ──────────────────────────────────────────────
function colWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }))
}

// ── Helper: merge cells ────────────────────────────────────────────────────
function merges(ws: XLSX.WorkSheet, ranges: string[]) {
  ws['!merges'] = ranges.map(r => XLSX.utils.decode_range(r))
}

// ── Helper: download file ──────────────────────────────────────────────────
function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// ── Format angka rupiah (tanpa simbol) ────────────────────────────────────
function n(val: number): number { return val }

// ── REKAP SIMPANAN & PINJAMAN ─────────────────────────────────────────────
export interface RekapRow {
  no: number
  nama: string
  pokok: number
  wajib: number
  wajib_khs: number
  sukarela: number
  jasa_suk: number
  tht: number
  jasa_tht: number
  jumlah: number
  pinjaman: number
}

export function exportSimpananPinjaman(
  identitas: Identitas,
  rows: RekapRow[]
) {
  const title1 = 'REKAPITULASI SIMPANAN DAN PINJAMAN PEGAWAI'
  const title2 = (identitas.nama || 'KOPERASI').toUpperCase()
  const akhir  = identitas.akhir || new Date().toISOString().split('T')[0]
  const title3 = `PER ${formatTanggal(akhir)}`

  const header = [
    'NO', 'NAMA',
    'SIMPANAN\nPOKOK', 'SIMPANAN\nWAJIB', 'SIMPANAN\nWAJIB KHUSUS',
    'SIMPANAN\nSUKARELA', 'JASA SIMP\nSUKARELA', 'THT', 'JASA\nTHT',
    'JUMLAH', 'SALDO\nPINJAMAN',
  ]

  // Total
  const tot = {
    pokok:    rows.reduce((s,r)=>s+r.pokok,0),
    wajib:    rows.reduce((s,r)=>s+r.wajib,0),
    wajib_khs:rows.reduce((s,r)=>s+r.wajib_khs,0),
    sukarela: rows.reduce((s,r)=>s+r.sukarela,0),
    jasa_suk: rows.reduce((s,r)=>s+r.jasa_suk,0),
    tht:      rows.reduce((s,r)=>s+r.tht,0),
    jasa_tht: rows.reduce((s,r)=>s+r.jasa_tht,0),
    jumlah:   rows.reduce((s,r)=>s+r.jumlah,0),
    pinjaman: rows.reduce((s,r)=>s+r.pinjaman,0),
  }

  const data: (string|number|null)[][] = [
    [title1, null,null,null,null,null,null,null,null,null,null],
    [title2, null,null,null,null,null,null,null,null,null,null],
    [title3, null,null,null,null,null,null,null,null,null,null],
    [],
    [],
    header,
    [],
    [],
    ...rows.map(r => [
      r.no, r.nama,
      n(r.pokok), n(r.wajib), n(r.wajib_khs),
      n(r.sukarela), n(r.jasa_suk), n(r.tht), n(r.jasa_tht),
      n(r.jumlah), n(r.pinjaman),
    ]),
    [],
    [
      null, 'TOTAL',
      n(tot.pokok), n(tot.wajib), n(tot.wajib_khs),
      n(tot.sukarela), n(tot.jasa_suk), n(tot.tht), n(tot.jasa_tht),
      n(tot.jumlah), n(tot.pinjaman),
    ],
  ]

  const sheet = ws(data)
  merges(sheet, ['A1:K1','A2:K2','A3:K3'])
  colWidths(sheet, [5, 35, 14, 14, 14, 14, 14, 12, 12, 16, 16])

  // Format angka
  const numFmt = '#,##0'
  const numCols = [2,3,4,5,6,7,8,9,10] // 0-based
  for (let r = 9; r <= data.length; r++) {
    numCols.forEach(c => {
      const cell = XLSX.utils.encode_cell({ r, c })
      if (sheet[cell]) sheet[cell].t = 'n'
      if (sheet[cell]) sheet[cell].z = numFmt
    })
  }

  sheet['!rows'] = [{ hpt: 20 },{ hpt: 20 },{ hpt: 20 },{},{},{ hpt: 30 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'REKAP SIMPANAN')
  download(wb, `Rekap_Simpanan_Pinjaman_${new Date().getFullYear()}.xlsx`)
}

// ── JURNAL UMUM ───────────────────────────────────────────────────────────
export function exportJurnal(
  identitas: Identitas,
  jurnal: { id:number; tanggal:string; nobukti:string; keterangan:string;
            rows:{ket:string;kode_d:string;debet:number;kode_k:string;kredit:number}[];
            total:number }[]
) {
  const sorted = [...jurnal].sort((a,b)=>a.tanggal.localeCompare(b.tanggal))
  const data: (string|number|null)[][] = [
    ['JURNAL UMUM', null,null,null,null,null],
    [identitas.nama, null,null,null,null,null],
    [`Periode: ${identitas.awal} s/d ${identitas.akhir}`, null,null,null,null,null],
    [],
    ['TANGGAL','NO. BUKTI','KETERANGAN','NAMA ANGGOTA','AKUN D','DEBET','AKUN K','KREDIT'],
  ]

  sorted.forEach(j => {
    j.rows.forEach(r => {
      data.push([j.tanggal, j.nobukti, j.keterangan, r.ket||'', r.kode_d, n(r.debet||0), r.kode_k, n(r.kredit||0)])
    })
  })

  const totalD = sorted.reduce((s,j)=>s+j.rows.reduce((x,r)=>x+(r.debet||0),0),0)
  data.push([])
  data.push([null,null,null,null,'TOTAL DEBET', n(totalD), 'TOTAL KREDIT', n(totalD)])

  const sheet = ws(data)
  colWidths(sheet, [12,12,30,28,10,16,10,16])
  merges(sheet, ['A1:H1','A2:H2','A3:H3'])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Jurnal Umum')
  download(wb, `Jurnal_Umum_${identitas.tahun}.xlsx`)
}

// ── BUKU BESAR ────────────────────────────────────────────────────────────
export function exportBukuBesar(
  identitas: Identitas,
  rows: { tanggal:string; keterangan:string; debet:number; kredit:number; saldo:number }[],
  namaAkun: string, kodeAkun: string, saldoAwal: number
) {
  const data: (string|number|null)[][] = [
    ['BUKU BESAR', null,null,null,null],
    [identitas.nama, null,null,null,null],
    [`Akun: ${kodeAkun} - ${namaAkun}`, null,null,null,null],
    [`Periode: ${identitas.awal} s/d ${identitas.akhir}`, null,null,null,null],
    [],
    ['TANGGAL','KETERANGAN','DEBET','KREDIT','SALDO'],
    [null,'Saldo Awal',null,null,n(saldoAwal)],
    ...rows.map(r=>[r.tanggal, r.keterangan, n(r.debet), n(r.kredit), n(r.saldo)]),
  ]

  const sheet = ws(data)
  colWidths(sheet, [12,35,16,16,16])
  merges(sheet, ['A1:E1','A2:E2','A3:E3','A4:E4'])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Buku Besar')
  download(wb, `Buku_Besar_${kodeAkun}_${identitas.tahun}.xlsx`)
}

// ── NERACA ────────────────────────────────────────────────────────────────
export function exportNeraca(identitas: Identitas, neraca: ReturnType<typeof import('./accounting').calcNeraca>) {
  const {
    kasBank, piutangNeto, persediaan, asetLancarLain, totalAsetLancar,
    investasi, asetTetapNeto, totalAsetTdkLancar, totalAset,
    kewJkPendek, kewJkPanjang, totalKewajiban,
    sp, sw, hibah, cad, shuLL, shuPB, totalEkuitas, totalKewEk,
  } = neraca

  const data: (string|number|null)[][] = [
    ['LAPORAN POSISI KEUANGAN (NERACA)', null, null],
    [identitas.nama, null, null],
    [identitas.akhir || '', null, null],
    [],
    ['ASET', null, null],
    ['Aset Lancar', null, null],
    ['  Kas dan Bank',                 null, n(kasBank)],
    ['  Piutang (Neto)',               null, n(piutangNeto)],
    ['  Persediaan',                   null, n(persediaan)],
    ['  Aset Lancar Lain',             null, n(asetLancarLain)],
    ['  JUMLAH ASET LANCAR',           null, n(totalAsetLancar)],
    ['Aset Tidak Lancar', null, null],
    ['  Investasi Jangka Panjang',     null, n(investasi)],
    ['  Aset Tetap (Neto)',            null, n(asetTetapNeto)],
    ['  JUMLAH ASET TIDAK LANCAR',     null, n(totalAsetTdkLancar)],
    ['TOTAL ASET',                     null, n(totalAset)],
    [],
    ['KEWAJIBAN DAN EKUITAS', null, null],
    ['  Kewajiban Jangka Pendek',      null, n(kewJkPendek)],
    ['  Kewajiban Jangka Panjang',     null, n(kewJkPanjang)],
    ['TOTAL KEWAJIBAN',                null, n(totalKewajiban)],
    [],
    ['Ekuitas', null, null],
    ['  Simpanan Pokok',               null, n(sp)],
    ['  Simpanan Wajib',               null, n(sw)],
    ['  Hibah',                        null, n(hibah)],
    ['  Cadangan',                     null, n(cad)],
    ['  SHU Tahun Lalu',               null, n(shuLL)],
    ['  SHU Periode Berjalan',         null, n(shuPB)],
    ['TOTAL EKUITAS',                  null, n(totalEkuitas)],
    ['TOTAL KEWAJIBAN DAN EKUITAS',    null, n(totalKewEk)],
  ]

  const sheet = ws(data)
  colWidths(sheet, [35, 5, 18])
  merges(sheet, ['A1:C1','A2:C2','A3:C3'])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Neraca')
  download(wb, `Neraca_${identitas.tahun}.xlsx`)
}

// ── LABA RUGI / SHU ───────────────────────────────────────────────────────
export function exportSHU(identitas: Identitas, shu: ReturnType<typeof import('./accounting').calcSHU>) {
  const {
    pendJasaBunga, pendAdm, pendDenda, penjToko, pendKons, totalPendUsaha,
    hpp, bebanBunga, bebanJual, labaKotor,
    bebanAdm, bebanKop, shuUsaha,
    pendLuar, bebanLuar, shuBersih,
  } = shu

  const data: (string|number|null)[][] = [
    ['LAPORAN PERHITUNGAN HASIL USAHA', null, null],
    [identitas.nama, null, null],
    [`Periode: ${identitas.awal} s/d ${identitas.akhir}`, null, null],
    [],
    ['PENDAPATAN USAHA', null, null],
    ['  Pendapatan Jasa Pinjaman',     null, n(pendJasaBunga)],
    ['  Pendapatan Administrasi',      null, n(pendAdm)],
    ['  Pendapatan Denda',             null, n(pendDenda)],
    ['  Penjualan Toko',               null, n(penjToko)],
    ['  Pendapatan Konsinyasi',        null, n(pendKons)],
    ['TOTAL PENDAPATAN USAHA',         null, n(totalPendUsaha)],
    [],
    ['BEBAN USAHA', null, null],
    ['  HPP Toko',                     null, n(hpp)],
    ['  Beban Bunga Simpanan',         null, n(bebanBunga)],
    ['  Beban Penjualan',              null, n(bebanJual)],
    ['  LABA KOTOR',                   null, n(labaKotor)],
    [],
    ['  Beban Administrasi & Umum',    null, n(bebanAdm)],
    ['  Beban Perkoperasian',          null, n(bebanKop)],
    ['  SHU USAHA',                    null, n(shuUsaha)],
    [],
    ['  Pendapatan Luar Usaha',        null, n(pendLuar)],
    ['  Beban Luar Usaha',             null, n(bebanLuar)],
    ['SHU BERSIH',                     null, n(shuBersih)],
  ]

  const sheet = ws(data)
  colWidths(sheet, [35, 5, 18])
  merges(sheet, ['A1:C1','A2:C2','A3:C3'])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Laba Rugi')
  download(wb, `Laba_Rugi_${identitas.tahun}.xlsx`)
}

// ── ARUS KAS ──────────────────────────────────────────────────────────────
export function exportArusKas(identitas: Identitas, ak: ReturnType<typeof import('./accounting').calcArusKas>) {
  const {
    penerimaanOp, pengeluaranOp, netOperasi,
    investIn, investOut, netInvestasi,
    pendanIn, pendanOut, netPendanaan,
    kasAwal, kasAkhir,
  } = ak

  const data: (string|number|null)[][] = [
    ['LAPORAN ARUS KAS', null, null],
    [identitas.nama, null, null],
    [`Periode: ${identitas.awal} s/d ${identitas.akhir}`, null, null],
    [],
    ['ARUS KAS DARI AKTIVITAS OPERASI',  null, null],
    ['  Penerimaan Operasional',          null, n(penerimaanOp)],
    ['  Pengeluaran Operasional',         null, n(-pengeluaranOp)],
    ['  Arus Kas Bersih Operasi',         null, n(netOperasi)],
    [],
    ['ARUS KAS DARI AKTIVITAS INVESTASI', null, null],
    ['  Penjualan Aset',                  null, n(investIn)],
    ['  Pembelian Aset',                  null, n(-investOut)],
    ['  Arus Kas Bersih Investasi',        null, n(netInvestasi)],
    [],
    ['ARUS KAS DARI AKTIVITAS PENDANAAN', null, null],
    ['  Penerimaan Pendanaan',             null, n(pendanIn)],
    ['  Pengeluaran Pendanaan',            null, n(-pendanOut)],
    ['  Arus Kas Bersih Pendanaan',        null, n(netPendanaan)],
    [],
    ['KAS AWAL PERIODE',                  null, n(kasAwal)],
    ['KAS AKHIR PERIODE',                 null, n(kasAkhir)],
  ]

  const sheet = ws(data)
  colWidths(sheet, [35, 5, 18])
  merges(sheet, ['A1:C1','A2:C2','A3:C3'])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Arus Kas')
  download(wb, `Arus_Kas_${identitas.tahun}.xlsx`)
}

// ── PIUTANG SP ────────────────────────────────────────────────────────────
export interface PiutangRow {
  no: number; nama: string; saldoAwal: number; realisasi: number
  bulan: Record<number, { pokok: number; jasa: number }>
  saldoPokok: number; totalJasa: number
}

export function exportPiutangSP(identitas: Identitas, rows: PiutangRow[]) {
  const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

  const header1: (string|null)[] = ['NO','NAMA','SALDO AWAL','REALISASI']
  BULAN.forEach(b => { header1.push(b); header1.push(null) })
  header1.push('SALDO POKOK','JML JASA')

  const header2: (string|null)[] = [null,null,null,null]
  BULAN.forEach(() => { header2.push('POKOK'); header2.push('JASA') })
  header2.push(null,null)

  const data: (string|number|null)[][] = [
    ['BUKU PEMBANTU PIUTANG SIMPAN PINJAM',null,null,null,...Array(28).fill(null)],
    [identitas.nama,null,null,null,...Array(28).fill(null)],
    [`Periode: ${identitas.awal} s/d ${identitas.akhir}`,null,null,null,...Array(28).fill(null)],
    [],
    header1,
    header2,
    ...rows.map(r => {
      const row: (string|number|null)[] = [r.no, r.nama, n(r.saldoAwal), n(r.realisasi)]
      for (let b = 1; b <= 12; b++) {
        row.push(n(r.bulan[b]?.pokok ?? 0))
        row.push(n(r.bulan[b]?.jasa ?? 0))
      }
      row.push(n(r.saldoPokok), n(r.totalJasa))
      return row
    }),
    [],
    (() => {
      const tot: (string|number|null)[] = [null,'TOTAL',
        n(rows.reduce((s,r)=>s+r.saldoAwal,0)),
        n(rows.reduce((s,r)=>s+r.realisasi,0))
      ]
      for (let b = 1; b <= 12; b++) {
        tot.push(n(rows.reduce((s,r)=>s+(r.bulan[b]?.pokok??0),0)))
        tot.push(n(rows.reduce((s,r)=>s+(r.bulan[b]?.jasa??0),0)))
      }
      tot.push(n(rows.reduce((s,r)=>s+r.saldoPokok,0)), n(rows.reduce((s,r)=>s+r.totalJasa,0)))
      return tot
    })(),
  ]

  const sheet = ws(data)
  const widths = [5, 35, 14, 14, ...Array(24).fill(12), 14, 12]
  colWidths(sheet, widths)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Piutang SP')
  download(wb, `Piutang_SP_${identitas.tahun}.xlsx`)
}

// ── Helper tanggal ────────────────────────────────────────────────────────
function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).toUpperCase()
}
