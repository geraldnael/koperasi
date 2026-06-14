import { useEffect, useRef, useState } from 'react'
import Sidebar, { type PageId } from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import IdentitasPage from './pages/IdentitasPage'
import COAPage from './pages/COAPage'
import AnggotaPage from './pages/AnggotaPage'
import SaldoAwalPage from './pages/SaldoAwalPage'
import JurnalPage from './pages/JurnalPage'
import BukuBesarPage from './pages/BukuBesarPage'
import { NeracaPage, LabaRugiPage, EkuitasPage, ArusKasPage } from './pages/LaporanPages'
import { SHUPage, SimpananPage, PiutangSPPage, TokoPage } from './pages/BukuPembantuPages'
import { useAppStore } from './store/useAppStore'
import { supabase, isOnline } from './lib/supabase'
import {
  dbGetIdentitas, dbGetSaldoAwal, dbGetJurnal,
  dbGetSaldoSimpanan, dbGetSaldoPiutang,
} from './lib/db'

// ── Debounce helper ────────────────────────────────────────────────────────
function useDebounce(fn: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, delay)
  }
}

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const { syncFromSupabase, syncStatus } = useAppStore()

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnline()) syncFromSupabase()
  }, [])

  // ── Granular realtime handlers ──────────────────────────────────────────
  // Setiap tabel punya handler sendiri yang hanya fetch tabel itu saja,
  // bukan full syncFromSupabase() — lebih ringan dan lebih cepat.

  const handleJurnalChange = useDebounce(async () => {
    if (!isOnline()) return
    const jurnal = await dbGetJurnal()
    useAppStore.setState({
      jurnal,
      nextJurnalId: jurnal.length > 0 ? Math.max(...jurnal.map(j => j.id)) + 1 : 1,
      syncStatus: 'synced',
    })
  }, 300)

  const handleSaldoAwalChange = useDebounce(async () => {
    if (!isOnline()) return
    const saldoAwal = await dbGetSaldoAwal()
    if (Object.keys(saldoAwal).length > 0) {
      useAppStore.setState({ saldoAwal, syncStatus: 'synced' })
    }
  }, 300)

  const handleSimpananChange = useDebounce(async () => {
    if (!isOnline()) return
    const saldoSimpanan = await dbGetSaldoSimpanan()
    if (saldoSimpanan.length > 0) {
      useAppStore.setState({ saldoSimpanan, syncStatus: 'synced' })
    }
  }, 300)

  const handlePiutangChange = useDebounce(async () => {
    if (!isOnline()) return
    const piutangSP = await dbGetSaldoPiutang()
    useAppStore.setState({ piutangSP, syncStatus: 'synced' })
  }, 300)

  const handleIdentitasChange = useDebounce(async () => {
    if (!isOnline()) return
    const identitas = await dbGetIdentitas()
    if (identitas) useAppStore.setState({ identitas, syncStatus: 'synced' })
  }, 300)

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline()) return

    const channel = supabase
      .channel('db-realtime', {
        config: { broadcast: { self: false } }, // tidak trigger untuk perubahan dari device sendiri
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jurnal' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handleJurnalChange() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_awal' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handleSaldoAwalChange() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_simpanan' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handleSimpananChange() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_piutang' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handlePiutangChange() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'identitas' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handleIdentitasChange() })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected ✓')
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Connection issue, will retry...')
          useAppStore.setState({ syncStatus: 'error' })
        }
      })

    // ── Reconnect saat browser kembali online ──────────────────────────
    const handleOnline = () => {
      console.log('[Realtime] Browser back online — re-syncing...')
      syncFromSupabase()
    }
    window.addEventListener('online', handleOnline)

    // ── Visibility change: sync ulang saat tab aktif kembali ──────────
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && isOnline()) {
        syncFromSupabase()
      }
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [])

  // ── Pages (keep all mounted untuk preserve state) ────────────────────────
  const pages: [PageId, React.ReactNode][] = [
    ['dashboard',  <Dashboard />],
    ['identitas',  <IdentitasPage />],
    ['coa',        <COAPage />],
    ['anggota',    <AnggotaPage />],
    ['saldo_awal', <SaldoAwalPage />],
    ['jurnal',     <JurnalPage />],
    ['buku_besar', <BukuBesarPage />],
    ['simpanan',   <SimpananPage />],
    ['piutang_sp', <PiutangSPPage />],
    ['toko',       <TokoPage />],
    ['neraca',     <NeracaPage />],
    ['laba_rugi',  <LabaRugiPage />],
    ['ekuitas',    <EkuitasPage />],
    ['arus_kas',   <ArusKasPage />],
    ['shu',        <SHUPage />],
  ]

  // ── Sync status label ────────────────────────────────────────────────────
  const statusLabel = !isOnline() ? { text: '○ Offline', cls: 'bg-slate-200 text-slate-500' }
    : syncStatus === 'loading' ? { text: '⟳ Menyinkron...', cls: 'bg-amber-100 text-amber-700' }
    : syncStatus === 'synced'  ? { text: '✓ Tersinkron',    cls: 'bg-emerald-100 text-emerald-700' }
    : syncStatus === 'error'   ? { text: '✗ Gagal sync',    cls: 'bg-red-100 text-red-700' }
    : { text: '○ Siap', cls: 'bg-slate-100 text-slate-500' }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div id="sidebar" className="no-print">
        <Sidebar active={page} onChange={setPage} />
      </div>
      <main id="main-content" className="flex-1 min-w-0 overflow-y-auto relative">

        {/* Sync indicator */}
        <div className={`fixed top-2 right-3 z-50 text-[10px] px-2 py-1 rounded-full font-medium transition-all no-print ${statusLabel.cls}`}>
          {statusLabel.text}
        </div>

        {/* Keep all pages mounted, only show active */}
        {pages.map(([pid, node]) => (
          <div key={pid} style={{ display: pid === page ? 'block' : 'none' }}>
            {node}
          </div>
        ))}
      </main>
    </div>
  )
}
