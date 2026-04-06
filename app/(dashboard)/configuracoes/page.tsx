import type { Metadata } from 'next'
import ConfiguracoesClient from './configuracoes-client'

export const metadata: Metadata = {
  title: 'Configurações | Sistema Cajado',
}

export default function ConfiguracoesPage() {
  return <ConfiguracoesClient />
}
