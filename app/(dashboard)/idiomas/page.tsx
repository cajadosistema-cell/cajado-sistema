import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TabIdiomas } from '@/app/(dashboard)/pf-pessoal/_components/tabs/TabIdiomas'

export default async function IdiomasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <TabIdiomas userId={user.id} />
    </div>
  )
}
