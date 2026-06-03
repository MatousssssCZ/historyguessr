import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import 'leaflet/dist/leaflet.css'
import { applyTheme, getTheme } from './lib/theme'

// Aplikuj uložené téma co nejdřív (zabrání bliknutí)
applyTheme(getTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
