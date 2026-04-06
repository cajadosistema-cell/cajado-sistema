import type { Metadata } from 'next'
import ConfiguracoesBotClient from './bot-client'

export const metadata: Metadata = { 
  title: 'Meu Bot WA | Cajado SaaS' 
}

export default function ConfiguracoesBotPage() {
  return <ConfiguracoesBotClient />
}
