import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { INVITE_PATH } from './lib/invite.ts'
import { useHorizontalSwipe } from './lib/gesture.ts'
import { nextTab } from './domain/swipe.ts'
import { useSession } from './data/RepositoryContext.tsx'
import { BookIcon, CalendarIcon, CartIcon } from './components/Icons.tsx'
import { cx } from './components/ui.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import SetupPage from './features/setup/SetupPage.tsx'
import JoinPage from './features/setup/JoinPage.tsx'
import RecipeListPage from './features/recipes/RecipeListPage.tsx'
import RecipeDetailPage from './features/recipes/RecipeDetailPage.tsx'
import RecipeEditPage from './features/recipes/RecipeEditPage.tsx'
import PlanPage from './features/plan/PlanPage.tsx'
import ShoppingPage from './features/shopping/ShoppingPage.tsx'
import SettingsPage from './features/setup/SettingsPage.tsx'

const TABS = [
  { to: '/rezepte', label: 'Rezepte', Icon: BookIcon },
  { to: '/plan', label: 'Essensplan', Icon: CalendarIcon },
  { to: '/einkaufsliste', label: 'Einkauf', Icon: CartIcon },
]

/** Dieselbe Reihenfolge wie in der Leiste — daran entlang wird gewischt. */
const TAB_PATHS = TABS.map((tab) => tab.to)

export default function App() {
  const { status } = useSession()
  const { pathname } = useLocation()

  if (status === 'loading') return <Splash />

  // Der Einladungslink muss gerade dann greifen, wenn auf diesem Gerät noch
  // kein Haushalt eingerichtet ist — deshalb vor der Einrichtungsseite.
  if (pathname.startsWith(`${INVITE_PATH}/`)) {
    return (
      <Routes>
        <Route path={`${INVITE_PATH}/:code`} element={<JoinPage />} />
      </Routes>
    )
  }

  if (status !== 'ready') return <SetupPage />

  return <Shell />
}

function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Formulare bekommen den ganzen Bildschirm: Die Reiterleiste würde neben der
  // eingeblendeten Tastatur und dem Speichern-Balken nur im Weg stehen.
  const fullscreen = /\/(neu|bearbeiten)$/.test(pathname)

  /**
   * Gewischt wird **nur auf den drei Reiterseiten**. Im Rezept, im Formular und
   * in den Einstellungen wäre „einen Reiter weiter" keine sinnvolle Antwort auf
   * die Geste — dort führt der Weg über Zurück.
   */
  const swipeable = TAB_PATHS.includes(pathname)
  const swipe = useHorizontalSwipe({
    enabled: swipeable,
    onSwipe: (richtung) => {
      const ziel = nextTab(TAB_PATHS, pathname, richtung)
      if (ziel) navigate(ziel)
    },
  })

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col bg-canvas">
      <main
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: fullscreen ? 0 : 'var(--tabbar-height)',
          // **Ohne das gäbe es die Geste nicht.** Auf einem scrollbaren Bereich
          // nimmt der Browser die Berührung an sich, sobald sie sich bewegt —
          // die App bekommt dann `pointercancel` statt `pointerup` und hat nie
          // ein Ende zum Nachmessen. `pan-y` gibt ihm das Scrollen nach oben und
          // unten und behält die waagerechte Richtung hier; `pinch-zoom` lässt
          // das Vergrößern mit zwei Fingern unangetastet.
          touchAction: swipeable ? 'pan-y pinch-zoom' : undefined,
        }}
        {...swipe}
      >
        {/* Innerhalb von <main>, damit die Reiterleiste stehen bleibt: Wer auf
            einer kaputten Seite landet, kommt so wenigstens wieder weg. */}
        <ErrorBoundary resetKey={pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/rezepte" replace />} />
            <Route path="/rezepte" element={<RecipeListPage />} />
            <Route path="/rezepte/neu" element={<RecipeEditPage />} />
            <Route path="/rezepte/:id" element={<RecipeDetailPage />} />
            <Route path="/rezepte/:id/bearbeiten" element={<RecipeEditPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/einkaufsliste" element={<ShoppingPage />} />
            <Route path="/einstellungen" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/rezepte" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {!fullscreen && <TabBar />}
    </div>
  )
}

function TabBar() {
  return (
    <nav
      className={cx(
        'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-4xl safe-bottom',
        'border-t border-clay-200 bg-surface/95 backdrop-blur',
      )}
    >
      <ul className="flex">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cx(
                  'flex h-16 flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-accent-text' : 'text-ink-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-6" strokeWidth={isActive ? 2 : 1.6} />
                  <span className="text-[0.7rem] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-canvas">
      <span className="size-8 animate-spin rounded-full border-[3px] border-clay-200 border-t-accent" />
      <p className="text-sm text-ink-500">Einen Moment …</p>
    </div>
  )
}
