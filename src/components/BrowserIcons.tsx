// Inline SVG ikony — bez externích assetů (CSP) a bez emoji.
// Značková loga jsou zjednodušená, ale rozpoznatelná.

type P = { size?: number }

export function SafariIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#3FA9F5"/>
      {/* Střelka = jeden kosočtverec: červená půlka k SV, bílá k JZ (spojené) */}
      <path d="M37 11 L27.4 27.4 L20.6 20.6 Z" fill="#DC2A22"/>
      <path d="M11 37 L27.4 27.4 L20.6 20.6 Z" fill="#fff"/>
    </svg>
  )
}

export function ChromeIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* červená nahoře, žlutá vpravo dole, zelená vlevo dole */}
      <path d="M24 24 L4.95 13 A22 22 0 0 1 43.05 13 Z" fill="#EA4335"/>
      <path d="M24 24 L43.05 13 A22 22 0 0 1 24 46 Z" fill="#FBBC05"/>
      <path d="M24 24 L24 46 A22 22 0 0 1 4.95 13 Z" fill="#34A853"/>
      <circle cx="24" cy="24" r="11" fill="#fff"/>
      <circle cx="24" cy="24" r="9" fill="#4285F4"/>
    </svg>
  )
}

export function FirefoxIcon({ size = 24 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* aktuální logo Firefoxu — ohnivá liška (žlutá → oranžová → fialová) */}
      <defs>
        <radialGradient id="ff-g" cx="62%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#FFD24A"/>
          <stop offset="38%" stopColor="#F58220"/>
          <stop offset="72%" stopColor="#E7442E"/>
          <stop offset="100%" stopColor="#9A2C8E"/>
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#ff-g)"/>
      <path
        d="M24 7c7 4 10 9 10 14.5C34 29 29.4 34 24 34s-10-4.6-10-11c0-3.6 1.4-6.6 3.8-8.9-1.1 4.6 1.2 8.2 4.4 8.2 3 0 5-2.1 5-5.1 0-3.4-2.3-6.3-3.2-10.2z"
        fill="#fff" opacity="0.9"
      />
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
