import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { computeSaldos, calcNeraca, calcSHU, calcArusKas, fmt } from '../utils/accounting'
import { COA, getAkunNama } from '../utils/coa'
import type { Akun } from '../types'
import { PageHeader, PrintButton, DownloadButton, LapRow, LapHeader } from '../components/ui'
import { exportNeraca, exportSHU, exportArusKas } from '../utils/exportExcel'

// ── Helper: load COA termasuk custom ──────────────────────────────────────
function getAllCOA(): Akun[] {
  try {
    const custom: Akun[] = JSON.parse(localStorage.getItem('sia-koperasi-custom-coa') || '[]')
    const merged = [...COA]
    custom.forEach(ca => {
      const idx = merged.findIndex(a => a.kode === ca.kode)
      if (idx >= 0) merged[idx] = ca
      else merged.push(ca)
    })
    return merged.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true }))
  } catch { return COA }
}

// ── shared header ─────────────────────────────────────────────────────────
function ReportHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center mb-6 print-only-show">
      <p className="font-bold text-base">{title}</p>
      <p className="text-sm text-slate-500">{sub}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 1. NERACA — akun tampil satu per satu, sama persis dengan Saldo Awal
// ─────────────────────────────────────────────────────────────────────────
export function NeracaPage() {
  const { saldoAwal, jurnal, identitas } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const neraca = useMemo(() => calcNeraca(saldos, shu.shuBersih), [saldos, shu])

  const allCOA = useMemo(() => getAllCOA(), [])

  const isKontraAset = (a: Akun) => a.grup === 'ASET' && a.tipe === 'K'

  const asetLancar     = allCOA.filter(a => a.grup === 'ASET' && a.kelompok === 'Aset Lancar')
  const asetTdkLancar  = allCOA.filter(a => a.grup === 'ASET' && a.kelompok === 'Aset Tidak Lancar')
  const kewJkPendek    = allCOA.filter(a => a.grup === 'KEWAJIBAN' && a.kelompok === 'Kewajiban Jk. Pendek')
  const kewJkPanjang   = allCOA.filter(a => a.grup === 'KEWAJIBAN' && a.kelompok === 'Kewajiban Jk. Panjang')
  const ekuitas        = allCOA.filter(a => a.grup === 'EKUITAS')

  const K = (kode: string) => saldos[kode] ?? 0

  // Total per kelompok — kontra akun dikurangkan
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

  // Render baris akun — sama persis dengan Saldo Awal (semua akun tampil)
  const renderAkunBaris = (list: Akun[]) =>
    list.map(a => {
      const val      = K(a.kode)
      const isKontra = isKontraAset(a)
      return (
        <LapRow
          key={a.kode}
          label={`${a.kode} — ${a.nama}`}
          value={isKontra ? -val : val}
          indent={1}
          negative={isKontra && val > 0}
        />
      )
    })

  return (
    <div className="p-6 max-w-2xl" id="print-neraca">
      <PageHeader
        title="Laporan Posisi Keuangan (Neraca)"
        subtitle={`Sesuai SAK EP — Per ${identitas.akhir}`}
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

        {/* ══ ASET ══ */}
        <LapHeader label="ASET" />

        <LapHeader label="Aset Lancar" />
        {renderAkunBaris(asetLancar)}
        <LapRow label="Jumlah Aset Lancar" value={totalAsetLancar} variant="subtotal" />

        <LapHeader label="Aset Tidak Lancar" />
        {renderAkunBaris(asetTdkLancar)}
        <LapRow label="Jumlah Aset Tidak Lancar" value={totalAsetTdkLancar} variant="subtotal" />

        <LapRow label="JUMLAH ASET" value={totalAset} variant="total" />

        <div className="h-4" />

        {/* ══ KEWAJIBAN ══ */}
        <LapHeader label="KEWAJIBAN DAN EKUITAS" />

        <LapHeader label="Kewajiban Jangka Pendek" />
        {renderAkunBaris(kewJkPendek)}
        <LapRow label="Jumlah Kewajiban Jk. Pendek" value={totalKewJkPendek} variant="subtotal" />

        <LapHeader label="Kewajiban Jangka Panjang" />
        {renderAkunBaris(kewJkPanjang)}
        <LapRow label="Jumlah Kewajiban Jk. Panjang" value={totalKewJkPanjang} variant="subtotal" />

        <LapRow label="JUMLAH KEWAJIBAN" value={totalKewajiban} variant="total" />

        <div className="h-4" />

        {/* ══ EKUITAS ══ */}
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
// 2. HASIL USAHA (PHU / SHU)
// ─────────────────────────────────────────────────────────────────────────
export function LabaRugiPage() {
  const { saldoAwal, jurnal, identitas } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const s = shu
  const K = (k: string) => saldos[k] ?? 0

  return (
    <div className="p-6 max-w-2xl" id="print-labarugi">
      <PageHeader
        title="Laporan Hasil Usaha (PHU/SHU)"
        subtitle={`Periode ${identitas.awal} s.d. ${identitas.akhir}`}
        actions={
          <div className="flex gap-2 no-print">
            <span className={`badge ${s.shuBersih >= 0 ? 'badge-green' : 'badge-red'}`}>
              SHU: Rp {fmt(Math.abs(s.shuBersih))} {s.shuBersih >= 0 ? '(Surplus)' : '(Defisit)'}
            </span>
            <PrintButton targetId="print-labarugi" title="Laporan Perhitungan Hasil Usaha" />
            <DownloadButton onClick={() => exportSHU(identitas, shu)} />
          </div>
        }
      />

      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN HASIL USAHA · Periode ${identitas.awal} s.d. ${identitas.akhir}`} />

        <LapHeader label="PENDAPATAN USAHA" />
        <LapRow label="Pendapatan Jasa Bunga (Simpan Pinjam)" value={s.pendJasaBunga} indent={1} />
        <LapRow label="Pendapatan Administrasi"               value={s.pendAdm}       indent={1} />
        <LapRow label="Pendapatan Denda"                      value={s.pendDenda}     indent={1} />
        <LapRow label="Penjualan Toko (neto)"                 value={s.penjToko}      indent={1} />
        <LapRow label="Pendapatan Konsinyasi"                 value={s.pendKons}      indent={1} />
        <LapRow label="Jumlah Pendapatan Usaha"               value={s.totalPendUsaha} variant="subtotal" />

        <LapHeader label="BEBAN POKOK & USAHA" />
        <LapRow label="HPP Toko"              value={s.hpp}        indent={1} />
        <LapRow label="Beban Bunga Tabungan"  value={s.bebanBunga} indent={1} />
        <LapRow label="Beban Penjualan"       value={s.bebanJual}  indent={1} />
        <LapRow label="Laba Kotor"            value={s.labaKotor}  variant="subtotal" />

        <LapHeader label="BEBAN ADMINISTRASI & UMUM" />
        {['5.1.7','5.1.8','5.1.9','5.1.10','5.1.11','5.1.12','5.1.13','5.1.14','5.1.15'].map(k =>
          K(k) > 0 ? <LapRow key={k} label={getAkunNama(k)} value={K(k)} indent={1} /> : null
        )}
        <LapRow label="Jumlah Beban Adm & Umum" value={s.bebanAdm} variant="subtotal" />

        <LapHeader label="BEBAN PERKOPERASIAN" />
        {['5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'].map(k =>
          K(k) > 0 ? <LapRow key={k} label={getAkunNama(k)} value={K(k)} indent={1} /> : null
        )}
        <LapRow label="Jumlah Beban Perkoperasian" value={s.bebanKop} variant="subtotal" />
        <LapRow label="SHU DARI USAHA" value={s.shuUsaha} variant="total" />

        <div className="h-4" />
        <LapHeader label="PENDAPATAN / BEBAN DI LUAR USAHA" />
        <LapRow label="Pendapatan Di Luar Usaha" value={s.pendLuar}  indent={1} />
        <LapRow label="Beban Di Luar Usaha"      value={s.bebanLuar} indent={1} />
        <LapRow label="SISA HASIL USAHA (SHU) BERSIH" value={s.shuBersih} variant="total" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 3. PERUBAHAN EKUITAS
// ─────────────────────────────────────────────────────────────────────────
export function EkuitasPage() {
  const { saldoAwal, jurnal, identitas } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])

  const components = [
    { nama: 'Simpanan Pokok',       kode: '3.1.1' },
    { nama: 'Simpanan Wajib',       kode: '3.1.2' },
    { nama: 'Hibah',                kode: '3.1.3' },
    { nama: 'Cadangan',             kode: '3.1.4' },
    { nama: 'SHU Tahun Lalu',       kode: '3.1.5' },
    { nama: 'SHU Periode Berjalan', kode: '3.1.6' },
  ]

  const rows = components.map(c => {
    const sa  = saldoAwal[c.kode] ?? 0
    const akh = saldos[c.kode]    ?? 0
    return { ...c, sa, akh, delta: akh - sa }
  })

  const totalSA  = rows.reduce((a, r) => a + r.sa,  0)
  const totalAkh = rows.reduce((a, r) => a + r.akh, 0)

  return (
    <div className="p-6 max-w-3xl" id="print-ekuitas">
      <PageHeader
        title="Laporan Perubahan Ekuitas"
        subtitle={`Per ${identitas.akhir}`}
        actions={<PrintButton targetId="print-ekuitas" title="Laporan Perubahan Ekuitas" />}
      />
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
// 4. ARUS KAS
// ─────────────────────────────────────────────────────────────────────────
export function ArusKasPage() {
  const { saldoAwal, jurnal, identitas } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])
  const ak     = useMemo(() => calcArusKas(saldos, saldoAwal), [saldos, saldoAwal])

  const kasCheck = Math.abs(ak.kasAkhir - ((saldos['1.1.1'] ?? 0) + (saldos['1.1.2'] ?? 0))) < 1

  return (
    <div className="p-6 max-w-2xl" id="print-aruskas">
      <PageHeader
        title="Laporan Arus Kas"
        subtitle={`Metode Langsung · Periode ${identitas.awal} s.d. ${identitas.akhir}`}
        actions={
          <div className="flex gap-2 no-print">
            <PrintButton targetId="print-aruskas" title="Laporan Arus Kas" />
            <DownloadButton onClick={() => exportArusKas(identitas, ak)} />
          </div>
        }
      />

      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN ARUS KAS · Periode ${identitas.awal} s.d. ${identitas.akhir}`} />

        <LapHeader label="ARUS KAS DARI AKTIVITAS OPERASI" />
        <LapHeader label="Penerimaan Kas" />
        <LapRow label="Pendapatan Jasa & Administrasi" value={ak.penerimaanOp} indent={2} />
        <LapHeader label="Pengeluaran Kas" />
        <LapRow label="Beban Usaha & Perkoperasian"   value={ak.pengeluaranOp} indent={2} />
        <LapRow label="KENAIKAN / (PENURUNAN) KAS DARI OPERASI" value={ak.netOperasi} variant="total" />

        <div className="h-4" />
        <LapHeader label="ARUS KAS DARI AKTIVITAS INVESTASI" />
        <LapRow label="Penerimaan — Penjualan Aset"       value={ak.investIn}  indent={1} />
        <LapRow label="Pengeluaran — Pembelian Aset Tetap" value={ak.investOut} indent={1} />
        <LapRow label="KENAIKAN / (PENURUNAN) KAS DARI INVESTASI" value={ak.netInvestasi} variant="total" />

        <div className="h-4" />
        <LapHeader label="ARUS KAS DARI AKTIVITAS PENDANAAN" />
        <LapRow label="Penerimaan Simpanan Pokok, Wajib & Pinjaman" value={ak.pendanIn} indent={1} />
        <LapRow label="KENAIKAN / (PENURUNAN) KAS DARI PENDANAAN"   value={ak.netPendanaan} variant="total" />

        <div className="h-6 border-t border-slate-200 mt-4" />
        <LapRow label="Kenaikan / (Penurunan) Kas Bersih" value={ak.netKas}   variant="subtotal" />
        <LapRow label="Saldo Kas Awal Periode"             value={ak.kasAwal}  indent={1} />
        <LapRow label="SALDO KAS AKHIR PERIODE"            value={ak.kasAkhir} variant="total" />

        {!kasCheck && (
          <p className="text-xs text-red-600 mt-2">⚠ Saldo kas akhir tidak cocok dengan neraca. Periksa jurnal transaksi kas.</p>
        )}
      </div>
    </div>
  )
}
