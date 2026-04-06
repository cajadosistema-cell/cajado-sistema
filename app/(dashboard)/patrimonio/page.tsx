import type { Metadata } from 'next'
import PatrimonioClient from './patrimonio-client'
export const metadata: Metadata = { title: 'Patrimônio' }
export default function PatrimonioPage() { return <PatrimonioClient /> }
