import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt, context, systemInstruction, model = 'openai/gpt-4o' } = await req.json()
    
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Chave OPENROUTER_API_KEY não configurada no .env.local' }, { status: 500 })
    }

    const messages = [
      { role: 'system', content: systemInstruction || 'Você é um assistente IA especialista em negócios, finanças e tecnologia da Cajado Soluções.' },
      { role: 'user', content: `${context ? `Contexto:\n${context}\n\n` : ''}${prompt}` }
    ]

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cajado-sistema.vercel.app',
        'X-Title': 'Cajado Sistema Integrado',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error?.message || 'Erro na API do OpenRouter')
    }

    return NextResponse.json({ result: data.choices[0].message.content })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
