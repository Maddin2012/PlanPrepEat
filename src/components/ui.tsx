import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { CloseIcon } from './Icons.tsx'

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-leaf-600 text-white active:bg-leaf-700 disabled:bg-leaf-300 shadow-sm',
  secondary:
    'bg-white text-ink-700 ring-1 ring-clay-200 active:bg-clay-50 disabled:text-ink-400',
  ghost: 'text-ink-600 active:bg-clay-100 disabled:text-ink-400',
  danger: 'bg-red-600 text-white active:bg-red-700 disabled:bg-red-300',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Über die volle Breite — das übliche Muster für Aktionen am Formularende. */
  block?: boolean
}

export function Button({
  variant = 'primary',
  block,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        // 44px Mindesthöhe: die kleinste Fläche, die man mit dem Daumen sicher trifft.
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4',
        'text-[0.95rem] font-medium transition-colors',
        'disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}

export function IconButton({
  className,
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
        'text-ink-600 transition-colors active:bg-clay-100',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  // Der Hinweis steht bewusst außerhalb des <label>: sonst würde er beim
  // Vorlesen Teil des Feldnamens („Portionen Für so viele gelten die Mengen …").
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-600">
          {label}
        </span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

const CONTROL =
  'w-full rounded-xl bg-white px-3 py-2.5 text-ink-900 ring-1 ring-clay-200 ' +
  'outline-none transition-shadow placeholder:text-ink-400 ' +
  'focus:ring-2 focus:ring-leaf-500'

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...props} />
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cx(CONTROL, 'resize-y leading-relaxed', className)} {...props} />
  )
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(CONTROL, 'appearance-none pr-8', className)} {...props} />
}

/**
 * Von unten einfahrendes Blatt. Auf dem Handy die angenehmste Art, ein Formular
 * oder eine Auswahl zu zeigen: Der Daumen erreicht den Inhalt, und ein Tipp
 * daneben schließt es wieder.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    // Hintergrund festhalten, damit nicht die Liste darunter mitscrollt.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-ink-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex max-h-[88svh] flex-col rounded-t-2xl bg-canvas shadow-2xl',
          'animate-[sheet-in_180ms_ease-out]',
        )}
      >
        <header className="flex items-center gap-2 border-b border-clay-200 bg-surface px-2 py-2 rounded-t-2xl">
          <h2 className="flex-1 pl-2 text-base font-semibold text-ink-900">
            {title}
          </h2>
          <IconButton label="Schließen" onClick={onClose}>
            <CloseIcon className="size-5" />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {footer && (
          <footer className="safe-bottom border-t border-clay-200 bg-surface px-4 py-3">
            {footer}
          </footer>
        )}
      </div>

      <style>{`@keyframes sheet-in { from { transform: translateY(12%); opacity: .6 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      {icon && <div className="mb-3 text-clay-300">{icon}</div>}
      <p className="text-base font-medium text-ink-700">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Lädt …' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-ink-500">
      <span className="size-4 animate-spin rounded-full border-2 border-clay-200 border-t-leaf-500" />
      {label}
    </div>
  )
}

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-leaf-600 text-white'
          : 'bg-white text-ink-600 ring-1 ring-clay-200',
        className,
      )}
      {...props}
    />
  )
}
