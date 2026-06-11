import { useState } from 'react'
import { Save } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { PageHeader, FormGroup } from '../components/ui'
import type { Identitas } from '../types'

export default function IdentitasPage() {
  const { identitas, setIdentitas } = useAppStore()
  const [form, setForm] = useState<Identitas>({ ...identitas })
  const [saved, setSaved] = useState(false)

  const set = (k: keyof Identitas) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    setIdentitas(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Profil Koperasi" subtitle="Identitas dan pengaturan periode akuntansi" />

      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Data Koperasi</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormGroup label="Nama Koperasi" required>
              <input className="input" value={form.nama} onChange={set('nama')} />
            </FormGroup>
          </div>
          <FormGroup label="Nomor Badan Hukum">
            <input className="input" value={form.bh} onChange={set('bh')} placeholder="-" />
          </FormGroup>
          <FormGroup label="Kota / Kabupaten">
            <input className="input" value={form.kota} onChange={set('kota')} />
          </FormGroup>
          <div className="col-span-2">
            <FormGroup label="Alamat">
              <input className="input" value={form.alamat} onChange={set('alamat')} />
            </FormGroup>
          </div>
          <FormGroup label="Desa / Kelurahan">
            <input className="input" value={form.kelurahan} onChange={set('kelurahan')} />
          </FormGroup>
          <FormGroup label="Kecamatan">
            <input className="input" value={form.kecamatan} onChange={set('kecamatan')} />
          </FormGroup>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Pengurus Koperasi</h2>
        <div className="grid grid-cols-3 gap-3">
          <FormGroup label="Nama Ketua">
            <input className="input" value={form.ketua} onChange={set('ketua')} />
          </FormGroup>
          <FormGroup label="Nama Bendahara">
            <input className="input" value={form.bendahara} onChange={set('bendahara')} />
          </FormGroup>
          <FormGroup label="Nama Sekretaris">
            <input className="input" value={form.sekretaris} onChange={set('sekretaris')} />
          </FormGroup>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Periode Akuntansi</h2>
        <div className="grid grid-cols-3 gap-3">
          <FormGroup label="Tahun Buku" required>
            <input className="input" type="number" value={form.tahun} onChange={set('tahun')} />
          </FormGroup>
          <FormGroup label="Tanggal Awal">
            <input className="input" type="date" value={form.awal} onChange={set('awal')} />
          </FormGroup>
          <FormGroup label="Tanggal Akhir">
            <input className="input" type="date" value={form.akhir} onChange={set('akhir')} />
          </FormGroup>
        </div>
      </div>

      <button onClick={handleSave} className="btn btn-primary">
        <Save size={15} />
        {saved ? 'Tersimpan ✓' : 'Simpan Pengaturan'}
      </button>
    </div>
  )
}
