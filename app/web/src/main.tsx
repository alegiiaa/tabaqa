import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nContext'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AuthPage } from './components/AuthPage'
import { Dashboard } from './components/dashboard/Dashboard'
import { BankDesk } from './components/dashboard/BankDesk'
import { BasePage } from './components/BasePage'
import { DevelopersPage } from './components/DevelopersPage'
import { CreditReport } from './components/CreditReport'
import { ComplianceReceiptDoc } from './components/ComplianceReceiptDoc'
import { ReportVerify } from './components/ReportVerify'
import App from './App'
import { BankApp } from './components/bank/BankApp'
import { BankDashboard } from './components/bankdash/BankDashboard'
import { TabaqaApp } from './components/tapp/TabaqaApp'
import './styles.css'

// Inside the native iOS shell (Capacitor), the phone IS the Tabaqa app — open
// straight into it (TEAM SPEC 2026-07-17: the journey begins in تطبيق طبقة).
const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.())
if (isNative && window.location.pathname === '/') {
  window.history.replaceState(null, '', '/tabaqa')
}

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
            <Route path="/receipt" element={<ComplianceReceiptDoc />} />
            <Route path="/verify" element={<ReportVerify />} />
            {/* The lender's desk — orders from the Tabaqa app + the applicants. */}
            <Route path="/demo" element={<BankDesk />} />
            {/* The full consumer dashboard, parked — reachable if a demo needs it. */}
            <Route path="/demo-full" element={<Dashboard />} />
            {/* تطبيق طبقة — the consumer app: Nafath (محاكاة) → 7 sources → lender engines → offers. */}
            <Route path="/tabaqa" element={<TabaqaApp />} />
            {/* The bank's mobile app — Ahmed's تمويل journey, Tabaqa invisible inside. */}
            <Route path="/bank" element={<BankApp />} />
            {/* The bank's own ops view over the applications the engine decided (spec §15). */}
            <Route path="/bank-dashboard" element={<BankDashboard />} />
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
