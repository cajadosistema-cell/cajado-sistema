import { Metadata } from 'next'
import DashboardPessoalClient from './dashboard-pessoal-client'

export const metadata: Metadata = {
  title: 'Dashboard Pessoal | Cajado Sistema',
  description: 'Visão geral das suas finanças pessoais, patrimônio e agenda',
}

export default function DashboardPessoalPage() {
  return <DashboardPessoalClient />
}
