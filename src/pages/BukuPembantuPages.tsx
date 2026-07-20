import React, { useMemo, useState, memo } from 'react'
import { Save } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { computeSaldos, calcSHU, calcSimpananBulanan, calcPiutangSPBulanan, fmt } from '../utils/accounting'
import { printElement } from '../utils/printHelper'
import { exportSimpananPinjaman, exportPiutangSP } from '../utils/exportExcel'
import type { RekapRow, PiutangRow } from '../utils/exportExcel'
import { PageHeader, FormGroup } from '../components/ui'

// ─────────────────────────────────────────────────────────────────────────
// SHU Allocation Page
// ─────────────────────────────────────────────────────────────────────────
export function SHUPage() {
  const { saldoAwal, jurnal, anggota, shuConfig, setSHUConfig, identitas, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const shu    = useMemo(() => calcSHU(saldos), [saldos])
  const [cfg, setCfg] = useState({ ...shuConfig })
  const [saved, setSaved] = useState(false)

  const totalPct = cfg.pctJasaSimpanan + cfg.pctJasaPinjaman + cfg.pctCadangan +
                   cfg.pctPengurus + cfg.pctPendidikan + cfg.pctKaryawan + cfg.pctSosial

  const set = (k: keyof typeof cfg) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg(c => ({ ...c, [k]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))

  const handleSave = () => {
    setSHUConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const shuBersih = shu.shuBersih

  const alokasi = [
    { label: 'Jasa Simpanan Anggota',  key: 'pctJasaSimpanan' as const },
    { label: 'Jasa Pinjaman Anggota',  key: 'pctJasaPinjaman' as const },
    { label: 'Cadangan Koperasi',      key: 'pctCadangan'     as const },
    { label: 'Dana Pengurus',          key: 'pctPengurus'     as const },
    { label: 'Dana Pendidikan',        key: 'pctPendidikan'   as const },
    { label: 'Dana Karyawan',          key: 'pctKaryawan'     as const },
    { label: 'Dana Sosial',            key: 'pctSosial'       as const },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Alokasi SHU"
        subtitle={`Sisa Hasil Usaha periode ${identitas.tahun} — Rp ${fmt(Math.abs(shuBersih))}`}
      />

      {shuBersih <= 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2 text-sm mb-4">
          ⚠ SHU periode berjalan masih 0 atau defisit. Input transaksi pendapatan terlebih dahulu.
        </div>
      )}

      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">SHU Bersih Periode Berjalan</h2>
        <p className="text-2xl font-bold text-blue-700">Rp {fmt(Math.abs(shuBersih))}</p>
        <p className="text-xs text-slate-400 mt-0.5">{shuBersih >= 0 ? 'Surplus' : 'Defisit'}</p>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Prosentase Pembagian SHU</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {alokasi.map(a => (
            <FormGroup key={a.key} label={`${a.label} (%)`}>
              <input
                type="number"
                className="input text-right"
                value={cfg[a.key]}
                min={0}
                max={100}
                onChange={set(a.key)}
              />
            </FormGroup>
          ))}
        </div>
        <div className={`text-sm font-medium ${totalPct === 100 ? 'text-emerald-700' : 'text-red-600'}`}>
          Total: {totalPct}% {totalPct === 100 ? '✓' : '⚠ (harus = 100%)'}
        </div>
        <button className="btn btn-primary mt-3" onClick={handleSave}>
          <Save size={15} /> {saved ? 'Tersimpan ✓' : 'Simpan Prosentase'}
        </button>
      </div>

      {shuBersih > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold">Rincian Alokasi SHU</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Peruntukan</th>
                <th className="th w-20 text-right">%</th>
                <th className="th w-40 text-right">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {alokasi.map(a => {
                const pct = cfg[a.key]
                const nom = (shuBersih * pct) / 100
                return (
                  <tr key={a.key} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="td">{a.label}</td>
                    <td className="td-num">{pct}%</td>
                    <td className="td-num font-semibold text-blue-700">{fmt(nom)}</td>
                  </tr>
                )
              })}
              <tr className="font-semibold bg-slate-50">
                <td className="td">Total SHU Dibagikan</td>
                <td className="td-num">{totalPct}%</td>
                <td className="td-num">{fmt(shuBersih)}</td>
              </tr>
            </tbody>
          </table>

          {anggota.length > 0 && (
            <>
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs font-semibold text-slate-500">ESTIMASI SHU PER ANGGOTA (Jasa Simpanan)</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">No.</th>
                    <th className="th">Nama Anggota</th>
                    <th className="th w-40 text-right">Est. SHU (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {anggota.map((a, i) => {
                    const bagian = anggota.length > 0
                      ? ((shuBersih * cfg.pctJasaSimpanan) / 100) / anggota.length
                      : 0
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 border-b border-slate-100">
                        <td className="td text-xs text-slate-400">{i + 1}</td>
                        <td className="td">{a.nama}</td>
                        <td className="td-num text-emerald-700">{fmt(bagian)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SIMPANAN ANGGOTA — dipecah per jenis, tiap jenis tampil bulan Jan–Des
// Struktur sama persis dengan sheet Excel:
//   NO | NAMA | SALDO AWAL | JAN | FEB | ... | DES | JUMLAH | SALDO AKHIR
// ─────────────────────────────────────────────────────────────────────────
const BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

type JenisSimpanan = 'wajib' | 'wajib_khs' | 'sukarela' | 'jasa_suk' | 'tht' | 'jasa_tht'

// Definisi tiap tab simpanan — sama dengan sheet Excel
const TAB_SIMPANAN = [
  {
    key: 'rekap'      as const,
    label: 'Rekap 2026',
    color: 'bg-slate-700',
    headerColor: 'bg-slate-700',
    short: 'Rekap',
  },
  {
    key: 'pokok'      as const,
    label: 'Simpanan Pokok',
    color: 'bg-blue-700',
    headerColor: 'bg-blue-800',
    short: 'Pokok',
    jenis: undefined as undefined,
    saldoAwalLabel: 'SALDO AWAL SIMPANAN POKOK',
    saldoAkhirLabel: 'SALDO AKHIR SIMPANAN POKOK',
  },
  {
    key: 'wajib'      as const,
    label: 'Simpanan Wajib',
    color: 'bg-emerald-700',
    headerColor: 'bg-emerald-800',
    short: 'Wajib',
    jenis: 'wajib' as JenisSimpanan,
    saldoAwalLabel: 'SALDO AWAL SIMPANAN WAJIB',
    saldoAkhirLabel: 'SALDO AKHIR SIMPANAN WAJIB',
  },
  {
    key: 'wajib_khs'  as const,
    label: 'Simpanan Wajib Khusus',
    color: 'bg-violet-700',
    headerColor: 'bg-violet-800',
    short: 'Wj.Khs',
    jenis: 'wajib_khs' as JenisSimpanan,
    saldoAwalLabel: 'SALDO AWAL SIMPANAN WAJIB KHUSUS',
    saldoAkhirLabel: 'SALDO AKHIR SIMPANAN WAJIB KHUSUS',
  },
  {
    key: 'sukarela'   as const,
    label: 'Simpanan Sukarela',
    color: 'bg-amber-600',
    headerColor: 'bg-amber-700',
    short: 'Sukarela',
    jenis: 'sukarela' as JenisSimpanan,
    saldoAwalLabel: 'SALDO AWAL SIMPANAN SUKARELA',
    saldoAkhirLabel: 'SALDO AKHIR SIMPANAN SUKARELA',
    jasaKey: 'jasa_suk' as JenisSimpanan,
    jasaLabel: 'SALDO AWAL JASA SIMPANAN SUKARELA',
    jasaAkhirLabel: 'SALDO AKHIR JASA SIMPANAN SUKARELA',
  },
  {
    key: 'tht'        as const,
    label: 'THT (Tabungan Hari Tua)',
    color: 'bg-teal-700',
    headerColor: 'bg-teal-800',
    short: 'THT',
    jenis: 'tht' as JenisSimpanan,
    saldoAwalLabel: 'SALDO AWAL TABUNGAN HARI TUA (THT)',
    saldoAkhirLabel: 'SALDO AKHIR TABUNGAN HARI TUA (THT)',
    jasaKey: 'jasa_tht' as JenisSimpanan,
    jasaLabel: 'SALDO AWAL JASA TABUNGAN HARI TUA (THT)',
    jasaAkhirLabel: 'SALDO AKHIR JASA TABUNGAN HARI TUA (THT)',
  },
] as const

type TabKey = typeof TAB_SIMPANAN[number]['key']

// ── SaldoAwalInput: input inline untuk saldo awal simpanan, di-memo agar tidak re-render ──
type SimpField = 'pokok' | 'wajib' | 'wajib_khs' | 'sukarela' | 'jasa_suk' | 'tht' | 'jasa_tht'

const SaldoAwalInput = memo(function SaldoAwalInput({
  anggotaId, field, value, onSave,
}: {
  anggotaId: number
  field: SimpField
  value: number
  onSave: (anggotaId: number, field: SimpField, val: number) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [local, setLocal] = React.useState('')

  const startEdit = () => {
    setLocal(value ? String(value) : '')
    setEditing(true)
  }

  const commit = () => {
    const v = Math.max(0, Number(local.replace(/[^\d.]/g, '')) || 0)
    onSave(anggotaId, field, v)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="input text-right text-[10px] p-1 w-24 font-mono"
        value={local}
        autoFocus
        type="number"
        min={0}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return (
    <span
      className={`cursor-pointer hover:underline block text-right w-full text-[10px] font-mono px-1
        ${value ? 'text-slate-700 font-semibold' : 'text-slate-300'}`}
      onClick={startEdit}
      title="Klik untuk edit saldo awal"
    >
      {value ? value.toLocaleString('id-ID') : 'ketik...'}
    </span>
  )
})

export function SimpananPage() {
  const { anggota, saldoSimpanan, jurnal, identitas, updateSaldoSimpanan } = useAppStore()

  // Simpan saldo awal per anggota per field — dipanggil dari SaldoAwalInput
  const onSaveSA = React.useCallback((anggotaId: number, field: SimpField, val: number) => {
    updateSaldoSimpanan(anggotaId, { [field]: val })
  }, [updateSaldoSimpanan])
  const [search,  setSearch]  = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('rekap')
  const [page,       setPage]     = useState(1)
  const [perPage]                 = useState(20)

  // Saldo awal per anggota
  const saldoMap = useMemo(() => {
    const m: Record<number, typeof saldoSimpanan[0]> = {}
    saldoSimpanan.forEach(s => { m[s.anggotaId] = s })
    return m
  }, [saldoSimpanan])

  // Mutasi per anggota per bulan dari jurnal
  const mutasi = useMemo(() => calcSimpananBulanan(jurnal), [jurnal])

  // Gabungkan semua data per anggota
  const rows = useMemo(() => anggota.map(a => {
    const sa  = saldoMap[a.id]
    const key = a.nama.toLowerCase()
    const mut = mutasi[key] ?? {}

    // Mutasi per bulan per jenis
    const bulan: Record<number, Record<JenisSimpanan, number>> = {}
    for (let b = 1; b <= 12; b++) {
      bulan[b] = {
        wajib:     mut[b]?.wajib     ?? 0,
        wajib_khs: mut[b]?.wajib_khs ?? 0,
        sukarela:  mut[b]?.sukarela  ?? 0,
        jasa_suk:  mut[b]?.jasa_suk  ?? 0,
        tht:       mut[b]?.tht       ?? 0,
        jasa_tht:  mut[b]?.jasa_tht  ?? 0,
      }
    }

    const mutTot = (k: JenisSimpanan) => Object.values(bulan).reduce((s, b) => s + b[k], 0)

    const pokok     = sa?.pokok     ?? 0
    const wajib     = (sa?.wajib     ?? 0) + mutTot('wajib')
    const wajib_khs = (sa?.wajib_khs ?? 0) + mutTot('wajib_khs')
    const sukarela  = (sa?.sukarela  ?? 0) + mutTot('sukarela')
    const jasa_suk  = (sa?.jasa_suk  ?? 0) + mutTot('jasa_suk')
    const tht       = (sa?.tht       ?? 0) + mutTot('tht')
    const jasa_tht  = (sa?.jasa_tht  ?? 0) + mutTot('jasa_tht')
    const jumlah    = pokok + wajib + wajib_khs + sukarela + jasa_suk + tht + jasa_tht

    return {
      id: a.id, nama: a.nama,
      // saldo awal
      sa_pokok: sa?.pokok     ?? 0,
      sa_wajib: sa?.wajib     ?? 0,
      sa_wajib_khs: sa?.wajib_khs ?? 0,
      sa_sukarela:  sa?.sukarela  ?? 0,
      sa_jasa_suk:  sa?.jasa_suk  ?? 0,
      sa_tht:       sa?.tht       ?? 0,
      sa_jasa_tht:  sa?.jasa_tht  ?? 0,
      // saldo akhir
      pokok, wajib, wajib_khs, sukarela, jasa_suk, tht, jasa_tht, jumlah,
      bulan,
    }
  }), [anggota, saldoMap, mutasi])

  const filtered = useMemo(() =>
    search ? rows.filter(r => r.nama.toLowerCase().includes(search.toLowerCase())) : rows,
    [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage])

  // Reset ke halaman 1 setiap kali pencarian atau tab berganti
  React.useEffect(() => { setPage(1) }, [search, activeTab])

  // ── Totals ──
  const totals = useMemo(() => {
    const t = {
      sa_pokok:0, sa_wajib:0, sa_wajib_khs:0, sa_sukarela:0, sa_jasa_suk:0, sa_tht:0, sa_jasa_tht:0,
      pokok:0, wajib:0, wajib_khs:0, sukarela:0, jasa_suk:0, tht:0, jasa_tht:0, jumlah:0,
      bulan: {} as Record<number, Record<JenisSimpanan, number>>,
    }
    for (let b=1;b<=12;b++) t.bulan[b]={ wajib:0, wajib_khs:0, sukarela:0, jasa_suk:0, tht:0, jasa_tht:0 }
    rows.forEach(r => {
      t.sa_pokok+=r.sa_pokok; t.sa_wajib+=r.sa_wajib; t.sa_wajib_khs+=r.sa_wajib_khs
      t.sa_sukarela+=r.sa_sukarela; t.sa_jasa_suk+=r.sa_jasa_suk
      t.sa_tht+=r.sa_tht; t.sa_jasa_tht+=r.sa_jasa_tht
      t.pokok+=r.pokok; t.wajib+=r.wajib; t.wajib_khs+=r.wajib_khs
      t.sukarela+=r.sukarela; t.jasa_suk+=r.jasa_suk; t.tht+=r.tht
      t.jasa_tht+=r.jasa_tht; t.jumlah+=r.jumlah
      for (let b=1;b<=12;b++) {
        const jj = ['wajib','wajib_khs','sukarela','jasa_suk','tht','jasa_tht'] as JenisSimpanan[]
        jj.forEach(j => { t.bulan[b][j]+=r.bulan[b][j] })
      }
    })
    return t
  }, [rows])

  const tab = TAB_SIMPANAN.find(t => t.key === activeTab)!

  // ── Render tabel per tab ──
  const renderTable = () => {
    if (activeTab === 'rekap') return renderRekap()
    const t = TAB_SIMPANAN.find(x => x.key === activeTab)!
    if ('jasaKey' in t && t.jasaKey) return renderWithJasa(t as any)
    return renderSimple(t as any)
  }

  // Tab REKAP 2026 — format sama persis sheet "REKAP 2025" di Excel
  const renderRekap = () => (
    <div style={{overflowX:'scroll', width:'100%', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white', boxShadow:'0 1px 2px rgba(0,0,0,.05)'}}>
      <table className="text-[10px] border-collapse" style={{width:'max-content', tableLayout:'fixed'}}>
        <thead>
          <tr className="bg-slate-700 text-white">
            <th className="th border border-slate-500 text-white text-center" style={{width:'28px'}}>NO</th>
            <th className="th border border-slate-500 text-white" style={{width:'170px'}}>NAMA</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'88px'}}>SIMPANAN<br/>POKOK</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'88px'}}>SIMPANAN<br/>WAJIB</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'88px'}}>SIMPANAN<br/>WAJIB KHUSUS</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'88px'}}>SIMPANAN<br/>SUKARELA</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'88px'}}>JASA SIMP<br/>SUKARELA</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'80px'}}>THT</th>
            <th className="th border border-slate-500 text-white text-center" style={{width:'80px'}}>JASA<br/>THT</th>
            <th className="th border border-slate-500 text-white text-center bg-slate-900 font-bold" style={{width:'96px'}}>TOTAL SIMPANAN</th>
          </tr>
          <tr className="bg-amber-50 font-semibold text-[10px] border-b-2 border-slate-400">
            <td className="td border border-slate-200" colSpan={2}>TOTAL ({rows.length} anggota)</td>
            <td className="td-num border border-slate-200 font-bold text-blue-700">{fmt(totals.pokok)}</td>
            <td className="td-num border border-slate-200 font-bold text-emerald-700">{fmt(totals.wajib)}</td>
            <td className="td-num border border-slate-200 font-bold text-violet-700">{fmt(totals.wajib_khs)}</td>
            <td className="td-num border border-slate-200 font-bold text-amber-700">{fmt(totals.sukarela)}</td>
            <td className="td-num border border-slate-200 font-bold text-orange-600">{fmt(totals.jasa_suk)}</td>
            <td className="td-num border border-slate-200 font-bold text-teal-700">{fmt(totals.tht)}</td>
            <td className="td-num border border-slate-200 font-bold text-cyan-700">{fmt(totals.jasa_tht)}</td>
            <td className="td-num border border-slate-200 font-bold text-slate-800">{fmt(totals.jumlah)}</td>
          </tr>
        </thead>
        <tbody>
          {paginated.map((r, i) => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="td text-slate-400 border border-slate-100 text-center">{(page-1)*perPage + i + 1}</td>
              <td className="td border border-slate-100 font-medium">{r.nama}</td>
              <td className="td-num border border-slate-100 text-blue-700">{r.pokok ? fmt(r.pokok) : '—'}</td>
              <td className="td-num border border-slate-100 text-emerald-700">{r.wajib ? fmt(r.wajib) : '—'}</td>
              <td className="td-num border border-slate-100 text-violet-700">{r.wajib_khs ? fmt(r.wajib_khs) : '—'}</td>
              <td className="td-num border border-slate-100 text-amber-700">{r.sukarela ? fmt(r.sukarela) : '—'}</td>
              <td className="td-num border border-slate-100 text-orange-600">{r.jasa_suk ? fmt(r.jasa_suk) : '—'}</td>
              <td className="td-num border border-slate-100 text-teal-700">{r.tht ? fmt(r.tht) : '—'}</td>
              <td className="td-num border border-slate-100 text-cyan-700">{r.jasa_tht ? fmt(r.jasa_tht) : '—'}</td>
              <td className="td-num border border-slate-100 font-bold text-slate-800">{r.jumlah ? fmt(r.jumlah) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-700 text-white font-bold text-[10px]">
            <td className="td border border-slate-500" colSpan={2}>JUMLAH TOTAL</td>
            <td className="td-num border border-slate-500">{fmt(totals.pokok)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.wajib)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.wajib_khs)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.sukarela)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.jasa_suk)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.tht)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.jasa_tht)}</td>
            <td className="td-num border border-slate-500">{fmt(totals.jumlah)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )

  // Tab SIMPANAN POKOK / WAJIB / WAJIB KHUSUS
  // Format: NO | NAMA | SALDO AWAL | JAN..DES | JUMLAH | SALDO AKHIR
  const renderSimple = (t: { key: 'pokok'|'wajib'|'wajib_khs'; label: string; headerColor: string; short: string; saldoAwalLabel: string; saldoAkhirLabel: string; jenis?: JenisSimpanan }) => {
    const isPokok = t.key === 'pokok'
    const getSA  = (r: typeof rows[0]) => isPokok ? r.sa_pokok : (r as any)[`sa_${t.key}`] as number
    const getAkh = (r: typeof rows[0]) => (r as any)[t.key] as number
    const getMut = (r: typeof rows[0], b: number) => isPokok ? 0 : r.bulan[b][t.key as JenisSimpanan]
    const getTotSA  = isPokok ? totals.sa_pokok : (totals as any)[`sa_${t.key}`] as number
    const getTotAkh = (totals as any)[t.key] as number
    const getBulTot = (b: number) => isPokok ? 0 : totals.bulan[b][t.key as JenisSimpanan]
    const jumlahMutTot = isPokok ? 0 : (() => {
      let s=0; for(let b=1;b<=12;b++) s+=getBulTot(b); return s
    })()

    return (
      <div style={{overflowX:'scroll', width:'100%', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white', boxShadow:'0 1px 2px rgba(0,0,0,.05)'}}>
        <table className="text-[10px] border-collapse" style={{width:'max-content', tableLayout:'fixed'}}>
          <thead>
            <tr className={`${t.headerColor} text-white`}>
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'28px'}}>NO</th>
              <th className="th border border-slate-500 text-white" rowSpan={2} style={{width:'170px'}}>NAMA</th>
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'88px'}}>{t.saldoAwalLabel}</th>
              {BULAN_LABEL.map(lb => (
                <th key={lb} className="th border border-slate-500 text-white text-center" style={{width:'72px'}}>{lb.toUpperCase()}</th>
              ))}
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'80px'}}>JUMLAH</th>
              <th className="th border border-slate-500 text-white text-center bg-slate-900" rowSpan={2} style={{width:'88px'}}>{t.saldoAkhirLabel}</th>
            </tr>
            <tr className={`${t.headerColor}`}></tr>
            <tr className="bg-amber-50 font-semibold text-[10px] border-b-2 border-slate-400">
              <td className="td border border-slate-200" colSpan={2}>TOTAL ({rows.length} anggota)</td>
              <td className="td-num border border-slate-200 font-bold">{fmt(getTotSA)}</td>
              {BULAN_LABEL.map((_, idx) => (
                <td key={idx} className="td-num border border-slate-200 font-bold">{getBulTot(idx+1) ? fmt(getBulTot(idx+1)) : '—'}</td>
              ))}
              <td className="td-num border border-slate-200 font-bold">{jumlahMutTot ? fmt(jumlahMutTot) : (isPokok ? '0' : '—')}</td>
              <td className="td-num border border-slate-200 font-bold">{fmt(getTotAkh)}</td>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const sa  = getSA(r)
              const akh = getAkh(r)
              let jum = 0; for(let b=1;b<=12;b++) jum+=getMut(r,b)
              return (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td text-slate-400 border border-slate-100 text-center">{(page-1)*perPage + i + 1}</td>
                  <td className="td border border-slate-100 font-medium">{r.nama}</td>
                  <td className="td-num border border-slate-100 p-0.5">
                    <SaldoAwalInput anggotaId={r.id} field={isPokok ? 'pokok' : t.key as any} value={sa} onSave={onSaveSA} />
                  </td>
                  {BULAN_LABEL.map((_, idx) => {
                    const v = getMut(r, idx+1)
                    return <td key={idx} className={`td-num border border-slate-100 ${v>0?'text-emerald-700 font-semibold':v<0?'text-red-600 font-semibold':'text-slate-200'}`}>{v ? fmt(v) : '—'}</td>
                  })}
                  <td className="td-num border border-slate-100 font-semibold">{jum ? fmt(jum) : (isPokok ? '0' : '—')}</td>
                  <td className="td-num border border-slate-100 font-bold">{akh ? fmt(akh) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={`${t.headerColor} text-white font-bold text-[10px]`}>
              <td className="td border border-slate-500" colSpan={2}>JUMLAH TOTAL</td>
              <td className="td-num border border-slate-500">{fmt(getTotSA)}</td>
              {BULAN_LABEL.map((_, idx) => (
                <td key={idx} className="td-num border border-slate-500">{getBulTot(idx+1) ? fmt(getBulTot(idx+1)) : '—'}</td>
              ))}
              <td className="td-num border border-slate-500">{jumlahMutTot ? fmt(jumlahMutTot) : (isPokok ? '0' : '—')}</td>
              <td className="td-num border border-slate-500">{fmt(getTotAkh)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  // Tab SUKARELA / THT — ada kolom SS + JASA berpasangan per bulan
  const renderWithJasa = (t: {
    key: 'sukarela' | 'tht'; label: string; headerColor: string; jenis: JenisSimpanan; jasaKey: JenisSimpanan;
    saldoAwalLabel: string; saldoAkhirLabel: string; jasaLabel: string; jasaAkhirLabel: string;
  }) => {
    const getSA      = (r: typeof rows[0]) => (r as any)[`sa_${t.key}`] as number
    const getSAJasa  = (r: typeof rows[0]) => (r as any)[`sa_${t.jasaKey}`] as number
    const getAkh     = (r: typeof rows[0]) => (r as any)[t.key] as number
    const getAkhJasa = (r: typeof rows[0]) => (r as any)[t.jasaKey] as number
    const getMut     = (r: typeof rows[0], b: number) => r.bulan[b][t.jenis]
    const getMutJasa = (r: typeof rows[0], b: number) => r.bulan[b][t.jasaKey]

    const getTotSA      = (totals as any)[`sa_${t.key}`] as number
    const getTotSAJasa  = (totals as any)[`sa_${t.jasaKey}`] as number
    const getTotAkh     = (totals as any)[t.key] as number
    const getTotAkhJasa = (totals as any)[t.jasaKey] as number
    const getBulTot     = (b: number) => totals.bulan[b][t.jenis]
    const getBulTotJasa = (b: number) => totals.bulan[b][t.jasaKey]

    let totJum=0, totJumJasa=0
    for(let b=1;b<=12;b++){totJum+=getBulTot(b); totJumJasa+=getBulTotJasa(b)}

    return (
      <div style={{overflowX:'scroll', width:'100%', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white', boxShadow:'0 1px 2px rgba(0,0,0,.05)'}}>
        <table className="text-[10px] border-collapse" style={{width:'max-content', tableLayout:'fixed'}}>
          <thead>
            <tr className={`${t.headerColor} text-white`}>
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'28px'}}>NO</th>
              <th className="th border border-slate-500 text-white" rowSpan={2} style={{width:'160px'}}>NAMA</th>
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'82px'}}>{t.saldoAwalLabel}</th>
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'82px'}}>{t.jasaLabel}</th>
              {BULAN_LABEL.map(lb => (
                <th key={lb} className="th border border-slate-500 text-white text-center" colSpan={2} style={{width:'100px'}}>{lb.toUpperCase()}</th>
              ))}
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'78px'}}>JUMLAH SS<br/>S/D DES</th>
              <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'78px'}}>JUMLAH JASA<br/>S/D DES</th>
              <th className="th border border-slate-500 text-white text-center bg-slate-900" rowSpan={2} style={{width:'82px'}}>{t.saldoAkhirLabel}</th>
              <th className="th border border-slate-500 text-white text-center bg-slate-900" rowSpan={2} style={{width:'82px'}}>{t.jasaAkhirLabel}</th>
            </tr>
            <tr className={`${t.headerColor} text-white text-[9px]`}>
              {BULAN_LABEL.map(lb => (
                <React.Fragment key={lb}>
                  <th className="th border border-slate-500 text-white text-right" style={{width:'50px'}}>SS</th>
                  <th className="th border border-slate-500 text-white text-right" style={{width:'50px'}}>JASA</th>
                </React.Fragment>
              ))}
            </tr>
            <tr className="bg-amber-50 font-semibold text-[10px] border-b-2 border-slate-400">
              <td className="td border border-slate-200" colSpan={2}>TOTAL ({rows.length} anggota)</td>
              <td className="td-num border border-slate-200 font-bold">{fmt(getTotSA)}</td>
              <td className="td-num border border-slate-200 font-bold">{fmt(getTotSAJasa)}</td>
              {BULAN_LABEL.map((_, idx) => (
                <React.Fragment key={idx}>
                  <td className="td-num border border-slate-200 font-bold">{getBulTot(idx+1) ? fmt(getBulTot(idx+1)) : '—'}</td>
                  <td className="td-num border border-slate-200 font-bold">{getBulTotJasa(idx+1) ? fmt(getBulTotJasa(idx+1)) : '—'}</td>
                </React.Fragment>
              ))}
              <td className="td-num border border-slate-200 font-bold">{totJum ? fmt(totJum) : '—'}</td>
              <td className="td-num border border-slate-200 font-bold">{totJumJasa ? fmt(totJumJasa) : '—'}</td>
              <td className="td-num border border-slate-200 font-bold">{fmt(getTotAkh)}</td>
              <td className="td-num border border-slate-200 font-bold">{fmt(getTotAkhJasa)}</td>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => {
              const sa=getSA(r), saJ=getSAJasa(r), akh=getAkh(r), akhJ=getAkhJasa(r)
              let jum=0, jumJ=0
              for(let b=1;b<=12;b++){jum+=getMut(r,b); jumJ+=getMutJasa(r,b)}
              return (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td text-slate-400 border border-slate-100 text-center">{(page-1)*perPage + i + 1}</td>
                  <td className="td border border-slate-100 font-medium">{r.nama}</td>
                  <td className="td-num border border-slate-100 p-0.5">
                    <SaldoAwalInput anggotaId={r.id} field={t.key as any} value={sa} onSave={onSaveSA} />
                  </td>
                  <td className="td-num border border-slate-100 p-0.5">
                    <SaldoAwalInput anggotaId={r.id} field={t.jasaKey as any} value={saJ} onSave={onSaveSA} />
                  </td>
                  {BULAN_LABEL.map((_, idx) => {
                    const v=getMut(r,idx+1), vJ=getMutJasa(r,idx+1)
                    return (
                      <React.Fragment key={idx}>
                        <td className={`td-num border border-slate-100 ${v?'text-emerald-700 font-semibold':'text-slate-200'}`}>{v?fmt(v):'—'}</td>
                        <td className={`td-num border border-slate-100 ${vJ?'text-blue-700 font-semibold':'text-slate-200'}`}>{vJ?fmt(vJ):'—'}</td>
                      </React.Fragment>
                    )
                  })}
                  <td className="td-num border border-slate-100 font-semibold">{jum?fmt(jum):'—'}</td>
                  <td className="td-num border border-slate-100 font-semibold">{jumJ?fmt(jumJ):'—'}</td>
                  <td className="td-num border border-slate-100 font-bold">{akh?fmt(akh):'—'}</td>
                  <td className="td-num border border-slate-100 font-bold">{akhJ?fmt(akhJ):'—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={`${t.headerColor} text-white font-bold text-[10px]`}>
              <td className="td border border-slate-500" colSpan={2}>JUMLAH TOTAL</td>
              <td className="td-num border border-slate-500">{fmt(getTotSA)}</td>
              <td className="td-num border border-slate-500">{fmt(getTotSAJasa)}</td>
              {BULAN_LABEL.map((_, idx) => (
                <React.Fragment key={idx}>
                  <td className="td-num border border-slate-500">{getBulTot(idx+1)?fmt(getBulTot(idx+1)):'—'}</td>
                  <td className="td-num border border-slate-500">{getBulTotJasa(idx+1)?fmt(getBulTotJasa(idx+1)):'—'}</td>
                </React.Fragment>
              ))}
              <td className="td-num border border-slate-500">{totJum?fmt(totJum):'—'}</td>
              <td className="td-num border border-slate-500">{totJumJasa?fmt(totJumJasa):'—'}</td>
              <td className="td-num border border-slate-500">{fmt(getTotAkh)}</td>
              <td className="td-num border border-slate-500">{fmt(getTotAkhJasa)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  return (
    <div className="p-6" style={{width:'100%', minWidth:0}}>
      <PageHeader title="Simpanan Anggota"
        subtitle="Rekapitulasi Simpanan Anggota — format sesuai RAT" />

      {/* ── TABS ── */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 pb-2">
        {TAB_SIMPANAN.map(t => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-colors border
              ${activeTab === t.key
                ? `${t.color} text-white border-transparent shadow`
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search + Export ── */}
      <div className="flex flex-wrap gap-3 items-center mb-3 no-print">
        <input className="input max-w-xs" placeholder="Cari nama anggota..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-xs text-slate-400">{filtered.length} anggota total</span>
        <button className="btn btn-sm ml-auto"
          onClick={() => printElement('simpanan-print-area', `Simpanan Anggota — ${tab.label}`, identitas.nama)}>
          🖨️ Cetak
        </button>
        <button className="btn btn-sm bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          onClick={() => {
            const rekapRows: RekapRow[] = rows.map((r, i) => ({
              no: i + 1, nama: r.nama,
              pokok: r.pokok, wajib: r.wajib, wajib_khs: r.wajib_khs,
              sukarela: r.sukarela, jasa_suk: r.jasa_suk,
              tht: r.tht, jasa_tht: r.jasa_tht,
              jumlah: r.jumlah, pinjaman: 0,
            }))
            exportSimpananPinjaman(identitas, rekapRows)
          }}>
          📥 Excel
        </button>
      </div>

      {/* ── Tabel ── */}
      <div id="simpanan-print-area" style={{width:'100%'}}>
        <div className="mb-2 text-center">
          <h2 className="text-sm font-bold text-slate-700">REKAPITULASI SIMPANAN ANGGOTA KOPERASI</h2>
          <p className="text-xs text-slate-600 font-semibold">{tab.label.toUpperCase()}</p>
          <p className="text-xs text-slate-500">{identitas.nama || 'KOPERASI'} — {identitas.akhir ? `Per ${identitas.akhir}` : `Tahun ${identitas.tahun}`}</p>
        </div>
        {renderTable()}

        <div className="flex justify-between items-center mt-3 no-print">
          <span className="text-xs text-slate-400">
            Menampilkan {filtered.length === 0 ? 0 : (page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} dari {filtered.length} anggota
          </span>
          <div className="flex gap-1">
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={()=>setPage(1)}>«</button>
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              const pg = Math.max(1, Math.min(totalPages-4, page-2)) + i
              return (
                <button key={pg}
                  className={`btn btn-sm px-2.5 ${pg===page?'btn-primary':''}`}
                  onClick={()=>setPage(pg)}>{pg}</button>
              )
            })}
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>»</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 no-print">
          💡 Pilih tab di atas untuk berpindah antar jenis simpanan.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Piutang SP
// SALDO AKHIR POKOK = SALDO AWAL POKOK + JUMLAH POKOK S/D DES
// SALDO AKHIR JASA  = SALDO AWAL JASA  + JUMLAH JASA S/D DES
// ─────────────────────────────────────────────────────────────────────────
export function PiutangSPPage() {
  const { anggota, piutangSP, updatePiutangSP, jurnal, identitas } = useAppStore()

  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [perPage]                   = useState(20)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editCell, setEditCell] = useState<{id: number; field: 'pokok' | 'jasa'; val: string} | null>(null)

  const saldoAwalMap = useMemo(() => {
    const pokok: Record<string, number> = {}
    const jasa:  Record<string, number> = {}
    anggota.forEach(a => {
      const sp = piutangSP.find(p => p.anggotaId === a.id)
      pokok[a.nama.toLowerCase()] = sp?.saldoAwal     ?? 0
      jasa [a.nama.toLowerCase()] = sp?.saldoAwalJasa ?? 0
    })
    return { pokok, jasa }
  }, [anggota, piutangSP])

  const mutasi = useMemo(
    () => calcPiutangSPBulanan(jurnal, saldoAwalMap.pokok, saldoAwalMap.jasa),
    [jurnal, saldoAwalMap]
  )

  const rows = useMemo(() => anggota.map(a => {
    const key           = a.nama.toLowerCase()
    const sp            = piutangSP.find(p => p.anggotaId === a.id)
    const saldoAwal     = sp?.saldoAwal     ?? 0
    const saldoAwalJasa = sp?.saldoAwalJasa ?? 0
    const mut           = mutasi[key]

    const bulan: Record<number, { pokok: number; jasa: number }> = {}
    for (let b = 1; b <= 12; b++) {
      bulan[b] = { pokok: mut?.bulan[b]?.pokok ?? 0, jasa: mut?.bulan[b]?.jasa ?? 0 }
    }

    // SALDO AKHIR POKOK = SALDO AWAL + JUMLAH POKOK S/D DES
    const jumlahPokok    = Object.values(bulan).reduce((s, b) => s + b.pokok, 0)
    const jumlahJasa     = Object.values(bulan).reduce((s, b) => s + b.jasa,  0)
    const saldoPokok     = saldoAwal + jumlahPokok
    const saldoAkhirJasa = saldoAwalJasa + jumlahJasa
    const hasActivity    = saldoAwal > 0 || saldoAwalJasa > 0

    return {
      id: a.id, nama: a.nama,
      saldoAwal, saldoAwalJasa,
      bulan,
      jumlahPokok, jumlahJasa,
      saldoPokok, saldoAkhirJasa,
      hasActivity,
    }
  }), [anggota, piutangSP, mutasi])

  const filtered = useMemo(() =>
    search ? rows.filter(r => r.nama.toLowerCase().includes(search.toLowerCase())) : rows,
    [rows, search])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage])

  const totals = useMemo(() => {
    const t = { saldoAwal:0, saldoAwalJasa:0, saldoPokok:0, saldoAkhirJasa:0, jumlahPokok:0, jumlahJasa:0 }
    const bulanTot: Record<number,{pokok:number;jasa:number}> = {}
    for (let b=1;b<=12;b++) bulanTot[b]={pokok:0,jasa:0}
    rows.forEach(r => {
      t.saldoAwal      += r.saldoAwal
      t.saldoAwalJasa  += r.saldoAwalJasa
      t.saldoPokok     += r.saldoPokok
      t.saldoAkhirJasa += r.saldoAkhirJasa
      t.jumlahPokok    += r.jumlahPokok
      t.jumlahJasa     += r.jumlahJasa
      for (let b=1;b<=12;b++) { bulanTot[b].pokok+=r.bulan[b].pokok; bulanTot[b].jasa+=r.bulan[b].jasa }
    })
    return { ...t, bulan: bulanTot }
  }, [rows])

  const saveEdit = (id: number) => {
    if (!editCell || editCell.id !== id) return
    const val = Math.max(0, Number(editCell.val.replace(/[^\d.]/g,'')) || 0)
    const sp  = piutangSP.find(p => p.anggotaId === id)
    if (editCell.field === 'pokok') {
      updatePiutangSP(id, val, sp?.saldoAwalJasa ?? 0)
    } else {
      updatePiutangSP(id, sp?.saldoAwal ?? 0, val)
    }
    setEditCell(null)
  }

  const selected = rows.find(r => r.id === selectedId) ?? null

  const EditableCell = ({ id, field, value }: { id: number; field: 'pokok'|'jasa'; value: number }) => {
    const isEditing = editCell?.id === id && editCell.field === field
    if (isEditing) return (
      <input className="input w-24 text-right text-[10px] p-1" value={editCell!.val} autoFocus
        onChange={e => setEditCell({ id, field, val: e.target.value })}
        onBlur={() => saveEdit(id)}
        onKeyDown={e => { if (e.key==='Enter') saveEdit(id); if (e.key==='Escape') setEditCell(null) }} />
    )
    return (
      <span
        className={`cursor-pointer hover:underline ${value ? 'text-slate-700 font-semibold' : 'text-slate-300 text-[9px]'}`}
        onClick={() => setEditCell({ id, field, val: String(value) })}>
        {value ? fmt(value) : 'edit'}
      </span>
    )
  }

  return (
    <div style={{padding:'24px', width:'100%', minWidth:0}}>
      <div className="no-print">
        <PageHeader title="Piutang Simpan Pinjam"
          subtitle="Saldo Akhir = Saldo Awal + Jumlah S/D Des" />

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {[
            { l:'Saldo Awal Pokok',      v:totals.saldoAwal,      c:'text-blue-700'    },
            { l:'Saldo Awal Jasa',        v:totals.saldoAwalJasa,  c:'text-teal-700'    },
            { l:'Jumlah Pokok S/D Des',   v:totals.jumlahPokok,    c:'text-indigo-700'  },
            { l:'Jumlah Jasa S/D Des',    v:totals.jumlahJasa,     c:'text-indigo-600'  },
            { l:'Saldo Akhir Pokok',      v:totals.saldoPokok,     c:'text-amber-700'   },
            { l:'Saldo Akhir Jasa',       v:totals.saldoAkhirJasa, c:'text-cyan-700'    },
          ].map(x => (
            <div key={x.l} className="card p-3">
              <p className="text-[10px] text-slate-500 mb-0.5">{x.l}</p>
              <p className={`text-xs font-bold ${x.c}`}>{fmt(x.v)}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-4 py-2 mb-4">
          💡 <strong>Rumus:</strong> Saldo Akhir Pokok = Saldo Awal Pokok + Jumlah Pokok S/D Des &nbsp;|&nbsp;
          Saldo Akhir Jasa = Saldo Awal Jasa + Jumlah Jasa S/D Des.<br/>
          Klik <strong>Saldo Awal</strong> untuk edit langsung. Kolom Jan–Des otomatis dari Jurnal Umum.
        </div>

        <div className="flex flex-wrap gap-3 items-center mb-3">
          <input className="input max-w-xs" placeholder="Cari nama anggota..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <span className="text-xs text-slate-400">{filtered.length} anggota</span>
          <div className="flex items-center gap-1 ml-auto">
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>
            <span className="text-xs text-slate-600 px-2">Hal {page} / {totalPages}</span>
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
          </div>
          <button className="btn btn-sm"
            onClick={() => printElement('piutang-print-area', 'Buku Pembantu Piutang Simpan Pinjam')}>
            🖨️ Cetak
          </button>
          <button className="btn btn-sm bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              const piutangRows: PiutangRow[] = rows.map((r,i) => ({
                no:i+1, nama:r.nama,
                saldoAwal:r.saldoAwal, realisasi:r.jumlahPokok,
                bulan:r.bulan, saldoPokok:r.saldoPokok, totalJasa:r.saldoAkhirJasa,
                saldoAwalJasa:r.saldoAwalJasa, realisasiJasa:r.jumlahJasa,
              }))
              exportPiutangSP(identitas, piutangRows)
            }}>
            📥 Excel
          </button>
        </div>
      </div>

      {/* Detail anggota terpilih */}
      {selected && (
        <div className="card p-5 mb-4 border-2 border-blue-300 bg-blue-50/30 no-print">
          <div className="flex justify-between items-center mb-3">
            <p className="font-semibold text-slate-800">{selected.nama}</p>
            <button className="btn btn-sm text-xs" onClick={() => setSelectedId(null)}>✕ Tutup</button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3 text-xs">
            {[
              { l:'Saldo Awal Pokok',    v:selected.saldoAwal,      c:'text-blue-700'    },
              { l:'Saldo Awal Jasa',      v:selected.saldoAwalJasa,  c:'text-teal-700'    },
              { l:'Jumlah Pokok S/D Des', v:selected.jumlahPokok,    c:'text-indigo-700'  },
              { l:'Jumlah Jasa S/D Des',  v:selected.jumlahJasa,     c:'text-indigo-600'  },
              { l:'Saldo Akhir Pokok',    v:selected.saldoPokok,     c:'text-amber-700'   },
              { l:'Saldo Akhir Jasa',     v:selected.saldoAkhirJasa, c:'text-cyan-700'    },
            ].map(x => (
              <div key={x.l} className="bg-white rounded p-2 text-center border">
                <p className="text-slate-400 text-[9px] mb-0.5">{x.l}</p>
                <p className={`font-semibold ${x.c}`}>{fmt(x.v)}</p>
              </div>
            ))}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="th w-12">Bulan</th>
                <th className="th text-right">Angsuran Pokok</th>
                <th className="th text-right">Bayar Jasa</th>
              </tr>
            </thead>
            <tbody>
              {BULAN_LABEL.map((lb, idx) => {
                const b = idx+1; const bm = selected.bulan[b]
                return (
                  <tr key={b} className={`border-b border-slate-100 ${(bm.pokok||bm.jasa)?'bg-emerald-50/40':''}`}>
                    <td className="td font-medium">{lb}</td>
                    <td className={`td-num ${bm.pokok?'text-emerald-700 font-semibold':'text-slate-300'}`}>{bm.pokok?fmt(bm.pokok):'—'}</td>
                    <td className={`td-num ${bm.jasa?'text-blue-700 font-semibold':'text-slate-300'}`}>{bm.jasa?fmt(bm.jasa):'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabel utama */}
      <div id="piutang-print-area" style={{width:'100%'}}>
        <div className="mb-2 text-center">
          <h2 className="text-sm font-bold text-slate-700">REKAPITULASI PIUTANG SP ANGGOTA SESUAI RAT</h2>
          <p className="text-xs text-slate-500">{identitas.nama || 'KOPERASI'} — {identitas.akhir ? `Per ${identitas.akhir}` : `Tahun ${identitas.tahun}`}</p>
        </div>

        <div style={{overflowX:'scroll', width:'100%', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white'}}>
          <table className="text-[10px] border-collapse" style={{width:'max-content', tableLayout:'fixed'}}>
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'28px'}}>NO</th>
                <th className="th border border-slate-500 text-white" rowSpan={2} style={{width:'160px'}}>NAMA</th>
                <th className="th border border-slate-500 text-white text-center bg-blue-800" rowSpan={2} style={{width:'78px'}}>SALDO AWAL<br/>POKOK PINJAMAN</th>
                <th className="th border border-slate-500 text-white text-center bg-teal-800" rowSpan={2} style={{width:'78px'}}>SALDO AWAL<br/>JASA PINJAMAN</th>
                {BULAN_LABEL.map(lb => (
                  <th key={lb} className="th border border-slate-500 text-white text-center" colSpan={2} style={{width:'96px'}}>{lb.toUpperCase()}</th>
                ))}
                <th className="th border border-slate-500 text-white text-center bg-indigo-700" rowSpan={2} style={{width:'80px'}}>JUMLAH<br/>POKOK S/D DES</th>
                <th className="th border border-slate-500 text-white text-center bg-indigo-600" rowSpan={2} style={{width:'80px'}}>JUMLAH<br/>JASA S/D DES</th>
                <th className="th border border-slate-500 text-white text-center bg-amber-700" rowSpan={2} style={{width:'80px'}}>SALDO AKHIR<br/>POKOK PINJAMAN</th>
                <th className="th border border-slate-500 text-white text-center bg-cyan-700" rowSpan={2} style={{width:'80px'}}>SALDO AKHIR<br/>JASA PINJAMAN</th>
              </tr>
              <tr className="bg-slate-600 text-white text-[9px]">
                {BULAN_LABEL.map(lb => (
                  <React.Fragment key={lb}>
                    <th className="th border border-slate-500 text-white text-right" style={{width:'48px'}}>POKOK</th>
                    <th className="th border border-slate-500 text-white text-right" style={{width:'48px'}}>JASA</th>
                  </React.Fragment>
                ))}
              </tr>
              <tr className="bg-amber-50 font-semibold border-b-2 border-slate-400 text-[10px]">
                <td className="td border border-slate-200" colSpan={2}>TOTAL ({rows.length} anggota)</td>
                <td className="td-num border border-slate-200 text-blue-700 font-bold">{fmt(totals.saldoAwal)}</td>
                <td className="td-num border border-slate-200 text-teal-700 font-bold">{fmt(totals.saldoAwalJasa)}</td>
                {Array.from({length:12},(_,i)=>i+1).map(b => (
                  <React.Fragment key={b}>
                    <td className={`td-num border border-slate-200 ${totals.bulan[b].pokok?'text-emerald-700':'text-slate-300'}`}>
                      {totals.bulan[b].pokok?fmt(totals.bulan[b].pokok):'—'}
                    </td>
                    <td className={`td-num border border-slate-200 ${totals.bulan[b].jasa?'text-blue-700':'text-slate-300'}`}>
                      {totals.bulan[b].jasa?fmt(totals.bulan[b].jasa):'—'}
                    </td>
                  </React.Fragment>
                ))}
                <td className="td-num border border-slate-200 text-indigo-700 font-bold">{fmt(totals.jumlahPokok)}</td>
                <td className="td-num border border-slate-200 text-indigo-600 font-bold">{fmt(totals.jumlahJasa)}</td>
                <td className="td-num border border-slate-200 text-amber-700 font-bold">{fmt(totals.saldoPokok)}</td>
                <td className="td-num border border-slate-200 text-cyan-700 font-bold">{fmt(totals.saldoAkhirJasa)}</td>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => {
                const no = (page - 1) * perPage + i + 1
                const isSel = r.id === selectedId
                return (
                  <tr key={r.id}
                    className={`border-b border-slate-100 cursor-pointer transition-colors
                      ${isSel ? 'bg-blue-100' : r.hasActivity ? 'hover:bg-blue-50/30 bg-blue-50/10' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedId(isSel ? null : r.id)}
                  >
                    <td className="td text-slate-400 border border-slate-100 text-center">{no}</td>
                    <td className="td border border-slate-100 font-medium">
                      {r.nama}
                      {r.hasActivity && <span className="ml-1 text-[8px] bg-blue-100 text-blue-600 px-1 rounded no-print">aktif</span>}
                    </td>
                    <td className="td-num border border-slate-100" onClick={e => e.stopPropagation()}>
                      <EditableCell id={r.id} field="pokok" value={r.saldoAwal} />
                    </td>
                    <td className="td-num border border-slate-100" onClick={e => e.stopPropagation()}>
                      <EditableCell id={r.id} field="jasa" value={r.saldoAwalJasa} />
                    </td>
                    {Array.from({length:12},(_,idx)=>idx+1).map(b => (
                      <React.Fragment key={b}>
                        <td className={`td-num border border-slate-100 ${r.bulan[b].pokok?'text-emerald-700 font-semibold':'text-slate-200'}`}>
                          {r.bulan[b].pokok?fmt(r.bulan[b].pokok):'—'}
                        </td>
                        <td className={`td-num border border-slate-100 ${r.bulan[b].jasa?'text-blue-600 font-semibold':'text-slate-200'}`}>
                          {r.bulan[b].jasa?fmt(r.bulan[b].jasa):'—'}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className={`td-num border border-slate-100 font-semibold ${r.jumlahPokok?'text-indigo-700':'text-slate-200'}`}>
                      {r.jumlahPokok?fmt(r.jumlahPokok):'—'}
                    </td>
                    <td className={`td-num border border-slate-100 font-semibold ${r.jumlahJasa?'text-indigo-600':'text-slate-200'}`}>
                      {r.jumlahJasa?fmt(r.jumlahJasa):'—'}
                    </td>
                    <td className={`td-num border border-slate-100 font-bold ${r.saldoPokok>0?'text-amber-700':r.saldoPokok<0?'text-red-600':'text-slate-200'}`}>
                      {r.saldoPokok!==0?fmt(r.saldoPokok):'—'}
                    </td>
                    <td className={`td-num border border-slate-100 font-bold ${r.saldoAkhirJasa>0?'text-cyan-700':r.saldoAkhirJasa<0?'text-red-600':'text-slate-200'}`}>
                      {r.saldoAkhirJasa!==0?fmt(r.saldoAkhirJasa):'—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-700 text-white font-bold text-[10px]">
                <td className="td border border-slate-500" colSpan={2}>JUMLAH TOTAL</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.saldoAwal)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.saldoAwalJasa)}</td>
                {Array.from({length:12},(_,i)=>i+1).map(b => (
                  <React.Fragment key={b}>
                    <td className="td-num border border-slate-500 text-white">{totals.bulan[b].pokok?fmt(totals.bulan[b].pokok):'—'}</td>
                    <td className="td-num border border-slate-500 text-white">{totals.bulan[b].jasa?fmt(totals.bulan[b].jasa):'—'}</td>
                  </React.Fragment>
                ))}
                <td className="td-num border border-slate-500 text-white">{fmt(totals.jumlahPokok)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.jumlahJasa)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.saldoPokok)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.saldoAkhirJasa)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-between items-center mt-3 no-print">
          <span className="text-xs text-slate-400">
            Menampilkan {(page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} dari {filtered.length} anggota
          </span>
          <div className="flex gap-1">
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={()=>setPage(1)}>«</button>
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              const pg = Math.max(1, Math.min(totalPages-4, page-2)) + i
              return (
                <button key={pg}
                  className={`btn btn-sm px-2.5 ${pg===page?'btn-primary':''}`}
                  onClick={()=>setPage(pg)}>{pg}</button>
              )
            })}
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={()=>setPage(totalPages)}>»</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 no-print">
          💡 Klik baris untuk detail bulan. Klik saldo awal untuk edit langsung.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// TokoPage — Buku Pembantu Piutang Toko per Anggota
// Format: NO | NAMA | SALDO PIUTANG TOKO | PENJUALAN Jan–Des | PIUTANG TOKO | TOTAL PENJUALAN
// Saldo Akhir Piutang Toko = Saldo Awal + Total Penjualan (belanja) - Total Angsuran
// Akun terkait: 1.1.6 Piutang Toko (D), 4.1.5 Penjualan Toko (K)
// ─────────────────────────────────────────────────────────────────────────
export function TokoPage() {
  const { anggota, saldoToko, updateSaldoToko, jurnal, identitas, saldoAwal, customCOA } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal, customCOA), [saldoAwal, jurnal, customCOA])
  const nilaiPiutangToko = saldos['1.1.6'] ?? 0

  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editSA,     setEditSA]     = useState<{id: number; val: string} | null>(null)
  const perPage = 20

  // Saldo awal per anggota (dari store)
  const saldoAwalMap = useMemo(() => {
    const m: Record<string, number> = {}
    anggota.forEach(a => {
      const st = saldoToko.find(t => t.anggotaId === a.id)
      m[a.nama.toLowerCase()] = st?.saldoAwal ?? 0
    })
    return m
  }, [anggota, saldoToko])

  // Hitung mutasi piutang toko per anggota per bulan dari jurnal
  // Penjualan (belanja): Debet 1.1.6 (piutang toko bertambah)
  // Angsuran/bayar: Kredit 1.1.6 (piutang toko berkurang)
  const AKUN_PIUTANG_TOKO = '1.1.6'
  const mutasi = useMemo(() => {
    const result: Record<string, Record<number, { jual: number; bayar: number }>> = {}
    jurnal.forEach(j => {
      if (!j.tanggal) return
      const bulan = new Date(j.tanggal).getMonth() + 1
      j.rows.forEach(r => {
        const nama = (r.ket || '').trim().toLowerCase()
        if (!nama) return
        const debet  = r.debet  || 0
        const kredit = r.kredit || 0
        if (!debet && !kredit) return
        // Hanya proses akun piutang toko
        if (r.kode_d !== AKUN_PIUTANG_TOKO && r.kode_k !== AKUN_PIUTANG_TOKO) return
        if (!result[nama]) result[nama] = {}
        if (!result[nama][bulan]) result[nama][bulan] = { jual: 0, bayar: 0 }
        if (r.kode_d === AKUN_PIUTANG_TOKO && debet > 0) result[nama][bulan].jual  += debet
        if (r.kode_k === AKUN_PIUTANG_TOKO && kredit > 0) result[nama][bulan].bayar += kredit
      })
    })
    return result
  }, [jurnal])

  // Gabungkan per anggota
  const rows = useMemo(() => anggota.map(a => {
    const key      = a.nama.toLowerCase()
    const saldoAwal = saldoAwalMap[key] ?? 0
    const mut      = mutasi[key] ?? {}

    const bulan: Record<number, { jual: number; bayar: number }> = {}
    for (let b = 1; b <= 12; b++) {
      bulan[b] = { jual: mut[b]?.jual ?? 0, bayar: mut[b]?.bayar ?? 0 }
    }

    const totalJual  = Object.values(bulan).reduce((s, b) => s + b.jual,  0)
    const totalBayar = Object.values(bulan).reduce((s, b) => s + b.bayar, 0)
    // Saldo Akhir = Saldo Awal + Total Penjualan (belanja) - Total Angsuran
    const saldoAkhir   = saldoAwal + totalJual - totalBayar
    const hasActivity  = saldoAwal > 0 || totalJual > 0

    return { id: a.id, nama: a.nama, saldoAwal, bulan, totalJual, totalBayar, saldoAkhir, hasActivity }
  }), [anggota, saldoAwalMap, mutasi])

  const filtered = useMemo(() =>
    search ? rows.filter(r => r.nama.toLowerCase().includes(search.toLowerCase())) : rows,
    [rows, search])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = useMemo(() => filtered.slice((page-1)*perPage, page*perPage), [filtered, page, perPage])

  // Totals
  const totals = useMemo(() => {
    const t = { saldoAwal: 0, totalJual: 0, totalBayar: 0, saldoAkhir: 0,
      bulan: {} as Record<number, { jual: number; bayar: number }> }
    for (let b = 1; b <= 12; b++) t.bulan[b] = { jual: 0, bayar: 0 }
    rows.forEach(r => {
      t.saldoAwal  += r.saldoAwal
      t.totalJual  += r.totalJual
      t.totalBayar += r.totalBayar
      t.saldoAkhir += r.saldoAkhir
      for (let b = 1; b <= 12; b++) {
        t.bulan[b].jual  += r.bulan[b].jual
        t.bulan[b].bayar += r.bulan[b].bayar
      }
    })
    return t
  }, [rows])

  const selected = rows.find(r => r.id === selectedId) ?? null

  const saveEditSA = (id: number) => {
    if (!editSA || editSA.id !== id) return
    const val = Math.max(0, Number(editSA.val.replace(/[^\d.]/g, '')) || 0)
    updateSaldoToko(id, val)
    setEditSA(null)
  }

  const EditableCell = ({ id, value }: { id: number; value: number }) => {
    const isEditing = editSA?.id === id
    if (isEditing) return (
      <input className="input w-24 text-right text-[10px] p-1 font-mono" value={editSA!.val} autoFocus
        type="number" min={0}
        onChange={e => setEditSA({ id, val: e.target.value })}
        onBlur={() => saveEditSA(id)}
        onKeyDown={e => { if (e.key === 'Enter') saveEditSA(id); if (e.key === 'Escape') setEditSA(null) }} />
    )
    return (
      <span className={`cursor-pointer hover:underline ${value ? 'text-slate-700 font-semibold' : 'text-slate-300 text-[9px]'}`}
        onClick={() => setEditSA({ id, val: String(value) })}>
        {value ? fmt(value) : 'ketik...'}
      </span>
    )
  }

  return (
    <div style={{ padding: '24px', width: '100%', minWidth: 0 }}>
      <PageHeader title="Piutang Toko"
        subtitle="Buku pembantu piutang belanja anggota di toko koperasi" />

      {/* Nilai akun 1.1.6 dari Buku Besar */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-indigo-600 font-semibold">1.1.6 — Piutang Toko (Nilai di Posisi Keuangan)</p>
          <p className="text-xl font-bold text-indigo-700">Rp {fmt(nilaiPiutangToko)}</p>
        </div>
        <p className="text-xs text-indigo-400">Saldo bersih akun dari Jurnal Umum</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { l: 'Saldo Awal Piutang',   v: totals.saldoAwal,  c: 'text-blue-700'    },
          { l: 'Total Penjualan',       v: totals.totalJual,  c: 'text-emerald-700' },
          { l: 'Total Angsuran/Bayar',  v: totals.totalBayar, c: 'text-amber-700'   },
          { l: 'Saldo Akhir Piutang',   v: totals.saldoAkhir, c: 'text-indigo-700'  },
        ].map(x => (
          <div key={x.l} className="card p-3">
            <p className="text-[10px] text-slate-500 mb-0.5">{x.l}</p>
            <p className={`text-xs font-bold ${x.c}`}>{fmt(x.v)}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-4 py-2 mb-4">
        💡 <strong>Rumus:</strong> Saldo Akhir Piutang Toko = Saldo Awal + Total Penjualan − Total Angsuran<br/>
        Akun <strong>1.1.6 Piutang Toko</strong>: Debet = belanja baru · Kredit = bayar/angsuran.<br/>
        Klik <strong>Saldo Awal</strong> untuk edit. Kolom bulan otomatis dari Jurnal Umum.
      </div>

      {/* Detail anggota terpilih */}
      {selected && (
        <div className="card p-4 mb-4 border-2 border-blue-300 bg-blue-50/30 no-print">
          <div className="flex justify-between items-center mb-3">
            <p className="font-semibold text-slate-800">{selected.nama}</p>
            <button className="btn btn-sm text-xs" onClick={() => setSelectedId(null)}>✕ Tutup</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
            {[
              { l: 'Saldo Awal',    v: selected.saldoAwal,  c: 'text-blue-700'    },
              { l: 'Total Jual',    v: selected.totalJual,  c: 'text-emerald-700' },
              { l: 'Total Bayar',   v: selected.totalBayar, c: 'text-amber-700'   },
              { l: 'Saldo Akhir',   v: selected.saldoAkhir, c: 'text-indigo-700'  },
            ].map(x => (
              <div key={x.l} className="bg-white rounded p-2 text-center border">
                <p className="text-slate-400 text-[9px] mb-0.5">{x.l}</p>
                <p className={`font-semibold ${x.c}`}>{fmt(x.v)}</p>
              </div>
            ))}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="th w-12">Bulan</th>
                <th className="th text-right">Penjualan (Belanja)</th>
                <th className="th text-right">Angsuran/Bayar</th>
                <th className="th text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {BULAN_LABEL.map((lb, idx) => {
                const b = idx + 1
                const bm = selected.bulan[b]
                const net = bm.jual - bm.bayar
                return (
                  <tr key={b} className={`border-b border-slate-100 ${(bm.jual||bm.bayar) ? 'bg-emerald-50/40' : ''}`}>
                    <td className="td font-medium">{lb}</td>
                    <td className={`td-num ${bm.jual ? 'text-emerald-700 font-semibold' : 'text-slate-300'}`}>{bm.jual ? fmt(bm.jual) : '—'}</td>
                    <td className={`td-num ${bm.bayar ? 'text-amber-700 font-semibold' : 'text-slate-300'}`}>{bm.bayar ? fmt(bm.bayar) : '—'}</td>
                    <td className={`td-num font-semibold ${net > 0 ? 'text-indigo-700' : net < 0 ? 'text-red-600' : 'text-slate-300'}`}>{net ? fmt(net) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-3 no-print">
        <input className="input max-w-xs" placeholder="Cari nama anggota..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <span className="text-xs text-slate-400">{filtered.length} anggota</span>
        <div className="flex items-center gap-1 ml-auto">
          <button className="btn btn-sm px-2" disabled={page<=1} onClick={() => setPage(p => p-1)}>‹</button>
          <span className="text-xs text-slate-600 px-2">Hal {page} / {totalPages}</span>
          <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={() => setPage(p => p+1)}>›</button>
        </div>
        <button className="btn btn-sm" onClick={() => printElement('toko-print-area', 'Buku Pembantu Piutang Toko', identitas.nama)}>
          🖨️ Cetak
        </button>
      </div>

      {/* Tabel utama */}
      <div id="toko-print-area">
        <div className="mb-2 text-center">
          <h2 className="text-sm font-bold text-slate-700">REKAPITULASI PIUTANG TOKO ANGGOTA</h2>
          <p className="text-xs text-slate-500">{identitas.nama || 'KOPERASI'} — {identitas.akhir ? `Per ${identitas.akhir}` : `Tahun ${identitas.tahun}`}</p>
        </div>

        <div style={{ overflowX: 'scroll', width: '100%', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }}>
          <table className="text-[10px] border-collapse" style={{ width: 'max-content', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{ width: '28px' }}>NO</th>
                <th className="th border border-slate-500 text-white" rowSpan={2} style={{ width: '160px' }}>NAMA</th>
                <th className="th border border-slate-500 text-white text-center bg-blue-800" rowSpan={2} style={{ width: '82px' }}>SALDO PIUTANG TOKO</th>
                {BULAN_LABEL.map(lb => (
                  <th key={lb} className="th border border-slate-500 text-white text-center" colSpan={2} style={{ width: '100px' }}>{lb.toUpperCase()}</th>
                ))}
                <th className="th border border-slate-500 text-white text-center bg-indigo-700" rowSpan={2} style={{ width: '82px' }}>PIUTANG TOKO</th>
                <th className="th border border-slate-500 text-white text-center bg-emerald-700" rowSpan={2} style={{ width: '82px' }}>TOTAL PENJUALAN</th>
              </tr>
              <tr className="bg-slate-600 text-white text-[9px]">
                {BULAN_LABEL.map(lb => (
                  <React.Fragment key={lb}>
                    <th className="th border border-slate-500 text-white text-right" style={{ width: '50px' }}>JUAL</th>
                    <th className="th border border-slate-500 text-white text-right" style={{ width: '50px' }}>BAYAR</th>
                  </React.Fragment>
                ))}
              </tr>
              {/* Row total di atas */}
              <tr className="bg-amber-50 font-semibold text-[10px] border-b-2 border-slate-400">
                <td className="td border border-slate-200" colSpan={2}>TOTAL ({rows.length} anggota)</td>
                <td className="td-num border border-slate-200 text-blue-700 font-bold">{fmt(totals.saldoAwal)}</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(b => (
                  <React.Fragment key={b}>
                    <td className={`td-num border border-slate-200 ${totals.bulan[b].jual ? 'text-emerald-700' : 'text-slate-300'}`}>
                      {totals.bulan[b].jual ? fmt(totals.bulan[b].jual) : '—'}
                    </td>
                    <td className={`td-num border border-slate-200 ${totals.bulan[b].bayar ? 'text-amber-700' : 'text-slate-300'}`}>
                      {totals.bulan[b].bayar ? fmt(totals.bulan[b].bayar) : '—'}
                    </td>
                  </React.Fragment>
                ))}
                <td className="td-num border border-slate-200 text-indigo-700 font-bold">{fmt(totals.saldoAkhir)}</td>
                <td className="td-num border border-slate-200 text-emerald-700 font-bold">{fmt(totals.totalJual)}</td>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => {
                const no = (page - 1) * perPage + i + 1
                const isSel = r.id === selectedId
                return (
                  <tr key={r.id}
                    className={`border-b border-slate-100 cursor-pointer transition-colors
                      ${isSel ? 'bg-blue-100' : r.hasActivity ? 'hover:bg-blue-50/30 bg-blue-50/10' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedId(isSel ? null : r.id)}>
                    <td className="td text-slate-400 border border-slate-100 text-center">{no}</td>
                    <td className="td border border-slate-100 font-medium">
                      {r.nama}
                      {r.hasActivity && <span className="ml-1 text-[8px] bg-blue-100 text-blue-600 px-1 rounded no-print">aktif</span>}
                    </td>
                    <td className="td-num border border-slate-100" onClick={e => e.stopPropagation()}>
                      <EditableCell id={r.id} value={r.saldoAwal} />
                    </td>
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map(b => (
                      <React.Fragment key={b}>
                        <td className={`td-num border border-slate-100 ${r.bulan[b].jual ? 'text-emerald-700 font-semibold' : 'text-slate-200'}`}>
                          {r.bulan[b].jual ? fmt(r.bulan[b].jual) : '—'}
                        </td>
                        <td className={`td-num border border-slate-100 ${r.bulan[b].bayar ? 'text-amber-700 font-semibold' : 'text-slate-200'}`}>
                          {r.bulan[b].bayar ? fmt(r.bulan[b].bayar) : '—'}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className={`td-num border border-slate-100 font-bold ${r.saldoAkhir > 0 ? 'text-indigo-700' : r.saldoAkhir < 0 ? 'text-red-600' : 'text-slate-200'}`}>
                      {r.saldoAkhir !== 0 ? fmt(r.saldoAkhir) : '—'}
                    </td>
                    <td className={`td-num border border-slate-100 font-semibold ${r.totalJual ? 'text-emerald-700' : 'text-slate-200'}`}>
                      {r.totalJual ? fmt(r.totalJual) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-700 text-white font-bold text-[10px]">
                <td className="td border border-slate-500" colSpan={2}>JUMLAH TOTAL</td>
                <td className="td-num border border-slate-500">{fmt(totals.saldoAwal)}</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(b => (
                  <React.Fragment key={b}>
                    <td className="td-num border border-slate-500">{totals.bulan[b].jual ? fmt(totals.bulan[b].jual) : '—'}</td>
                    <td className="td-num border border-slate-500">{totals.bulan[b].bayar ? fmt(totals.bulan[b].bayar) : '—'}</td>
                  </React.Fragment>
                ))}
                <td className="td-num border border-slate-500">{fmt(totals.saldoAkhir)}</td>
                <td className="td-num border border-slate-500">{fmt(totals.totalJual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-between items-center mt-3 no-print">
          <span className="text-xs text-slate-400">
            Menampilkan {(page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} dari {filtered.length} anggota
          </span>
          <div className="flex gap-1">
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-sm px-2" disabled={page<=1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(1, Math.min(totalPages-4, page-2)) + i
              return <button key={pg} className={`btn btn-sm px-2.5 ${pg===page ? 'btn-primary' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
            })}
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="btn btn-sm px-2" disabled={page>=totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 no-print">
          💡 Klik baris untuk detail per bulan. Klik saldo awal untuk edit langsung.
        </p>
      </div>
    </div>
  )
}

