import { Metadata } from 'next'
import ManualClient from './manual-client'

export const metadata: Metadata = {
  title: 'Manual do Sistema | Cajado Soluções',
  description: 'Guia completo de uso do Cajado Sistema v2.0',
}

export default function ManualPage() {
  return <ManualClient />
}
