import type { Metadata } from 'next'
import SegurancaWAClient from './seguranca-wa-client'

export const metadata: Metadata = { title: 'Segurança WhatsApp' }

export default function SegurancaWAPage() {
  return <SegurancaWAClient />
}
