import type { Metadata } from 'next'
import CajadoClient from './cajado-client'

export const metadata: Metadata = { title: 'Cajado Empresa' }

export default function CajadoPage() {
  return <CajadoClient />
}
