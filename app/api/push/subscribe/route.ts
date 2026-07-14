import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ════════════════════════════════════════════════════════════════
// POST /api/push/subscribe — registra o dispositivo para push
//
// 🔴 BUGS CORRIGIDOS:
//
// 1. COLUNAS INEXISTENTES — a versão antiga gravava `user_agent` e
//    `updated_at`, que NÃO existiam na tabela. Com `if (error) throw`,
//    TODA inscrição retornava HTTP 500. A tabela push_subscriptions
//    ficou vazia — e o send-push enviava notificação para ninguém.
//    Os alertas do Sr. Max nunca funcionaram com o app fechado.
//    (Colunas adicionadas na migration 066.)
//
// 2. onConflict ERRADO — a tabela tem DUAS constraints:
//        UNIQUE (endpoint)             ← a que realmente importa
//        UNIQUE (user_id, endpoint)
//    O código usava `onConflict: 'user_id,endpoint'`, que não resolve a
//    primeira. Se o Sr. Max saísse e outro usuário entrasse no MESMO
//    navegador, o endpoint seria o mesmo e o insert violaria
//    UNIQUE(endpoint) → erro 23505.
//    Um endpoint = um dispositivo = um usuário atual. onConflict correto
//    é 'endpoint': ao trocar de usuário, o dispositivo passa a ser dele.
// ════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { subscription, userId } = await req.json()

    if (!subscription?.endpoint || !userId) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    if (!subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Chaves da subscription ausentes' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id:    userId,
        endpoint:   subscription.endpoint,
        p256dh:     subscription.keys.p256dh,
        auth:       subscription.keys.auth,
        user_agent: (req.headers.get('user-agent') || '').substring(0, 300),
        updated_at: new Date().toISOString(),
      }, {
        // ✅ 'endpoint' — não 'user_id,endpoint'.
        // Se outro usuário logar no mesmo dispositivo, o registro é
        // reaproveitado e o user_id é atualizado, em vez de estourar
        // a constraint UNIQUE(endpoint).
        onConflict: 'endpoint',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[push/subscribe] ❌ falhou:', error.message, error.details || '')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[push/subscribe] ✅ dispositivo registrado para ${userId}`)
    return NextResponse.json({ ok: true, id: data?.id })

  } catch (err: any) {
    console.error('[push/subscribe] exceção:', err?.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE /api/push/subscribe — remove o dispositivo ───────────
export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { endpoint, userId } = await req.json()
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint obrigatório' }, { status: 400 })
    }

    // 🔴 O erro também era descartado aqui (nenhum `if (error)`).
    let q = supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (userId) q = q.eq('user_id', userId)

    const { error } = await q
    if (error) {
      console.error('[push/subscribe] DELETE falhou:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
