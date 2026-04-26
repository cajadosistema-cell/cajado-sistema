import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Configura o pdf-parse
    const data = await pdfParse(buffer)

    return NextResponse.json({ text: data.text })
  } catch (error: any) {
    console.error('Erro ao processar PDF:', error)
    return NextResponse.json({ error: error.message || 'Erro ao extrair texto do PDF' }, { status: 500 })
  }
}
