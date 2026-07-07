import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, RotateCcw, PenLine, Pencil, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { COA, getAkunNama, mergeCustomCOA } from '../utils/coa'
import { fmt } from '../utils/accounting'
import { PageHeader, BalanceAlert, EmptyState } from '../components/ui'
import { printElement } from '../utils/printHelper'
import { exportJurnal } from '../utils/exportExcel'
import type { JurnalBaris, JurnalEntry } from '../types'

// ── Akun yang mempengaruhi buku pembantu ─────────────────────────────────
const AKUN_SIMPANAN   = new Set(['3.1.2','2.1.8','2.1.9','2.1.10'])
const AKUN_KAS_BANK   = new Set(['1.1.1','1.1.2'])

function rowTag(r: JurnalBaris): 'simpanan' | 'piutang' | null {
  // Baris simpanan: akun menyentuh akun simpanan + kas/bank
  if ((AKUN_KAS_BANK.has(r.kode_d) && AKUN_SIMPANAN.has(r.kode_k)) ||
      (AKUN_SIMPANAN.has(r.kode_d) && AKUN_KAS_BANK.has(r.kode_k))) return 'simpanan'
  // Baris piutang: semua baris yang ada nama anggota (ket diisi) → masuk buku piutang
  if (r.ket && r.ket.trim()) return 'piutang'
  return null
}

const newRow = (): JurnalBaris => ({
  id: crypto.randomUUID(), ket: '', kode_d: '', debet: 0, kode_k: '', kredit: 0,
})

