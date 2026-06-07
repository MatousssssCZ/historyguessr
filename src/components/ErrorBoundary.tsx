import { Component, type ReactNode } from 'react'
import i18n from '@/i18n'

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string }

// Záchrana proti bílé obrazovce — když cokoli v renderu spadne, ukáže
// se nouzová obrazovka s tlačítky místo prázdné stránky.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) }
  }

  componentDidCatch(err: unknown) {
    console.error('[ErrorBoundary]', err)
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
      </div>
    )
  }
}
