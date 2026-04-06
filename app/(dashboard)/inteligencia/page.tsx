import type { Metadata } from 'next'
import InteligenciaClient from './inteligencia-client'
export const metadata: Metadata = { title: 'Inteligência' }
export default function InteligenciaPage() { return <InteligenciaClient /> }
