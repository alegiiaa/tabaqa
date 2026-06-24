# Tabaqa · web

The marketing landing page + product dashboard, built in **React + Vite +
TypeScript**. Bilingual **EN / AR** with full RTL, hand-written CSS (no
Tailwind), and the Tabaqa Score demo mock.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
npm run typecheck  # tsc --noEmit
```

The dev server proxies `/v1/*` to the FastAPI backend on `:8000` (see
`vite.config.ts`), so the demo can call `/v1/score` without CORS friction.

## Structure

```
src/
├── main.tsx                 entry — wraps <App> in <I18nProvider>
├── App.tsx                  page composition (section order)
├── styles.css               full design system (ported verbatim)
├── i18n/
│   ├── strings.ts           EN/AR dictionary (single source of copy)
│   └── I18nContext.tsx      lang state · RTL <html dir> · ?lang= · localStorage
└── components/
    ├── Rich.tsx             renders translations that contain inline HTML
    ├── Logo.tsx  LangSwitcher.tsx
    ├── Hero.tsx  ProductMock.tsx  Features.tsx  HowItWorks.tsx
    ├── Security.tsx  ApiSection.tsx  Pricing.tsx  Faq.tsx  SignUp.tsx  Footer.tsx
```

## Language / RTL

`useI18n()` exposes `{ lang, dir, setLang, t }`. `t(key)` returns a string from
`strings.ts`; keys whose value contains inline HTML (emphasis, `<br>`, score
chips) are rendered via the `<Rich k="…">` helper. Switching to Arabic flips
`<html dir="rtl">`, which drives the RTL rules in `styles.css`.

## Content source of truth

Copy lives in `src/i18n/strings.ts` — the single source of content truth. Fonts
and images are in `public/` (29LT Bukra for Arabic, the hero billboard, icons).

> Roadmap: the demo **dashboard** (calling `/v1/profile` to render the live
> gauge + reason codes from the API instead of the static mock) lands next to
> these landing components.
