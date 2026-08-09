import { Component, type ReactNode } from 'react'
import i18n from '@/i18n'
import { submitFeedback } from '@/lib/feedback'
import { Sentry } from '@/lib/sentry'

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string; reporting: boolean; note: string; sent: boolean }

// Záchrana proti bílé obrazovce — když cokoli v renderu spadne, ukáže
// se nouzová obrazovka s tlačítky (a možností nahlásit problém) místo prázdné stránky.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, reporting: false, note: '', sent: false }

  static getDerivedStateFromError(err: unknown): Partial<State> {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) }
  }

  componentDidCatch(err: unknown) {
    console.error('[ErrorBoundary]', err)
    Sentry.captureException(err)
  }

  private async sendReport() {
    const context = `Chyba: ${this.state.message ?? '—'}\nStránka: ${location.pathname}`
    const body = this.state.note.trim() ? `${this.state.note.trim()}\n\n---\n${context}` : context
    try { await submitFeedback('bug', body) } catch { /* best-effort */ }
    this.setState({ sent: true })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const t = (k: string, fb: string) => {
      const v = i18n.t(k)
      return v === k ? fb : v
    }
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
        background: 'var(--paper-200)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: 0 }}>
          {t('common.errorTitle', 'Něco se pokazilo')}
        </h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, maxWidth: 420, margin: 0 }}>
          {t('common.errorBody', 'Aplikaci se nepodařilo zobrazit. Zkus obnovit stránku nebo se vrátit do menu.')}
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button className="btn btn-accent" onClick={() => window.location.reload()}>
            {t('common.reload', 'Obnovit')}
          </button>
          <button className="btn btn-ghost" onClick={() => { window.location.href = '/menu' }}>
            {t('common.toMenu', 'Do menu')}
          </button>
        </div>

        {/* Nahlášení problému */}
        {this.state.sent ? (
          <p style={{ color: 'var(--success-deep, #3f7a4d)', fontSize: 13, marginTop: 4 }}>
            {t('feedback.thanksTitle', 'Děkujeme za nahlášení!')}
          </p>
        ) : this.state.reporting ? (
          <div style={{ width: '100%', maxWidth: 420, marginTop: 4 }}>
            <textarea
              value={this.state.note}
              onChange={e => this.setState({ note: e.target.value })}
              maxLength={2000}
              rows={3}
              placeholder={t('feedback.crashPlaceholder', 'Co jsi dělal(a), když to spadlo? (nepovinné)')}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line-strong)',
                borderRadius: 11, padding: '11px 13px', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--ink)', marginBottom: 10, resize: 'vertical',
              }}
            />
            <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => this.sendReport()}>
              {t('feedback.send', 'Odeslat hlášení')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => this.setState({ reporting: true })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, textDecoration: 'underline', marginTop: 2 }}
          >
            {t('feedback.reportProblem', 'Nahlásit problém')}
          </button>
        )}
      </div>
    )
  }
}
