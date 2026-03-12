import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initAnalytics } from './lib/analytics'
import './lib/i18n' // Initialize i18n

// Defer analytics initialization until after first paint
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => initAnalytics(), { timeout: 3000 })
} else {
  setTimeout(initAnalytics, 1000)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

