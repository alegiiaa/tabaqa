import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nContext'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AuthPage } from './components/AuthPage'
import { Dashboard } from './components/dashboard/Dashboard'
import { BasePage } from './components/BasePage'
import { DevelopersPage } from './components/DevelopersPage'
import { CreditReport } from './components/CreditReport'
import { ReportVerify } from './components/ReportVerify'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<AuthPage mode="signin" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/base" element={<BasePage />} />
            <Route path="/developers" element={<DevelopersPage />} />
            <Route path="/report" element={<CreditReport />} />
            <Route path="/verify" element={<ReportVerify />} />
            {/* Frictionless judge/demo entry — straight into the app, no sign-up. */}
            <Route path="/demo" element={<Dashboard />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
