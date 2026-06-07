import { NextResponse } from 'next/server'

export const maxDuration = 30

/**
 * POST /api/organizar-ideia
 *
 * Recebe texto bruto (falado pelo Sr. Max) e retorna a ideia organizada:
 * { titulo, descricao, categoria }
 *
 * Usa OpenRouter + Claude Sonnet (mesmo stack da Elena).
 */
export async function POST(req: Request) {
  try {
    const { texto } = await req.json()

    if (!texto?.trim()) {
      return NextResponse.json({ error: 'Texto vazio.' }, { status: 400 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      // Fallback sem IA: usa o texto bruto como título
      return NextResponse.json({
        titulo: texto.trim().substring(0, 120),
        descricao: texto.trim(),
        categoria: 'geral',
      })
    }

    const systemPrompt = `Você é um organizador de ideias. Receba um texto falado (transcrição de voz) e extraia:
1. "titulo": Título curto e claro (máx 80 caracteres)
2. "descricao": Descrição organizada com detalhes relevantes
3. "categoria": Uma entre: negocio, produto, pessoal, financeiro, saude, criativo, geral

Responda APENAS com JSON válido, sem markdown, sem backticks, sem explicação.
Exemplo: {"titulo":"App de Delivery Pet","descricao":"Criar plataforma de delivery para pet shops com assinatura mensal","categoria":"negocio"}`

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://cajado-sistema.vercel.app',
        'X-Title': 'Cajado - Organizador de Ideias',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: texto.trim() },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[Organizar Ideia] OpenRouter error:', data.error?.message)
      // Fallback: salva texto bruto
      return NextResponse.json({
        titulo: texto.trim().substring(0, 120),
        descricao: texto.trim(),
        categoria: 'geral',
      })
    }

    const resposta = data.choices?.[0]?.message?.content ?? ''

    try {
      // Tenta parsear o JSON da resposta
      const cleaned = resposta.replace(/```json\s*/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)

      // Valida os campos
      const categoriasValidas = ['negocio', 'produto', 'pessoal', 'financeiro', 'saude', 'criativo', 'geral']
      return NextResponse.json({
        titulo: (parsed.titulo || texto.trim().substring(0, 120)).substring(0, 120),
        descricao: parsed.descricao || texto.trim(),
        categoria: categoriasValidas.includes(parsed.categoria) ? parsed.categoria : 'geral',
      })
    } catch {
      // JSON inválido — fallback
      return NextResponse.json({
        titulo: texto.trim().substring(0, 120),
        descricao: texto.trim(),
        categoria: 'geral',
      })
    }

  } catch (err: any) {
    console.error('[Organizar Ideia]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
