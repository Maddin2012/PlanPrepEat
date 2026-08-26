import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon, UpdateIcon } from './Icons.tsx'
import { APP_NAME, Mark } from './Logo.tsx'
import { IconButton, cx } from './ui.tsx'
import { useUpdate } from '../lib/updates.tsx'

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
  brand,
}: {
  title: string
  subtitle?: ReactNode
  /** Zeigt eine Zurück-Taste. `true` = einen Schritt zurück, sonst ein Ziel. */
  back?: boolean | string
  actions?: ReactNode
  /** Zusätzliche Zeile unter dem Titel, z.B. Suchfeld oder Filter. */
  below?: ReactNode
  /**
   * Auf den drei Hauptreitern: Statt des Seitentitels stehen Zeichen und Name
   * der App in der Überschrift, und der Titel rutscht in die kleine Zeile
   * darunter. Absichtlich keine zusätzliche Zeile — auf dem Handy zählt jede
   * Zeile Liste.
   */
  brand?: boolean
}) {
  const navigate = useNavigate()
  const { ready } = useUpdate()

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
          {brand ? (
            <h1 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
              <Mark className="h-[1.55em] w-auto shrink-0" />
              <span className="truncate">{APP_NAME}</span>
              {/*
                Sonst hießen alle drei Reiter beim Vorlesen gleich. Das
                Leerzeichen davor gehört dazu: Ohne es liest der Screenreader
                „PlanPrepEat– Rezeptbuch" in einem Wort.
              */}
              <span className="sr-only"> – {title}</span>
            </h1>
          ) : (
            <h1 className="truncate text-lg font-semibold text-ink-900">{title}</h1>
          )}

          {(brand || subtitle) && (
            <div className="truncate text-xs text-ink-500">
              {brand ? (
                <>
                  {title}
                  {subtitle && <> · {subtitle}</>}
                </>
              ) : (
                subtitle
              )}
            </div>
          )}
        </div>

        {/*
          Das Update-Zeichen steht auf **jeder** Seite, nicht nur auf den
          Hauptreitern: Wer gerade ein Rezept bearbeitet, soll es genauso sehen.
          Es führt in die Einstellungen, wo der Knopf sitzt.
        */}
        {ready && (
          <IconButton
            label="Update verfügbar — zu den Einstellungen"
            className="relative text-accent-text"
            onClick={() => navigate('/einstellungen')}
          >
            <UpdateIcon className="size-5" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-surface" />
          </IconButton>
        )}

        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>

      {below && <div className="px-4 pb-3">{below}</div>}
    </header>
  )
}
