import type { Metadata } from 'next'
import InvestimentosClient from './investimentos-client'
export const metadata: Metadata = { title: 'Investimentos' }
export default function InvestimentosPage() { return <InvestimentosClient /> }
