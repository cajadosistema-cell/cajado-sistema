import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Tabelas incluídas no backup
const TABELAS = [
  'lancamentos',
  'leads',
  'ocorrencias',
  'chat_interno',
  'gastos_pessoais',
  'receitas_pessoais',
  'agenda_eventos',
  'elena_conversas',
  'elena_ideias',
  'funcionarios',
  'clientes',
  'produtos',
  'contas',
  'categorias',
  'configuracoes_empresa',
  'comissoes',
]

export async function GET() {
  try {
    // Usa service role para ter acesso irrestrito a todas as tabelas
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const backup: Record<string, any[]> = {}
    const erros: string[] = []

    for (const tabela of TABELAS) {
      try {
        const { data, error } = await supabase.from(tabela).select('*')
        if (error) erros.push(`${tabela}: ${error.message}`)
        else backup[tabela] = data ?? []
      } catch {
        erros.push(`${tabela}: tabela não encontrada (ignorada)`)
      }
    }

    const payload = {
      meta: {
        sistema: 'Cajado Sistema v2.0',
        gerado_em: new Date().toISOString(),
        total_tabelas: Object.keys(backup).length,
        total_registros: Object.values(backup).reduce((s, v) => s + v.length, 0),
        erros_ignorados: erros,
      },
      dados: backup,
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cajado-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
