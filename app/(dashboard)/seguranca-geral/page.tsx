import type { Metadata } from 'next'
import SegurancaGeralClient from './seguranca-geral-client'
export const metadata: Metadata = { title: 'Segurança Geral' }
export default function SegurancaGeralPage() { return <SegurancaGeralClient /> }
