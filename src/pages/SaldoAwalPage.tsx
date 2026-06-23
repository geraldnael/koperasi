import { useMemo, useState, memo, useCallback,} from 'react'
import { mergeCustomCOA } from '../utils/coa'
import type { Akun } from '../types'
import { fmt } from '../utils/accounting'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/ui'

const isKontraAset = (a: Akun) => a.grup === 'ASET' && a.tipe === 'K'

// ── AkunRow — auto-save tiap blur/Enter, TIDAK pakai tombol Simpan manual ──
const AkunRow = memo(function AkunRow({
  akun, value, onSave,
}: {
  akun: Akun
  value: number
  onSave: (kode: string, val: number) => void
}) {
  const isKontra = isKontraAset(akun)
  const [editing, setEditing] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const commit = useCallback(() => {
    const v = Math.max(0, Number(editing.replace(/[^\d.]/g, '')) || 0)
    if (v !== value) onSave(akun.kode, v)
    setIsFocused(false)
  }, [editing, value, akun.kode, onSave])

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
          className={`input text-right font-mono transition-colors
            ${isKontra ? 'border-rose-200 focus:border-rose-400' : ''}
            ${isFocused ? 'ring-2 ring-blue-300' : ''}`}
          value={isFocused ? editing : (value || '')}
          placeholder="0"
          min={0}
          onFocus={() => {
            setEditing(value ? String(value) : '')
            setIsFocused(true)
          }}
          onChange={e => setEditing(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }}
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

// ── SectionTable — di luar komponen utama agar tidak re-create tiap render ──
const SectionTable = memo(function SectionTable({
  title, colorClass, list, total, totalLabel, values, onSave,
}: {
  title: string
  colorClass: string
  list: Akun[]
  total: number
  totalLabel: string
  values: Record<string, number>
  onSave: (kode: string, val: number) => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${colorClass}`}>
        <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
        <span className="text-xs font-mono font-bold">{fmt(total)}</span>
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
              onSave={onSave}
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
  // Baca langsung dari store — tidak pakai local state lagi
  // sehingga perubahan langsung terlihat di semua halaman
  const { saldoAwal, updateSaldoAkun, customCOA } = useAppStore()

  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])

  const asetAkun      = useMemo(() => allCOA.filter(a => a.grup === 'ASET'),      [allCOA])
  const kewajibanAkun = useMemo(() => allCOA.filter(a => a.grup === 'KEWAJIBAN'), [allCOA])
  const ekuitasAkun   = useMemo(() => allCOA.filter(a => a.grup === 'EKUITAS'),   [allCOA])

  // onSave: langsung update store + Supabase per akun — tanpa tombol Simpan
  const handleSave = useCallback((kode: string, val: number) => {
    updateSaldoAkun(kode, val)
  }, [updateSaldoAkun])

  const totalAset = useMemo(() =>
    asetAkun.reduce((s, a) => {
      const val = saldoAwal[a.kode] ?? 0
      return s + (isKontraAset(a) ? -val : val)
    }, 0), [saldoAwal, asetAkun])

  const totalKewajiban = useMemo(() =>
    kewajibanAkun.reduce((s, a) => s + (saldoAwal[a.kode] ?? 0), 0),
    [saldoAwal, kewajibanAkun])

  const totalEkuitas = useMemo(() =>
    ekuitasAkun.reduce((s, a) => s + (saldoAwal[a.kode] ?? 0), 0),
    [saldoAwal, ekuitasAkun])

  const totalKewajEkuitas = totalKewajiban + totalEkuitas
  const selisih           = Math.abs(totalAset - totalKewajEkuitas)
  const balanced          = selisih < 1

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        title="Saldo Awal"
        subtitle="Klik nilai lalu Enter atau klik luar — tersimpan otomatis"
      />

      {/* Status neraca */}
      <div className={`rounded-lg px-4 py-3 text-sm mb-5 flex flex-wrap items-center justify-between gap-2 ${
        balanced
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span className="font-semibold">{balanced ? '✓ Neraca seimbang' : '⚠ Neraca belum seimbang'}</span>
        <span className="font-mono text-xs flex flex-wrap gap-4">
          <span>Total Aset: <strong>{fmt(totalAset)}</strong></span>
          <span>Kewajiban + Modal: <strong>{fmt(totalKewajEkuitas)}</strong></span>
          {!balanced && <span className="text-amber-700">Selisih: <strong>{fmt(selisih)}</strong></span>}
        </span>
      </div>

      {/* Info auto-save */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-4 py-2 mb-4">
        💡 Nilai tersimpan otomatis saat Anda menekan <kbd className="bg-white border border-blue-300 px-1 rounded text-[10px]">Enter</kbd> atau klik di luar kolom input. Tidak perlu klik tombol Simpan.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div>
          <SectionTable
            title="ASET"
            colorClass="bg-blue-50 border-blue-100 text-blue-700"
            list={asetAkun}
            total={totalAset}
            totalLabel="Total Aset"
            values={saldoAwal}
            onSave={handleSave}
          />
        </div>
        <div className="space-y-4">
          <SectionTable
            title="KEWAJIBAN"
            colorClass="bg-amber-50 border-amber-100 text-amber-700"
            list={kewajibanAkun}
            total={totalKewajiban}
            totalLabel="Total Kewajiban"
            values={saldoAwal}
            onSave={handleSave}
          />
          <SectionTable
            title="EKUITAS / MODAL"
            colorClass="bg-emerald-50 border-emerald-100 text-emerald-700"
            list={ekuitasAkun}
            total={totalEkuitas}
            totalLabel="Total Ekuitas"
            values={saldoAwal}
            onSave={handleSave}
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
    </div>
  )
}
