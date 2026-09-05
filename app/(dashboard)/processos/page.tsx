import type { Metadata } from 'next'
import ProcessosClient from './processos-client'

export const metadata: Metadata = { title: 'Processos & Fluxogramas' }

export default function ProcessosPage() {
  return <ProcessosClient />
}
