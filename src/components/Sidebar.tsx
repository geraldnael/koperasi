import {
  LayoutDashboard, Building2, ListTree, Wallet, Users,
  PenLine, BookOpen, Scale, ChartPie, ChartBar, Banknote,
  Store, CreditCard, PieChart, ChevronRight, GitCompare, Lock, LogOut,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore, type UserRole } from '../store/useAuthStore'

export type PageId =
  | 'dashboard' | 'identitas' | 'coa' | 'anggota'
  | 'saldo_awal' | 'jurnal' | 'buku_besar'
  | 'simpanan' | 'piutang_sp' | 'toko'
  | 'neraca' | 'neraca_komparatif' | 'laba_rugi' | 'ekuitas' | 'arus_kas' | 'shu'
  | 'tutup_buku'

interface Props { active: PageId; onChange: (p: PageId) => void }

const sections = [
  {
    label: 'Beranda',
    items: [
      { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { id: 'identitas' as PageId,  label: 'Profil Koperasi',  icon: Building2 },
      { id: 'coa' as PageId,        label: 'Bagan Akun (COA)', icon: ListTree },
      { id: 'anggota' as PageId,    label: 'Data Anggota',     icon: Users },
      { id: 'saldo_awal' as PageId, label: 'Saldo Awal',       icon: Wallet },
    ],
  },
  {
    label: 'Buku Pembantu',
    items: [
      { id: 'simpanan' as PageId,   label: 'Simpanan Anggota', icon: CreditCard },
      { id: 'piutang_sp' as PageId, label: 'Piutang SP',       icon: Store },
      { id: 'toko' as PageId,       label: 'Toko',             icon: Store },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { id: 'jurnal' as PageId,      label: 'Jurnal Umum',  icon: PenLine },
      { id: 'buku_besar' as PageId,  label: 'Buku Besar',   icon: BookOpen },
    ],
  },
  {
    label: 'Laporan Keuangan',
    items: [
      { id: 'neraca' as PageId,    label: 'Posisi Keuangan',  icon: Scale },
      { id: 'neraca_komparatif' as PageId, label: 'Neraca Komparatif', icon: GitCompare },
      { id: 'laba_rugi' as PageId, label: 'Hasil Usaha (PHU)', icon: ChartPie },
      { id: 'ekuitas' as PageId,   label: 'Perubahan Ekuitas', icon: ChartBar },
      { id: 'arus_kas' as PageId,  label: 'Arus Kas',          icon: Banknote },
      { id: 'shu' as PageId,       label: 'Alokasi SHU',       icon: PieChart },
    ],
  },
  {
    label: 'Akhir Periode',
    items: [
      { id: 'tutup_buku' as PageId, label: 'Tutup Buku', icon: Lock },
    ],
  },
]

// Menu yang boleh dilihat Ketua Umum — read-only, cuma laporan.
// admin & bendahara: lihat SEMUA menu (pembatasannya ada di sisi AKSI
// simpan/edit, bukan di sisi menu mana yang kelihatan).
const KETUA_ALLOWED: PageId[] = [
  'buku_besar', 'neraca', 'neraca_komparatif', 'laba_rugi', 'ekuitas', 'arus_kas', 'shu',
]

export function isPageAllowed(role: UserRole | undefined, pageId: PageId): boolean {
  if (role === 'ketua') return KETUA_ALLOWED.includes(pageId)
  return true // admin & bendahara: semua menu kelihatan
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin', bendahara: 'Bendahara', ketua: 'Ketua Umum',
}
const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'badge-blue', bendahara: 'badge-green', ketua: 'badge-slate',
}

export default function Sidebar({ active, onChange }: Props) {
  const { identitas, jurnal } = useAppStore()
  const { profile, signOut } = useAuthStore()
  const role = profile?.role

  const visibleSections = sections
    .map(sec => ({ ...sec, items: sec.items.filter(item => isPageAllowed(role, item.id)) }))
    .filter(sec => sec.items.length > 0)

  return (
    <aside className="w-56 min-w-[224px] bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
      {/* brand */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Scale size={14} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">SmartSAK EP</span>
        </div>
        <p className="text-xs font-medium text-slate-800 leading-tight line-clamp-2">
          {identitas.nama || 'KOPERASI'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Periode {identitas.tahun || new Date().getFullYear()}
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <span className="badge badge-blue text-[10px]">SAK EP</span>
          <span className="badge badge-slate text-[10px]">{jurnal.length} jurnal</span>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 py-2 px-2">
        {visibleSections.map(sec => (
          <div key={sec.label} className="mb-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1.5">
              {sec.label}
            </p>
            {sec.items.map(item => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={`nav-item w-full text-left mb-0.5 ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 text-xs">{item.label}</span>
                  {isActive && <ChevronRight size={12} className="opacity-50" />}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-2.5 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">{profile?.nama ?? '-'}</p>
            {role && <span className={`badge ${ROLE_BADGE[role]} text-[9px] mt-0.5`}>{ROLE_LABEL[role]}</span>}
          </div>
          <button onClick={signOut} title="Keluar"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 shrink-0">
            <LogOut size={14} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center">
          KKP RS. Soeharto Heerdjan Jakarta
        </p>
      </div>
    </aside>
  )
}
