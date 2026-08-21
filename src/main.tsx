import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { RepositoryProvider } from './data/RepositoryContext.tsx'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root fehlt in index.html')

createRoot(root).render(
  <StrictMode>
    {/* HashRouter statt BrowserRouter: GitHub Pages liefert für Unterpfade
        keine index.html aus, ein direkter Aufruf von /rezepte/123 endete sonst
        im 404. Mit # funktioniert das Neuladen auf jeder Seite. */}
    <HashRouter>
      <RepositoryProvider>
        <App />
      </RepositoryProvider>
    </HashRouter>
  </StrictMode>,
)
