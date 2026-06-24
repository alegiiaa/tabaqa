import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18N, type Lang } from './strings'

interface I18nValue {
  lang: Lang
  dir: 'rtl' | 'ltr'
  setLang: (lang: Lang) => void
  /** Look up a translation key; falls back to English, then the key itself. */
  t: (key: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

const STORAGE_KEY = 'tabaqa-lang'

function initialLang(): Lang {
  // ?lang=ar|en wins (explicit), otherwise default to English on every load
  // (mirrors the original landing page behaviour).
  const q = new URLSearchParams(window.location.search).get('lang')
  if (q === 'ar' || q === 'en') return q
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable (private mode) — non-fatal */
    }
  }

  // Keep <html lang/dir> in sync so RTL styling + screen readers work.
  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      setLang,
      t: (key) => {
        const entry = I18N[key]
        if (!entry) return key
        return entry[lang] || entry.en
      },
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
