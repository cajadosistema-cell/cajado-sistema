import { NextResponse } from 'next/server'

/**
 * POST /api/busca-web
 * Realiza busca na internet usando Perplexity Sonar via OpenRouter.
 * Perplexity Sonar tem acesso à web em tempo real — ideal para comparação de preços.
 */
export async function POST(req: Request) {
  try {
    const { query, contexto } = await req.json()

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Consulta de busca vazia' }, { status: 400 })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }

    const systemPrompt = `Você é um assistente de pesquisa especializado em mercado brasileiro.
Quando buscar preços, sempre:
- Mencione de qual loja/site o preço vem
- Compare pelo menos 3 fontes quando possível
- Informe se o preço inclui ou não frete
- Mencione a data da pesquisa
- Use R$ com valores em reais brasileiros
- Seja objetivo e direto, sem enrolação
- Se não encontrar dados concretos, diga claramente

Responda sempre em português brasileiro.`

    const userPrompt = contexto
      ? `${contexto}\n\nPesquise agora: ${query}`
      : query

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://cajado-sistema.vercel.app',
        'X-Title': 'Cajado Elena Busca Web',
      },
      body: JSON.stringify({
        // Perplexity Sonar tem acesso à internet em tempo real
        model: 'perplexity/sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.2, // baixa temperatura para respostas factuais
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      // Fallback para sonar básico se sonar-pro falhar
      if (res.status === 402 || res.status === 429) {
        const fallback = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://cajado-sistema.vercel.app',
          },
          body: JSON.stringify({
            model: 'perplexity/sonar',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.2,
          }),
        })
        const fallbackData = await fallback.json()
        if (fallback.ok) {
          return NextResponse.json({
            resultado: fallbackData.choices?.[0]?.message?.content ?? '',
            modelo: 'perplexity/sonar',
            citations: fallbackData.citations ?? [],
          })
        }
      }
      throw new Error(data.error?.message || `Erro ${res.status}`)
    }

    return NextResponse.json({
      resultado: data.choices?.[0]?.message?.content ?? '',
      modelo: 'perplexity/sonar-pro',
      citations: data.citations ?? [],
    })

  } catch (error: any) {
    console.error('[Busca Web]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
