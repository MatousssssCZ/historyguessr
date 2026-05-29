import { useNavigate } from 'react-router-dom'

export default function PrivacyPage() {
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
            Zásady ochrany osobních údajů
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

          <Section title="1. Kdo jsme">
            <p>HistoryGuessr je vzdělávací webová hra dostupná na adrese historyguessr.vercel.app. Provozovatelem aplikace je [jméno/firma].</p>
          </Section>

          <Section title="2. Jaké údaje sbíráme">
            <p>Při registraci a používání aplikace shromažďujeme:</p>
            <ul>
              <li><strong>E-mailová adresa</strong> — pro přihlášení a komunikaci</li>
              <li><strong>Uživatelské jméno</strong> — zobrazované v žebříčcích</li>
              <li><strong>Herní statistiky</strong> — počet her, skóre, výsledky kol</li>
              <li><strong>Analytická data</strong> — anonymizované události (spuštění hry, dokončení kola) pro zlepšení aplikace</li>
            </ul>
          </Section>

          <Section title="3. K čemu údaje používáme">
            <ul>
              <li>Provoz uživatelských účtů a autentizace</li>
              <li>Zobrazení žebříčků a herních statistik</li>
              <li>Zlepšování aplikace na základě anonymizovaných dat</li>
              <li>Zasílání důležitých oznámení o aplikaci (není marketing)</li>
            </ul>
          </Section>

          <Section title="4. Jak data chráníme">
            <p>Vaše data jsou uložena v zabezpečené cloudové databázi (Supabase). Přístup k datům je chráněn pomocí Row Level Security — každý uživatel vidí pouze vlastní data.</p>
          </Section>

          <Section title="5. Sdílení dat">
            <p>Vaše osobní údaje neprodáváme ani nesdílíme s třetími stranami, s výjimkou nezbytných technických providerů (Supabase pro databázi, Vercel pro hosting).</p>
          </Section>

          <Section title="6. Vaše práva">
            <p>Máte právo na přístup ke svým datům, jejich opravu nebo smazání. Pro smazání účtu nás kontaktujte na [email].</p>
          </Section>

          <Section title="7. Cookies">
            <p>Aplikace používá pouze technicky nezbytné cookies pro udržení přihlášení. Nepoužíváme sledovací ani reklamní cookies.</p>
          </Section>

          <Section title="8. Kontakt" last>
            <p>Dotazy ohledně ochrany osobních údajů zasílejte na: <strong>[email]</strong></p>
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
