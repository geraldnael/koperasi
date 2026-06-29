import { useMemo, useState } from 'react'
import { Search, Plus, X, Save, Pencil, Trash2, Check } from 'lucide-react'
import { COA } from '../utils/coa'
import { computeSaldos, fmt } from '../utils/accounting'
import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/ui'
import type { Akun, TipeAkun, SaldoNormal } from '../types'

// ── Akun custom disimpan di localStorage ──────────────────────────────────
const GRUP_OPTIONS: TipeAkun[] = ['ASET','KEWAJIBAN','EKUITAS','PENDAPATAN','BEBAN']

const emptyForm = (): Akun => ({ kode: '', nama: '', kelompok: '', grup: 'ASET', tipe: 'D' })

const GRUP_COLOR: Record<string, string> = {
  ASET:'badge-blue', KEWAJIBAN:'badge-amber',
  EKUITAS:'badge-green', PENDAPATAN:'badge-green', BEBAN:'badge-red',
}

// ── Form tambah/edit ───────────────────────────────────────────────────────
function AkunForm({
  form, setForm, onSave, onCancel, err, isEdit, originalKode,
}: {
  form: Akun
  setForm: (f: Akun) => void
  onSave: () => void
  onCancel: () => void
  err: string
  isEdit: boolean
  originalKode?: string
}) {
  return (
    <div className={`card p-5 mb-4 border-2 ${isEdit ? 'border-amber-400 bg-amber-50/20' : 'border-blue-300 bg-blue-50/20'}`}>
      <p className="text-sm font-semibold text-slate-700 mb-4">
        {isEdit ? `✏️ Edit Akun — ${form.kode}` : '➕ Tambah Akun Baru'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="label">Kode Akun *</label>
          <input className="input" placeholder="mis. 1.1.15"
            value={form.kode}
            onChange={e => setForm({ ...form, kode: e.target.value })}
          />
          {isEdit && originalKode && form.kode !== originalKode && (
            <p className="text-[10px] text-amber-600 mt-0.5">⚠ Kode berubah: {originalKode} → {form.kode}</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="label">Nama Akun *</label>
          <input className="input" placeholder="mis. Piutang Lain-lain"
            value={form.nama}
            onChange={e => setForm({ ...form, nama: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Kelompok</label>
          <input className="input" placeholder="mis. Aset Lancar"
            value={form.kelompok}
            onChange={e => setForm({ ...form, kelompok: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Grup *</label>
            <select className="input" value={form.grup}
              onChange={e => setForm({ ...form, grup: e.target.value as TipeAkun })}>
              {GRUP_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Normal *</label>
            <select className="input" value={form.tipe}
              onChange={e => setForm({ ...form, tipe: e.target.value as SaldoNormal })}>
              <option value="D">Debet</option>
              <option value="K">Kredit</option>
            </select>
          </div>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={onSave}>
          <Check size={14} /> {isEdit ? 'Update Akun' : 'Simpan Akun'}
        </button>
        <button className="btn" onClick={onCancel}>
          <X size={14} /> Batal
        </button>
      </div>
    </div>
  )
}

// ── Main COAPage ───────────────────────────────────────────────────────────
export default function COAPage() {
  const { saldoAwal, jurnal, customCOA, setCustomCOA } = useAppStore()
  const [q,           setQ]           = useState('')
  // customAkun dari store — reaktif di semua halaman saat COA diubah
  const customAkun = customCOA
  const setCustomAkun = (akun: Akun[]) => setCustomCOA(akun)
  const [mode,        setMode]        = useState<'none' | 'add' | 'edit'>('none')
  const [form,        setForm]        = useState<Akun>(emptyForm())
  const [originalKode, setOriginalKode] = useState<string>('')
  const [formErr,     setFormErr]     = useState('')
  const [filterGrup,  setFilterGrup]  = useState<string>('SEMUA')

  const saldos  = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])
  const allAkun = useMemo(() => {
    // Gabung COA standar + custom, sort by kode
    const merged = [...COA]
    customAkun.forEach(ca => {
      if (!merged.find(a => a.kode === ca.kode)) merged.push(ca)
      else {
        // Override nama/kelompok/grup/tipe jika sudah ada (edit akun standar)
        const idx = merged.findIndex(a => a.kode === ca.kode)
        merged[idx] = ca
      }
    })
    return merged.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true }))
  }, [customAkun])

  const filtered = useMemo(() => {
    const lq = q.toLowerCase()
    return allAkun.filter(a => {
      if (a.nama.startsWith('__HIDDEN__')) return false
      const matchQ = !lq || a.kode.toLowerCase().includes(lq) ||
                            a.nama.toLowerCase().includes(lq) ||
                            a.kelompok.toLowerCase().includes(lq)
      const matchGrup = filterGrup === 'SEMUA' || a.grup === filterGrup
      return matchQ && matchGrup
    })
  }, [q, allAkun, filterGrup])

  // Akun yang disembunyikan (untuk tombol restore)
  const hiddenAkun = useMemo(() =>
    allAkun.filter(a => a.nama.startsWith('__HIDDEN__')),
    [allAkun])

  const handleRestore = (kode: string) => {
    const updated = customAkun.filter(a => a.kode !== kode)
    setCustomAkun(updated)
  }

  const isCustom = (kode: string) => customAkun.some(c => c.kode === kode)
  const isEdited = (kode: string) => {
    const orig = COA.find(a => a.kode === kode)
    const cust = customAkun.find(a => a.kode === kode)
    if (!orig || !cust) return false
    return orig.nama !== cust.nama || orig.kelompok !== cust.kelompok ||
           orig.grup !== cust.grup || orig.tipe !== cust.tipe
  }

  const openAdd = () => {
    setForm(emptyForm())
    setFormErr('')
    setMode('add')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openEdit = (a: Akun) => {
    setForm({ ...a })
    setOriginalKode(a.kode)
    setFormErr('')
    setMode('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = () => {
    if (!form.kode.trim()) { setFormErr('Kode akun wajib diisi'); return }
    if (!form.nama.trim()) { setFormErr('Nama akun wajib diisi'); return }

    if (mode === 'add') {
      // Cek duplikat kode (tidak boleh sama dengan custom, boleh override standar)
      if (customAkun.find(a => a.kode === form.kode.trim())) {
        setFormErr(`Kode ${form.kode} sudah ada di akun custom`); return
      }
    }

    const newAkun: Akun = {
      kode:     form.kode.trim(),
      nama:     form.nama.trim(),
      kelompok: form.kelompok.trim(),
      grup:     form.grup,
      tipe:     form.tipe,
    }

    let updated: Akun[]
    if (mode === 'edit') {
      const kodeChanged = originalKode && originalKode !== newAkun.kode
      if (kodeChanged) {
        // Kode berubah: hapus kode lama dari custom, tambah kode baru
        // Cek duplikat kode baru
        const duplikat = allAkun.find(a => a.kode === newAkun.kode && a.kode !== originalKode)
        if (duplikat) { setFormErr(`Kode ${newAkun.kode} sudah digunakan oleh akun lain`); return }
        updated = customAkun.filter(a => a.kode !== originalKode)
        updated = [...updated, newAkun]
      } else {
        // Kode sama: update nama/kelompok/grup/tipe
        const exists = customAkun.find(a => a.kode === newAkun.kode)
        updated = exists
          ? customAkun.map(a => a.kode === newAkun.kode ? newAkun : a)
          : [...customAkun, newAkun]
      }
    } else {
      updated = [...customAkun, newAkun]
    }

    updated.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true }))
    setCustomAkun(updated)
    setMode('none')
    setForm(emptyForm())
    setOriginalKode('')
    setFormErr('')
  }

  const handleDelete = (kode: string) => {
    const isStandard = COA.some(a => a.kode === kode)
    const akun = allAkun.find(a => a.kode === kode)
    const msg = isStandard
      ? `Sembunyikan akun ${kode} — ${akun?.nama} dari semua menu? Akun tidak akan muncul di COA, Saldo Awal, maupun Laporan.`
      : `Hapus akun ${kode} — ${akun?.nama} secara permanen?`
    if (!confirm(msg)) return
    if (isStandard) {
      // Tandai sebagai hidden dengan nama prefix '__HIDDEN__'
      const hidden: Akun = { ...akun!, nama: '__HIDDEN__' + akun!.nama }
      const existing = customAkun.find(a => a.kode === kode)
      const updated = existing
        ? customAkun.map(a => a.kode === kode ? hidden : a)
        : [...customAkun, hidden]
      setCustomAkun(updated)
    } else {
      const updated = customAkun.filter(a => a.kode !== kode)
      setCustomAkun(updated)
    }
    if (mode === 'edit' && form.kode === kode) setMode('none')
  }

  const handleReset = (kode: string) => {
    if (!confirm(`Reset akun ${kode} ke nilai standar?`)) return
    const updated = customAkun.filter(a => a.kode !== kode)
    setCustomAkun(updated)
  }

  const totalCustom = customAkun.filter(c => !COA.some(s => s.kode === c.kode)).length
  const totalEdited = customAkun.filter(c =>  COA.some(s => s.kode === c.kode)).length

  return (
    <div className="p-6" id="print-coa">
      <PageHeader
        title="Bagan Akun (COA)"
        subtitle={`${allAkun.length} akun — ${totalCustom} tambahan · ${totalEdited} diubah dari standar`}
        actions={
          <button className="btn btn-primary btn-sm no-print" onClick={openAdd}>
            <Plus size={14} /> Tambah Akun
          </button>
        }
      />

      {/* Form tambah/edit */}
      {mode !== 'none' && (
        <AkunForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => { setMode('none'); setFormErr(''); setOriginalKode('') }}
          err={formErr}
          isEdit={mode === 'edit'}
          originalKode={originalKode}
        />
      )}

      {/* Filter + Search */}
      <div className="flex flex-wrap gap-2 mb-3 no-print">
        {/* Filter grup */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {['SEMUA', ...GRUP_OPTIONS].map(g => (
            <button key={g}
              className={`px-2.5 py-1.5 font-medium transition-colors
                ${filterGrup === g ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setFilterGrup(g)}>
              {g}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="card px-3 py-1.5 flex items-center gap-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input className="text-sm outline-none flex-1 bg-transparent"
            placeholder="Cari kode, nama, kelompok…"
            value={q} onChange={e => setQ(e.target.value)} />
          <span className="text-xs text-slate-400">{filtered.length}</span>
        </div>
      </div>

      {/* Tabel */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="th text-white w-24">Kode</th>
              <th className="th text-white">Nama Akun</th>
              <th className="th text-white w-44 hidden md:table-cell">Kelompok</th>
              <th className="th text-white w-28">Grup</th>
              <th className="th text-white w-20">Normal</th>
              <th className="th text-white w-36 text-right">Saldo Saat Ini</th>
              <th className="th text-white w-24 text-center no-print">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const saldo    = saldos[a.kode] ?? 0
              const custom   = isCustom(a.kode) && !COA.some(s => s.kode === a.kode)
              const edited   = isEdited(a.kode)
              const isActive = mode === 'edit' && form.kode === a.kode
              return (
                <tr key={a.kode}
                  className={`border-b border-slate-100 transition-colors
                    ${isActive ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <td className="td font-mono text-xs">
                    <span className="text-slate-600">{a.kode}</span>
                    {custom && <span className="ml-1 text-[8px] bg-blue-100 text-blue-600 px-1 rounded">baru</span>}
                    {edited && <span className="ml-1 text-[8px] bg-amber-100 text-amber-600 px-1 rounded">edit</span>}
                  </td>
                  <td className="td font-medium text-slate-800">{a.nama}</td>
                  <td className="td hidden md:table-cell">
                    <span className="text-xs text-slate-500">{a.kelompok}</span>
                  </td>
                  <td className="td">
                    <span className={`badge text-[10px] ${GRUP_COLOR[a.grup] ?? 'badge-slate'}`}>
                      {a.grup}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`badge text-[10px] ${a.tipe === 'D' ? 'badge-blue' : 'badge-green'}`}>
                      {a.tipe === 'D' ? 'Debet' : 'Kredit'}
                    </span>
                  </td>
                  <td className="td-num">
                    <span className={saldo < 0 ? 'text-red-600 font-semibold' : saldo > 0 ? 'text-slate-800 font-semibold' : 'text-slate-300'}>
                      {saldo !== 0 ? fmt(saldo) : '—'}
                    </span>
                  </td>
                  <td className="td no-print">
                    <div className="flex gap-1 justify-center">
                      {/* Semua akun bisa di-edit */}
                      <button
                        className="btn btn-sm p-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => openEdit(a)} title="Edit akun">
                        <Pencil size={13} />
                      </button>
                      {/* Reset: hanya akun standar yang sudah diedit */}
                      {edited && (
                        <button
                          className="btn btn-sm p-1.5 text-slate-500 border-slate-200 hover:bg-slate-100"
                          onClick={() => handleReset(a.kode)} title="Reset ke standar">
                          <Save size={13} />
                        </button>
                      )}
                      {/* Hapus: semua akun bisa dihapus (standar = dihide dari COA, custom = hapus permanen) */}
                      <button
                        className="btn btn-danger btn-sm p-1.5"
                        onClick={() => handleDelete(a.kode)} title={custom ? 'Hapus akun' : 'Sembunyikan dari COA'}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            Tidak ada akun yang sesuai pencarian
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mt-3 text-xs text-slate-400 no-print">
        <span><span className="bg-blue-100 text-blue-600 px-1 rounded">baru</span> = akun tambahan</span>
        <span><span className="bg-amber-100 text-amber-600 px-1 rounded">edit</span> = akun standar yang diubah</span>
        <span><Pencil size={11} className="inline"/> = edit kode/nama · <Trash2 size={11} className="inline"/> = hapus/sembunyikan · <Save size={11} className="inline"/> = reset ke standar</span>
      </div>

      {/* Akun tersembunyi */}
      {hiddenAkun.length > 0 && (
        <div className="card p-4 mt-4 border-amber-200 bg-amber-50/30">
          <p className="text-xs font-semibold text-amber-700 mb-2">⚠ Akun Disembunyikan ({hiddenAkun.length})</p>
          <div className="flex flex-wrap gap-2">
            {hiddenAkun.map(a => (
              <div key={a.kode} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded px-2 py-1 text-xs">
                <span className="font-mono text-slate-600">{a.kode}</span>
                <span className="text-slate-500">{a.nama.replace('__HIDDEN__', '')}</span>
                <button className="text-emerald-600 hover:text-emerald-800 font-semibold ml-1" onClick={() => handleRestore(a.kode)} title="Tampilkan kembali">↩ Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
