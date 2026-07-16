import { useTranslation } from 'react-i18next'

export const YEAR_MIN = -3000
export const YEAR_MAX = 2025

// Rozsah let — dva posuvníky (tažitelný dvojitý slider) + číselná pole.
// Sdílené mezi singleplayerem (PreGameLobby) a multiplayerem (MultiplayerLobby).
export default function YearRange({ from, to, onFrom, onTo }: {
  from: number; to: number; onFrom: (v: number) => void; onTo: (v: number) => void
}) {
  const span = YEAR_MAX - YEAR_MIN
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const leftPct = ((lo - YEAR_MIN) / span) * 100
  const rightPct = ((hi - YEAR_MIN) / span) * 100

  // Když se úchyty kříží, „od" řídí spodní hodnotu a „do" horní
  function handleFrom(v: number) { if (v <= to) onFrom(v); else { onFrom(to); onTo(v) } }
  function handleTo(v: number) { if (v >= from) onTo(v); else { onTo(from); onFrom(v) } }

  const { t } = useTranslation()
  return (
    <div>
      {/* Tažitelný dvojitý posuvník */}
      <div className="range-dual" style={{ margin: '4px 2px 14px' }}>
        {/* podkladová dráha */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 6, transform: 'translateY(-50%)', background: 'var(--paper-300)', borderRadius: 99 }}/>
        {/* vybraný rozsah */}
        <div style={{ position: 'absolute', top: '50%', height: 6, transform: 'translateY(-50%)', left: `${leftPct}%`, right: `${100 - rightPct}%`, background: 'linear-gradient(90deg, #5b7fa6, var(--accent))', borderRadius: 99 }}/>
        <input type="range" min={YEAR_MIN} max={YEAR_MAX} value={from} onChange={e => handleFrom(Number(e.target.value))} aria-label="Rok od"/>
        <input type="range" min={YEAR_MIN} max={YEAR_MAX} value={to} onChange={e => handleTo(Number(e.target.value))} aria-label="Rok do"/>
      </div>
      {/* Číselná pole */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <YearBox label={t('pregame.from')} value={from} onChange={handleFrom}/>
        <span style={{ color: 'var(--ink-3)' }}>→</span>
        <YearBox label={t('pregame.to')} value={to} onChange={handleTo}/>
      </div>
    </div>
  )
}

function YearBox({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation()
  const isBc = value < 0
  return (
    <label style={{ flex: 1, border: '1px solid var(--line-strong)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', cursor: 'text' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        {label} <span style={{ color: isBc ? '#5b7fa6' : 'var(--accent-deep)' }}>{isBc ? t('pregame.bc') : t('pregame.ad')}</span>
      </span>
      <input
        type="number" min={YEAR_MIN} max={YEAR_MAX} value={value}
        onChange={e => onChange(Math.max(YEAR_MIN, Math.min(YEAR_MAX, Number(e.target.value))))}
        style={{
          border: 'none', outline: 'none', background: 'transparent', width: '100%',
          fontFamily: 'var(--font-serif)', fontSize: 18, padding: 0,
          color: isBc ? '#5b7fa6' : 'var(--accent-deep)',
        }}
      />
    </label>
  )
}
