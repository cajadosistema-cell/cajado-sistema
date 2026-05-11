import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TabDiario } from '@/app/(dashboard)/pf-pessoal/_components/tabs/TabDiario'

export default async function DiarioPessoalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <TabDiario userId={user.id} />
    </div>
  )
}
