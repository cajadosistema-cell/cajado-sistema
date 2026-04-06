import type { Metadata } from 'next'
import FinanceiroClient from './financeiro-client'

export const metadata: Metadata = { title: 'Financeiro' }

export default function FinanceiroPage() {
  return <FinanceiroClient />
}
