import type { Metadata } from 'next'
import PfPessoalClient from './pf-pessoal-client'

export const metadata: Metadata = { title: 'PF Pessoal — Sistema Cajado' }

export default function PfPessoalPage() {
  return <PfPessoalClient />
}
