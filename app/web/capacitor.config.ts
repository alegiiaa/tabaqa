import type { CapacitorConfig } from '@capacitor/cli'

// The native iOS shell. The app is a thin client: all intelligence comes from
// tabaqa-api over HTTPS (VITE_API_BASE at build time) — nothing is decided on-device.
// appName is the on-device display name; swap it when the fictional bank name is locked.
const config: CapacitorConfig = {
  appId: 'sa.tabaqa.bank',
  appName: 'Tabaqa',
  webDir: 'dist',
  // Safe areas are handled in CSS via env(safe-area-inset-*); letting the WebView
  // also inset content (contentInset: 'automatic') double-applies and clips the tab bar.
  ios: {
    contentInset: 'never',
  },
  plugins: {
    // The branded splash (Assets.xcassets/Splash — the Tabaqa light-burst) holds
    // for a beat instead of flashing mid-zoom, then hands over to the login gate.
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#06102e',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
}

export default config
