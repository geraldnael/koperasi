import { useMemo, useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { COA } from '../utils/coa'
import type { Akun } from '../types'
import { fmt } from '../utils/accounting'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/ui'

const GROUPS = ['ASET', 'KEWAJIBAN', 'EKUITAS'] as const

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

export default function SaldoAwalPage() {
  const { saldoAwal, setSaldoAwal } = useAppStore()
  const [local, setLocal]   = useState<Record<string, number>>({ ...saldoAwal })
  const [saved, setSaved]   = useState(false)
  const [allCOA, setAllCOA] = useState<Akun[]>(getAllCOA)

  // Refresh COA list when localStorage changes (e.g. after editing in COAPage)
  useEffect(() => {
    const refresh = () => setAllCOA(getAllCOA())
    window.addEventListener('storage', refresh)
    // Also poll every 2s to catch same-tab changes
    const interval = setInterval(() => setAllCOA(getAllCOA()), 2000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(interval) }
  }, [])

  const set = (kode: string, val: number) => setLocal(s => ({ ...s, [kode]: val }))

  const { totalD, totalK } = useMemo(() => {
    let d = 0, k = 0
    allCOA.filter(a => GROUPS.includes(a.grup as any)).forEach(a => {
      const v = local[a.kode] ?? 0
      if (a.tipe === 'D') d += v; else k += v
    })
    return { totalD: d, totalK: k }
  }, [local, allCOA])

  const balanced = Math.abs(totalD - totalK) < 1

  const handleSave = () => {
    setSaldoAwal(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Saldo Awal"
        subtitle="Isi saldo pembuka sesuai Laporan Posisi Keuangan tahun sebelumnya"
      />

      <div className={`rounded-lg px-4 py-2.5 text-sm mb-4 flex items-center justify-between ${
        balanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                 : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span>{balanced ? '✓ Saldo seimbang' : '⚠ Belum seimbang'}</span>
        <span className="font-mono text-xs">
          D: {fmt(totalD)} | K: {fmt(totalK)}
          {!balanced && ` | Selisih: ${fmt(Math.abs(totalD - totalK))}`}
        </span>
      </div>

      {GROUPS.map(grup => (
        <div key={grup} className="card overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{grup}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th w-24">Kode</th>
                <th className="th">Nama Akun</th>
                <th className="th w-20">Normal</th>
                <th className="th w-44 text-right pr-4">Saldo (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {allCOA.filter(a => a.grup === grup).map(a => (
                <tr key={a.kode} className="hover:bg-slate-50 border-b border-slate-50">
                  <td className="td font-mono text-xs text-slate-500">{a.kode}</td>
                  <td className="td text-sm">{a.nama}</td>
                  <td className="td">
                    <span className={`badge text-[10px] ${a.tipe === 'D' ? 'badge-blue' : 'badge-green'}`}>
                      {a.tipe === 'D' ? 'Debet' : 'Kredit'}
                    </span>
                  </td>
                  <td className="td pr-2">
                    <input type="number" className="input text-right font-mono"
                      value={local[a.kode] ?? 0}
                      onChange={e => set(a.kode, Number(e.target.value) || 0)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex items-center gap-3 mt-2">
        <button onClick={handleSave} className="btn btn-primary" disabled={!balanced}>
          <Save size={15} /> {saved ? 'Tersimpan ✓' : 'Simpan Saldo Awal'}
        </button>
        {!balanced && <p className="text-xs text-amber-600">Harap seimbangkan Debet dan Kredit terlebih dahulu.</p>}
      </div>
    </div>
  )
}