// ═══════════════════════════════════════════════════════════════════════
// Autocomplete input — muncul dropdown saat ketik nama anggota
// ═══════════════════════════════════════════════════════════════════════
function AutocompleteInput({
  value, onChange, suggestions, placeholder, className,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState(value)
  const wrapRef           = useRef<HTMLDivElement>(null)

  // Sync from outside (e.g. reset/edit)
  useEffect(() => { setQuery(value) }, [value])

  const matches = useMemo(() => {
    if (!query || query.length < 1) return []
    const q = query.toLowerCase()
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 10)
  }, [query, suggestions])

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const pick = (name: string) => {
    setQuery(name)
    onChange(name)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        className={className}
        placeholder={placeholder}
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => { if (query.length >= 1) setOpen(true) }}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter' && matches.length > 0) { pick(matches[0]); e.preventDefault() }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-[999] left-0 top-full mt-0.5 w-full min-w-[240px] max-h-52
                       overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl text-xs">
          {matches.map(s => (
            <li
              key={s}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
              onMouseDown={e => { e.preventDefault(); pick(s) }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Satu baris jurnal — dengan auto-fill kredit dari debit
// ═══════════════════════════════════════════════════════════════════════
function JurnalRow({
  row, allRows, onChange, onRemove, canRemove, anggotaNama, coaOpts,
}: {
  row: JurnalBaris
  allRows: JurnalBaris[]
  onChange: (id: string, field: keyof JurnalBaris, value: string | number) => void
  onRemove: (id: string) => void
  canRemove: boolean
  anggotaNama: string[]
  coaOpts: React.ReactNode
}) {
  const tag = rowTag(row)

  // Hitung sisa kredit yang dibutuhkan agar jurnal balance
  const totalDebet  = allRows.reduce((s, r) => s + (r.debet  || 0), 0)
  const totalKredit = allRows.reduce((s, r) => s + (r.kredit || 0), 0)

  // Saat user mengisi debet → auto-fill kredit baris ini dengan sisa selisih
  const handleDebetChange = (val: number) => {
    val = Math.max(0, val)
    onChange(row.id, 'debet', val)
    // Hitung ulang: total debet semua baris (termasuk nilai baru ini)
    const newTotalD = allRows.reduce((s, r) => s + (r.id === row.id ? val : r.debet || 0), 0)
    const newTotalK = allRows.reduce((s, r) => s + (r.id === row.id ? 0 : r.kredit || 0), 0)
    const selisih = newTotalD - newTotalK
    if (selisih > 0 && row.kredit === 0) {
      onChange(row.id, 'kredit', selisih)
    }
  }

  // Saat user mengisi kredit → auto-fill debet baris ini dengan sisa selisih
  const handleKreditChange = (val: number) => {
    val = Math.max(0, val)
    onChange(row.id, 'kredit', val)
    const newTotalK = allRows.reduce((s, r) => s + (r.id === row.id ? val : r.kredit || 0), 0)
    const newTotalD = allRows.reduce((s, r) => s + (r.id === row.id ? 0 : r.debet || 0), 0)
    const selisih = newTotalK - newTotalD
    if (selisih > 0 && row.debet === 0) {
      onChange(row.id, 'debet', selisih)
    }
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[220px_1fr_130px_1fr_130px_36px] gap-2
                     items-end rounded-lg px-2 py-2 border transition-colors
                     ${tag === 'simpanan' ? 'bg-emerald-50 border-emerald-200' :
                       tag === 'piutang'  ? 'bg-blue-50   border-blue-200'    :
                                           'bg-white      border-slate-100'   }`}>

      {/* Nama anggota — autocomplete */}
      <div className="relative">
        {tag && (
          <span className={`absolute -top-4 left-0 text-[9px] font-semibold
            ${tag === 'simpanan' ? 'text-emerald-600' : 'text-blue-600'}`}>
            → buku {tag}
          </span>
        )}
        <AutocompleteInput
          value={row.ket}
          onChange={v => onChange(row.id, 'ket', v)}
          suggestions={anggotaNama}
          placeholder="Nama anggota..."
          className={`input text-xs w-full
            ${tag === 'simpanan' ? 'border-emerald-300 focus:border-emerald-500' :
              tag === 'piutang'  ? 'border-blue-300   focus:border-blue-500'    : ''}`}
        />
      </div>

      {/* Akun Debet */}
      <select className="input text-xs" value={row.kode_d}
        onChange={e => onChange(row.id, 'kode_d', e.target.value)}>
        <option value="">-- Akun Debet --</option>
        {coaOpts}
      </select>

      {/* Nominal Debet — auto-fills kredit */}
      <input
        type="number" min={0}
        className="input text-right text-xs font-mono"
        placeholder="0"
        value={row.debet || ''}
        onChange={e => handleDebetChange(Math.max(0, Number(e.target.value) || 0))}
      />

      {/* Akun Kredit */}
      <select className="input text-xs" value={row.kode_k}
        onChange={e => onChange(row.id, 'kode_k', e.target.value)}>
        <option value="">-- Akun Kredit --</option>
        {coaOpts}
      </select>

      {/* Nominal Kredit — auto-filled dari debet */}
      <input
        type="number" min={0}
        className={`input text-right text-xs font-mono
          ${row.kredit > 0 && row.kredit === (totalDebet - (totalKredit - row.kredit))
            ? 'bg-emerald-50 border-emerald-300' : ''}`}
        placeholder="0"
        value={row.kredit || ''}
        onChange={e => handleKreditChange(Math.max(0, Number(e.target.value) || 0))}
      />

      {/* Hapus baris */}
      <button className="btn btn-danger p-2 justify-center"
        onClick={() => onRemove(row.id)} disabled={!canRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Main JurnalPage
// ═══════════════════════════════════════════════════════════════════════
export default function JurnalPage() {
  const { jurnal, addJurnal, updateJurnal, deleteJurnal, anggota, identitas, customCOA } = useAppStore()
  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])

  const anggotaNama = useMemo(() => anggota.map(a => a.nama), [anggota])

  const [editId,      setEditId]      = useState<number | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const [tanggal,     setTanggal]     = useState(today)
  const [nobukti,     setNobukti]     = useState('')
  const [keterangan,  setKeterangan]  = useState('')
  const [rows,        setRows]        = useState<JurnalBaris[]>([newRow()])

  const totalD   = useMemo(() => rows.reduce((a, r) => a + (r.debet  || 0), 0), [rows])
  const totalK   = useMemo(() => rows.reduce((a, r) => a + (r.kredit || 0), 0), [rows])
  const balanced = Math.abs(totalD - totalK) < 0.01 && totalD > 0

  const updateRow = useCallback((id: string, field: keyof JurnalBaris, value: string | number) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r)), [])

  const addRow    = () => setRows(rs => [...rs, newRow()])
  const removeRow = (id: string) => setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs)

  const reset = () => {
    setEditId(null); setNobukti(''); setKeterangan('')
    setRows([newRow()])
    setTanggal(new Date().toISOString().split('T')[0])
  }

  const startEdit = (j: JurnalEntry) => {
    setEditId(j.id); setTanggal(j.tanggal); setNobukti(j.nobukti)
    setKeterangan(j.keterangan); setRows(j.rows.map(r => ({ ...r })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = () => {
    if (!tanggal || !nobukti.trim()) { alert('Tanggal dan No. Bukti wajib diisi'); return }
    if (!balanced) { alert('Jurnal tidak seimbang (Debet ≠ Kredit)'); return }
    const entry = { tanggal, nobukti, keterangan, rows, total: totalD }
    editId != null ? updateJurnal(editId, entry) : addJurnal(entry)
    reset()
  }

  const autoNoBukti = `JU-${String(jurnal.length + 1).padStart(3, '0')}`

  const coaOpts = useMemo(() => allCOA.map(a => (
    <option key={a.kode} value={a.kode}>{a.kode} — {a.nama}</option>
  )), [allCOA])

  return (
    <div className="p-6" id="print-jurnal">
      <PageHeader
        title={editId != null ? '✏️ Edit Jurnal' : 'Jurnal Umum'}
        subtitle="Pencatatan transaksi double-entry — debet = kredit"
        actions={
          <div className="flex gap-2 no-print">
            <button className="btn" onClick={() => printElement('print-jurnal', 'Jurnal Umum')}>
              🖨️ Cetak
            </button>
            <button className="btn bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
              onClick={() => exportJurnal(identitas, jurnal)}>
              📥 Excel
            </button>
          </div>
        }
      />

      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-4 py-2 mb-4 leading-relaxed">
        💡 <strong>Nama Anggota:</strong> ketik sebagian nama → pilih dari dropdown.
        <span className="mx-2">·</span>
        <strong>Nominal Kredit</strong> terisi otomatis saat Debet diinput.
        <span className="mx-2">·</span>
        Baris <span className="text-emerald-600 font-semibold">hijau</span> = terhubung buku simpanan.
        <span className="mx-2">·</span>
        <span className="text-blue-600 font-semibold">Semua baris yang ada Nama Anggota</span> → otomatis masuk buku piutang
        (Debet = realisasi, Kredit = angsuran pokok, Kredit 4.1.1 = jasa).
      </div>

      {/* ── Form input / edit ── */}
      <div className={`card p-5 mb-5 ${editId != null ? 'border-2 border-amber-400 bg-amber-50/30' : ''}`}>
        {editId != null && (
          <div className="flex items-center gap-2 mb-3 text-amber-700 text-sm font-semibold bg-amber-100 px-3 py-2 rounded-lg">
            <Pencil size={15} /> Mode Edit — mengubah entri yang sudah tersimpan
            <button className="ml-auto btn btn-sm text-xs border-amber-300" onClick={reset}>
              <X size={13} /> Batal Edit
            </button>
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div>
            <label className="label">Tanggal <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={tanggal}
              onChange={e => setTanggal(e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>No. Bukti <span className="text-red-500">*</span></span>
              {editId == null && (
                <button className="text-[10px] text-blue-500 hover:underline"
                  onClick={() => setNobukti(autoNoBukti)}>auto</button>
              )}
            </label>
            <input className="input" value={nobukti}
              onChange={e => setNobukti(e.target.value)} placeholder="JU-001" />
          </div>
          <div className="col-span-2">
            <label className="label">Keterangan Transaksi</label>
            <input className="input" value={keterangan}
              onChange={e => setKeterangan(e.target.value)} placeholder="Deskripsi transaksi…" />
          </div>
        </div>

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[220px_1fr_130px_1fr_130px_36px] gap-2 mb-1 px-2">
          {['Nama Anggota','Akun Debet','Nominal Debet','Akun Kredit','Nominal Kredit',''].map(h => (
            <span key={h} className="label">{h}</span>
          ))}
        </div>

        {/* Baris-baris jurnal */}
        <div className="space-y-2.5 mb-3">
          {rows.map(r => (
            <JurnalRow
              key={r.id}
              row={r}
              allRows={rows}
              onChange={updateRow}
              onRemove={removeRow}
              canRemove={rows.length > 1}
              anggotaNama={anggotaNama}
              coaOpts={coaOpts}
            />
          ))}
        </div>

        <button className="btn btn-sm mb-5" onClick={addRow}>
          <Plus size={14} /> Tambah Baris
        </button>

        {/* Balance indicator */}
        <BalanceAlert debet={totalD} kredit={totalK} />

        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary" onClick={save} disabled={!balanced || !nobukti.trim()}>
            <Save size={15} /> {editId != null ? 'Update Jurnal' : 'Simpan Jurnal'}
          </button>
          <button className="btn" onClick={reset}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      {/* ── Daftar jurnal tersimpan ── */}
      <div className="card overflow-hidden no-print">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Daftar Jurnal Tersimpan</span>
          <span className="badge badge-blue">{jurnal.length} entri</span>
        </div>

        {jurnal.length === 0 ? (
          <EmptyState icon={<PenLine size={32} />} message="Belum ada jurnal. Tambah transaksi di atas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="th w-24">Tanggal</th>
                  <th className="th w-24">No. Bukti</th>
                  <th className="th">Keterangan</th>
                  <th className="th w-36 text-right">Jumlah (Rp)</th>
                  <th className="th w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {[...jurnal].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map(j => {
                  const td       = j.rows.reduce((a, r) => a + (r.debet || 0), 0)
                  const isEdit   = j.id === editId
                  return (
                    <>
                      {/* Header entri */}
                      <tr key={`h-${j.id}`}
                        className={`border-b border-slate-200 ${isEdit ? 'bg-amber-50' : 'bg-slate-50/70 hover:bg-slate-100'}`}>
                        <td className="td text-xs font-mono">{j.tanggal}</td>
                        <td className="td text-xs font-mono font-bold">{j.nobukti}</td>
                        <td className="td text-sm font-medium">{j.keterangan || <span className="text-slate-400">—</span>}</td>
                        <td className="td-num text-blue-700 font-bold">{fmt(td)}</td>
                        <td className="td text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              className="btn btn-sm p-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => startEdit(j)} title="Edit jurnal">
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm p-1.5"
                              onClick={() => { if (confirm('Hapus jurnal ini?')) deleteJurnal(j.id) }}
                              title="Hapus jurnal">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Baris-baris detail */}
                      {j.rows.map(r => {
                        const tag = rowTag(r)
                        return (
                          <tr key={`r-${r.id}`} className="bg-white text-xs border-b border-slate-50">
                            <td className="td py-1.5" colSpan={2}></td>
                            <td className="td py-1.5 pl-8 text-slate-500">
                              {r.ket && (
                                <span className="mr-2 font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {r.ket}
                                </span>
                              )}
                              {r.kode_d && (
                                <span className="text-blue-600 mr-1">
                                  Dr {r.kode_d} {getAkunNama(r.kode_d, allCOA)}
                                </span>
                              )}
                              {r.kode_k && (
                                <span className="text-emerald-600 ml-2">
                                  Cr {r.kode_k} {getAkunNama(r.kode_k, allCOA)}
                                </span>
                              )}
                              {tag && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold
                                  ${tag === 'simpanan' ? 'bg-emerald-100 text-emerald-600'
                                                       : 'bg-blue-100 text-blue-600'}`}>
                                  → {tag}
                                </span>
                              )}
                            </td>
                            <td className="td-num py-1.5 text-blue-600 font-mono">
                              {r.debet ? fmt(r.debet) : ''}
                            </td>
                            <td className="td py-1.5"></td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
