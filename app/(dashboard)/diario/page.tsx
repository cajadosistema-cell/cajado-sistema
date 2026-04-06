import type { Metadata } from 'next'
import DiarioEstrategicoClient from './diario-client'

export const metadata: Metadata = { 
  title: 'Diário Estratégico | Cajado' 
}

export default function DiarioPage() {
  return <DiarioEstrategicoClient />
}
