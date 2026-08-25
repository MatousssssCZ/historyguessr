import type { EventStory } from '@/types/database'

// Vykreslení „příběhu" události (Dozvědět se více): titulek + odstavce.
// Když příběh chybí, zobrazí se fallback (krátký popis).
export default function StoryView({ story, fallback }: { story: EventStory | null; fallback?: string }) {
  if (!story) {
    return <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--ink-2)', margin: 0 }}>{fallback}</p>
  }
  return (
    <div>
      {story.titulek && (
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, lineHeight: 1.25, color: 'var(--ink)', margin: '0 0 14px', letterSpacing: '-0.01em' }}>{story.titulek}</h3>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {story.odstavce.map((p, i) => (
          <p key={i} style={{ fontSize: 14.5, lineHeight: 1.78, color: 'var(--ink-2)', margin: 0 }}>{p}</p>
        ))}
      </div>
    </div>
  )
}
