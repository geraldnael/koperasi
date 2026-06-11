import { useState } from 'react'
import { Plus, Trash2, Pencil, Users } from 'lucide-react'
import { useAppStore, type Anggota } from '../store/useAppStore'
import { PageHeader, Modal, FormGroup, EmptyState } from '../components/ui'

const emptyForm: Omit<Anggota, 'id'> = {
  noAnggota: '', nama: '', alamat: '', telepon: '', email: '',
}

export default function AnggotaPage() {
  const { anggota, addAnggota, updateAnggota, deleteAnggota } = useAppStore()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Omit<Anggota, 'id'>>(emptyForm)
  const [q, setQ] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleOpen = (a?: Anggota) => {
    if (a) { setEditId(a.id); setForm({ noAnggota: a.noAnggota, nama: a.nama, alamat: a.alamat, telepon: a.telepon, email: a.email }) }
    else   { setEditId(null); setForm({ ...emptyForm, noAnggota: `A${String(anggota.length + 1).padStart(3, '0')}` }) }
    setOpen(true)
  }

  const handleSave = () => {
    if (!form.nama.trim()) return
    if (editId !== null) updateAnggota(editId, form)
    else addAnggota(form)
    setOpen(false)
  }

  const filtered = anggota.filter(a =>
    !q || a.nama.toLowerCase().includes(q.toLowerCase()) || a.noAnggota.includes(q)
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Data Anggota"
        subtitle="Master daftar anggota koperasi"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpen()}>
            <Plus size={15} /> Tambah Anggota
          </button>
        }
      />

      <div className="card p-3 mb-4 flex items-center gap-2">
        <input
          className="text-sm outline-none flex-1 bg-transparent"
          placeholder="Cari nama atau nomor anggota…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <span className="badge badge-blue">{anggota.length} anggota</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={36} />}
            message="Belum ada data anggota"
            action={<button className="btn btn-primary" onClick={() => handleOpen()}><Plus size={14} /> Tambah Pertama</button>}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th w-10">#</th>
                <th className="th w-24">No. Anggota</th>
                <th className="th">Nama</th>
                <th className="th hidden md:table-cell">Alamat</th>
                <th className="th w-32 hidden lg:table-cell">Telepon</th>
                <th className="th w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="td text-slate-400 text-xs">{i + 1}</td>
                  <td className="td font-mono text-xs">{a.noAnggota}</td>
                  <td className="td font-medium">{a.nama}</td>
                  <td className="td hidden md:table-cell text-slate-500 text-xs">{a.alamat || '—'}</td>
                  <td className="td hidden lg:table-cell text-slate-500 text-xs">{a.telepon || '—'}</td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button className="btn btn-sm p-1.5" onClick={() => handleOpen(a)}><Pencil size={13} /></button>
                      <button className="btn btn-danger btn-sm p-1.5" onClick={() => { if (confirm(`Hapus anggota ${a.nama}?`)) deleteAnggota(a.id) }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Edit Anggota' : 'Tambah Anggota Baru'}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave}>Simpan</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="No. Anggota" required>
            <input className="input" value={form.noAnggota} onChange={set('noAnggota')} />
          </FormGroup>
          <FormGroup label="Nama Lengkap" required>
            <input className="input" value={form.nama} onChange={set('nama')} />
          </FormGroup>
          <div className="col-span-2">
            <FormGroup label="Alamat">
              <input className="input" value={form.alamat} onChange={set('alamat')} />
            </FormGroup>
          </div>
          <FormGroup label="Telepon">
            <input className="input" value={form.telepon} onChange={set('telepon')} />
          </FormGroup>
          <FormGroup label="Email">
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </FormGroup>
        </div>
      </Modal>
    </div>
  )
}
