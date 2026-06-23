import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { COA } from '../utils/coa'
import { getBukuBesar, fmt } from '../utils/accounting'
import { useAppStore } from '../store/useAppStore'
import { PageHeader, EmptyState } from '../components/ui'
import { printElement } from '../utils/printHelper'
import { exportBukuBesar } from '../utils/exportExcel'

export default function BukuBesarPage() {
  const { saldoAwal, jurnal, identitas } = useAppStore()
  const [kode, setKode]     = useState('')
  const [dari, setDari]     = useState(identitas.awal || '')
  const [sampai, setSampai] = useState(identitas.akhir || '')

  const akuns = kode
    ? COA.filter(a => a.kode === kode)
    : COA.filter(a => {
        const sa = saldoAwal[a.kode] ?? 0
        const hasJurnal = jurnal.some(j => j.rows.some(r => r.kode_d === a.kode || r.kode_k === a.kode))
        return sa !== 0 || hasJurnal
      })

  const handleExcel = () => {
    if (!kode) { alert('Pilih akun terlebih dahulu untuk export Excel'); return }
    const akun = COA.find(a => a.kode === kode)
    if (!akun) return
    const rows = getBukuBesar(kode, saldoAwal, jurnal, dari || undefined, sampai || undefined)
    const sa = saldoAwal[kode] ?? 0
    exportBukuBesar(
      identitas,
      rows.filter(r => r.tipe !== 'saldo_awal').map(r => ({
        tanggal: r.tanggal, keterangan: r.keterangan,
        debet: r.debet ?? 0, kredit: r.kredit ?? 0, saldo: r.saldo,
      })),
      akun.nama, kode, sa
    )
  }

  return (
    <div className="p-6" id="print-bukubesar">
      <PageHeader
        title="Buku Besar"
        subtitle="Mutasi per akun dengan filter rentang tanggal"
        actions={
          <div className="flex gap-2 no-print">
            <button className="btn" onClick={() => printElement('print-bukubesar', 'Buku Besar')}>
              🖨️ Cetak
            </button>
            <button
              className="btn bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
              onClick={handleExcel}>
              📥 Excel
            </button>
          </div>
        }
      />

      <div className="card p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Pilih Akun</label>
          <select className="input" value={kode} onChange={e => setKode(e.target.value)}>
            <option value="">— Semua Akun Aktif —</option>
            {COA.map(a => <option key={a.kode} value={a.kode}>{a.kode} — {a.nama}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Dari Tanggal</label>
          <input type="date" className="input" value={dari} onChange={e => setDari(e.target.value)} />
        </div>
        <div>
          <label className="label">Sampai Tanggal</label>
          <input type="date" className="input" value={sampai} onChange={e => setSampai(e.target.value)} />
        </div>
      </div>

      {akuns.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen size={32} />}
            message="Belum ada akun aktif. Input saldo awal atau transaksi jurnal terlebih dahulu."
          />
        </div>
      ) : (
        akuns.map(akun => {
          const rows = getBukuBesar(akun.kode, saldoAwal, jurnal, dari || undefined, sampai || undefined)
          return (
            <div key={akun.kode} className="card overflow-hidden mb-4">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-slate-800">{akun.kode} — {akun.nama}</span>
                  <span className="ml-2 text-xs text-slate-400">{akun.kelompok}</span>
                </div>
                <span className={`badge ${akun.tipe === 'D' ? 'badge-blue' : 'badge-green'}`}>
                  {akun.tipe === 'D' ? 'Saldo Normal Debet' : 'Saldo Normal Kredit'}
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th w-24">Tanggal</th>
                    <th className="th w-24">Referensi</th>
                    <th className="th">Keterangan</th>
                    <th className="th w-32 text-right">Debet</th>
                    <th className="th w-32 text-right">Kredit</th>
                    <th className="th w-36 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={r.tipe === 'saldo_awal' ? 'bg-slate-50/50' : 'hover:bg-slate-50'}>
                      <td className="td text-xs text-slate-500">{r.tanggal}</td>
                      <td className="td text-xs font-mono">{r.referensi}</td>
                      <td className="td text-xs text-slate-600">{r.keterangan}</td>
                      <td className="td-num text-blue-700 text-xs">{r.debet !== null ? fmt(r.debet) : ''}</td>
                      <td className="td-num text-emerald-700 text-xs">{r.kredit !== null ? fmt(r.kredit) : ''}</td>
                      <td className="td-num font-semibold text-xs">{fmt(r.saldo)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-semibold">
                    <td className="td" colSpan={5}>
                      <span className="text-xs text-slate-600">Saldo Akhir</span>
                    </td>
                    <td className="td-num text-sm">
                      {rows.length ? fmt(rows[rows.length - 1].saldo) : '0'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}
