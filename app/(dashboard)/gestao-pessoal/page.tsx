import { Metadata } from 'next'
import GestaoPessoalClient from './gestao-pessoal-client'

export const metadata: Metadata = {
  title: 'Gestão Pessoal | Cajado'
}

export default function GestaoPessoalPage() {
  return <GestaoPessoalClient />
}
