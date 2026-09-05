'use client'

import { PageHeader } from '@/components/shared/ui'
import { TabFluxogramas } from '@/app/(dashboard)/organizacao/_components/TabFluxogramas'

export default function ProcessosClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Processos & Fluxogramas"
        subtitle="Procedimentos Operacionais Padrão (POPs) · Fluxos de Decisão · Guias de Execução"
      />

      <TabFluxogramas />
    </div>
  )
}
