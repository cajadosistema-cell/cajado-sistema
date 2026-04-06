import type { Metadata } from 'next'
import SuperAdminClient from './empresas-client'

export const metadata: Metadata = { 
  title: 'Clientes SaaS | Cajado Admin' 
}

export default function SuperAdminPage() {
  return <SuperAdminClient />
}
