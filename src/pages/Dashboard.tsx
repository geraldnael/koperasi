import { useMemo } from 'react'
import { Scale, TrendingUp, Wallet, Users, PenLine, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { computeSaldos, calcNeraca, calcSHU, fmt } from '../utils/accounting'
import { MetricCard, PageHeader } from '../components/ui'

export default function Dashboard() {
const { saldoAwal, jurnal, identitas, customCOA } = useAppStore()
const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const neraca = useMemo(() => calcNeraca(saldos), [saldos])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])

  const kasBank = (saldos['1.1.1'] ?? 0) + (saldos['1.1.2'] ?? 0)

  const recent = jurnal.slice(0, 6)

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        subtitle={`${identitas.nama} · Periode ${identitas.awal} s.d. ${identitas.akhir}`}
      />

      {/* metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Total Aset"
          value={`Rp ${fmt(neraca.totalAset)}`}
          sub={`Lancar Rp ${fmt(neraca.totalAsetLancar)}`}
          color="blue"
          icon={<Scale size={16} />}
        />
        <MetricCard
          label="Total Ekuitas"
          value={`Rp ${fmt(neraca.totalEkuitas)}`}
          sub="Modal koperasi"
          color="green"
          icon={<Wallet size={16} />}
        />
        <MetricCard
          label="SHU Berjalan"
          value={`Rp ${fmt(Math.abs(shu.shuBersih))}`}
          sub={shu.shuBersih >= 0 ? 'Surplus ↑' : 'Defisit ↓'}
          color={shu.shuBersih >= 0 ? 'green' : 'red'}
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          label="Kas & Bank"
          value={`Rp ${fmt(kasBank)}`}
          sub="Saldo akhir"
          icon={<Wallet size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <MetricCard label="Jumlah Anggota" value={`${anggota.length} orang`} icon={<Users size={16} />} />
        <MetricCard label="Entri Jurnal"   value={`${jurnal.length} transaksi`} icon={<PenLine size={16} />} />
        <MetricCard
          label="Status Neraca"
          value={neraca.seimbang ? '✓ Seimbang' : '⚠ Tidak Seimbang'}
          color={neraca.seimbang ? 'green' : 'red'}
          icon={<AlertCircle size={16} />}
        />
      </div>

      {/* two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* recent journals */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Transaksi Terbaru</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Belum ada jurnal</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map(j => {
                const total = j.rows.reduce((a, r) => a + (r.debet || 0), 0)
                return (
                  <div key={j.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{j.nobukti}</p>
                      <p className="text-xs text-slate-400">{j.tanggal} · {j.keterangan || '—'}</p>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">Rp {fmt(total)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ringkasan laporan */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Ringkasan Laporan</h2>
          <div className="space-y-2">
            {[
              { label: 'Pendapatan Usaha', val: shu.totalPendUsaha, color: 'text-emerald-700' },
              { label: 'Beban Usaha', val: shu.bebanAdm + shu.bebanKop + shu.hpp + shu.bebanBunga + shu.bebanJual, color: 'text-red-600' },
              { label: 'SHU Bersih', val: shu.shuBersih, color: shu.shuBersih >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: 'Total Kewajiban', val: neraca.totalKewajiban, color: 'text-amber-700' },
              { label: 'Total Ekuitas', val: neraca.totalEkuitas, color: 'text-blue-700' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-sm text-slate-600">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>Rp {fmt(row.val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
