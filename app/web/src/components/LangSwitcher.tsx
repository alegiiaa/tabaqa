import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { LANG_META, type Lang } from '../i18n/strings'

const LANGS: Lang[] = ['en', 'ar']

/** EN/AR dropdown. `onImage` styles it for the dark hero header. */
export function LangSwitcher({ onImage = false }: { onImage?: boolean }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (next: Lang) => {
    setLang(next)
    setOpen(false)
  }

  return (
    <div className={`langwrap${open ? ' open' : ''}`} ref={wrapRef}>
      <button
        className={`langbtn langtrigger${onImage ? ' onimg' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className="flag">{LANG_META[lang].flag}</span>
        <span className="langlabel-text">{LANG_META[lang].label}</span>
        <svg className="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      <div className="langmenu" role="listbox">
        {LANGS.map((l) => (
          <button
            key={l}
            className={`langopt${l === lang ? ' active' : ''}`}
            role="option"
            aria-selected={l === lang}
            onClick={() => choose(l)}
          >
            <span className="flag">{LANG_META[l].flag}</span>
            <span className="lname">{LANG_META[l].label}</span>
            <svg className="check" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 7.5 6 11l5.5-7.5" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
