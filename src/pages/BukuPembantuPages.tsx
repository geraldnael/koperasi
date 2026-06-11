import React, { useMemo, useState } from 'react'
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
  const { saldoAwal, jurnal, anggota, shuConfig, setSHUConfig, identitas } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])
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

      {/* alokasi tabel */}
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
                  <p className="text-[10px] text-slate-400 px-3 py-1">
                    * Estimasi dibagi rata. Implementasi by-name memerlukan data partisipasi per anggota.
                  </p>
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
// Simpanan Anggota — Format sesuai Excel REKAP 2025:
// NO | NAMA | SIMP.POKOK | SIMP.WAJIB | WJ.KHS | SUKARELA | JASA SUK | THT | JASA THT | JUMLAH
// ─────────────────────────────────────────────────────────────────────────
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

type JenisSimpanan = 'wajib' | 'wajib_khs' | 'sukarela' | 'jasa_suk' | 'tht' | 'jasa_tht'

const KOLOM_SIMPANAN = [
  { key:'pokok'     as const, label:'SIMPANAN\nPOKOK',          short:'Pokok',    color:'text-blue-700'    },
  { key:'wajib'     as const, label:'SIMPANAN\nWAJIB',          short:'Wajib',    color:'text-emerald-700' },
  { key:'wajib_khs' as const, label:'SIMPANAN\nWAJIB KHUSUS',   short:'Wj.Khs',  color:'text-violet-700'  },
  { key:'sukarela'  as const, label:'SIMPANAN\nSUKARELA',        short:'Sukarela', color:'text-amber-700'   },
  { key:'jasa_suk'  as const, label:'JASA SIMP\nSUKARELA',      short:'Jasa Suk', color:'text-orange-600'  },
  { key:'tht'       as const, label:'THT',                       short:'THT',      color:'text-teal-700'    },
  { key:'jasa_tht'  as const, label:'JASA\nTHT',                 short:'Jasa THT', color:'text-cyan-700'    },
]

