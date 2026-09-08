// Sdílená sada line-ikon (stroke: currentColor). Nahrazuje emoji v UI chromu.
// Barvu i velikost řídí rodič (color / prop size).

export type IconName =
  | 'home' | 'campaign' | 'badge' | 'friends' | 'profile' | 'admin'
  | 'bolt' | 'sliders' | 'swords' | 'pin' | 'calendar' | 'trophy'
  | 'chart' | 'globe' | 'star' | 'save' | 'roadmap' | 'flame' | 'help' | 'bug' | 'link' | 'plus' | 'lock' | 'share'
  | 'archive' | 'compass' | 'gear' | 'palette' | 'medal' | 'warning' | 'moon-stars'
  | 'calendar-check' | 'lightning' | 'calendar-star' | 'diamond' | 'crown' | 'users' | 'arrow-right'

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></>,
  campaign: <><path d="M5 21V4"/><path d="M5 4h11l-2 3 2 3H5"/></>,
  badge: <><circle cx="12" cy="9" r="5"/><path d="M9 13.5 8 21l4-2.2L16 21l-1-7.5"/></>,
  friends: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17 14.2A5.5 5.5 0 0 1 20.5 19"/></>,
  profile: <><circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  admin: <><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5"/></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,
  sliders: <><path d="M4 8h9M17 8h3"/><circle cx="15" cy="8" r="2"/><path d="M4 16h3M11 16h9"/><circle cx="9" cy="16" r="2"/></>,
  swords: <><path d="M14.5 3H20v5.5L9 19.5 4.5 15z"/><path d="M9.5 3H4v5.5L15 19.5 19.5 15z"/></>,
  pin: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2.2"/><path d="M4 9h16M8 3v4M16 3v4"/></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.4C3.6 6 3 6.7 3 7.6 3 9.6 4.8 11 7 11"/><path d="M17 6h2.6c.8 0 1.4.7 1.4 1.6C21 9.6 19.2 11 17 11"/><path d="M12 14v2.4M9.5 20h5M10 20l.4-3.6h3.2L14 20"/></>,
  chart: <><path d="M4 20V10M9.3 20V4M14.6 20v-8M19.9 20V7"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  star: <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.6l5.8-.8z"/>,
  save: <><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="7"/></>,
  roadmap: <><path d="M4 6h13l3 2.5-3 2.5H4z"/><path d="M4 6v14"/><path d="M4 15h9l3 2.5-3 2.5H4"/></>,
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 2 3 3.5 3 6a5 5 0 0 1-10 0c0-4 3-5 5-13z"/>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.3-2.6 3.9"/><path d="M12 17.3h.01"/></>,
  bug: <><rect x="7" y="8" width="10" height="11" rx="5"/><path d="M12 8V5"/><path d="M9 5.5 8 4M15 5.5 16 4"/><path d="M7 11H3.5M7 15H4M17 11h3.5M17 15h3.5M12 19v2"/></>,
  link: <><path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5l-1.5 1.5"/><path d="M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  share: <><path d="M12 15V4"/><path d="M8.5 7.5 12 4l3.5 3.5"/><path d="M5 12v5.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V12"/></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8"/><path d="M10 12h4"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13 13l-4.6 2.6L11 11z"/></>,
  gear: <><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19"/></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-1 1-1.9-.6-1 .1-2.1 1.3-2.1H17a4 4 0 0 0 4-4c0-5-4-8-9-8z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="16" cy="10.5" r="1"/></>,
  medal: <><circle cx="12" cy="14" r="5"/><path d="M9 9.2 7 3M15 9.2 17 3M10.5 14h3"/></>,
  warning: <><path d="M8.2 3h7.6l5.2 5.2v7.6L15.8 21H8.2L3 15.8V8.2z"/><path d="M12 8v5M12 16.3v.2"/></>,
  'moon-stars': <><path d="M20 14.5A8 8 0 1 1 10.5 4 6.2 6.2 0 0 0 20 14.5z"/><path d="M17.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L15.5 5.5l1.4-.6z"/></>,
  'calendar-check': <><rect x="4" y="5" width="16" height="16" rx="2.2"/><path d="M4 9h16M8 3v4M16 3v4M9 14.5l2 2 4-4"/></>,
  lightning: <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,
  'calendar-star': <><rect x="4" y="5" width="16" height="16" rx="2.2"/><path d="M4 9h16M8 3v4M16 3v4"/><path d="m12 12 .9 1.9 2 .2-1.5 1.4.5 2-1.9-1.1-1.9 1.1.5-2L9.1 14l2-.2z"/></>,
  diamond: <><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 6 9l6 12 6-12-3-6"/></>,
  crown: <path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.4 10.5H5.4z"/>,
  users: <><circle cx="8.5" cy="9" r="2.6"/><path d="M3.8 18a4.7 4.7 0 0 1 9.4 0"/><circle cx="16" cy="9" r="2.2"/><path d="M14.5 14.4A4.6 4.6 0 0 1 20.2 18"/></>,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6"/>,
}

export default function Icon({ name, size = 20, strokeWidth = 1.7, style }: {
  name: IconName; size?: number; strokeWidth?: number; style?: React.CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
