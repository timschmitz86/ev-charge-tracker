import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import './index.css'
import App from './App.jsx'
import EntryDetailsPage from './EntryDetailsPage.jsx'
import { setupPWAUpdates } from './pwaUpdateHandler.js'
import { LanguageProvider } from './i18n/useLanguage.js'

// Initialize PWA update handler
setupPWAUpdates()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/entry/:id" element={<EntryDetailsPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
)
