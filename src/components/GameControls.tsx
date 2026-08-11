import { useTranslation } from 'react-i18next'

export const GREEN = '#27ae60'
// Neprůhlednější sklo + stín → dlaždice líp „vyskočí" z panoramatu.
export const GLASS = 'rgba(250,247,240,0.94)'
const TILE_SHADOW = '0 8px 22px -6px rgba(0,0,0,0.5)'

function PinIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" stroke={color} strokeWidth="2.2"/>
      <circle cx="12" cy="9" r="2.4" fill={color}/>
    </svg>
  )
}
function CalIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="2"/>
      <path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth="2"/>
    </svg>
  )
}

const TILE_W = 184  // 2× původní šířka

function MapTile({ set, onClick }: { set: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={{
      width: TILE_W, borderRadius: 18, padding: '11px 15px', cursor: 'pointer', border: 'none',
      display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
      background: set ? GREEN : 'var(--accent)', color: '#fff',
      boxShadow: set ? '0 12px 26px -6px rgba(39,174,96,0.5)' : '0 12px 26px -6px rgba(190,98,64,0.5)',
    }}>
      <PinIcon color="#fff"/>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13 }}>{t('game.mapTile')}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{set ? `✓ ${t('game.placeHint')}` : t('game.mapCta')}</span>
      </span>
    </button>
  )
}

function YearTile({ guessYear, guessYearSet, onClick }: { guessYear: number; guessYearSet: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  const bc = guessYear < 0
  const set = guessYearSet
  const label = set ? `${Math.abs(guessYear)} ${bc ? t('game.bcShort') : t('game.adShort')}` : '—'
  return (
    <button onClick={onClick} style={{
      width: TILE_W, borderRadius: 18, padding: '11px 15px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
      background: set ? GREEN : GLASS, backdropFilter: set ? 'none' : 'blur(14px)',
      border: set ? 'none' : '1px solid rgba(255,255,255,0.7)',
      boxShadow: set ? '0 12px 26px -6px rgba(39,174,96,0.5)' : TILE_SHADOW,
      color: set ? '#fff' : 'var(--ink)',
    }}>
      <CalIcon color={set ? '#fff' : 'var(--accent)'}/>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: set ? 700 : 600, fontSize: 13, color: set ? '#fff' : '#26211C' }}>{t('game.year')}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: set ? 'rgba(255,255,255,0.85)' : '#8C8175', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{set ? `✓ ${label}` : t('game.yearCta')}</span>
      </span>
    </button>
  )
}

/** Ovládací dock (dle #1b): hint pilulka vlevo + svislé dlaždice Rok/Mapa vpravo + Odeslat. */
export default function ControlDock({ set, guessYear, guessYearSet, canSubmit, submitLabel, submitting, onMap, onYear, onSubmit }: {
  set: boolean; guessYear: number; guessYearSet: boolean; canSubmit: boolean; submitLabel: string; submitting?: boolean
  onMap: () => void; onYear: () => void; onSubmit: () => void
}) {
  const { t } = useTranslation()
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ pointerEvents: 'auto', flexShrink: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(250,247,240,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 14px -4px rgba(0,0,0,0.4)', borderRadius: 20, padding: '8px 12px', color: '#4a4033', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11 }}>
          <span style={{ flexShrink: 0 }}>✥</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('game.dragHint')}</span>
        </span>
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
          <YearTile guessYear={guessYear} guessYearSet={guessYearSet} onClick={onYear}/>
          <MapTile set={set} onClick={onMap}/>
        </div>
      </div>
      {canSubmit && (
        <button onClick={onSubmit} disabled={submitting} style={{
          pointerEvents: 'auto', width: '100%', marginTop: 12, fontSize: 15, padding: '14px 0', borderRadius: 14,
          border: 'none', fontFamily: 'var(--font-sans)', fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
          background: GREEN, color: '#fff', boxShadow: '0 8px 24px -6px rgba(39,174,96,0.5)', opacity: submitting ? 0.7 : 1,
        }}>{submitLabel}</button>
      )}
    </div>
  )
}
