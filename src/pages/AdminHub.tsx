import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getAdminEvents } from '@/lib/supabase'

type Tile = { icon: string; title: string; sub: string; to: string; showCount?: boolean }
type Group = { label: string; tiles: Tile[] }

const GROUPS: Group[] = [
  {
    label: 'Události',
    tiles: [
      { icon: '🗂', title: 'Správa událostí', sub: 'Přidání, editace, náhledy', to: '/admin/events', showCount: true },
      { icon: '✨', title: 'AI zadávání', sub: 'AI navrhne události + data', to: '/admin/bulk-ai' },
      { icon: '↑', title: 'Hromadný import', sub: 'Import CSV/XLS + šablony', to: '/admin/import' },
    ],
  },
  {
    label: 'Hra',
    tiles: [
      { icon: '🏛', title: 'Kampaně', sub: 'Kategorie, kampaně, odemykání za ★', to: '/admin/campaigns' },
      { icon: '📅', title: 'Denní výzvy', sub: 'Kalendář „Tento den v historii"', to: '/admin/daily' },
    ],
  },
  {
    label: 'Nástroje a údržba',
    tiles: [
      { icon: '🌍', title: 'Kontinenty z GPS', sub: 'Dávkové odvození + kontrola', to: '/admin/continents' },
      { icon: '🖼', title: 'Oprava panoramat', sub: 'Srovnat odkazy se soubory', to: '/admin/panorama-repair' },
    ],
  },
  {
    label: 'Přehled a komunita',
    tiles: [
      { icon: '📊', title: 'Reporting', sub: 'Statistiky a přehledy', to: '/admin/reports' },
      { icon: '🐞', title: 'Hlášení a zpětná vazba', sub: 'Bugy a nápady od hráčů', to: '/admin/feedback' },
      { icon: '🗳️', title: 'Roadmap', sub: 'Vylepšení k hlasování pro předplatitele', to: '/admin/roadmap' },
    ],
  },
]

export default function AdminHubPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [eventCount, setEventCount] = useState<number | null>(null)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])
  useEffect(() => { getAdminEvents().then(r => setEventCount((r.data ?? []).length)).catch(() => {}) }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/menu')}>← Menu</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>⚙️ Administrace</h1>
      </header>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 48px' }}>
        {GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 28 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>{group.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {group.tiles.map(tile => (
                <button key={tile.to} onClick={() => navigate(tile.to)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', background: 'var(--surface)',
                    border: '1px solid var(--line)', borderRadius: 16, padding: '18px 18px',
                    transition: 'transform 140ms, box-shadow 140ms, border-color 140ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md, 0 8px 24px rgba(42,31,23,0.1))'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{tile.icon}</span>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tile.title}
                      {tile.showCount && eventCount != null && <span className="badge badge-neutral">{eventCount}</span>}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>{tile.sub}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
