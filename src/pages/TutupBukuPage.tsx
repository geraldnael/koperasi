import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Lock, History } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { computeSaldos, calcNeraca, calcSHU, fmt } from '../utils/accounting'
import { PageHeader, Modal, FormGroup } from '../components/ui'

export default function TutupBukuPage() {
  const { saldoAwal, jurnal, identitas, customCOA, arsipTahun, tutupBuku } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const neraca = useMemo(() => calcNeraca(saldos, shu.shuBersih), [saldos, shu])

  const tahunSekarang = Number(identitas.tahun) || new Date().getFullYear()
  const tahunBerikutnya = String(tahunSekarang + 1)

  const [tahunBaru, setTahunBaru] = useState(tahunBerikutnya)
  const [awalBaru, setAwalBaru]   = useState(`${tahunBerikutnya}-01-01`)
  const [akhirBaru, setAkhirBaru] = useState(`${tahunBerikutnya}-12-31`)
  const [showModal, setShowModal] = useState(false)
  const [konfirmasiText, setKonfirmasiText] = useState('')
  const [hasil, setHasil] = useState<{ ok: boolean; message: string } | null>(null)
  const [processing, setProcessing] = useState(false)

  const riwayat = useMemo(
    () => Object.values(arsipTahun).sort((a, b) => b.tahun.localeCompare(a.tahun)),
    [arsipTahun]
  )

  const konfirmasiValid = konfirmasiText.trim() === identitas.tahun

  const handleTutupBuku = async () => {
    setProcessing(true)
    const res = await tutupBuku(tahunBaru, awalBaru, akhirBaru)
    setProcessing(false)
    setHasil(res)
    setShowModal(false)
    setKonfirmasiText('')
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Tutup Buku Akhir Tahun" subtitle="Pindahkan saldo akhir Posisi Keuangan menjadi Saldo Awal tahun berikutnya" />

      {hasil && (
        <div className={`rounded-lg px-4 py-3 text-sm mb-4 flex items-start gap-2 ${
          hasil.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {hasil.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>{hasil.message}</span>
        </div>
      )}

      {/* ── Ringkasan saldo akhir tahun berjalan ───────────────────────── */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-slate-800 mb-3">Ringkasan Posisi Keuangan — Tahun {identitas.tahun}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] text-slate-400 uppercase mb-1">Total Aset</p>
            <p className="font-semibold">Rp {fmt(neraca.totalAset)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] text-slate-400 uppercase mb-1">Total Kewajiban</p>
            <p className="font-semibold">Rp {fmt(neraca.totalKewajiban)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] text-slate-400 uppercase mb-1">Total Ekuitas</p>
            <p className="font-semibold">Rp {fmt(neraca.totalEkuitas)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] text-slate-400 uppercase mb-1">SHU Tahun Berjalan</p>
            <p className={`font-semibold ${shu.shuBersih >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Rp {fmt(Math.abs(shu.shuBersih))} {shu.shuBersih >= 0 ? '(Surplus)' : '(Defisit)'}
            </p>
          </div>
        </div>
        {!neraca.seimbang && (
          <div className="mt-3 text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle size={13} /> Posisi Keuangan belum seimbang. Perbaiki dulu sebelum tutup buku.
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">
          Total jurnal tahun ini: <strong>{jurnal.length}</strong> entri.
        </p>
      </div>

      {/* ── Aturan penyesuaian ───────────────────────────────────────────── */}
      <div className="card p-5 mb-4 text-sm text-slate-600 space-y-2">
        <h3 className="font-semibold text-slate-800 mb-1">Yang akan terjadi saat Tutup Buku:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Aset, Kewajiban, dan Ekuitas</strong> — saldo akhir tahun {identitas.tahun} dibawa langsung menjadi <strong>Saldo Awal</strong> tahun {tahunBaru} (termasuk SHU tahun berjalan yang sudah terakumulasi ke Ekuitas).</li>
          <li><strong>Pendapatan dan Beban</strong> — ditutup ke 0 di tahun baru, karena akun ini bersifat sementara (per periode) dan hasilnya sudah ikut dihitung dalam Ekuitas.</li>
          <li>Seluruh jurnal tahun {identitas.tahun} <strong>diarsipkan</strong> (bisa dilihat lagi lewat Neraca Komparatif) lalu <strong>dikosongkan</strong> dari Jurnal Umum untuk memulai tahun baru.</li>
          <li>Periode aktif aplikasi berubah menjadi <strong>{tahunBaru}</strong> ({awalBaru} s.d. {akhirBaru}).</li>
        </ul>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
          ⚠️ Proses ini tidak bisa dibatalkan otomatis. Pastikan semua jurnal tahun {identitas.tahun} sudah benar
          dan Posisi Keuangan sudah seimbang sebelum melanjutkan. Disarankan ekspor/cetak semua laporan tahun ini
          sebagai backup terlebih dahulu.
        </p>
      </div>

      {/* ── Form periode baru ─────────────────────────────────────────────── */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-slate-800 mb-3">Periode Tahun Buku Baru</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormGroup label="Tahun Buku Baru" required>
            <input className="input" value={tahunBaru} onChange={e => setTahunBaru(e.target.value)} />
          </FormGroup>
          <FormGroup label="Tanggal Awal" required>
            <input type="date" className="input" value={awalBaru} onChange={e => setAwalBaru(e.target.value)} />
          </FormGroup>
          <FormGroup label="Tanggal Akhir" required>
            <input type="date" className="input" value={akhirBaru} onChange={e => setAkhirBaru(e.target.value)} />
          </FormGroup>
        </div>
        <button
          className="btn btn-primary mt-4"
          disabled={jurnal.length === 0 || !tahunBaru.trim() || !awalBaru || !akhirBaru}
          onClick={() => setShowModal(true)}
        >
          <Lock size={15} /> Tutup Buku Tahun {identitas.tahun} & Mulai Tahun {tahunBaru}
        </button>
      </div>

      {/* ── Riwayat tutup buku ────────────────────────────────────────────── */}
      {riwayat.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <History size={16} /> Riwayat Tutup Buku
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase border-b border-slate-100">
                <th className="py-2">Tahun</th>
                <th className="py-2">Jumlah Jurnal</th>
                <th className="py-2">Ditutup Pada</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map(a => (
                <tr key={a.tahun} className="border-b border-slate-50">
                  <td className="py-2 font-medium">{a.tahun}</td>
                  <td className="py-2">{a.jumlahJurnal} entri</td>
                  <td className="py-2 text-slate-500">{new Date(a.ditutupPada).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-2">
            Lihat perbandingan lengkap di menu <strong>Neraca Komparatif</strong>.
          </p>
        </div>
      )}

      {/* ── Modal konfirmasi ─────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setKonfirmasiText('') }}
        title="Konfirmasi Tutup Buku"
        footer={
          <>
            <button className="btn" onClick={() => { setShowModal(false); setKonfirmasiText('') }}>Batal</button>
            <button
              className="btn bg-red-600 text-white hover:bg-red-700 border-red-600"
              disabled={!konfirmasiValid || processing}
              onClick={handleTutupBuku}
            >
              {processing ? 'Memproses...' : 'Ya, Tutup Buku Sekarang'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 mb-3">
          Anda akan menutup buku tahun <strong>{identitas.tahun}</strong> dan memulai tahun <strong>{tahunBaru}</strong>.
          Jurnal tahun {identitas.tahun} akan diarsipkan lalu dikosongkan, dan saldo akhir akan menjadi saldo awal
          tahun baru. Tindakan ini tidak bisa dibatalkan otomatis.
        </p>
        <FormGroup label={`Ketik "${identitas.tahun}" untuk konfirmasi`} required>
          <input
            className="input"
            value={konfirmasiText}
            onChange={e => setKonfirmasiText(e.target.value)}
            placeholder={identitas.tahun}
            autoFocus
          />
        </FormGroup>
      </Modal>
    </div>
  )
}
