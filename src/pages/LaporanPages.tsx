import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { computeSaldos, calcNeraca, calcSHU, fmt } from '../utils/accounting'
import { mergeCustomCOA,} from '../utils/coa'
import type { Akun } from '../types'
import { PageHeader, PrintButton, DownloadButton, LapRow, LapHeader } from '../components/ui'
import { exportNeraca, exportSHU } from '../utils/exportExcel'

function ReportHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center mb-6 print-only-show">
      <p className="font-bold text-base">{title}</p>
      <p className="text-sm text-slate-500">{sub}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 1. NERACA
// ─────────────────────────────────────────────────────────────────────────
export function NeracaPage() {
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const neraca = useMemo(() => calcNeraca(saldos, shu.shuBersih), [saldos, shu])
  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])

  const isKontraAset = (a: Akun) => a.grup === 'ASET' && a.tipe === 'K'
  const asetLancar    = allCOA.filter(a => a.grup === 'ASET' && a.kelompok === 'Aset Lancar')
  const asetTdkLancar = allCOA.filter(a => a.grup === 'ASET' && a.kelompok === 'Aset Tidak Lancar')
  const kewJkPendek   = allCOA.filter(a => a.grup === 'KEWAJIBAN' && a.kelompok === 'Kewajiban Jk. Pendek')
  const kewJkPanjang  = allCOA.filter(a => a.grup === 'KEWAJIBAN' && a.kelompok === 'Kewajiban Jk. Panjang')
  const ekuitas       = allCOA.filter(a => a.grup === 'EKUITAS')

  const K = (kode: string) => saldos[kode] ?? 0
  const sumKelompok = (list: Akun[]) =>
    list.reduce((s, a) => s + (isKontraAset(a) ? -(K(a.kode)) : K(a.kode)), 0)

  const totalAsetLancar    = sumKelompok(asetLancar)
  const totalAsetTdkLancar = sumKelompok(asetTdkLancar)
  const totalAset          = totalAsetLancar + totalAsetTdkLancar
  const totalKewJkPendek   = sumKelompok(kewJkPendek)
  const totalKewJkPanjang  = sumKelompok(kewJkPanjang)
  const totalKewajiban     = totalKewJkPendek + totalKewJkPanjang
  const totalEkuitas       = ekuitas.reduce((s, a) => s + K(a.kode), 0)
  const totalKewEk         = totalKewajiban + totalEkuitas
  const selisih            = Math.abs(totalAset - totalKewEk)
  const seimbang           = selisih < 1

  const renderAkunBaris = (list: Akun[]) =>
    list.map(a => {
      const val      = K(a.kode)
      const isKontra = isKontraAset(a)
      return (
        <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`}
          value={isKontra ? -val : val} indent={1} negative={isKontra && val > 0} />
      )
    })

  return (
    <div className="p-6 max-w-2xl" id="print-neraca">
      <PageHeader title="Laporan Posisi Keuangan (Neraca)" subtitle={`Sesuai SAK EP — Per ${identitas.akhir}`}
        actions={
          <div className="flex gap-2 no-print">
            <PrintButton targetId="print-neraca" title="Laporan Posisi Keuangan (Neraca)" />
            <DownloadButton onClick={() => exportNeraca(identitas, neraca)} />
          </div>
        }
      />
      {!seimbang && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-4">
          ⚠ Neraca tidak seimbang — Selisih Rp {fmt(selisih)}. Periksa saldo awal dan jurnal Anda.
        </div>
      )}
      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN POSISI KEUANGAN · Per ${identitas.akhir}`} />
        <LapHeader label="ASET" />
        <LapHeader label="Aset Lancar" />
        {renderAkunBaris(asetLancar)}
        <LapRow label="Jumlah Aset Lancar" value={totalAsetLancar} variant="subtotal" />
        <LapHeader label="Aset Tidak Lancar" />
        {renderAkunBaris(asetTdkLancar)}
        <LapRow label="Jumlah Aset Tidak Lancar" value={totalAsetTdkLancar} variant="subtotal" />
        <LapRow label="JUMLAH ASET" value={totalAset} variant="total" />
        <div className="h-4" />
        <LapHeader label="KEWAJIBAN DAN EKUITAS" />
        <LapHeader label="Kewajiban Jangka Pendek" />
        {renderAkunBaris(kewJkPendek)}
        <LapRow label="Jumlah Kewajiban Jk. Pendek" value={totalKewJkPendek} variant="subtotal" />
        <LapHeader label="Kewajiban Jangka Panjang" />
        {renderAkunBaris(kewJkPanjang)}
        <LapRow label="Jumlah Kewajiban Jk. Panjang" value={totalKewJkPanjang} variant="subtotal" />
        <LapRow label="JUMLAH KEWAJIBAN" value={totalKewajiban} variant="total" />
        <div className="h-4" />
        <LapHeader label="EKUITAS" />
        {renderAkunBaris(ekuitas)}
        <LapRow label="JUMLAH EKUITAS" value={totalEkuitas} variant="total" />
        <LapRow label="JUMLAH KEWAJIBAN + EKUITAS" value={totalKewEk} variant="total" />
        <div className={`mt-3 text-right text-xs ${seimbang ? 'text-emerald-600' : 'text-red-600'}`}>
          {seimbang ? '✓ Neraca seimbang' : `⚠ Selisih: Rp ${fmt(selisih)}`}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 2. HASIL USAHA (PHU/SHU) — format sesuai Excel PHU CETAK
// ─────────────────────────────────────────────────────────────────────────
export function LabaRugiPage() {
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])
  const K = (k: string) => saldos[k] ?? 0

  // Ambil semua akun berdasarkan grup/kelompok — tampil semua, termasuk yang 0
  const pendUsaha    = useMemo(() => allCOA.filter(a => a.grup === 'PENDAPATAN' && a.kelompok === 'Pendapatan Usaha'),    [allCOA])
  const bebanLangsung= useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Pokok'),              [allCOA])
  const bebanUsahaL  = useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Usaha'),              [allCOA])
  const bebanAdmL    = useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Adm & Umum'),         [allCOA])
  const bebanKopL    = useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Perkoperasian'),      [allCOA])
  const pendLuarL    = useMemo(() => allCOA.filter(a => a.grup === 'PENDAPATAN' && a.kelompok === 'Pendapatan Luar Usaha'),[allCOA])
  const bebanLuarL   = useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Luar Usaha'),         [allCOA])

  const sum = (list: Akun[]) => list.reduce((t, a) => t + K(a.kode), 0)
  // Fallback ke kode default jika kelompok COA belum ada
  const fallbackKodes = (kodes: string[]) => kodes.map(k => allCOA.find(a => a.kode === k)).filter(Boolean) as Akun[]

  const renderAkun = (list: Akun[], fallback: string[]) => {
    const items = list.length > 0 ? list : fallbackKodes(fallback)
    return items.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} />)
  }

  const totalPend        = sum(pendUsaha)     || ['4.1.1','4.1.2','4.1.3','4.1.4','4.1.5','4.1.6','4.1.7','4.1.8'].reduce((s,k)=>s+K(k),0)
  const totalBLangsung   = sum(bebanLangsung) || K('5.1.1') + K('5.1.2')
  const shuKotor         = totalPend - totalBLangsung
  const totalBUsaha      = sum(bebanUsahaL)   || ['5.1.2','5.1.3','5.1.4','5.1.5','5.1.6'].reduce((s,k)=>s+K(k),0)
  const totalBAdm        = sum(bebanAdmL)     || ['5.1.7','5.1.8','5.1.9','5.1.10','5.1.11','5.1.12','5.1.13','5.1.14','5.1.15'].reduce((s,k)=>s+K(k),0)
  const totalBKop        = sum(bebanKopL)     || ['5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'].reduce((s,k)=>s+K(k),0)
  const jumlahBeban      = totalBLangsung + totalBUsaha + totalBAdm + totalBKop
  const shuDariUsaha     = shuKotor - totalBUsaha - totalBAdm - totalBKop
  const totalPLuar       = sum(pendLuarL)     || ['4.2.1','4.2.2','4.2.3'].reduce((s,k)=>s+K(k),0)
  const totalBLuar       = sum(bebanLuarL)    || ['5.2.1','5.2.2','5.2.3'].reduce((s,k)=>s+K(k),0)
  const totalLuarBersih  = totalPLuar - totalBLuar
  const shuSebelumPajak  = shuDariUsaha + totalLuarBersih
  const bebanPajak       = K('5.2.4')
  const shuSetelahPajak  = shuSebelumPajak - bebanPajak

  return (
    <div className="p-6 max-w-2xl" id="print-labarugi">
      <PageHeader title="Laporan Hasil Usaha (PHU/SHU)" subtitle={`Periode ${identitas.awal} s.d. ${identitas.akhir}`}
        actions={
          <div className="flex gap-2 no-print">
            <span className={`badge ${shuSetelahPajak >= 0 ? 'badge-green' : 'badge-red'}`}>
              SHU: Rp {fmt(Math.abs(shuSetelahPajak))} {shuSetelahPajak >= 0 ? '(Surplus)' : '(Defisit)'}
            </span>
            <PrintButton targetId="print-labarugi" title="Laporan Perhitungan Hasil Usaha" />
            <DownloadButton onClick={() => exportSHU(identitas, shu)} />
          </div>
        }
      />
      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN HASIL USAHA · Periode ${identitas.awal} s.d. ${identitas.akhir}`} />

        {/* PENDAPATAN */}
        <LapHeader label="PENDAPATAN" />
        {renderAkun(pendUsaha, ['4.1.1','4.1.2','4.1.3','4.1.4','4.1.5','4.1.6','4.1.7','4.1.8'])}
        <LapRow label="JUMLAH PENDAPATAN USAHA" value={totalPend} variant="subtotal" />

        {/* BEBAN LANGSUNG */}
        <div className="h-2" />
        <LapHeader label="BEBAN LANGSUNG" />
        {renderAkun(bebanLangsung, ['5.1.1','5.1.2'])}
        <LapRow label="JUMLAH BEBAN LANGSUNG" value={totalBLangsung} variant="subtotal" />
        <LapRow label="JUMLAH SHU KOTOR" value={shuKotor} variant="total" />

        {/* BEBAN USAHA */}
        <div className="h-2" />
        <LapHeader label="BEBAN USAHA" />
        {renderAkun(bebanUsahaL, ['5.1.2','5.1.3','5.1.4','5.1.5','5.1.6'])}

        {/* BEBAN ADMINISTRASI DAN UMUM */}
        <LapHeader label="BEBAN ADMINISTRASI DAN UMUM" />
        {renderAkun(bebanAdmL, ['5.1.7','5.1.8','5.1.9','5.1.10','5.1.11','5.1.12','5.1.13','5.1.14','5.1.15'])}

        {/* BEBAN PERKOPERASIAN */}
        <LapHeader label="BEBAN PERKOPERASIAN" />
        {renderAkun(bebanKopL, ['5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'])}

        <LapRow label="JUMLAH BEBAN" value={jumlahBeban} variant="subtotal" />
        <LapRow label="SHU DARI USAHA" value={shuDariUsaha} variant="total" />

        {/* PENDAPATAN DAN BEBAN LAIN-LAIN */}
        <div className="h-2" />
        <LapHeader label="PENDAPATAN DAN BEBAN LAIN-LAIN" />
        {renderAkun(pendLuarL, ['4.2.1','4.2.2','4.2.3'])}
        {renderAkun(bebanLuarL, ['5.2.1','5.2.2','5.2.3'])}
        <LapRow label="TOTAL PENDAPATAN DAN BEBAN LAINNYA" value={totalLuarBersih} variant="subtotal" />

        <LapRow label="SHU SEBELUM PAJAK" value={shuSebelumPajak} variant="total" />
        {bebanPajak > 0 && <LapRow label="5.2.4 — Beban Pajak Badan" value={bebanPajak} indent={1} />}
        <LapRow label="SHU SETELAH PAJAK" value={shuSetelahPajak} variant="total" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 3. PERUBAHAN EKUITAS
// ─────────────────────────────────────────────────────────────────────────
export function EkuitasPage() {
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos   = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const allCOA   = useMemo(() => mergeCustomCOA(customCOA), [customCOA])
  const components = useMemo(() =>
    allCOA.filter(a => a.grup === 'EKUITAS').map(a => ({ nama: a.nama, kode: a.kode })), [allCOA])

  const rows = components.map(c => {
    const sa  = saldoAwal[c.kode] ?? 0
    const akh = saldos[c.kode]    ?? 0
    return { ...c, sa, akh, delta: akh - sa }
  })
  const totalSA  = rows.reduce((a, r) => a + r.sa,  0)
  const totalAkh = rows.reduce((a, r) => a + r.akh, 0)

  return (
    <div className="p-6 max-w-3xl" id="print-ekuitas">
      <PageHeader title="Laporan Perubahan Ekuitas" subtitle={`Per ${identitas.akhir}`}
        actions={<PrintButton targetId="print-ekuitas" title="Laporan Perubahan Ekuitas" />} />
      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN PERUBAHAN EKUITAS · Per ${identitas.akhir}`} />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="th">Komponen Ekuitas</th>
                <th className="th text-right">Saldo Awal (Rp)</th>
                <th className="th text-right">Penambahan (Rp)</th>
                <th className="th text-right">Pengurangan (Rp)</th>
                <th className="th text-right">Saldo Akhir (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.kode} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="td">{r.nama}</td>
                  <td className="td-num">{fmt(r.sa)}</td>
                  <td className="td-num text-emerald-700">{r.delta > 0 ? fmt(r.delta) : '—'}</td>
                  <td className="td-num text-red-600">{r.delta < 0 ? fmt(Math.abs(r.delta)) : '—'}</td>
                  <td className="td-num font-semibold">{fmt(r.akh)}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-slate-50 border-t-2 border-slate-300">
                <td className="td">Total Ekuitas</td>
                <td className="td-num">{fmt(totalSA)}</td>
                <td className="td-num"></td>
                <td className="td-num"></td>
                <td className="td-num">{fmt(totalAkh)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 4. ARUS KAS — Direct Method, sesuai format Excel ARUS KAS
// ─────────────────────────────────────────────────────────────────────────
export function ArusKasPage() {
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  // Arus Kas hanya mencatat MUTASI JURNAL periode berjalan — saldo awal tidak ikut
  // (saldo awal hanya relevan di Posisi Keuangan / Neraca)
  const saldos = useMemo(() => computeSaldos({}, jurnal, customCOA), [jurnal, customCOA])
  const K  = (k: string) => saldos[k]   ?? 0
  const SA = (k: string) => saldoAwal[k] ?? 0

  // ── AKTIVITAS OPERASI — PENERIMAAN ────────────────────────────────────
  const penJasaBunga    = K('4.1.1')
  const penAdm          = K('4.1.2')
  const penDenda        = K('4.1.3')
  const penToko         = K('4.1.4')
  const penKons         = K('4.1.5')
  const piutangSP       = K('1.1.4')
  const piutangToko     = K('1.1.6')
  const piutangJasa     = K('1.1.5')
  const penarikanBank   = K('1.1.2')
  const pendYMH         = K('1.1.11')
  const tambahSukarela  = K('2.1.9')
  const tambahKhusus    = K('2.1.10')
  const tambahBerjangka = K('2.1.11')
  const totalPenerimaanOp = penJasaBunga + penAdm + penDenda + penToko + penKons
    + piutangSP + piutangToko + piutangJasa + penarikanBank
    + pendYMH + tambahSukarela + tambahKhusus + tambahBerjangka

  // ── AKTIVITAS OPERASI — PENGELUARAN ───────────────────────────────────
  const pembelian       = K('5.1.1')
  const bebanUsahaSum   = ['5.1.2','5.1.3','5.1.4','5.1.5','5.1.6'].reduce((s,k)=>s+K(k),0)
  const bebanAdmSum     = ['5.1.7','5.1.8','5.1.9','5.1.10','5.1.11','5.1.12','5.1.13','5.1.14','5.1.15'].reduce((s,k)=>s+K(k),0)
  const bebanKopSum     = ['5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'].reduce((s,k)=>s+K(k),0)
  const pengeluaranSP   = K('1.1.4')
  const utangUsaha      = K('2.1.1')
  const pembayaranSHU   = K('3.1.5')
  const biayaDimuka     = K('1.1.10')
  const setorBank       = K('1.1.2')
  const ambilSukarela   = K('2.1.9')
  const ambilKhusus     = K('2.1.10')
  const ambilBerjangka  = K('2.1.11')
  const bebanPajak      = K('5.2.4')
  const totalPengeluaranOp = pembelian + bebanUsahaSum + bebanAdmSum + bebanKopSum
    + pengeluaranSP + utangUsaha + pembayaranSHU + biayaDimuka
    + setorBank + ambilSukarela + ambilKhusus + ambilBerjangka + bebanPajak
  const netOperasi = totalPenerimaanOp - totalPengeluaranOp

  // ── AKTIVITAS INVESTASI ────────────────────────────────────────────────
  const investasiJPIn    = K('1.2.1')
  const simpKopSekIn     = K('1.2.2')
  const keuntAsetTetap   = K('4.2.2')
  const suratBerhargaIn  = K('1.1.7')
  const totalInvestasiIn = investasiJPIn + simpKopSekIn + keuntAsetTetap + suratBerhargaIn

  const simpKopSekOut    = K('1.2.3')
  const investasiJPOut   = K('1.2.4')
  const beliPropInv      = K('1.2.5')
  const beliAsetTetap    = ['1.2.6','1.2.7','1.2.8','1.2.9'].reduce((s,k)=>s+K(k),0)
  const totalInvestasiOut= simpKopSekOut + investasiJPOut + beliPropInv + beliAsetTetap
  const netInvestasi     = totalInvestasiIn - totalInvestasiOut

  // ── AKTIVITAS PENDANAAN ────────────────────────────────────────────────
  const tambahPokok      = K('3.1.1')
  const tambahWajib      = K('3.1.2')
  const pinjamanBank     = K('2.2.1')
  const penyertaan       = K('3.1.4')
  const hibah            = K('3.1.3')
  const totalPendanaanIn = tambahPokok + tambahWajib + pinjamanBank + penyertaan + hibah

  const kembaliPokok     = Math.max(0, SA('3.1.1') - K('3.1.1'))
  const kembaliWajib     = Math.max(0, SA('3.1.2') - K('3.1.2'))
  const bayarPinjBank    = Math.max(0, SA('2.2.1') - K('2.2.1'))
  const totalPendanaanOut= kembaliPokok + kembaliWajib + bayarPinjBank
  const netPendanaan     = totalPendanaanIn - totalPendanaanOut

  // ── SALDO KAS ─────────────────────────────────────────────────────────
  const kasAwal      = SA('1.1.1') + SA('1.1.2')
  const kasAkhir     = K('1.1.1')  + K('1.1.2')
  const kenaikanKas  = netOperasi + netInvestasi + netPendanaan
  const seimbang     = Math.abs(kasAkhir - (kasAwal + kenaikanKas)) < 1

  return (
    <div className="p-6 max-w-2xl" id="print-aruskas">
      <PageHeader title="Laporan Arus Kas" subtitle={`Metode Langsung (Direct Method) — Per ${identitas.akhir}`}
        actions={
          <div className="flex gap-2 no-print">
            <PrintButton targetId="print-aruskas" title="Laporan Arus Kas" />
          </div>
        }
      />
      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN ARUS KAS (Direct Method) · Per ${identitas.akhir}`} />

        {/* ── OPERASI ── */}
        <LapHeader label="ARUS KAS DARI AKTIVITAS OPERASI" />
        <LapHeader label="Penerimaan Kas" />
        <LapRow label="4.1.1 — Pendapatan Jasa Pinjaman"        value={penJasaBunga}    indent={1} />
        <LapRow label="4.1.2 — Pendapatan Administrasi"         value={penAdm}          indent={1} />
        <LapRow label="4.1.3 — Pendapatan Denda"                value={penDenda}        indent={1} />
        <LapRow label="4.1.4 — Pendapatan Sewa"                  value={penToko}         indent={1} />
        <LapRow label="4.1.5 — Penjualan Toko"                  value={penKons}         indent={1} />
        <LapRow label="1.1.4 — Piutang Simpan Pinjam"           value={piutangSP}       indent={1} />
        <LapRow label="1.1.6 — Piutang Toko"                    value={piutangToko}     indent={1} />
        <LapRow label="1.1.5 — Piutang Jasa Pinjaman"            value={piutangJasa}     indent={1} />
        <LapRow label="1.1.2 — Penarikan dari Bank"             value={penarikanBank}   indent={1} />
        <LapRow label="1.1.11 — Pendapatan diterima dimuka"      value={pendYMH}         indent={1} />
        <LapRow label="2.1.9 — Penambahan Simpanan Sukarela"    value={tambahSukarela}  indent={1} />
        <LapRow label="2.1.10 — Penambahan Simpanan Khusus"     value={tambahKhusus}    indent={1} />
        <LapRow label="2.1.11 — Penambahan Simpanan Berjangka"  value={tambahBerjangka} indent={1} />
        <LapRow label="Jumlah Penerimaan Kas" value={totalPenerimaanOp} variant="subtotal" />

        <LapHeader label="Pengeluaran Kas" />
        <LapRow label="5.1.1 — Pembelian / HPP Toko"              value={pembelian}       indent={1} />
        <LapRow label="Beban Usaha (5.1.2–5.1.6)"                 value={bebanUsahaSum}   indent={1} />
        <LapRow label="Beban Adm & Umum (5.1.7–5.1.15)"           value={bebanAdmSum}     indent={1} />
        <LapRow label="Beban Perkoperasian (5.1.16–5.1.20)"       value={bebanKopSum}     indent={1} />
        <LapRow label="1.1.4 — Piutang Simpan Pinjam"             value={pengeluaranSP}   indent={1} />
        <LapRow label="2.1.1 — Utang Usaha"                       value={utangUsaha}      indent={1} />
        <LapRow label="3.1.5 — Pembayaran Dana-Dana SHU"          value={pembayaranSHU}   indent={1} />
        <LapRow label="1.1.10 — Biaya dibayar dimuka"              value={biayaDimuka}     indent={1} />
        <LapRow label="1.1.2 — Penyetoran ke Bank"                value={setorBank}       indent={1} />
        <LapRow label="2.1.9 — Pengambilan Simpanan Sukarela"     value={ambilSukarela}   indent={1} />
        <LapRow label="2.1.10 — Pengambilan Simpanan Khusus"      value={ambilKhusus}     indent={1} />
        <LapRow label="2.1.11 — Pengambilan Simpanan Berjangka"   value={ambilBerjangka}  indent={1} />
        <LapRow label="5.2.4 — Beban Pajak Badan"                 value={bebanPajak}      indent={1} />
        <LapRow label="Jumlah Pengeluaran Kas" value={totalPengeluaranOp} variant="subtotal" />
        <LapRow label="KENAIKAN (PENURUNAN) KAS DARI AKTIVITAS OPERASI" value={netOperasi} variant="total" />

        <div className="h-4" />

        {/* ── INVESTASI ── */}
        <LapHeader label="ARUS KAS DARI AKTIVITAS INVESTASI" />
        <LapHeader label="Penerimaan Kas" />
        <LapRow label="1.2.1 — Investasi Jangka Panjang"              value={investasiJPIn}   indent={1} />
        <LapRow label="1.2.2 — Simpanan di Koperasi Sekunder"         value={simpKopSekIn}    indent={1} />
        <LapRow label="4.2.2 — Keuntungan Penjualan Aset Tetap"       value={keuntAsetTetap}  indent={1} />
        <LapRow label="1.1.7 — Surat Berharga"                        value={suratBerhargaIn} indent={1} />
        <LapRow label="Jumlah Penerimaan Investasi" value={totalInvestasiIn} variant="subtotal" />

        <LapHeader label="Pengeluaran Kas" />
        <LapRow label="1.2.3 — Simpanan di Koperasi Sekunder"         value={simpKopSekOut}   indent={1} />
        <LapRow label="1.2.4 — SKPB di PKPRI"                          value={investasiJPOut}  indent={1} />
        <LapRow label="1.2.5 — Pembelian Properti Investasi"          value={beliPropInv}     indent={1} />
        <LapRow label="1.2.6–1.2.9 — Pembelian Aset Tetap"           value={beliAsetTetap}   indent={1} />
        <LapRow label="Jumlah Pengeluaran Investasi" value={totalInvestasiOut} variant="subtotal" />
        <LapRow label="KENAIKAN (PENURUNAN) KAS DARI AKTIVITAS INVESTASI" value={netInvestasi} variant="total" />

        <div className="h-4" />

        {/* ── PENDANAAN ── */}
        <LapHeader label="ARUS KAS DARI AKTIVITAS PENDANAAN" />
        <LapHeader label="Penerimaan" />
        <LapRow label="3.1.1 — Penambahan Simpanan Pokok Anggota"     value={tambahPokok}     indent={1} />
        <LapRow label="3.1.2 — Penambahan Simpanan Wajib Anggota"     value={tambahWajib}     indent={1} />
        <LapRow label="2.2.1 — Pinjaman Bank / Lembaga Keuangan"      value={pinjamanBank}    indent={1} />
        <LapRow label="3.1.4 — Penyertaan Modal"                      value={penyertaan}      indent={1} />
        <LapRow label="3.1.3 — Hibah"                                 value={hibah}           indent={1} />
        <LapRow label="Jumlah Penerimaan Pendanaan" value={totalPendanaanIn} variant="subtotal" />

        <LapHeader label="Pengeluaran" />
        <LapRow label="Pengembalian Simpanan Pokok"                    value={kembaliPokok}    indent={1} />
        <LapRow label="Pengembalian Simpanan Wajib"                    value={kembaliWajib}    indent={1} />
        <LapRow label="Pembayaran Pinjaman Bank / Lembaga Keuangan"    value={bayarPinjBank}   indent={1} />
        <LapRow label="Jumlah Pengeluaran Pendanaan" value={totalPendanaanOut} variant="subtotal" />
        <LapRow label="KENAIKAN (PENURUNAN) KAS DARI AKTIVITAS PENDANAAN" value={netPendanaan} variant="total" />

        <div className="h-4" />

        {/* ── SALDO KAS ── */}
        <LapRow label="KENAIKAN (PENURUNAN) KAS BERSIH"               value={kenaikanKas}   variant="total" />
        <LapRow label="Saldo Kas Awal Periode (1.1.1 + 1.1.2)"        value={kasAwal}       indent={1} />
        <LapRow label="SALDO KAS AKHIR PERIODE"                        value={kasAkhir}      variant="total" />

        <div className={`mt-3 text-right text-xs ${seimbang ? 'text-emerald-600' : 'text-red-600'}`}>
          {seimbang ? '✓ Saldo Seimbang' : `⚠ Selisih: Rp ${fmt(Math.abs(kasAkhir - (kasAwal + kenaikanKas)))}`}
        </div>
      </div>
    </div>
  )
}
