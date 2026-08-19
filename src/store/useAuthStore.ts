import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'admin' | 'bendahara' | 'ketua'

export interface Profile {
  id: string
  nama: string
  role: UserRole
}

export interface EditRequest {
  id: number
  jurnal_id: number
  requested_by: string
  requested_by_nama?: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  used: boolean
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  authLoading: boolean          // masih cek sesi awal / login lagi
  editRequests: EditRequest[]   // semua request (bendahara lihat semua, admin filter sendiri)

  init: () => void
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => Promise<void>

  loadEditRequests: () => Promise<void>
  requestEdit: (jurnalId: number) => Promise<{ ok: boolean; message?: string }>
  approveEditRequest: (id: number) => Promise<void>
  rejectEditRequest: (id: number) => Promise<void>
  hasApprovedEdit: (jurnalId: number) => boolean
  hasPendingEdit: (jurnalId: number) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  authLoading: true,
  editRequests: [],

  init: () => {
    // Ambil sesi yang mungkin masih tersimpan (persistSession: true)
    supabase.auth.getSession().then(async ({ data }) => {
      set({ session: data.session })
      if (data.session) await loadProfile(data.session.user.id, set)
      set({ authLoading: false })
    })

    // Dengarkan perubahan login/logout (termasuk dari tab lain)
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session })
      if (session) {
        await loadProfile(session.user.id, set)
        get().loadEditRequests()
      } else {
        set({ profile: null, editRequests: [] })
      }
    })
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Pesan error Supabase default bahasa Inggris, kita bikin lebih jelas
      const msg = error.message.includes('Invalid login credentials')
        ? 'Email atau password salah.'
        : error.message
      return { ok: false, message: msg }
    }
    if (data.session) await loadProfile(data.session.user.id, set)
    return { ok: true }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null, editRequests: [] })
  },

  loadEditRequests: async () => {
    const { data: reqs, error } = await supabase
      .from('edit_requests')
      .select('*')
      .order('requested_at', { ascending: false })
    if (error) { console.error('Gagal load edit_requests:', error); return }

    // Ambil nama requester secara TERPISAH (bukan lewat join/embed), karena
    // tidak ada foreign key langsung dari edit_requests ke profiles —
    // yang ada cuma edit_requests→auth.users dan profiles→auth.users
    // secara terpisah. Embed query PostgREST sebelumnya gagal diam-diam
    // karena relasi itu tidak ada, bikin seluruh fitur ini kelihatan mati.
    const userIds = Array.from(new Set((reqs ?? []).map((r: any) => r.requested_by)))
    let namaMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from('profiles').select('id, nama').in('id', userIds)
      if (profErr) console.error('Gagal load nama requester:', profErr)
      namaMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nama]))
    }

    const mapped: EditRequest[] = (reqs ?? []).map((r: any) => ({
      ...r,
      requested_by_nama: namaMap[r.requested_by] ?? '(user tidak dikenal)',
    }))
    set({ editRequests: mapped })
  },

  requestEdit: async (jurnalId) => {
    const uid = get().session?.user.id
    if (!uid) return { ok: false, message: 'Sesi login habis, silakan login ulang.' }
    // Cegah spam: kalau sudah ada request pending untuk entri yang sama, jangan bikin baru
    const existing = get().editRequests.find(
      r => r.jurnal_id === jurnalId && r.requested_by === uid && r.status === 'pending'
    )
    if (existing) return { ok: false, message: 'Sudah ada permintaan izin untuk entri ini, tunggu persetujuan Bendahara.' }
    const { error } = await supabase.from('edit_requests').insert({ jurnal_id: jurnalId, requested_by: uid })
    if (error) return { ok: false, message: 'Gagal mengirim permintaan izin: ' + error.message }
    await get().loadEditRequests()
    return { ok: true }
  },

  approveEditRequest: async (id) => {
    const uid = get().session?.user.id
    const { error } = await supabase.from('edit_requests')
      .update({ status: 'approved', approved_by: uid, approved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert('Gagal menyetujui: ' + error.message); return }
    await get().loadEditRequests()
  },

  rejectEditRequest: async (id) => {
    const uid = get().session?.user.id
    const { error } = await supabase.from('edit_requests')
      .update({ status: 'rejected', approved_by: uid, approved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert('Gagal menolak: ' + error.message); return }
    await get().loadEditRequests()
  },

  hasApprovedEdit: (jurnalId) => {
    const uid = get().session?.user.id
    return get().editRequests.some(
      r => r.jurnal_id === jurnalId && r.requested_by === uid && r.status === 'approved' && !r.used
    )
  },

  hasPendingEdit: (jurnalId) => {
    const uid = get().session?.user.id
    return get().editRequests.some(
      r => r.jurnal_id === jurnalId && r.requested_by === uid && r.status === 'pending'
    )
  },
}))

async function loadProfile(userId: string, set: (partial: Partial<AuthState>) => void) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) { console.error('Gagal load profile:', error); return }
  set({ profile: data as Profile })
}
