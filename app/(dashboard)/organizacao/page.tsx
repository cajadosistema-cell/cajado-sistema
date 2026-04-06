import type { Metadata } from 'next'
import OrganizacaoClient from './organizacao-client'

export const metadata: Metadata = { title: 'Organização' }

export default function OrganizacaoPage() {
  return <OrganizacaoClient />
}
