import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { repairPanoramaLinks, type PanoramaRepairResult } from '@/lib/supabase'

// Admin-only, česky (dle pravidla projektu).
export default function AdminPanoramaRepairPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [result, setResult] = useState<PanoramaRepairResult | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  async function run() {
    setRunning(true); setResult(null)
    try {
      const r = await repairPanoramaLinks((done, total) => setProgress({ done, total }))
      setResult(r)
    } catch (e) {
      alert('Oprava selhala: ' + (e as Error).message)
    }
    setRunning(false); setProgress(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>🖼 Oprava odkazů panoramat</h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>Srovná DB odkazy se soubory v úložišti · opraví rozbité (.png vs .webp)</p>
        </div>
      </header>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Některé starší události mají v DB odkaz na panorama s příponou (.png/.jpg), ale skutečný
            soubor je .webp (komprese ho převedla) → nenačte se. Tenhle nástroj u každé události
            zkontroluje, zda odkaz míří na existující soubor, a rozbité přesměruje na reálný soubor
            (přednostně .webp). Opravuje i náhledy. Funkční odkazy nechává být.
          </p>
          <button className="btn btn-accent" disabled={running} onClick={run}>
            {running ? 'Kontroluji…' : '↻ Zkontrolovat a opravit'}
          </button>
          {progress && (
            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
              {progress.done} / {progress.total}
            </div>
          )}
        </div>

        {result && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
              <Stat label="Zkontrolováno" value={result.total}/>
              <Stat label="Opraveno" value={result.fixed} accent="#5c9468"/>
              <Stat label="K řešení" value={result.problems.length} accent={result.problems.length ? '#c0392b' : undefined}/>
            </div>
            {result.fixed > 0 && (
              <p style={{ fontSize: 13, color: '#3f7a4d', marginBottom: 14 }}>✓ Opraveno {result.fixed} odkazů — panoramata by se teď měla načíst.</p>
            )}
            {result.problems.length > 0 && (
              <div>
                <p className="eyebrow" style={{ marginBottom: 10 }}>K ruční kontrole ({result.problems.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.problems.map(p => (
                    <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{p.title}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#c0392b', marginTop: 2 }}>{p.note}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>
                  Tyhle nemají v úložišti žádný panorama soubor — je potřeba je znovu nahrát v editaci události.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: accent ?? 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
