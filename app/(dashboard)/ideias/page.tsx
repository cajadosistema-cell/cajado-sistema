import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TabIdeias } from '@/app/(dashboard)/pf-pessoal/_components/tabs/TabIdeias'

export default async function IdeiasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <TabIdeias userId={user.id} />
    </div>
  )
}
