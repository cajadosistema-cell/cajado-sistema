import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { base64 } = await req.json()
    if (!base64) return NextResponse.json({ error: 'Base64 não informado' }, { status: 400 })

    // Converte base64 para Buffer
    const buffer = Buffer.from(base64, 'base64')

    // Usa pdf-parse para extrair texto
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const resultado = await pdfParse(buffer)

    const texto = resultado.text?.trim() || ''
    if (!texto) {
      return NextResponse.json({ texto: '', aviso: 'PDF sem texto legível (pode ser imagem escaneada).' })
    }

    // Limita a 6000 chars para não explodir o contexto da IA
    return NextResponse.json({ texto: texto.substring(0, 6000), paginas: resultado.numpages })
  } catch (err: any) {
    console.error('[extrair-pdf]', err.message)
    return NextResponse.json({ error: 'Falha ao extrair texto do PDF: ' + err.message }, { status: 500 })
  }
}
