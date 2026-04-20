import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_INBOX_API_URL || 'http://localhost:3001'

/**
 * POST /api/whatsapp/enviar
 * Body: { numero: string, mensagem: string, token?: string }
 *
 * Encaminha o envio de mensagem para o backend Evolution API.
 * Retorna { ok: true } em caso de sucesso.
 */
export async function POST(req: NextRequest) {
  try {
    const { numero, mensagem } = await req.json()

    if (!numero || !mensagem) {
      return NextResponse.json({ ok: false, erro: 'número e mensagem são obrigatórios' }, { status: 400 })
    }

    // Pega o token de auth do header para repassar ao backend
    const authHeader = req.headers.get('authorization') || ''

    const resp = await fetch(`${BACKEND_URL}/api/whatsapp/enviar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ numero, mensagem }),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return NextResponse.json({ ok: false, erro: err?.erro || 'Erro ao enviar mensagem' }, { status: resp.status })
    }

    const data = await resp.json()
    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    console.error('[/api/whatsapp/enviar]', err?.message)
    return NextResponse.json({ ok: false, erro: 'Serviço de WhatsApp indisponível' }, { status: 503 })
  }
}
