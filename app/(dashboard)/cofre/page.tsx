import { createClient } from '@/lib/supabase/client'
import CofreClient from './cofre-client'

export const metadata = {
  title: 'Cofre de Senhas | Cajado Sistema',
  description: 'Guardar senhas com criptografia AES-256. Seus dados nunca chegam ao servidor descriptografados.',
}

export default function CofrePage() {
  return <CofreClient />
}
