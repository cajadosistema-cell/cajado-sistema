'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import { TabOportunidades } from './_components/TabOportunidades'
import { TabOKRs } from './_components/TabOKRs'
import { SecretariaFlutuante } from '@/components/shared/SecretariaFlutuante'

export default function ExpansaoClient() {
  const [tab, setTab] = useState<'oportunidades' | 'okrs'>('oportunidades')

  return (
    <>
      <PageHeader 
        title="Expansão Estratégica" 
        subtitle="Planejamento · Oportunidades · Novos Mercados · OKRs Estratégicos"
      />

      <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'oportunidades', label: '🚀 Oportunidades & Inovação' },
          { key: 'okrs', label: '🎯 Planejamento Estratégico (OKRs)' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {tab === 'oportunidades' && <TabOportunidades />}
        {tab === 'okrs' && <TabOKRs />}
      </div>

      {/* Secretária Flutuante do Patrão */}
      <SecretariaFlutuante />
    </>
  )
}
