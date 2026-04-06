import type { Metadata } from 'next'
import ComissoesClient from './comissoes-client'

export const metadata: Metadata = { 
  title: 'Parceiros e Comissões | Cajado' 
}

export default function ComissoesPage() {
  return <ComissoesClient />
}
