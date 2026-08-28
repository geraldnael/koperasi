import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, RotateCcw, PenLine, Pencil, X, ShieldQuestion, Clock, Check, XCircle, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { dbPeekNextNobukti } from '../lib/db'
import { getAkunNama, mergeCustomCOA } from '../utils/coa'
import { fmt } from '../utils/accounting'
import { PageHeader, BalanceAlert, EmptyState } from '../components/ui'
import { printElement } from '../utils/printHelper'
import { exportJurnal } from '../utils/exportExcel'
import type { JurnalBaris, JurnalEntry } from '../types'

// ── Akun yang mempengaruhi buku pembantu ─────────────────────────────────
const AKUN_SIMPANAN = new Set(['3.1.1','3.1.2','2.1.8','2.1.9','2.1.10','2.1.14','5.1.2','4.2.3'])

function rowTag(r: JurnalBaris): 'simpanan' | 'piutang' | null {
  // Baris simpanan: salah satu sisi menyentuh akun simpanan
  if (AKUN_SIMPANAN.has(r.kode_d) || AKUN_SIMPANAN.has(r.kode_k)) return 'simpanan'
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
  row, allRows, onChange, onRemove, canRemove, anggotaNama, coaOpts, attempted,
}: {
  row: JurnalBaris
  allRows: JurnalBaris[]
  onChange: (id: string, field: keyof JurnalBaris, value: string | number) => void
  onRemove: (id: string) => void
  canRemove: boolean
  anggotaNama: string[]
  coaOpts: React.ReactNode
  attempted: boolean
}) {
  const tag = rowTag(row)
  const namaTidakValid = attempted && !!row.ket.trim() &&
    !anggotaNama.some(n => n.toLowerCase() === row.ket.trim().toLowerCase())

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
            ${namaTidakValid ? 'border-red-400 bg-red-50 focus:border-red-500' :
              tag === 'simpanan' ? 'border-emerald-300 focus:border-emerald-500' :
              tag === 'piutang'  ? 'border-blue-300   focus:border-blue-500'    : ''}`}
        />
        {namaTidakValid && (
          <p className="text-[10px] text-red-500 mt-0.5">
            Nama tidak ada di daftar Anggota — pilih dari saran, atau kosongkan.
          </p>
        )}
      </div>

      {/* Akun Debet */}
      <div>
        <select
          className={`input text-xs ${attempted && !row.kode_d ? 'border-red-400 bg-red-50 focus:border-red-500' : ''}`}
          value={row.kode_d}
          onChange={e => onChange(row.id, 'kode_d', e.target.value)}>
          <option value="">-- Akun Debet * --</option>
          {coaOpts}
        </select>
        {attempted && !row.kode_d && (
          <p className="text-[10px] text-red-500 mt-0.5">Wajib diisi</p>
        )}
      </div>

      {/* Nominal Debet — auto-fills kredit */}
      <input
        type="number" min={0}
        className="input text-right text-xs font-mono"
        placeholder="0"
        value={row.debet || ''}
        onChange={e => handleDebetChange(Math.max(0, Number(e.target.value) || 0))}
      />

      {/* Akun Kredit */}
      <div>
        <select
          className={`input text-xs ${attempted && !row.kode_k ? 'border-red-400 bg-red-50 focus:border-red-500' : ''}`}
          value={row.kode_k}
          onChange={e => onChange(row.id, 'kode_k', e.target.value)}>
          <option value="">-- Akun Kredit * --</option>
          {coaOpts}
        </select>
        {attempted && !row.kode_k && (
          <p className="text-[10px] text-red-500 mt-0.5">Wajib diisi</p>
        )}
      </div>

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

function parseNoBuktiNum(nobukti: string): number {
  const m = nobukti.match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : -1
}

// ═══════════════════════════════════════════════════════════════════════
// Main JurnalPage
// ═══════════════════════════════════════════════════════════════════════
export default function JurnalPage() {
  const { jurnal, addJurnal, updateJurnal, deleteJurnal, anggota, identitas, customCOA } = useAppStore()
  const { profile, editRequests, requestEdit, approveEditRequest, rejectEditRequest,
          hasApprovedEdit, hasPendingEdit } = useAuthStore()
  const role = profile?.role
  const isBendahara = role === 'bendahara'
  const isAdmin     = role === 'admin'
  const [showApprovalPanel, setShowApprovalPanel] = useState(false)
  const pendingRequests = editRequests.filter(r => r.status === 'pending')
  const allCOA = useMemo(() => mergeCustomCOA(customCOA), [customCOA])

  // ── Filter & sort daftar jurnal ─────────────────────────────────────────
  // SEBELUMNYA semua entri (1500+) di-sort dan dirender sekaligus tanpa
  // batas di setiap render, ini yang bikin tab browser "Not Responding"
  // karena ribuan baris DOM dibuat ulang tiap kali ada state berubah
  // sedikit saja. Sekarang di-useMemo + pagination + filter, jadi cuma
  // dihitung ulang saat memang perlu, dan yang dirender cuma 1 halaman.
  const [searchJurnal, setSearchJurnal] = useState('')
  const [pageJurnal,   setPageJurnal]   = useState(1)
  const perPageJurnal = 25
  const [showFilter,   setShowFilter]   = useState(false)

  type SortField = 'nobukti' | 'tanggal' | 'nominal'
  const [sortField, setSortField] = useState<SortField>('nobukti')
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc') // default: terbaru/terbesar dulu

  const [filterTglDari,    setFilterTglDari]    = useState('')
  const [filterTglSampai,  setFilterTglSampai]  = useState('')
  const [filterAkun,       setFilterAkun]       = useState('')
  const [filterNominalMin, setFilterNominalMin] = useState('')
  const [filterNominalMax, setFilterNominalMax] = useState('')

  const filterAktifCount =
    (filterTglDari ? 1 : 0) + (filterTglSampai ? 1 : 0) + (filterAkun ? 1 : 0) +
    (filterNominalMin ? 1 : 0) + (filterNominalMax ? 1 : 0)

  const resetFilter = () => {
    setFilterTglDari(''); setFilterTglSampai(''); setFilterAkun('')
    setFilterNominalMin(''); setFilterNominalMax('')
  }

  // Shortcut rentang tanggal cepat
  const setRangeCepat = (jenis: 'hari' | 'minggu' | 'bulan') => {
    const now = new Date()
    const toISO = (d: Date) => d.toISOString().slice(0, 10)
    if (jenis === 'hari') {
      setFilterTglDari(toISO(now)); setFilterTglSampai(toISO(now))
    } else if (jenis === 'minggu') {
      const awal = new Date(now); awal.setDate(now.getDate() - now.getDay())
      setFilterTglDari(toISO(awal)); setFilterTglSampai(toISO(now))
    } else {
      const awal = new Date(now.getFullYear(), now.getMonth(), 1)
      setFilterTglDari(toISO(awal)); setFilterTglSampai(toISO(now))
    }
    setPageJurnal(1)
  }

  const jurnalFiltered = useMemo(() => {
    let list = jurnal

    const q = searchJurnal.trim().toLowerCase()
    if (q) {
      list = list.filter(j =>
        j.nobukti.toLowerCase().includes(q) ||
        j.keterangan.toLowerCase().includes(q) ||
        j.tanggal.includes(q) ||
        j.rows.some(r => (r.ket || '').toLowerCase().includes(q) || r.kode_d.includes(q) || r.kode_k.includes(q))
      )
    }
    if (filterTglDari)   list = list.filter(j => j.tanggal >= filterTglDari)
    if (filterTglSampai) list = list.filter(j => j.tanggal <= filterTglSampai)
    if (filterAkun)      list = list.filter(j => j.rows.some(r => r.kode_d === filterAkun || r.kode_k === filterAkun))
    const min = parseFloat(filterNominalMin)
    const max = parseFloat(filterNominalMax)
    if (!isNaN(min)) list = list.filter(j => j.total >= min)
    if (!isNaN(max)) list = list.filter(j => j.total <= max)

    return list
  }, [jurnal, searchJurnal, filterTglDari, filterTglSampai, filterAkun, filterNominalMin, filterNominalMax])

  const jurnalSorted = useMemo(() => {
    const arr = [...jurnalFiltered]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortField === 'tanggal')      cmp = a.tanggal.localeCompare(b.tanggal)
      else if (sortField === 'nominal') cmp = a.total - b.total
      else                              cmp = parseNoBuktiNum(a.nobukti) - parseNoBuktiNum(b.nobukti)
      if (cmp === 0) cmp = a.id - b.id
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [jurnalFiltered, sortField, sortDir])

  const totalPageJurnal = Math.max(1, Math.ceil(jurnalSorted.length / perPageJurnal))
  const jurnalPaginated = useMemo(() =>
    jurnalSorted.slice((pageJurnal - 1) * perPageJurnal, pageJurnal * perPageJurnal),
    [jurnalSorted, pageJurnal])

  useEffect(() => {
    if (pageJurnal > totalPageJurnal) setPageJurnal(totalPageJurnal)
  }, [totalPageJurnal, pageJurnal])

  const anggotaNama = useMemo(() => anggota.map(a => a.nama), [anggota])

  const [editId,      setEditId]      = useState<number | null>(null)
  const [attempted,   setAttempted]   = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [tanggal,     setTanggal]     = useState(today)
  const [nobukti,     setNobukti]     = useState('')
  const [autoMode,    setAutoMode]    = useState(false)
  const [keterangan,  setKeterangan]  = useState('')
  const [rows,        setRows]        = useState<JurnalBaris[]>([newRow()])
  const [loadingNoBukti, setLoadingNoBukti] = useState(false)
  const [saving, setSaving] = useState(false)

  const totalD   = useMemo(() => rows.reduce((a, r) => a + (r.debet  || 0), 0), [rows])
  const totalK   = useMemo(() => rows.reduce((a, r) => a + (r.kredit || 0), 0), [rows])
  const balanced = Math.abs(totalD - totalK) < 0.01 && totalD > 0

  const updateRow = useCallback((id: string, field: keyof JurnalBaris, value: string | number) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r)), [])

  const addRow    = () => setRows(rs => [...rs, newRow()])
  const removeRow = (id: string) => setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs)

  const reset = () => {
    setEditId(null); setNobukti(''); setAutoMode(false); setKeterangan('')
    setRows([newRow()]); setAttempted(false)
    setTanggal(new Date().toISOString().split('T')[0])
  }

  // Dipakai setelah SUKSES simpan: TIDAK mereset tanggal ke hari ini.
  // Ini penting untuk input transaksi lama secara berurutan (misal input
  // banyak transaksi Desember 2025 sekaligus) — tanggal yang barusan dipakai
  // tetap dipertahankan, jadi tidak gampang lupa ganti dan ke-set otomatis
  // ke tanggal hari ini (bug yang bikin banyak transaksi lama salah tercatat).
  const resetAfterSave = () => {
    setEditId(null); setNobukti(''); setAutoMode(false); setKeterangan('')
    setRows([newRow()]); setAttempted(false)
  }

  const startEdit = (j: JurnalEntry) => {
    setEditId(j.id); setTanggal(j.tanggal); setNobukti(j.nobukti); setAutoMode(false)
    setKeterangan(j.keterangan); setRows(j.rows.map(r => ({ ...r })))
    // Scroll ke atas FORM edit. PENTING: bukan window.scrollTo(), karena layout
    // aplikasi ini pakai sidebar fixed — yang benar-benar bisa di-scroll itu
    // <main id="main-content"> di App.tsx, bukan window/body-nya. window.scrollTo()
    // tidak akan berefek apapun di layout seperti ini.
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    setAttempted(true)
    if (!tanggal || !nobukti.trim()) { alert('Tanggal dan No. Bukti wajib diisi'); return }
    if (!balanced) { alert('Jurnal tidak seimbang (Debet ≠ Kredit)'); return }
    const rowKosong = rows.findIndex(r => !r.kode_d || !r.kode_k)
    if (rowKosong !== -1) {
      alert(`Baris ${rowKosong + 1}: Akun Debet dan Akun Kredit wajib diisi`)
      return
    }
    // Nama anggota kalau diisi HARUS cocok dengan data di menu Anggota —
    // cegah salah ketik/nama fiktif ikut tercatat sebagai piutang/simpanan
    // anggota yang sebenarnya tidak ada di database.
    const rowNamaSalah = rows.findIndex(r =>
      r.ket.trim() && !anggotaNama.some(n => n.toLowerCase() === r.ket.trim().toLowerCase())
    )
    if (rowNamaSalah !== -1) {
      alert(`Baris ${rowNamaSalah + 1}: Nama anggota "${rows[rowNamaSalah].ket}" tidak ditemukan di daftar Anggota.\n\nPilih nama dari saran yang muncul saat mengetik, atau kosongkan kolom itu kalau transaksi ini bukan untuk anggota tertentu. Kalau anggota ini memang baru, tambahkan dulu lewat menu Anggota.`)
      return
    }
    const entry = { tanggal, nobukti, keterangan, rows, total: totalD }
    setSaving(true)
    try {
      if (editId != null) {
        await updateJurnal(editId, entry)
      } else {
        // isAutoMode: nomor baru benar-benar DIKUNCI di server sekarang,
        // bukan sebelumnya saat tombol "auto" diklik — nilai `nobukti` di
        // sini cuma preview, hasil final bisa sedikit beda kalau user lain
        // sempat menyimpan lebih dulu di antara waktu preview & simpan ini.
        await addJurnal(entry, autoMode)
      }
      resetAfterSave()
    } catch (e: any) {
      // Ada user lain yang barusan pakai No. Bukti yang sama (submit hampir
      // bersamaan, biasanya nomor manual). Ambilkan nomor baru otomatis
      // biar user tinggal cek & simpan ulang.
      if (e?.message === 'DUPLICATE_NOBUKTI') {
        alert(`No. Bukti "${nobukti}" baru saja dipakai user lain untuk transaksi lain (submit bersamaan). Silakan cek ulang, nomor baru sudah disiapkan.`)
        await fetchAutoNoBukti()
      } else {
        alert('Gagal menyimpan jurnal. Cek koneksi internet dan coba lagi.')
      }
    } finally {
      setSaving(false)
    }
  }

  // Ambil PREVIEW nomor bukti berikutnya untuk ditampilkan di form. Ini
  // TIDAK mengunci/memajukan nomor apapun di database — nomor final baru
  // benar-benar dikunci nanti saat user klik Simpan (lihat komentar di save()).
  const fetchAutoNoBukti = useCallback(async () => {
    setLoadingNoBukti(true)
    try {
      const next = await dbPeekNextNobukti()
      setNobukti(next)
      setAutoMode(true)
    } catch {
      // Fallback kalau RPC belum ter-setup di database (misal lupa jalankan migration)
      setNobukti(`JU-${String(jurnal.length + 1).padStart(3, '0')}`)
      setAutoMode(false)
    } finally {
      setLoadingNoBukti(false)
    }
  }, [jurnal.length])

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
            {isBendahara && (
              <button
                className={`btn relative ${pendingRequests.length > 0 ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' : ''}`}
                onClick={() => setShowApprovalPanel(v => !v)}>
                <ShieldQuestion size={15} /> Permintaan Edit
                {pendingRequests.length > 0 && (
                  <span className="ml-1 bg-white text-amber-600 rounded-full px-1.5 text-[10px] font-bold">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            )}
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

      {/* Panel approval — cuma Bendahara yang lihat */}
      {isBendahara && showApprovalPanel && (
        <div className="card p-4 mb-4 no-print">
          <p className="text-xs font-semibold text-slate-500 mb-2">Permintaan Izin Edit dari Admin</p>
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-400">Tidak ada permintaan yang menunggu.</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map(req => {
                const j = jurnal.find(x => x.id === req.jurnal_id)
                return (
                  <div key={req.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                    <div>
                      <span className="font-bold">{j?.nobukti ?? `#${req.jurnal_id}`}</span>
                      <span className="text-slate-500"> — {j?.keterangan || 'transaksi'}</span>
                      <span className="block text-slate-400 mt-0.5">
                        diminta oleh {req.requested_by_nama ?? 'user'} · {new Date(req.requested_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="btn btn-sm bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                        onClick={() => approveEditRequest(req.id)}>
                        <Check size={12} /> Setujui
                      </button>
                      <button className="btn btn-sm text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => rejectEditRequest(req.id)}>
                        <XCircle size={12} /> Tolak
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
            {editId == null && (
              <p className="text-[10px] text-slate-400 mt-1">
                Tanggal dipertahankan dari entri sebelumnya — cek/ganti dulu kalau transaksi ini beda tanggal.
              </p>
            )}
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>No. Bukti <span className="text-red-500">*</span></span>
              {editId == null && (
                <button className="text-[10px] text-blue-500 hover:underline disabled:opacity-50"
                  disabled={loadingNoBukti}
                  onClick={fetchAutoNoBukti}>{loadingNoBukti ? 'memuat...' : 'auto'}</button>
              )}
            </label>
            <input className="input" value={nobukti}
              onChange={e => { setNobukti(e.target.value); setAutoMode(false) }} placeholder="JU-001" />
            {autoMode && (
              <p className="text-[10px] text-slate-400 mt-1">
                Preview — nomor final dikunci saat disimpan, bisa sedikit beda kalau ada user lain menyimpan lebih dulu.
              </p>
            )}
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
              attempted={attempted}
            />
          ))}
        </div>

        <button className="btn btn-sm mb-5" onClick={addRow}>
          <Plus size={14} /> Tambah Baris
        </button>

        {/* Balance indicator */}
        <BalanceAlert debet={totalD} kredit={totalK} />

        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary" onClick={save} disabled={!balanced || !nobukti.trim() || saving}>
            <Save size={15} /> {saving ? 'Menyimpan...' : editId != null ? 'Update Jurnal' : 'Simpan Jurnal'}
          </button>
          <button className="btn" onClick={reset}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      {/* ── Daftar jurnal tersimpan ── */}
      <div className="card overflow-hidden no-print">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Daftar Jurnal Tersimpan</span>
            <span className="badge badge-blue">{jurnal.length} entri</span>
            {jurnalSorted.length !== jurnal.length && (
              <span className="text-xs text-slate-400">({jurnalSorted.length} cocok filter)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input max-w-xs"
              placeholder="Cari no. bukti / keterangan / nama / kode akun..."
              value={searchJurnal}
              onChange={e => { setSearchJurnal(e.target.value); setPageJurnal(1) }}
            />
            <button
              className={`btn btn-sm ${showFilter || filterAktifCount > 0 ? 'border-blue-400 text-blue-600 bg-blue-50' : ''}`}
              onClick={() => setShowFilter(v => !v)}>
              <SlidersHorizontal size={14} /> Filter
              {filterAktifCount > 0 && (
                <span className="ml-1 bg-blue-600 text-white rounded-full text-[10px] w-4 h-4 inline-flex items-center justify-center">
                  {filterAktifCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Panel Filter Lanjutan ── */}
        {showFilter && (
          <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/60 space-y-4">
            {/* Urutkan */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Urutkan berdasarkan</label>
              <div className="flex flex-wrap gap-2">
                {([
                  { field: 'nobukti' as const, label: 'No. Bukti' },
                  { field: 'tanggal' as const, label: 'Tanggal' },
                  { field: 'nominal' as const, label: 'Nominal' },
                ]).map(opt => (
                  <button
                    key={opt.field}
                    className={`btn btn-sm ${sortField === opt.field ? 'border-blue-400 text-blue-600 bg-blue-50' : ''}`}
                    onClick={() => {
                      if (sortField === opt.field) {
                        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortField(opt.field)
                        setSortDir('desc')
                      }
                      setPageJurnal(1)
                    }}>
                    {opt.label}
                    {sortField === opt.field && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                  </button>
                ))}
                <span className="text-xs text-slate-400 self-center ml-1">
                  {sortField === 'tanggal'
                    ? (sortDir === 'desc' ? 'Terbaru → terlama' : 'Terlama → terbaru')
                    : sortField === 'nominal'
                    ? (sortDir === 'desc' ? 'Terbesar → terkecil' : 'Terkecil → terbesar')
                    : (sortDir === 'desc' ? 'Nomor terbesar → terkecil' : 'Nomor terkecil → terbesar')}
                </span>
              </div>
            </div>

            {/* Rentang tanggal */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Rentang tanggal</label>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" className="input w-auto" value={filterTglDari}
                  onChange={e => { setFilterTglDari(e.target.value); setPageJurnal(1) }} />
                <span className="text-xs text-slate-400">s/d</span>
                <input type="date" className="input w-auto" value={filterTglSampai}
                  onChange={e => { setFilterTglSampai(e.target.value); setPageJurnal(1) }} />
                <div className="flex gap-1.5 ml-1">
                  <button className="btn btn-sm" onClick={() => setRangeCepat('hari')}>Hari ini</button>
                  <button className="btn btn-sm" onClick={() => setRangeCepat('minggu')}>Minggu ini</button>
                  <button className="btn btn-sm" onClick={() => setRangeCepat('bulan')}>Bulan ini</button>
                </div>
              </div>
            </div>

            {/* Akun & rentang nominal */}
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Akun (Debet atau Kredit)</label>
                <select className="input w-64" value={filterAkun}
                  onChange={e => { setFilterAkun(e.target.value); setPageJurnal(1) }}>
                  <option value="">Semua akun</option>
                  {allCOA.map(a => (
                    <option key={a.kode} value={a.kode}>{a.kode} — {a.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Rentang nominal (Rp)</label>
                <div className="flex items-center gap-2">
                  <input type="number" className="input w-32" placeholder="Dari" value={filterNominalMin}
                    onChange={e => { setFilterNominalMin(e.target.value); setPageJurnal(1) }} />
                  <span className="text-xs text-slate-400">s/d</span>
                  <input type="number" className="input w-32" placeholder="Sampai" value={filterNominalMax}
                    onChange={e => { setFilterNominalMax(e.target.value); setPageJurnal(1) }} />
                </div>
              </div>
            </div>

            {filterAktifCount > 0 && (
              <button className="btn btn-sm text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => { resetFilter(); setPageJurnal(1) }}>
                <X size={13} /> Reset filter ({filterAktifCount})
              </button>
            )}
          </div>
        )}

        {jurnal.length === 0 ? (
          <EmptyState icon={<PenLine size={32} />} message="Belum ada jurnal. Tambah transaksi di atas." />
        ) : jurnalSorted.length === 0 ? (
          <EmptyState icon={<PenLine size={32} />} message="Tidak ada jurnal yang cocok dengan pencarian/filter ini." />
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
                {jurnalPaginated.map(j => {
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
                            {/* Tombol Edit: perilaku beda per role */}
                            {isBendahara ? (
                              <button
                                className="btn btn-sm p-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                                onClick={() => startEdit(j)} title="Edit jurnal">
                                <Pencil size={13} />
                              </button>
                            ) : isAdmin && hasApprovedEdit(j.id) ? (
                              <button
                                className="btn btn-sm p-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => startEdit(j)} title="Izin edit disetujui — klik untuk edit">
                                <Pencil size={13} />
                              </button>
                            ) : isAdmin && hasPendingEdit(j.id) ? (
                              <button className="btn btn-sm p-1.5 text-slate-400 cursor-not-allowed" disabled
                                title="Menunggu persetujuan Bendahara">
                                <Clock size={13} />
                              </button>
                            ) : isAdmin ? (
                              <button
                                className="btn btn-sm p-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={async () => {
                                  const res = await requestEdit(j.id)
                                  if (!res.ok) alert(res.message)
                                }}
                                title="Minta izin edit ke Bendahara">
                                <ShieldQuestion size={13} />
                              </button>
                            ) : null}
                            {/* Hapus: cuma Bendahara */}
                            {isBendahara && (
                              <button
                                className="btn btn-danger btn-sm p-1.5"
                                onClick={() => { if (confirm('Hapus jurnal ini?')) deleteJurnal(j.id) }}
                                title="Hapus jurnal">
                                <Trash2 size={13} />
                              </button>
                            )}
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
        {jurnalSorted.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Menampilkan {(pageJurnal - 1) * perPageJurnal + 1}–{Math.min(pageJurnal * perPageJurnal, jurnalSorted.length)} dari {jurnalSorted.length} entri
            </span>
            <div className="flex items-center gap-2">
              <button className="btn btn-sm" disabled={pageJurnal <= 1}
                onClick={() => setPageJurnal(p => Math.max(1, p - 1))}>
                ‹ Sebelumnya
              </button>
              <span>Hal {pageJurnal} / {totalPageJurnal}</span>
              <button className="btn btn-sm" disabled={pageJurnal >= totalPageJurnal}
                onClick={() => setPageJurnal(p => Math.min(totalPageJurnal, p + 1))}>
                Berikutnya ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
