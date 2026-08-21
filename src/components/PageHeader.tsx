import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon } from './Icons.tsx'
import { IconButton, cx } from './ui.tsx'

/**
 * Kopfzeile einer Seite. Bleibt beim Scrollen oben stehen, damit die
 * Zurück-Taste und die Hauptaktion immer erreichbar sind.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  below,
}: {
  title: string
  subtitle?: ReactNode
  /** Zeigt eine Zurück-Taste. `true` = einen Schritt zurück, sonst ein Ziel. */
  back?: boolean | string
  actions?: ReactNode
  /** Zusätzliche Zeile unter dem Titel, z.B. Suchfeld oder Filter. */
  below?: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-clay-200 bg-surface/95 backdrop-blur">
      <div className={cx('flex items-center gap-1 px-2 py-2', !back && 'px-4')}>
        {back && (
          <IconButton
            label="Zurück"
            onClick={() =>
              typeof back === 'string' ? navigate(back) : navigate(-1)
            }
          >
            <BackIcon className="size-5" />
          </IconButton>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-ink-900">{title}</h1>
          {subtitle && (
            <div className="truncate text-xs text-ink-500">{subtitle}</div>
          )}
        </div>

        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>

      {below && <div className="px-4 pb-3">{below}</div>}
    </header>
  )
}
