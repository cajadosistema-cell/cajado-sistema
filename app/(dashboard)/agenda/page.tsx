import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TabAgenda } from '@/app/(dashboard)/pf-pessoal/_components/tabs/TabAgenda'

export default async function AgendaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <TabAgenda userId={user.id} />
    </div>
  )
}
