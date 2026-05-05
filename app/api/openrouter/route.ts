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
    } = await req.json()

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'Chave OPENROUTER_API_KEY não configurada no .env.local' },
        { status: 500 }
      )
    }

    const system = systemInstruction
      || 'Você é um assistente IA especialista em negócios, finanças e tecnologia da Cajado Soluções. Responda sempre em português brasileiro.'

    // Escolhe modelo: se tiver imagem usa GPT-4o (vision), senão usa Gemini 2.5 Flash
    const model = imageBase64
      ? 'openai/gpt-4o'
      : (reqModel || 'google/gemini-2.5-flash-preview')

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
        max_tokens: 2048,
        temperature: 0.7,
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
