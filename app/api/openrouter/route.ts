import { NextResponse } from 'next/server'

// Aumenta o timeout para 60s — modelos podem demorar em respostas longas
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const {
      prompt,
      context,
      systemInstruction,
      model: reqModel,
      messages: rawMessages,
      imageBase64,
      imageMime,
      temperature: reqTemperature,
      max_tokens: reqMaxTokens,
    } = await req.json()

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'Chave OPENROUTER_API_KEY não configurada no .env.local' },
        { status: 500 }
      )
    }

    const system = systemInstruction
      || 'Você é um assistente IA especialista em negócios, finanças e tecnologia da Cajado Soluções. Responda sempre em português brasileiro.'

    // Claude Sonnet 4 — melhor custo-benefício para JSON estruturado + instruções longas
    const model = reqModel || 'anthropic/claude-sonnet-4'

    let messages: { role: string; content: any }[]

    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      messages = [
        { role: 'system', content: system },
        ...rawMessages,
      ]
    } else {
      const textContent = context
        ? `Contexto da conversa anterior:\n${context}\n\nMensagem atual: ${prompt}`
        : (prompt || '')

      // Se tiver imagem, usa formato multimodal (vision)
      const userContent = imageBase64
        ? [
            { type: 'text', text: textContent },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ]
        : textContent

      messages = [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ]
    }

    // Cadeia de fallback: se o modelo principal falhar, tenta o próximo
    const FALLBACK_CHAIN = [
      model,
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
    ].filter((m, i, arr) => arr.indexOf(m) === i) // remove duplicatas

    let lastError = ''
    for (const tentativaModel of FALLBACK_CHAIN) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://cajado-sistema.vercel.app',
            'X-Title': 'Cajado Sistema Integrado',
          },
          body: JSON.stringify({
            model: tentativaModel,
            messages,
            max_tokens: reqMaxTokens ?? 4096,
            temperature: reqTemperature ?? 0.4,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          lastError = data.error?.message || `Erro ${res.status}`
          // Se for erro 429 (rate limit) ou 503 (indisponível), tenta o próximo modelo
          if (res.status === 429 || res.status === 503 || res.status === 502) continue
          // Para outros erros (400, 401...), não adianta tentar outro modelo
          throw new Error(lastError)
        }

        const result = data.choices?.[0]?.message?.content ?? ''
        const usage = data.usage ?? null

        // Se usou fallback, loga para monitoramento
        if (tentativaModel !== model) {
          console.warn(`[OpenRouter] Fallback ativado: ${model} → ${tentativaModel}`)
        }

        return NextResponse.json({ result, usage, model: tentativaModel })

      } catch (fetchErr: any) {
        lastError = fetchErr.message
        if (tentativaModel === FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1]) throw fetchErr
        continue
      }
    }

    throw new Error(lastError || 'Todos os modelos indisponíveis no momento.')

  } catch (error: any) {
    console.error('[OpenRouter API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

