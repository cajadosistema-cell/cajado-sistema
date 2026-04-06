import type { Metadata } from 'next'
import InboxClient from './inbox-client'

export const metadata: Metadata = { 
  title: 'Inbox WhatsApp | Cajado' 
}

export default function InboxPage() {
  return <InboxClient />
}