export function SimpananPage() {
  const { anggota, saldoSimpanan, jurnal, identitas } = useAppStore()
  const [search,     setSearch]     = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

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
        wajib:    mut[b]?.wajib    ?? 0,
        wajib_khs:mut[b]?.wajib_khs?? 0,
        sukarela: mut[b]?.sukarela ?? 0,
        jasa_suk: mut[b]?.jasa_suk ?? 0,
        tht:      mut[b]?.tht      ?? 0,
        jasa_tht: mut[b]?.jasa_tht ?? 0,
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
    const pinjaman  = sa?.pinjaman ?? 0
    const hasMutasi = Object.values(mut).some(bln => Object.values(bln).some(v => v !== 0))

    return { id: a.id, nama: a.nama, pokok, wajib, wajib_khs, sukarela, jasa_suk, tht, jasa_tht, jumlah, pinjaman, bulan, hasMutasi }
  }), [anggota, saldoMap, mutasi])

  const filtered = useMemo(() =>
    search ? rows.filter(r => r.nama.toLowerCase().includes(search.toLowerCase())) : rows,
    [rows, search])

  const totals = useMemo(() => {
    const t = { pokok:0, wajib:0, wajib_khs:0, sukarela:0, jasa_suk:0, tht:0, jasa_tht:0, jumlah:0, pinjaman:0 }
    rows.forEach(r => {
      t.pokok+=r.pokok; t.wajib+=r.wajib; t.wajib_khs+=r.wajib_khs
      t.sukarela+=r.sukarela; t.jasa_suk+=r.jasa_suk; t.tht+=r.tht
      t.jasa_tht+=r.jasa_tht; t.jumlah+=r.jumlah; t.pinjaman+=r.pinjaman
    })
    return t
  }, [rows])

  const selected = rows.find(r => r.id === selectedId) ?? null

  return (
    <div className="p-6" style={{width:'100%', minWidth:0}}>
      <div className="no-print">
        <PageHeader title="Simpanan Anggota"
          subtitle="Rekapitulasi Simpanan Anggota — format sesuai RAT" />

        {/* Kartu ringkasan per jenis */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
          {KOLOM_SIMPANAN.map(k => (
            <div key={k.key} className="card p-3 text-center">
              <p className="text-[10px] text-slate-500 mb-0.5 leading-tight">{k.label.replace('\n',' ')}</p>
              <p className={`text-xs font-bold ${k.color}`}>{fmt((totals as any)[k.key])}</p>
            </div>
          ))}
          <div className="card p-3 text-center bg-slate-50 border-2 border-slate-300">
            <p className="text-[10px] text-slate-500 mb-0.5">JUMLAH</p>
            <p className="text-xs font-bold text-slate-800">{fmt(totals.jumlah)}</p>
          </div>
        </div>

        {/* Search + export */}
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <input className="input max-w-xs" placeholder="Cari nama anggota..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <span className="text-xs text-slate-400">{filtered.length} anggota</span>
          <button className="btn btn-sm ml-auto"
            onClick={() => printElement('simpanan-print-area', 'Rekapitulasi Simpanan Anggota', identitas.nama)}>
            🖨️ Cetak
          </button>
          <button className="btn btn-sm bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              try {
                const rekapRows: RekapRow[] = rows.map((r, i) => ({
                  no: i + 1, nama: r.nama,
                  pokok: r.pokok, wajib: r.wajib, wajib_khs: r.wajib_khs,
                  sukarela: r.sukarela, jasa_suk: r.jasa_suk,
                  tht: r.tht, jasa_tht: r.jasa_tht,
                  jumlah: r.jumlah, pinjaman: r.pinjaman,
                }))
                if (rekapRows.length === 0) { alert('Tidak ada data untuk diexport'); return }
                exportSimpananPinjaman(identitas, rekapRows)
              } catch(e) {
                console.error('Export error:', e)
                alert('Gagal export Excel: ' + String(e))
              }
            }}>
            📥 Excel ({rows.length} anggota)
          </button>
        </div>
      </div>

      {/* Detail anggota terpilih */}
      {selected && (
        <div className="card p-5 mb-4 border-2 border-blue-300 bg-blue-50/30 no-print">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="font-semibold text-slate-800">{selected.nama}</p>
              <p className="text-xs text-slate-500">Detail mutasi per bulan — semua jenis simpanan</p>
            </div>
            <button className="btn btn-sm text-xs" onClick={() => setSelectedId(null)}>✕ Tutup</button>
          </div>
          {/* Saldo akhir per jenis */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-3">
            {KOLOM_SIMPANAN.map(k => (
              <div key={k.key} className="bg-white rounded-lg p-2 text-center border text-xs">
                <p className="text-slate-400 text-[9px] mb-0.5 leading-tight">{k.short}</p>
                <p className={`font-bold ${k.color}`}>{fmt((selected as any)[k.key])}</p>
              </div>
            ))}
            <div className="bg-slate-100 rounded-lg p-2 text-center border text-xs">
              <p className="text-slate-400 text-[9px] mb-0.5">JUMLAH</p>
              <p className="font-bold text-slate-800">{fmt(selected.jumlah)}</p>
            </div>
          </div>
          {/* Tabel mutasi bulan */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="th w-12">Bulan</th>
                  {KOLOM_SIMPANAN.filter(k=>k.key!=='pokok').map(k => (
                    <th key={k.key} className="th text-right text-[10px]">{k.short}</th>
                  ))}
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {BULAN.map((lb, idx) => {
                  const b   = idx + 1
                  const bm  = selected.bulan[b]
                  const tot = Object.values(bm).reduce((s, v) => s + v, 0)
                  return (
                    <tr key={b} className={`border-b border-slate-100 ${tot ? 'bg-emerald-50/40' : ''}`}>
                      <td className="td font-medium">{lb}</td>
                      {KOLOM_SIMPANAN.filter(k=>k.key!=='pokok').map(k => {
                        const v = bm[k.key as JenisSimpanan]
                        return (
                          <td key={k.key} className={`td-num ${v>0?k.color+' font-semibold':v<0?'text-red-600 font-semibold':'text-slate-300'}`}>
                            {v !== 0 ? fmt(v) : '—'}
                          </td>
                        )
                      })}
                      <td className={`td-num font-semibold ${tot?'text-slate-800':'text-slate-300'}`}>
                        {tot ? fmt(tot) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-bold text-xs border-t-2 border-slate-300">
                  <td className="td">SALDO AKHIR</td>
                  {KOLOM_SIMPANAN.filter(k=>k.key!=='pokok').map(k => (
                    <td key={k.key} className={`td-num ${k.color}`}>{fmt((selected as any)[k.key])}</td>
                  ))}
                  <td className="td-num text-slate-800 font-bold">{fmt(selected.jumlah)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Tabel Utama — Format Excel REKAP 2025 ═══════════════════ */}
      <div id="simpanan-print-area" style={{width:'100%'}}>
        <div className="mb-2 text-center">
          <h2 className="text-sm font-bold text-slate-700">REKAPITULASI SIMPANAN ANGGOTA KOPERASI</h2>
          <p className="text-xs text-slate-500">{identitas.nama || 'KOPERASI'} — {identitas.akhir ? `Per ${identitas.akhir}` : `Tahun ${identitas.tahun}`}</p>
        </div>

        <div style={{overflowX:'scroll', width:'100%', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white', boxShadow:'0 1px 2px rgba(0,0,0,.05)'}}>
          <table className="text-[10px] border-collapse" style={{width:'max-content', tableLayout:'fixed'}}>
            <thead>
              {/* Baris header 1 */}
              <tr className="bg-slate-700 text-white">
                <th className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'28px'}}>NO</th>
                <th className="th border border-slate-500 text-white" rowSpan={2} style={{width:'170px'}}>NAMA</th>
                {KOLOM_SIMPANAN.map(k => (
                  <th key={k.key} className="th border border-slate-500 text-white text-center" rowSpan={2} style={{width:'82px'}}>
                    <span className="leading-tight whitespace-pre-line">{k.label}</span>
                  </th>
                ))}
                <th className="th border border-slate-500 text-white text-center bg-slate-900 font-bold" rowSpan={2} style={{width:'88px'}}>JUMLAH</th>
              </tr>
              {/* baris 2 kosong (rowSpan di atas sudah handle) */}
              <tr className="bg-slate-700"></tr>
              {/* Baris total */}
              <tr className="bg-amber-50 font-semibold border-b-2 border-slate-400 text-[10px]">
                <td className="td border border-slate-200" colSpan={2}>TOTAL ({rows.length} anggota)</td>
                {KOLOM_SIMPANAN.map(k => (
                  <td key={k.key} className={`td-num border border-slate-200 font-bold ${k.color}`}>
                    {fmt((totals as any)[k.key])}
                  </td>
                ))}
                <td className="td-num border border-slate-200 font-bold text-slate-800">{fmt(totals.jumlah)}</td>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isSel = r.id === selectedId
                return (
                  <tr key={r.id}
                    className={`border-b border-slate-100 cursor-pointer transition-colors
                      ${isSel ? 'bg-blue-100' : r.hasMutasi ? 'hover:bg-emerald-50/30 bg-emerald-50/10' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedId(isSel ? null : r.id)}
                  >
                    <td className="td text-slate-400 border border-slate-100 text-center">{i+1}</td>
                    <td className="td border border-slate-100 font-medium">
                      {r.nama}
                      {r.hasMutasi && <span className="ml-1 text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded no-print">mutasi</span>}
                    </td>
                    {/* Saldo akhir per jenis simpanan */}
                    {KOLOM_SIMPANAN.map(k => {
                      const v = (r as any)[k.key] as number
                      return (
                        <td key={k.key} className={`td-num border border-slate-100 ${v ? k.color : 'text-slate-200'}`}>
                          {v ? fmt(v) : '—'}
                        </td>
                      )
                    })}
                    {/* JUMLAH semua jenis */}
                    <td className="td-num border border-slate-100 font-bold text-slate-800 bg-slate-50/50">
                      {r.jumlah ? fmt(r.jumlah) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-700 text-white font-bold text-[10px]">
                <td className="td border border-slate-500" colSpan={2}>JUMLAH TOTAL</td>
                {KOLOM_SIMPANAN.map(k => (
                  <td key={k.key} className="td-num border border-slate-500 text-white">
                    {fmt((totals as any)[k.key])}
                  </td>
                ))}
                <td className="td-num border border-slate-500 text-white">{fmt(totals.jumlah)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3 no-print">
          💡 Klik baris anggota untuk melihat detail mutasi per bulan per jenis simpanan.
        </p>
      </div>
    </div>
  )
}

const BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']

// ─────────────────────────────────────────────────────────────────────────
// Piutang SP — Saldo Awal Pokok | Jan–Des (Pokok & Jasa) |
//              Saldo Akhir Pokok | Saldo Awal Jasa | Saldo Akhir Jasa |
//              Realisasi Pokok | Realisasi Jasa
// Dengan PAGINATION
// ─────────────────────────────────────────────────────────────────────────
export function PiutangSPPage() {
  const { anggota, piutangSP, updatePiutangSP, jurnal, identitas } = useAppStore()

  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [perPage]                   = useState(20)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Edit saldo inline
  const [editCell, setEditCell] = useState<{id: number; field: 'pokok' | 'jasa'; val: string} | null>(null)

  // Saldo awal pokok & jasa per anggota
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

  // Hitung mutasi dari jurnal
  const mutasi = useMemo(
    () => calcPiutangSPBulanan(jurnal, saldoAwalMap.pokok, saldoAwalMap.jasa),
    [jurnal, saldoAwalMap]
  )

  // Gabungkan data per anggota
  const rows = useMemo(() => anggota.map(a => {
    const key       = a.nama.toLowerCase()
    const sp        = piutangSP.find(p => p.anggotaId === a.id)
    const saldoAwal = sp?.saldoAwal     ?? 0
    const saldoAwalJasa = sp?.saldoAwalJasa ?? 0
    const mut       = mutasi[key]

    const bulan: Record<number, { pokok: number; jasa: number }> = {}
    for (let b = 1; b <= 12; b++) {
      bulan[b] = { pokok: mut?.bulan[b]?.pokok ?? 0, jasa: mut?.bulan[b]?.jasa ?? 0 }
    }

    const realisasiPokok = mut?.realisasiPokok ?? 0
    const realisasiJasa  = mut?.realisasiJasa  ?? 0
    const totalPokok     = Object.values(bulan).reduce((s, b) => s + b.pokok, 0)
    const totalJasa      = Object.values(bulan).reduce((s, b) => s + b.jasa,  0)
    const saldoPokok     = saldoAwal + realisasiPokok - totalPokok
    const saldoAkhirJasa = saldoAwalJasa + realisasiJasa - totalJasa
    const hasActivity    = saldoAwal > 0 || saldoAwalJasa > 0 || realisasiPokok > 0 || totalPokok > 0

    return {
      id: a.id, nama: a.nama,
      saldoAwal, saldoAwalJasa,
      bulan,
      realisasiPokok, realisasiJasa,
      saldoPokok, saldoAkhirJasa,
      hasActivity,
    }
  }), [anggota, piutangSP, mutasi])

  // Filter + pagination
  const filtered = useMemo(() =>
    search ? rows.filter(r => r.nama.toLowerCase().includes(search.toLowerCase())) : rows,
    [rows, search])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage])

  // Totals
  const totals = useMemo(() => {
    const t = { saldoAwal:0, saldoAwalJasa:0, saldoPokok:0, saldoAkhirJasa:0, realisasiPokok:0, realisasiJasa:0 }
    const bulanTot: Record<number,{pokok:number;jasa:number}> = {}
    for (let b=1;b<=12;b++) bulanTot[b]={pokok:0,jasa:0}
    rows.forEach(r => {
      t.saldoAwal     += r.saldoAwal
      t.saldoAwalJasa += r.saldoAwalJasa
      t.saldoPokok    += r.saldoPokok
      t.saldoAkhirJasa+= r.saldoAkhirJasa
      t.realisasiPokok+= r.realisasiPokok
      t.realisasiJasa += r.realisasiJasa
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
          subtitle="Format sesuai RAT: Saldo Awal Pokok | Saldo Awal Jasa | Jan–Des | Jumlah S/D Des | Saldo Akhir" />

        {/* Ringkasan */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {[
            { l:'Saldo Awal Pokok',      v:totals.saldoAwal,      c:'text-blue-700'    },
            { l:'Saldo Awal Jasa',        v:totals.saldoAwalJasa,  c:'text-teal-700'    },
            { l:'Jumlah Pokok S/D Des',   v:totals.realisasiPokok, c:'text-indigo-700'  },
            { l:'Jumlah Jasa S/D Des',    v:totals.realisasiJasa,  c:'text-indigo-600'  },
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
          💡 Klik <strong>Saldo Awal Pokok</strong> atau <strong>Saldo Awal Jasa</strong> untuk edit langsung.
          Kolom Jan–Des otomatis dari Jurnal Umum. Jumlah S/D Des = total angsuran sepanjang tahun.
        </div>

        {/* Search + pagination */}
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
                saldoAwal:r.saldoAwal, realisasi:r.realisasiPokok,
                bulan:r.bulan, saldoPokok:r.saldoPokok, totalJasa:r.saldoAkhirJasa,
                saldoAwalJasa:r.saldoAwalJasa, realisasiJasa:r.realisasiJasa,
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
              { l:'Jumlah Pokok S/D Des', v:selected.realisasiPokok, c:'text-indigo-700'  },
              { l:'Jumlah Jasa S/D Des',  v:selected.realisasiJasa,  c:'text-indigo-600'  },
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

      {/* ═══ Tabel utama — Format Excel Piutang SP ═══════════════════ */}
      <div id="piutang-print-area" style={{width:'100%'}}>
        <div className="mb-2 text-center">
          <h2 className="text-sm font-bold text-slate-700">REKAPITULASI POKOK DAN JASA PINJAMAN ANGGOTA</h2>
          <p className="text-xs text-slate-500">{identitas.nama || 'KOPERASI'} — {identitas.akhir ? `Per ${identitas.akhir}` : `Tahun ${identitas.tahun}`}</p>
        </div>

        <div style={{overflowX:'scroll', width:'100%', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white'}}>
          <table className="text-[10px] border-collapse" style={{width:'max-content', tableLayout:'fixed'}}>
            <thead>
              {/* Header baris 1 */}
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
              {/* Header baris 2 — sub-header Pokok/Jasa per bulan */}
              <tr className="bg-slate-600 text-white text-[9px]">
                {BULAN_LABEL.map(lb => (
                  <React.Fragment key={lb}>
                    <th className="th border border-slate-500 text-white text-right" style={{width:'48px'}}>POKOK</th>
                    <th className="th border border-slate-500 text-white text-right" style={{width:'48px'}}>JASA</th>
                  </React.Fragment>
                ))}
              </tr>
              {/* Grand total */}
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
                <td className="td-num border border-slate-200 text-indigo-700 font-bold">{fmt(totals.realisasiPokok)}</td>
                <td className="td-num border border-slate-200 text-indigo-600 font-bold">{fmt(totals.realisasiJasa)}</td>
                <td className="td-num border border-slate-200 text-amber-700 font-bold">{fmt(totals.saldoPokok)}</td>
                <td className="td-num border border-slate-200 text-cyan-700 font-bold">{fmt(totals.saldoAkhirJasa)}</td>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => {
                const no = (page - 1) * perPage + i + 1
                const isSel = r.id === selectedId
                // Hitung jumlah pokok & jasa s/d des (total angsuran/pembayaran sepanjang tahun)
                const jumlahPokok = Object.values(r.bulan).reduce((s, b) => s + b.pokok, 0)
                const jumlahJasa  = Object.values(r.bulan).reduce((s, b) => s + b.jasa, 0)
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
                    {/* Saldo Awal Pokok — editable */}
                    <td className="td-num border border-slate-100" onClick={e => e.stopPropagation()}>
                      <EditableCell id={r.id} field="pokok" value={r.saldoAwal} />
                    </td>
                    {/* Saldo Awal Jasa — editable */}
                    <td className="td-num border border-slate-100" onClick={e => e.stopPropagation()}>
                      <EditableCell id={r.id} field="jasa" value={r.saldoAwalJasa} />
                    </td>
                    {/* Jan–Des Pokok & Jasa */}
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
                    {/* Jumlah Pokok S/D Des */}
                    <td className={`td-num border border-slate-100 font-semibold ${jumlahPokok?'text-indigo-700':'text-slate-200'}`}>
                      {jumlahPokok?fmt(jumlahPokok):'—'}
                    </td>
                    {/* Jumlah Jasa S/D Des */}
                    <td className={`td-num border border-slate-100 font-semibold ${jumlahJasa?'text-indigo-600':'text-slate-200'}`}>
                      {jumlahJasa?fmt(jumlahJasa):'—'}
                    </td>
                    {/* Saldo Akhir Pokok */}
                    <td className={`td-num border border-slate-100 font-bold ${r.saldoPokok>0?'text-amber-700':r.saldoPokok<0?'text-red-600':'text-slate-200'}`}>
                      {r.saldoPokok!==0?fmt(r.saldoPokok):'—'}
                    </td>
                    {/* Saldo Akhir Jasa */}
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
                <td className="td-num border border-slate-500 text-white">{fmt(totals.realisasiPokok)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.realisasiJasa)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.saldoPokok)}</td>
                <td className="td-num border border-slate-500 text-white">{fmt(totals.saldoAkhirJasa)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination bawah */}
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

export function TokoPage() {
  const { saldoAwal, jurnal } = useAppStore()
  const saldos = useMemo(() => computeSaldos(saldoAwal, jurnal), [saldoAwal, jurnal])
  const penjualan = saldos['4.1.4'] ?? 0
  const retur     = saldos['4.1.6'] ?? 0
  const hpp       = saldos['5.1.1'] ?? 0
  const piutangToko = saldos['1.1.5'] ?? 0

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Toko" subtitle="Buku pembantu transaksi penjualan barang koperasi" />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Penjualan Kotor (4.1.4)</p>
          <p className="text-lg font-bold text-emerald-700">Rp {fmt(penjualan)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Retur Penjualan (4.1.6)</p>
          <p className="text-lg font-bold text-red-600">Rp {fmt(retur)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">HPP Toko (5.1.1)</p>
          <p className="text-lg font-bold text-amber-700">Rp {fmt(hpp)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Piutang Toko (1.1.5)</p>
          <p className="text-lg font-bold text-blue-700">Rp {fmt(piutangToko)}</p>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-slate-700 mb-1">Laba Kotor Toko</p>
        <p className="text-xl font-bold text-blue-700">Rp {fmt(penjualan - retur - hpp)}</p>
        <p className="text-xs text-slate-400 mt-1">Penjualan Neto − HPP</p>
      </div>
    </div>
  )
}
