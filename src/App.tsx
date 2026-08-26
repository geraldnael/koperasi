import { useEffect, useRef, useState } from 'react'
import Sidebar, { type PageId, isPageAllowed } from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import IdentitasPage from './pages/IdentitasPage'
import COAPage from './pages/COAPage'
import AnggotaPage from './pages/AnggotaPage'
import SaldoAwalPage from './pages/SaldoAwalPage'
import JurnalPage from './pages/JurnalPage'
import BukuBesarPage from './pages/BukuBesarPage'
import { NeracaPage, LabaRugiPage, EkuitasPage, ArusKasPage, NeracaKomparatifPage } from './pages/LaporanPages'
import { SHUPage, SimpananPage, PiutangSPPage, TokoPage } from './pages/BukuPembantuPages'
import TutupBukuPage from './pages/TutupBukuPage'
import { useAppStore } from './store/useAppStore'
import { useAuthStore } from './store/useAuthStore'
import { supabase, isOnline } from './lib/supabase'
import {
  dbGetIdentitas, dbGetCustomCOA,
} from './lib/db'
import type { JurnalEntry } from './types'
import type { SaldoSimpanan } from './store/useAppStore'

// ── Debounce helper ────────────────────────────────────────────────────────
function useDebounce(fn: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, delay)
  }
}

