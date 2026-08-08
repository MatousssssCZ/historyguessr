import { useTranslation } from 'react-i18next'
import { STREAK_ACHIEVEMENTS } from '@/lib/achievements'

// Žebříček milníků série denních výzev — ukazuje všech 7 odznaků, které jsou
// dosažené, a kolik dní zbývá k dalšímu. `tone` řeší tmavé/světlé pozadí.
export default function StreakLadder({ streak, tone = 'light' }: { streak: number; tone?: 'light' | 'dark' }) {
  const { t } = useTranslation()
  const tiers = STREAK_ACHIEVEMENTS.tiers
  const next = tiers.find(x => x.count > streak) ?? null
  const dark = tone === 'dark'
  const fg = dark ? 'rgba(245,241,232,0.92)' : 'var(--ink)'
  const fgDim = dark ? 'rgba(245,241,232,0.45)' : 'var(--ink-3)'
  const cardBg = dark ? 'rgba(255,255,255,0.05)' : 'var(--surface)'
  const border = dark ? 'rgba(255,255,255,0.1)' : 'var(--line)'

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: fg }}>
          🔥 {t('daily.streakTitle', { n: streak })}
        </span>
        {next && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: fgDim }}>
            {t('daily.streakToNext', { n: next.count - streak })} {next.icon}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {tiers.map(tier => {
          const done = streak >= tier.count
          const isNext = next?.count === tier.count
          return (
            <div key={tier.count} style={{
              flex: '0 0 auto', width: 60, textAlign: 'center', borderRadius: 12, padding: '9px 4px',
              background: done ? 'rgba(217,119,87,0.16)' : (dark ? 'rgba(255,255,255,0.04)' : 'var(--paper-200)'),
              border: `1px solid ${isNext ? 'var(--accent)' : 'transparent'}`,
              opacity: done || isNext ? 1 : 0.5,
            }}>
              <div style={{ fontSize: 20, filter: done ? 'none' : 'grayscale(0.6)', lineHeight: 1.1 }}>{tier.icon}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: done ? 'var(--accent-deep)' : fgDim, marginTop: 4 }}>
                {tier.count}{t('daily.streakDayShort')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
