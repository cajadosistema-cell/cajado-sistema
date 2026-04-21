import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const {
      prompt,
      context,
      systemInstruction,
      model = 'openai/gpt-4o-mini',
      messages: rawMessages,
    } = await req.json()

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'Chave OPENROUTER_API_KEY não configurada no .env.local' },
        { status: 500 }
      )
    }

    const system = systemInstruction
      || 'Você é um assistente IA especialista em negócios, finanças e tecnologia da Cajado Soluções. Responda sempre em português brasileiro.'

    // Suporte a array de mensagens (histórico) ou formato simples prompt+context
    let messages: { role: string; content: string }[]

    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      // Modo conversa com histórico completo
      messages = [
        { role: 'system', content: system },
        ...rawMessages,
      ]
    } else {
      // Modo simples (prompt + contexto opcional)
      messages = [
        { role: 'system', content: system },
        {
          role: 'user',
          content: context
            ? `Contexto da conversa anterior:\n${context}\n\nMensagem atual: ${prompt}`
            : prompt,
        },
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
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error?.message || `Erro ${res.status} na API do OpenRouter`)
    }

    const result = data.choices?.[0]?.message?.content ?? ''
    const usage = data.usage ?? null

    return NextResponse.json({ result, usage })

  } catch (error: any) {
    console.error('[OpenRouter API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
