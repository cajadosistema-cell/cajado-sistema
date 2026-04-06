import type { Metadata } from 'next'
import PosVendaClient from './pos-venda-client'

export const metadata: Metadata = { 
  title: 'Pós-venda | Cajado' 
}

export default function PosVendaPage() {
  return <PosVendaClient />
}
