import type { ReactNode } from 'react'
import { Printer, Download, X } from 'lucide-react'

// ── PageHeader ────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'blue' | 'green' | 'red' | 'amber'
  icon?: ReactNode
}
export function MetricCard({ label, value, sub, color = 'default', icon }: MetricCardProps) {
  const colors = {
    default: 'text-slate-800',
    blue:    'text-blue-700',
    green:   'text-emerald-700',
    red:     'text-red-600',
    amber:   'text-amber-700',
  }
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className={`text-xl font-semibold ${colors[color]}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {icon && <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">{icon}</div>}
      </div>
    </div>
  )
}

// ── LaporanRow ────────────────────────────────────────────────────────────
interface LapRowProps {
  label: string
  value: number | null
  indent?: 0 | 1 | 2
  variant?: 'normal' | 'subtotal' | 'total'
  negative?: boolean
}
export function LapRow({ label, value, indent = 0, variant = 'normal', negative }: LapRowProps) {
  const indentClass = indent === 1 ? 'indent-1' : indent === 2 ? 'indent-2' : ''
  const formatted = value !== null
    ? new Intl.NumberFormat('id-ID').format(Math.abs(Math.round(value)))
    : '-'
  const isNeg = negative || (value !== null && value < 0)
  return (
    <div className={`lap-row ${indentClass} ${variant}`}>
      <span className="text-slate-700">{label}</span>
      <span className={`num text-sm ${isNeg ? 'text-red-600' : 'text-slate-800'}`}>
        {value !== null ? (isNeg ? `(${formatted})` : formatted) : '-'}
      </span>
    </div>
  )
}

export function LapHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-3 pb-1">
      {label}
    </p>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────
interface EmptyStateProps { icon?: ReactNode; message: string; action?: ReactNode }
export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      {icon && <div className="mb-3 opacity-50">{icon}</div>}
      <p className="text-sm">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="btn p-1.5 border-transparent hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  )
}

// ── PrintButton ────────────────────────────────────────────────────────────
import { printElement } from '../utils/printHelper'

export function PrintButton({ targetId, title }: { targetId?: string; title?: string }) {
  const handlePrint = () => {
    if (targetId) {
      printElement(targetId, title ?? '')
    } else {
      // fallback: cetak elemen main-content saja
      printElement('main-content', title ?? '')
    }
  }
  return (
    <button onClick={handlePrint} className="btn no-print">
      <Printer size={15} /> Cetak
    </button>
  )
}

// ── DownloadButton ─────────────────────────────────────────────────────────
interface DownloadBtnProps { onClick: () => void; label?: string }
export function DownloadButton({ onClick, label = 'Ekspor Excel' }: DownloadBtnProps) {
  return (
    <button onClick={onClick} className="btn btn-success no-print">
      <Download size={15} /> {label}
    </button>
  )
}

// ── FormGroup ─────────────────────────────────────────────────────────────
interface FormGroupProps { label: string; children: ReactNode; required?: boolean }
export function FormGroup({ label, children, required }: FormGroupProps) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── BalanceAlert ──────────────────────────────────────────────────────────
interface BalanceAlertProps { debet: number; kredit: number }
export function BalanceAlert({ debet, kredit }: BalanceAlertProps) {
  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(Math.round(n))
  if (debet === 0 && kredit === 0) return null
  const ok = Math.abs(debet - kredit) < 0.01
  return (
    <div className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
      ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
         : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      <span>{ok ? '✓ Seimbang' : '⚠ Tidak Seimbang'}</span>
      <span className="mx-1">—</span>
      <span>Debet: Rp {fmt(debet)}</span>
      <span>·</span>
      <span>Kredit: Rp {fmt(kredit)}</span>
      {!ok && (
        <>
          <span>·</span>
          <span>Selisih: Rp {fmt(Math.abs(debet - kredit))}</span>
        </>
      )}
    </div>
  )
}
