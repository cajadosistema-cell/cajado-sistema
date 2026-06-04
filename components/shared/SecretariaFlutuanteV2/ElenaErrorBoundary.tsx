'use client'
// ── ElenaErrorBoundary.tsx ────────────────────────────────────
// Captura erros não tratados no widget da Elena sem quebrar a página.

import React from 'react'

interface State { hasError: boolean; error?: Error }

export class ElenaErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Elena] Erro não tratado:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
          }}
        >
          <button
            onClick={() => this.setState({ hasError: false })}
            title="Elena teve um problema. Clique para reiniciar."
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
            }}
          >
            🔄
          </button>
          <div style={{
            position: 'absolute',
            bottom: 64,
            right: 0,
            background: '#1a1a2e',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12,
            padding: '8px 12px',
            fontSize: 11,
            color: '#fca5a5',
            whiteSpace: 'nowrap',
          }}>
            Elena reiniciando... clique no botão
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
