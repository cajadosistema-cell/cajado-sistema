import type { Metadata } from 'next'
import VendasClient from './vendas-client'

export const metadata: Metadata = { 
  title: 'Vendas e Ordens de Serviço | Cajado' 
}

export default function VendasPage() {
  return <VendasClient />
}
