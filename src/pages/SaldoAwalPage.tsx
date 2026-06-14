import { useMemo, useState, useEffect, useCallback, memo } from 'react'
import { Save } from 'lucide-react'
import { COA } from '../utils/coa'
import type { Akun } from '../types'
import { fmt } from '../utils/accounting'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/ui'

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

const isKontraAset = (a: Akun) => a.grup === 'ASET' && a.tipe === 'K'

// ── AkunRow: komponen per baris, di-memo agar tidak re-render saat baris lain berubah ──
const AkunRow = memo(function AkunRow({
  akun, value, onChange,
}: {
  akun: Akun
  value: number
  onChange: (kode: string, val: number) => void
}) {
  const isKontra = isKontraAset(akun)
  return (
    <tr className="hover:bg-slate-50 border-b border-slate-50">
      <td className="td font-mono text-xs text-slate-500">{akun.kode}</td>
      <td className="td text-sm">
        <span>{akun.nama}</span>
        {isKontra && (
          <span className="ml-1.5 text-[9px] font-semibold text-rose-500 bg-rose-50 px-1 py-0.5 rounded">kontra</span>
        )}
      </td>
      <td className="td pr-2">
        <input
          type="number"
          className={`input text-right font-mono ${isKontra ? 'border-rose-200 focus:border-rose-400' : ''}`}
          value={value || ''}
          placeholder="0"
          min={0}
          onChange={e => onChange(akun.kode, Number(e.target.value) || 0)}
        />
      </td>
      <td className="td text-right font-mono text-xs pr-3">
        {value ? (
          <span className={isKontra ? 'text-rose-600' : 'text-slate-700'}>
            {isKontra ? `(${fmt(value)})` : fmt(value)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  )
})

// ── SectionTable: di-definisikan di luar komponen utama agar tidak di-recreate setiap render ──
const SectionTable = memo(function SectionTable({
  title, colorClass, list, total, totalLabel, values, onChange,
}: {
  title: string
  colorClass: string
  list: Akun[]
  total: number
  totalLabel: string
  values: Record<string, number>
  onChange: (kode: string, val: number) => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${colorClass}`}>
        <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
        <span className="text-xs font-mono">{fmt(total)}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="th w-20">Kode</th>
            <th className="th">Nama Akun</th>
            <th className="th w-40 text-right">Nilai (Rp)</th>
            <th className="th w-32 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {list.map(a => (
            <AkunRow
              key={a.kode}
              akun={a}
              value={values[a.kode] ?? 0}
              onChange={onChange}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className={`border-t-2 ${colorClass}`}>
            <td colSpan={3} className="td text-xs font-bold text-right pr-3">{totalLabel}</td>
            <td className="td text-right font-bold font-mono pr-3">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
})

export default function SaldoAwalPage() {
  const { saldoAwal, setSaldoAwal } = useAppStore()

  const [local, setLocal] = useState<Record<string, number>>(() => ({ ...saldoAwal }))
  const [saved, setSaved] = useState(false)

  // Sync dari Supabase realtime — HANYA saat saldoAwal berubah dari luar (device lain),
  // tidak saat user sedang mengetik (cek isDiff supaya tidak trigger saat equal)
  useEffect(() => {
    setLocal(prev => {
      const next = { ...saldoAwal }
      const isDiff =
        Object.keys(next).some(k => next[k] !== prev[k]) ||
        Object.keys(prev).some(k => next[k] !== prev[k])
      return isDiff ? next : prev
    })
  }, [saldoAwal])

  // COA dimuat sekali saja — tidak pakai interval agar tidak trigger re-render tiap 2 detik
  const allCOA = useMemo(() => getAllCOA(), [])

  const setManual = useCallback((kode: string, val: number) =>
    setLocal(s => ({ ...s, [kode]: Math.max(0, val) })), [])

  const asetAkun      = useMemo(() => allCOA.filter(a => a.grup === 'ASET'), [allCOA])
  const kewajibanAkun = useMemo(() => allCOA.filter(a => a.grup === 'KEWAJIBAN'), [allCOA])
  const ekuitasAkun   = useMemo(() => allCOA.filter(a => a.grup === 'EKUITAS'), [allCOA])

  const totalAset = useMemo(() =>
    asetAkun.reduce((s, a) => {
      const val = local[a.kode] ?? 0
      return s + (isKontraAset(a) ? -val : val)
    }, 0), [local, asetAkun])

  const totalKewajiban = useMemo(() =>
    kewajibanAkun.reduce((s, a) => s + (local[a.kode] ?? 0), 0),
    [local, kewajibanAkun])

  const totalEkuitas = useMemo(() =>
    ekuitasAkun.reduce((s, a) => s + (local[a.kode] ?? 0), 0),
    [local, ekuitasAkun])

  const totalKewajEkuitas = totalKewajiban + totalEkuitas
  const selisih  = Math.abs(totalAset - totalKewajEkuitas)
  const balanced = selisih < 1

  const handleSave = () => {
    setSaldoAwal(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        title="Saldo Awal"
        subtitle="Isi saldo pembuka sesuai Laporan Posisi Keuangan tahun sebelumnya"
      />

      <div className={`rounded-lg px-4 py-3 text-sm mb-5 flex flex-wrap items-center justify-between gap-2 ${
        balanced
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span className="font-semibold">{balanced ? '✓ Neraca seimbang' : '⚠ Neraca belum seimbang'}</span>
        <span className="font-mono text-xs flex flex-wrap gap-4">
          <span>Total Aset: <strong>{fmt(totalAset)}</strong></span>
          <span>Kewajiban + Modal: <strong>{fmt(totalKewajEkuitas)}</strong></span>
          {!balanced && <span>Selisih: <strong>{fmt(selisih)}</strong></span>}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div>
          <SectionTable
            title="ASET"
            colorClass="bg-blue-50 border-blue-100 text-blue-700"
            list={asetAkun}
            total={totalAset}
            totalLabel="Total Aset"
            values={local}
            onChange={setManual}
          />
        </div>
        <div className="space-y-4">
          <SectionTable
            title="KEWAJIBAN"
            colorClass="bg-amber-50 border-amber-100 text-amber-700"
            list={kewajibanAkun}
            total={totalKewajiban}
            totalLabel="Total Kewajiban"
            values={local}
            onChange={setManual}
          />
          <SectionTable
            title="EKUITAS / MODAL"
            colorClass="bg-emerald-50 border-emerald-100 text-emerald-700"
            list={ekuitasAkun}
            total={totalEkuitas}
            totalLabel="Total Ekuitas"
            values={local}
            onChange={setManual}
          />
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

      <div className="flex items-center gap-3 mt-5">
        <button onClick={handleSave} className="btn btn-primary">
          <Save size={15} /> {saved ? 'Tersimpan ✓' : 'Simpan Saldo Awal'}
        </button>
        {!balanced && (
          <p className="text-xs text-amber-600">
            Seimbangkan Aset = Kewajiban + Modal. Selisih: Rp {fmt(selisih)}
          </p>
        )}
      </div>
    </div>
  )
}
