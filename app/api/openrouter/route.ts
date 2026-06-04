import { NextResponse } from 'next/server'

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

    // Claude Opus 4.5 é o padrão premium — melhor compreensão de contexto e JSON estruturado
    const model = reqModel || 'anthropic/claude-opus-4.5'

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

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://cajado-sistema.vercel.app',
        'X-Title': 'Cajado Sistema Integrado',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: reqMaxTokens ?? 4096,
        temperature: reqTemperature ?? 0.4,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error?.message || `Erro ${res.status} na API do OpenRouter`)
    }

    const result = data.choices?.[0]?.message?.content ?? ''
    const usage = data.usage ?? null

    return NextResponse.json({ result, usage, model })

  } catch (error: any) {
    console.error('[OpenRouter API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