export default function App() {
  const { session, profile, authLoading, init: initAuth, loadEditRequests } = useAuthStore()
  const [page, setPage] = useState<PageId>('dashboard')
  const { syncFromSupabase, syncArsipTahun, syncStatus } = useAppStore()

  // ── Init auth (cek sesi tersimpan + dengarkan perubahan login) ─────────
  useEffect(() => { initAuth() }, [])

  // ── Setelah login berhasil & role diketahui, arahkan ke halaman yang
  //    memang boleh diakses role itu (Ketua tidak punya akses ke Dashboard)
  useEffect(() => {
    if (profile && !isPageAllowed(profile.role, page)) {
      setPage(profile.role === 'ketua' ? 'buku_besar' : 'dashboard')
    }
  }, [profile])

  // Ganti halaman TAPI selalu dicek dulu boleh/tidak untuk role ini —
  // lapisan pertahanan kedua di sisi UI, selain RLS di database.
  const changePage = (p: PageId) => {
    if (isPageAllowed(profile?.role, p)) setPage(p)
  }

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnline() && session) { syncFromSupabase(); syncArsipTahun(); loadEditRequests() }
  }, [session])

  // ── Granular realtime handlers ──────────────────────────────────────────
  // PENTING (perbaikan performa): handler-handler ini TIDAK fetch ulang
  // seluruh tabel dari server. Payload `postgres_changes` dari Supabase
  // SUDAH berisi baris yang berubah (payload.new / payload.old), jadi kita
  // cukup "tempel" (patch) baris itu ke state lokal.
  //
  // Sebelumnya: setiap ADA SATU perubahan jurnal (dari siapa pun), SEMUA
  // device yang sedang buka aplikasi akan download ULANG SELURUH tabel
  // jurnal (ribuan baris) secara bersamaan. Ini "thundering herd" — makin
  // banyak data & makin banyak orang buka bareng, makin berat, apalagi di
  // Supabase Free tier yang jatah koneksi/compute-nya terbatas. Sekarang
  // tiap device cukup update satu baris yang memang berubah → jauh lebih
  // ringan meskipun datanya sudah ribuan baris atau dibuka puluhan device
  // sekaligus.
  const handleJurnalChange = (payload: { eventType: string; new: any; old: any }) => {
    useAppStore.setState((s) => {
      if (payload.eventType === 'DELETE') {
        return { jurnal: s.jurnal.filter(j => j.id !== payload.old.id), syncStatus: 'synced' }
      }
      const r = payload.new
      const mapped: JurnalEntry = {
        id:             r.id,
        tanggal:        r.tanggal,
        nobukti:        r.nobukti,
        keterangan:     r.keterangan ?? '',
        rows:           r.rows,
        total:          Number(r.total),
        jasaSukSynced:  r.jasa_suk_synced ?? false,
      }
      const exists = s.jurnal.some(j => j.id === mapped.id)
      const jurnal = exists
        ? s.jurnal.map(j => j.id === mapped.id ? mapped : j)
        : [mapped, ...s.jurnal]
      return {
        jurnal,
        nextJurnalId: Math.max(s.nextJurnalId, mapped.id + 1),
        syncStatus: 'synced',
      }
    })
  }

  const handleSaldoAwalChange = (payload: { eventType: string; new: any; old: any }) => {
    useAppStore.setState((s) => {
      if (payload.eventType === 'DELETE') {
        const c = { ...s.saldoAwal }
        delete c[payload.old.kode]
        return { saldoAwal: c, syncStatus: 'synced' }
      }
      const r = payload.new
      return { saldoAwal: { ...s.saldoAwal, [r.kode]: Number(r.nilai) }, syncStatus: 'synced' }
    })
  }

  const handleSimpananChange = (payload: { eventType: string; new: any; old: any }) => {
    useAppStore.setState((s) => {
      if (payload.eventType === 'DELETE') {
        return { saldoSimpanan: s.saldoSimpanan.filter(x => x.anggotaId !== payload.old.anggota_no), syncStatus: 'synced' }
      }
      const r = payload.new
      const mapped: SaldoSimpanan = {
        anggotaId: r.anggota_no,
        pokok:     Number(r.pokok),
        wajib:     Number(r.wajib),
        wajib_khs: Number(r.wajib_khs),
        sukarela:  Number(r.sukarela),
        jasa_suk:  Number(r.jasa_suk),
        tht:       Number(r.tht),
        jasa_tht:  Number(r.jasa_tht),
        pinjaman:  Number(r.pinjaman),
      }
      const exists = s.saldoSimpanan.some(x => x.anggotaId === mapped.anggotaId)
      const saldoSimpanan = exists
        ? s.saldoSimpanan.map(x => x.anggotaId === mapped.anggotaId ? mapped : x)
        : [...s.saldoSimpanan, mapped]
      return { saldoSimpanan, syncStatus: 'synced' }
    })
  }

  const handlePiutangChange = (payload: { eventType: string; new: any; old: any }) => {
    useAppStore.setState((s) => {
      if (payload.eventType === 'DELETE') {
        return { piutangSP: s.piutangSP.filter(x => x.anggotaId !== payload.old.anggota_no), syncStatus: 'synced' }
      }
      const r = payload.new
      const mapped = {
        anggotaId:     r.anggota_no,
        saldoAwal:     Number(r.saldo_awal),
        saldoAwalJasa: Number(r.saldo_awal_jasa ?? 0),
      }
      const exists = s.piutangSP.some(x => x.anggotaId === mapped.anggotaId)
      const piutangSP = exists
        ? s.piutangSP.map(x => x.anggotaId === mapped.anggotaId ? mapped : x)
        : [...s.piutangSP, mapped]
      return { piutangSP, syncStatus: 'synced' }
    })
  }

  // Identitas & Bagan Akun: tabel kecil (1 baris/beberapa puluh baris) dan
  // jarang berubah, jadi tetap pakai full refetch — lebih simpel, dan
  // dampaknya ke performa dapat diabaikan dibanding jurnal/saldo di atas.
  const handleIdentitasChange = useDebounce(async () => {
    if (!isOnline()) return
    const identitas = await dbGetIdentitas()
    if (identitas) useAppStore.setState({ identitas, syncStatus: 'synced' })
  }, 300)

  const handleCustomCOAChange = useDebounce(async () => {
    if (!isOnline()) return
    const customCOA = await dbGetCustomCOA()
    if (customCOA !== null) useAppStore.setState({ customCOA, syncStatus: 'synced' })
  }, 300)

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline() || !session) return

    const channel = supabase
      .channel('db-realtime', {
        config: { broadcast: { self: false } }, // tidak trigger untuk perubahan dari device sendiri
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jurnal' },
        (payload) => handleJurnalChange(payload as any))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_awal' },
        (payload) => handleSaldoAwalChange(payload as any))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_simpanan' },
        (payload) => handleSimpananChange(payload as any))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saldo_piutang' },
        (payload) => handlePiutangChange(payload as any))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'identitas' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handleIdentitasChange() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_coa' },
        () => { useAppStore.setState({ syncStatus: 'loading' }); handleCustomCOAChange() })
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
  }, [session])

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
    ['neraca_komparatif', <NeracaKomparatifPage />],
    ['laba_rugi',  <LabaRugiPage />],
    ['ekuitas',    <EkuitasPage />],
    ['arus_kas',   <ArusKasPage />],
    ['shu',        <SHUPage />],
    ['tutup_buku', <TutupBukuPage />],
  ]

  // ── Sync status label ────────────────────────────────────────────────────
  const statusLabel = !isOnline() ? { text: '○ Offline', cls: 'bg-slate-200 text-slate-500' }
    : syncStatus === 'loading' ? { text: '⟳ Menyinkron...', cls: 'bg-amber-100 text-amber-700' }
    : syncStatus === 'synced'  ? { text: '✓ Tersinkron',    cls: 'bg-emerald-100 text-emerald-700' }
    : syncStatus === 'error'   ? { text: '✗ Gagal sync',    cls: 'bg-red-100 text-red-700' }
    : { text: '○ Siap', cls: 'bg-slate-100 text-slate-500' }

  // ── Gerbang auth ──────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        Memuat...
      </div>
    )
  }
  if (!session) return <LoginPage />

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div id="sidebar" className="no-print">
        <Sidebar active={page} onChange={changePage} />
      </div>
      <main id="main-content" className="flex-1 min-w-0 overflow-y-auto relative">

        {/* Sync indicator */}
        <div className={`fixed top-2 right-3 z-50 text-[10px] px-2 py-1 rounded-full font-medium transition-all no-print ${statusLabel.cls}`}>
          {statusLabel.text}
        </div>

        {/* Keep all pages mounted, only show yang aktif DAN yang boleh diakses role ini */}
        {pages
          .filter(([pid]) => isPageAllowed(profile?.role, pid))
          .map(([pid, node]) => (
            <div key={pid} style={{ display: pid === page ? 'block' : 'none' }}>
              {node}
            </div>
          ))}
      </main>
    </div>
  )
}
