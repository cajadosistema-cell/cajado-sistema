import type { Metadata } from 'next'
import TraderClient from './trader-client'

export const metadata: Metadata = { title: 'Trader' }

export default function TraderPage() {
  return <TraderClient />
}
