import { useNavigate } from 'react-router-dom'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 24px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost"
          style={{ padding: '7px 12px', fontSize: 13 }}
        >
          ← Zpět
        </button>
        <div>
          <div className="eyebrow" style={{ fontSize: 9 }}>HistoryGuessr</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>
            Podmínky použití
          </h1>
        </div>
      </header>

      {/* Obsah */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

        <div className="card" style={{ padding: '24px 32px', marginBottom: 20 }}>
          <div style={{
            background: 'rgba(217,119,87,0.08)',
            border: '1px solid rgba(217,119,87,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 28,
          }}>
            <p style={{ fontSize: 13, color: 'var(--accent-deep)', margin: 0 }}>
              ⚠ Tento dokument je připravovaný placeholder. Finální znění bude doplněno před veřejným spuštěním.
            </p>
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 32 }}>
            Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
          </p>

          <Section title="1. Přijetí podmínek">
            <p>Používáním aplikace HistoryGuessr souhlasíte s těmito podmínkami použití. Pokud nesouhlasíte, aplikaci prosím nepoužívejte.</p>
          </Section>

          <Section title="2. Popis služby">
            <p>HistoryGuessr je bezplatná vzdělávací hra, ve které hráči tipují polohu a rok historických událostí na základě 360° panoramatických fotografií.</p>
          </Section>

          <Section title="3. Uživatelský účet">
            <ul>
              <li>Registrace vyžaduje platnou e-mailovou adresu</li>
              <li>Za bezpečnost svého účtu a hesla odpovídáte vy</li>
              <li>Jeden uživatel smí mít pouze jeden účet</li>
              <li>Uživatelské jméno nesmí být urážlivé nebo klamavé</li>
            </ul>
          </Section>

          <Section title="4. Pravidla chování">
            <p>Zakazuje se:</p>
            <ul>
              <li>Manipulace se žebříčky nebo skóre pomocí technických prostředků</li>
              <li>Automatizované hraní (boti)</li>
              <li>Pokusy o narušení bezpečnosti aplikace</li>
              <li>Šíření obsahu, který poškozuje ostatní uživatele</li>
            </ul>
          </Section>

          <Section title="5. Obsah aplikace">
            <p>Historické události, panoramata a popisky v aplikaci jsou shromažďovány za vzdělávacím účelem. Provozovatel si vyhrazuje právo kdykoli upravit nebo odstranit jakýkoli obsah.</p>
          </Section>

          <Section title="6. Dostupnost služby">
            <p>Aplikace je poskytována „jak stojí a leží". Neposkytujeme záruku nepřetržité dostupnosti ani přesnosti herního obsahu. Vyhrazujeme si právo aplikaci kdykoli upravit nebo ukončit.</p>
          </Section>

          <Section title="7. Odpovědnost">
            <p>Provozovatel neodpovídá za jakékoli škody vzniklé v důsledku používání nebo nedostupnosti aplikace.</p>
          </Section>

          <Section title="8. Změny podmínek">
            <p>Podmínky použití můžeme kdykoli aktualizovat. O zásadních změnách budeme uživatele informovat e-mailem.</p>
          </Section>

          <Section title="9. Kontakt" last>
            <p>Dotazy ohledně podmínek použití zasílejte na: <strong>[email]</strong></p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 28, paddingBottom: last ? 0 : 28, borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}
