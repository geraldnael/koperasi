import { useEffect, useState } from 'react'
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

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const { syncFromSupabase, syncStatus } = useAppStore()

  useEffect(() => {
    if (isOnline()) syncFromSupabase()
  }, [])

  useEffect(() => {
    if (!isOnline()) return
    const channel = supabase
      .channel('db-all-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jurnal' },         () => syncFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_simpanan' }, () => syncFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_piutang' },  () => syncFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_awal' },     () => syncFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'identitas' },      () => syncFromSupabase())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // All pages stay mounted — only active page is visible
  // This preserves unsaved input state when switching menus
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div id="sidebar" className="no-print">
        <Sidebar active={page} onChange={setPage} />
      </div>
      <main id="main-content" className="flex-1 min-w-0 overflow-y-auto relative">
        {/* Sync indicator */}
        {isOnline() ? (
          <div className={`fixed top-2 right-3 z-50 text-[10px] px-2 py-1 rounded-full font-medium transition-all no-print
            ${syncStatus==='loading' ? 'bg-amber-100 text-amber-700' :
              syncStatus==='synced'  ? 'bg-emerald-100 text-emerald-700' :
              syncStatus==='error'   ? 'bg-red-100 text-red-700' :
                                       'bg-slate-100 text-slate-500'}`}>
            {syncStatus==='loading' ? '⟳ Menyinkron...' :
             syncStatus==='synced'  ? '✓ Tersinkron' :
             syncStatus==='error'   ? '✗ Gagal sync' : '○ Siap'}
          </div>
        ) : (
          <div className="fixed top-2 right-3 z-50 text-[10px] px-2 py-1 rounded-full bg-slate-200 text-slate-500 no-print">
            ○ Mode Offline
          </div>
        )}

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
