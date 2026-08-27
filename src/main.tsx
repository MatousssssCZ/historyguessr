import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { applyTheme, getTheme } from './lib/theme'
import { initInstallPrompt } from './lib/pwaInstall'
import { initSentry } from './lib/sentry'
import './i18n'

// Sledování chyb (aktivní jen s VITE_SENTRY_DSN)
initSentry()
// Aplikuj uložené téma co nejdřív (zabrání bliknutí)
applyTheme(getTheme())
// Zachyť `beforeinstallprompt` dřív, než ji prohlížeč zahodí
initInstallPrompt()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
