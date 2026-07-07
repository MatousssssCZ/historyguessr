// Sépiový „hledající kompas" — jednotný loader napříč appkou.
// Světlá varianta (light) pro papírová pozadí, jinak akcentní na tmavém.
export default function CompassLoader({ size = 76, light = false }: { size?: number; light?: boolean }) {
  const ring = light ? 'var(--accent)' : 'var(--accent)'
  const dial = light ? 'rgba(42,31,23,0.22)' : 'rgba(245,241,232,0.28)'
  const ticks = light ? 'rgba(42,31,23,0.35)' : 'rgba(245,241,232,0.4)'
  const southArrow = light ? 'rgba(42,31,23,0.5)' : 'rgba(245,241,232,0.75)'
  const glowA = 'rgba(217,119,87,0.9)'
  const glowB = 'rgba(217,119,87,0.9)'

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${ring}`, animation: 'pulseRing 1.8s ease-out infinite', boxShadow: `0 0 0 0 ${glowA}` }}/>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${ring}`, animation: 'pulseRing 1.8s ease-out infinite', animationDelay: '0.9s', boxShadow: `0 0 0 0 ${glowB}` }}/>
      {/* statický kruh kompasu */}
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0 }} fill="none" stroke={dial} strokeWidth="1">
        <circle cx="12" cy="12" r="10.5"/>
        <path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2" stroke={ticks} strokeWidth="1.2"/>
      </svg>
      {/* rotující střelka */}
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0, animation: 'spin 2.8s cubic-bezier(0.5,0,0.5,1) infinite' }}>
        <polygon points="12,3.5 9.6,12 14.4,12" fill="var(--accent)"/>
        <polygon points="12,20.5 9.6,12 14.4,12" fill={southArrow}/>
        <circle cx="12" cy="12" r="1.4" fill={light ? 'var(--accent)' : '#fff'}/>
      </svg>
    </div>
  )
}
