import type { Metadata } from 'next'
import OnboardingClient from './onboarding-client'

export const metadata: Metadata = { 
  title: 'Nova Empresa | Cajado SaaS' 
}

export default function OnboardingPage() {
  return <OnboardingClient />
}
