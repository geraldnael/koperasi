import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { computeSaldos, calcNeraca, calcSHU, calcArusKas, fmt } from '../utils/accounting'
import { mergeCustomCOA, getAkunNama } from '../utils/coa'
import type { Akun } from '../types'
import { PageHeader, PrintButton, DownloadButton, LapRow, LapHeader } from '../components/ui'
import { exportNeraca, exportSHU, exportArusKas } from '../utils/exportExcel'

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
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const neraca = useMemo(() => calcNeraca(saldos, shu.shuBersih), [saldos, shu])

  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])

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
// 2. HASIL USAHA (PHU / SHU) — akun dinamis dari COA
// ─────────────────────────────────────────────────────────────────────────
export function LabaRugiPage() {
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const s = shu
  const K = (k: string) => saldos[k] ?? 0

  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])

  // Kelompok akun dari COA — otomatis mengikuti perubahan di menu Bagan Akun
  const pendUsaha   = useMemo(() => allCOA.filter(a => a.grup === 'PENDAPATAN' && a.kelompok === 'Pendapatan Usaha'), [allCOA])
  const bebanPokok  = useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Pokok'), [allCOA])
  const bebanAdmList= useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Adm & Umum'), [allCOA])
  const bebanKopList= useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Perkoperasian'), [allCOA])
  const pendLuarList= useMemo(() => allCOA.filter(a => a.grup === 'PENDAPATAN' && a.kelompok === 'Pendapatan Luar Usaha'), [allCOA])
  const bebanLuarList=useMemo(() => allCOA.filter(a => a.grup === 'BEBAN' && a.kelompok === 'Beban Luar Usaha'), [allCOA])

  const sumList = (list: typeof allCOA) => list.reduce((t, a) => t + K(a.kode), 0)

  const totalPendUsaha = sumList(pendUsaha)
  const totalBebanPokok= sumList(bebanPokok)
  const labaKotor      = totalPendUsaha - totalBebanPokok
  const totalBebanAdm  = sumList(bebanAdmList)
  const totalBebanKop  = sumList(bebanKopList)
  const shuDariUsaha   = labaKotor - totalBebanAdm - totalBebanKop
  const totalPendLuar  = sumList(pendLuarList)
  const totalBebanLuar = sumList(bebanLuarList)
  const shuBersihCalc  = shuDariUsaha + totalPendLuar - totalBebanLuar

  return (
    <div className="p-6 max-w-2xl" id="print-labarugi">
      <PageHeader
        title="Laporan Hasil Usaha (PHU/SHU)"
        subtitle={`Periode ${identitas.awal} s.d. ${identitas.akhir}`}
        actions={
          <div className="flex gap-2 no-print">
            <span className={`badge ${shuBersihCalc >= 0 ? 'badge-green' : 'badge-red'}`}>
              SHU: Rp {fmt(Math.abs(shuBersihCalc))} {shuBersihCalc >= 0 ? '(Surplus)' : '(Defisit)'}
            </span>
            <PrintButton targetId="print-labarugi" title="Laporan Perhitungan Hasil Usaha" />
            <DownloadButton onClick={() => exportSHU(identitas, shu)} />
          </div>
        }
      />

      <div className="card p-5">
        <ReportHeader title={identitas.nama} sub={`LAPORAN HASIL USAHA · Periode ${identitas.awal} s.d. ${identitas.akhir}`} />

        <LapHeader label="PENDAPATAN USAHA" />
        {pendUsaha.length > 0
          ? pendUsaha.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} />)
          : <>{
              [['4.1.1', 'Pendapatan Jasa Pinjaman'], ['4.1.2', 'Pendapatan Administrasi'],
               ['4.1.3', 'Pendapatan Denda'], ['4.1.4', 'Penjualan Toko'], ['4.1.5', 'Pendapatan Konsinyasi'],
               ['4.1.6', 'Retur Penjualan'], ['4.1.7', 'Pendapatan Sewa'], ['4.1.8', 'Pendapatan Lain-lain']
              ].map(([k, n]) => <LapRow key={k} label={`${k} — ${n}`} value={K(k)} indent={1} />)
            }</>
        }
        <LapRow label="Jumlah Pendapatan Usaha" value={totalPendUsaha || s.totalPendUsaha} variant="subtotal" />

        <LapHeader label="BEBAN POKOK & USAHA" />
        {bebanPokok.length > 0
          ? bebanPokok.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} />)
          : <>{
              [['5.1.1','HPP Toko'],['5.1.2','Beban Bunga Tabungan'],['5.1.3','Beban Penjualan'],
               ['5.1.4','Beban Angkut'],['5.1.5','Beban Promosi'],['5.1.6','Beban Penjualan Lain']
              ].map(([k, n]) => K(k) > 0 ? <LapRow key={k} label={`${k} — ${n}`} value={K(k)} indent={1} /> : null)
            }</>
        }
        <LapRow label="Laba Kotor" value={labaKotor || s.labaKotor} variant="subtotal" />

        <LapHeader label="BEBAN ADMINISTRASI & UMUM" />
        {bebanAdmList.length > 0
          ? bebanAdmList.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} />)
          : ['5.1.7','5.1.8','5.1.9','5.1.10','5.1.11','5.1.12','5.1.13','5.1.14','5.1.15'].map(k =>
              K(k) > 0 ? <LapRow key={k} label={`${k} — ${getAkunNama(k)}`} value={K(k)} indent={1} /> : null)
        }
        <LapRow label="Jumlah Beban Adm & Umum" value={totalBebanAdm || s.bebanAdm} variant="subtotal" />

        <LapHeader label="BEBAN PERKOPERASIAN" />
        {bebanKopList.length > 0
          ? bebanKopList.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} />)
          : ['5.1.16','5.1.17','5.1.18','5.1.19','5.1.20'].map(k =>
              K(k) > 0 ? <LapRow key={k} label={`${k} — ${getAkunNama(k)}`} value={K(k)} indent={1} /> : null)
        }
        <LapRow label="Jumlah Beban Perkoperasian" value={totalBebanKop || s.bebanKop} variant="subtotal" />
        <LapRow label="SHU DARI USAHA" value={shuDariUsaha || s.shuUsaha} variant="total" />

        <div className="h-4" />
        <LapHeader label="PENDAPATAN / BEBAN DI LUAR USAHA" />
        {pendLuarList.length > 0
          ? pendLuarList.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} />)
          : ['4.2.1','4.2.2','4.2.3'].map(k =>
              K(k) > 0 ? <LapRow key={k} label={`${k} — ${getAkunNama(k)}`} value={K(k)} indent={1} /> : null)
        }
        {bebanLuarList.length > 0
          ? bebanLuarList.map(a => <LapRow key={a.kode} label={`${a.kode} — ${a.nama}`} value={K(a.kode)} indent={1} negative />)
          : ['5.2.1','5.2.2','5.2.3'].map(k =>
              K(k) > 0 ? <LapRow key={k} label={`${k} — ${getAkunNama(k)}`} value={K(k)} indent={1} negative /> : null)
        }
        <LapRow label="SISA HASIL USAHA (SHU) BERSIH" value={shuBersihCalc || s.shuBersih} variant="total" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 3. PERUBAHAN EKUITAS
// ─────────────────────────────────────────────────────────────────────────
export function EkuitasPage() {
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])
  // Komponen ekuitas dari COA — dinamis mengikuti perubahan Bagan Akun
  const components = useMemo(() =>
    allCOA.filter(a => a.grup === 'EKUITAS').map(a => ({ nama: a.nama, kode: a.kode })),
    [allCOA])

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
  const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
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
