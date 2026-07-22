// Inline SVG ikony — bez externích assetů (CSP) a bez emoji.
// Značková loga jsou zjednodušená, ale rozpoznatelná.

type P = { size?: number }

export function SafariIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#1AA5F8"/>
      <circle cx="24" cy="24" r="18" fill="none" stroke="#fff" strokeWidth="2"/>
      <path d="M24 24 L35 13 L29 25 Z" fill="#F5453B"/>
      <path d="M24 24 L13 35 L19 23 Z" fill="#fff"/>
    </svg>
  )
}

export function ChromeIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* tři barevné výseče po 120° */}
      <path d="M24 24 L4.95 13 A22 22 0 0 1 43.05 13 Z" fill="#EA4335"/>
      <path d="M24 24 L43.05 13 A22 22 0 0 1 24 46 Z" fill="#34A853"/>
      <path d="M24 24 L24 46 A22 22 0 0 1 4.95 13 Z" fill="#FBBC05"/>
      <circle cx="24" cy="24" r="11" fill="#fff"/>
      <circle cx="24" cy="24" r="9" fill="#4285F4"/>
    </svg>
  )
}

export function FirefoxIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="ffg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB03A"/>
          <stop offset="45%" stopColor="#F5793A"/>
          <stop offset="100%" stopColor="#C5307C"/>
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#ffg)"/>
      <path d="M24 8c6 2 9 6 9 11 0 6-4 10-9 10s-9-4-9-9c0-3 1-5 3-7-1 4 1 7 4 7 3 0 5-2 5-5 0-3-2-5-3-7z" fill="#fff" opacity="0.92"/>
    </svg>
  )
}

export function OperaIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="24" rx="21" ry="22" fill="#EE2950"/>
      <ellipse cx="24" cy="24" rx="8.5" ry="13" fill="#fff"/>
    </svg>
  )
}

export function AndroidIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M12 28a12 12 0 0 1 24 0z" fill="#3DDC84"/>
      <path d="M16.5 15.5 13.5 10.5M31.5 15.5 34.5 10.5" stroke="#3DDC84" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="19" cy="22" r="1.7" fill="#fff"/>
      <circle cx="29" cy="22" r="1.7" fill="#fff"/>
    </svg>
  )
}

// ── UI ikony ──────────────────────────────────────────────

/** Stažení / přidání na plochu */
export function DownloadIcon({ size = 20, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>
    </svg>
  )
}

/** iOS „Sdílet" — čtvereček se šipkou nahoru */
export function ShareIosIcon({ size = 20, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3"/><path d="m8 7 4-4 4 4"/>
      <path d="M6 12H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/>
    </svg>
  )
}

/** Nabídka prohlížeče — tři tečky svisle */
export function DotsIcon({ size = 20, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/>
    </svg>
  )
}

/** Ikona instalace v adresním řádku (monitor se šipkou) */
export function InstallBarIcon({ size = 20, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 7v6"/><path d="m9.5 10.5 2.5 2.5 2.5-2.5"/>
    </svg>
  )
}

/** Zvoneček — oznámení */
export function BellIcon({ size = 16, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
    </svg>
  )
}

/** Položka v nabídce „Přidat na plochu" — čtvereček s plusem */
export function PlusSquareIcon({ size = 18, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>
    </svg>
  )
}

/** Hotovo / potvrzeno */
export function CheckIcon({ size = 18, color = 'currentColor' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5"/>
    </svg>
  )
}
