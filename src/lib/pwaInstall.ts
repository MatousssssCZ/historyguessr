// Přidání aplikace na plochu (PWA install).
//
// Tři různé světy:
//  • Chromium (Android Chrome/Edge/Samsung, desktop Chrome/Edge) — umí nativní
//    dialog přes událost `beforeinstallprompt`, kterou si musíme schovat.
//  • iOS Safari — žádné API, jen ruční postup přes Sdílet → Přidat na plochu.
//  • iOS Chrome/Firefox/Edge — nejde vůbec (jsou to obálky WebKitu bez té volby),
//    uživatele musíme poslat do Safari.

export type InstallPlatform =
  | 'installed'
  | 'ios-safari'
  | 'ios-other'
  | 'android-chromium'
  | 'android-other'
  | 'desktop-chromium'
  | 'desktop-safari'
  | 'unsupported'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

/** Zavolat co nejdřív (main.tsx) — událost přijde hned po načtení. */
export function initInstallPrompt() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault() // ať prohlížeč neukáže vlastní lištu; nabídneme ji sami
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach(fn => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach(fn => fn())
  })
}

/** Přihlásí se k odběru změn dostupnosti nativního dialogu. Vrací odhlašovač. */
export function onInstallAvailabilityChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function canPromptInstall(): boolean {
  return deferred !== null
}

/** Spustí nativní instalační dialog. Vrací true, když uživatel potvrdil. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  listeners.forEach(fn => fn())
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome === 'accepted'
  } catch {
    return false
  }
}

/** Běží už jako nainstalovaná aplikace (ne v záložce prohlížeče)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia?.('(display-mode: standalone)').matches === true || iosStandalone
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'unsupported'
  if (isStandalone()) return 'installed'

  const ua = navigator.userAgent
  // iPadOS 13+ se hlásí jako Mac — pozná se podle dotykové obrazovky
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(ua)

  if (isIOS) {
    // Na iOSu jsou všechny prohlížeče WebKit; „Přidat na plochu" má jen Safari.
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua)
    return isOtherBrowser ? 'ios-other' : 'ios-safari'
  }

  if (isAndroid) {
    const isChromium = /Chrome|Chromium|SamsungBrowser|EdgA|OPR/.test(ua) && !/FxiOS|Firefox/.test(ua)
    return isChromium ? 'android-chromium' : 'android-other'
  }

  // Desktop
  const isChromium = /Chrome|Chromium|Edg\//.test(ua) && !/OPR/.test(ua)
  if (isChromium) return 'desktop-chromium'
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'desktop-safari'
  return 'unsupported'
}
