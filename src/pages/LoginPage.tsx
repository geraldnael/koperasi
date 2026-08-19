import { useState } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

export default function LoginPage() {
  const signIn = useAuthStore(s => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Email dan password wajib diisi'); return }
    setLoading(true)
    const res = await signIn(email.trim(), password)
    setLoading(false)
    if (!res.ok) setError(res.message ?? 'Login gagal')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">SIA Koperasi</h1>
          <p className="text-sm text-slate-500 mt-1">Masuk untuk melanjutkan</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email}
              onChange={e => setEmail(e.target.value)} autoFocus
              placeholder="nama@email.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="btn btn-primary w-full justify-center disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-4">
          Belum punya akun? Hubungi Bendahara/Admin koperasi untuk dibuatkan akun.
        </p>
      </div>
    </div>
  )
}
