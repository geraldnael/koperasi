import { useMemo, useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { COA } from '../utils/coa'
import type { Akun } from '../types'
import { fmt } from '../utils/accounting'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/ui'

// Load COA including custom accounts from localStorage
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

// Akun kontra aset (saldo normal K, tapi masuk sisi Aset sebagai pengurang)
const isKontraAset = (a: Akun) => a.grup === 'ASET' && a.tipe === 'K'

// Hitung kontribusi akun ke total Aset (positif = menambah, negatif = mengurangi)
function kontribusiAset(a: Akun, val: number): number {
  return isKontraAset(a) ? -val : val
}

export default function SaldoAwalPage() {
  const { saldoAwal, setSaldoAwal } = useAppStore()
  const [local, setLocal]   = useState<Record<string, number>>({ ...saldoAwal })
  const [saved, setSaved]   = useState(false)
  const [allCOA, setAllCOA] = useState<Akun[]>(getAllCOA)

  useEffect(() => {
    const refresh = () => setAllCOA(getAllCOA())
    window.addEventListener('storage', refresh)
    const interval = setInterval(() => setAllCOA(getAllCOA()), 2000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(interval) }
  }, [])

  const set = (kode: string, val: number) =>
    setLocal(s => ({ ...s, [kode]: Math.max(0, val) }))

  const asetAkun       = useMemo(() => allCOA.filter(a => a.grup === 'ASET'), [allCOA])
  const kewajibanAkun  = useMemo(() => allCOA.filter(a => a.grup === 'KEWAJIBAN'), [allCOA])
  const ekuitasAkun    = useMemo(() => allCOA.filter(a => a.grup === 'EKUITAS'), [allCOA])

  const totalAset = useMemo(() =>
    asetAkun.reduce((s, a) => s + kontribusiAset(a, local[a.kode] ?? 0), 0),
    [local, asetAkun])

  const totalKewajiban = useMemo(() =>
    kewajibanAkun.reduce((s, a) => s + (local[a.kode] ?? 0), 0),
    [local, kewajibanAkun])

  const totalEkuitas = useMemo(() =>
    ekuitasAkun.reduce((s, a) => s + (local[a.kode] ?? 0), 0),
    [local, ekuitasAkun])

  const totalKewajEkuitas = totalKewajiban + totalEkuitas
  const selisih = Math.abs(totalAset - totalKewajEkuitas)
  const balanced = selisih < 1

  const handleSave = () => {
    setSaldoAwal(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const renderAkunRows = (list: Akun[]) =>
    list.map(a => {
      const val = local[a.kode] ?? 0
      const isKontra = isKontraAset(a)
      return (
        <tr key={a.kode} className="hover:bg-slate-50 border-b border-slate-50">
          <td className="td font-mono text-xs text-slate-500">{a.kode}</td>
          <td className="td text-sm">
            {a.nama}
            {isKontra && (
              <span className="ml-1.5 text-[9px] font-semibold text-rose-500 bg-rose-50 px-1 py-0.5 rounded">
                kontra
              </span>
            )}
          </td>
          <td className="td pr-2">
            <input
              type="number"
              className={`input text-right font-mono ${isKontra ? 'border-rose-200 focus:border-rose-400' : ''}`}
              value={val || ''}
              placeholder="0"
              onChange={e => set(a.kode, Number(e.target.value) || 0)}
            />
          </td>
          <td className="td text-right font-mono text-xs pr-3">
            {val ? (
              <span className={isKontra ? 'text-rose-600' : 'text-slate-700'}>
                {isKontra ? `(${fmt(val)})` : fmt(val)}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        </tr>
      )
    })

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        title="Saldo Awal"
        subtitle="Isi saldo pembuka sesuai Laporan Posisi Keuangan tahun sebelumnya"
      />

      {/* Balance indicator */}
      <div className={`rounded-lg px-4 py-3 text-sm mb-5 flex flex-wrap items-center justify-between gap-2 ${
        balanced
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span className="font-semibold">{balanced ? '✓ Neraca seimbang' : '⚠ Neraca belum seimbang'}</span>
        <span className="font-mono text-xs flex gap-4">
          <span>Total Aset: <strong>{fmt(totalAset)}</strong></span>
          <span>Kewajiban + Modal: <strong>{fmt(totalKewajEkuitas)}</strong></span>
          {!balanced && <span className="text-amber-700">Selisih: <strong>{fmt(selisih)}</strong></span>}
        </span>
      </div>

      {/* Dua kolom: ASET | KEWAJIBAN + EKUITAS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ── Kolom kiri: ASET ── */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">ASET</span>
              <span className="text-xs font-mono text-blue-600">{fmt(totalAset)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th w-20">Kode</th>
                  <th className="th">Nama Akun</th>
                  <th className="th w-36 text-right">Input (Rp)</th>
                  <th className="th w-32 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {renderAkunRows(asetAkun)}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={3} className="td text-xs font-bold text-blue-700 text-right pr-3">Total Aset</td>
                  <td className="td text-right font-bold font-mono text-blue-700 pr-3">{fmt(totalAset)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Kolom kanan: KEWAJIBAN + EKUITAS ── */}
        <div className="space-y-4">
          {/* KEWAJIBAN */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">KEWAJIBAN</span>
              <span className="text-xs font-mono text-amber-600">{fmt(totalKewajiban)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th w-20">Kode</th>
                  <th className="th">Nama Akun</th>
                  <th className="th w-36 text-right">Input (Rp)</th>
                  <th className="th w-32 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {renderAkunRows(kewajibanAkun)}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200">
                  <td colSpan={3} className="td text-xs font-bold text-amber-700 text-right pr-3">Total Kewajiban</td>
                  <td className="td text-right font-bold font-mono text-amber-700 pr-3">{fmt(totalKewajiban)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* EKUITAS / MODAL */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">EKUITAS / MODAL</span>
              <span className="text-xs font-mono text-emerald-600">{fmt(totalEkuitas)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th w-20">Kode</th>
                  <th className="th">Nama Akun</th>
                  <th className="th w-36 text-right">Input (Rp)</th>
                  <th className="th w-32 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {renderAkunRows(ekuitasAkun)}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                  <td colSpan={3} className="td text-xs font-bold text-emerald-700 text-right pr-3">Total Ekuitas</td>
                  <td className="td text-right font-bold font-mono text-emerald-700 pr-3">{fmt(totalEkuitas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Ringkasan Kewajiban + Modal */}
          <div className={`rounded-lg px-4 py-3 border-2 flex items-center justify-between text-sm font-semibold ${
            balanced
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-amber-300 bg-amber-50 text-amber-700'
          }`}>
            <span>Total Kewajiban + Modal</span>
            <span className="font-mono">{fmt(totalKewajEkuitas)}</span>
          </div>
        </div>
      </div>

      {/* Simpan */}
      <div className="flex items-center gap-3 mt-5">
        <button onClick={handleSave} className="btn btn-primary" disabled={!balanced}>
          <Save size={15} /> {saved ? 'Tersimpan ✓' : 'Simpan Saldo Awal'}
        </button>
        {!balanced && (
          <p className="text-xs text-amber-600">
            Harap seimbangkan Aset dengan Kewajiban + Modal terlebih dahulu. Selisih: Rp {fmt(selisih)}
          </p>
        )}
      </div>
    </div>
  )
}
