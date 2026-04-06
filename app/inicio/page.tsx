import type { Metadata } from 'next'
import InicioClient from './inicio-client'
export const metadata: Metadata = { title: 'Dashboard Geral - Cajado' }
export default function InicioPage() { return <InicioClient /> }

// force reload
