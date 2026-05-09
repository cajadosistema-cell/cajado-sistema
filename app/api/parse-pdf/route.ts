import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

// Detecta se uma linha é uma data brasileira (dd/mm/yyyy ou mm/yyyy)
function isDataBR(str: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}/.test(str.trim()) || /^\d{2}\/\d{4}/.test(str.trim())
}

// Extrai metadados de parcelas de um bloco de texto "Saldo Devedor"
function analisarBlocoSaldoDevedor(bloco: string) {
  const linhas = bloco.split('\n').map(l => l.trim()).filter(Boolean)
  const hoje = new Date()

  let parcelasTotal = 0
  let parcelasPagas = 0

  for (const linha of linhas) {
    // Linha que começa com data = uma parcela
    if (isDataBR(linha)) {
      parcelasTotal++
      // Extrai a data da linha e verifica se é passado
      const match = linha.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      if (match) {
        const dataLinha = new Date(`${match[3]}-${match[2]}-${match[1]}`)
        if (dataLinha < hoje) parcelasPagas++
      }
    }
  }

  // Procura "Ano próximo" ou total de parcelas no cabeçalho
  const totalMatch = bloco.match(/Ano\s+pr[oó]ximo[:\s]+(\d+)/i)
    || bloco.match(/Total\s+de\s+parcelas[:\s]+(\d+)/i)
    || bloco.match(/Parcelas[:\s]+(\d+)/i)

  // Extrai valor da parcela (procura valores monetários típicos de parcela)
  const parcelaMatch = bloco.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:REAL|INCC|IGP|IPCA|TR)/i)

  return {
    parcelasTotal: parcelasTotal > 0 ? parcelasTotal : null,
    parcelasPagas: parcelasPagas > 0 ? parcelasPagas : 0,
    totalHeader: totalMatch ? parseInt(totalMatch[1]) : null,
    valorParcelaAmostra: parcelaMatch ? parcelaMatch[1] : null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const data = await pdfParse(buffer)
    const text: string = data.text || ''

    // --- Pré-processamento para "Saldo Devedor Presente" ---
    let metadata: Record<string, any> = {}

    if (text.includes('Saldo Devedor')) {
      // Divide em blocos por empresa (cada contrato começa com "Empresa")
      const blocos = text.split(/(?=Empresa\s*[\n:])/).filter(b => b.trim().length > 100)

      if (blocos.length > 0) {
        // Escolhe o bloco com MAIS parcelas (contrato principal/ativo)
        const analisados = blocos.map((b, i) => ({ i, ...analisarBlocoSaldoDevedor(b) }))
        const principal = analisados.reduce((best, cur) =>
          (cur.parcelasTotal ?? 0) > (best.parcelasTotal ?? 0) ? cur : best
        )

        metadata = {
          blocos_encontrados: blocos.length,
          parcelas_total_contadas: principal.parcelasTotal,
          parcelas_pagas_contadas: principal.parcelasPagas,
          total_header: principal.totalHeader,
          // Usa o maior valor entre contagem real e cabeçalho
          parcelas_total_final: Math.max(
            principal.parcelasTotal ?? 0,
            principal.totalHeader ?? 0
          ) || null,
        }
      }
    }

    // Adiciona resumo de metadados no início do texto para a IA usar
    const resumo = metadata.parcelas_total_final
      ? `\n[METADADOS EXTRAÍDOS PELO SERVIDOR]\n` +
        `- Blocos de contratos encontrados: ${metadata.blocos_encontrados}\n` +
        `- Parcelas PAGAS contadas nas tabelas: ${metadata.parcelas_pagas_contadas}\n` +
        `- Parcelas TOTAL contadas nas tabelas: ${metadata.parcelas_total_contadas}\n` +
        `- Total pelo cabeçalho: ${metadata.total_header ?? 'não encontrado'}\n` +
        `- USE ESTE VALOR para parcelas_total: ${metadata.parcelas_total_final}\n` +
        `- USE ESTE VALOR para parcelas_pagas: ${metadata.parcelas_pagas_contadas}\n` +
        `[FIM DOS METADADOS]\n\n`
      : ''

    return NextResponse.json({
      text: resumo + text,
      paginas: data.numpages,
      metadata,
    })
  } catch (error: any) {
    console.error('Erro ao processar PDF:', error)
    return NextResponse.json({ error: error.message || 'Erro ao extrair texto do PDF' }, { status: 500 })
  }
}
