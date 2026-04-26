'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Parser OFX simples (sem dependência) ───────────────────────
function parsearOFX(conteudo: string): TransacaoImportada[] {
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
  const resultados: TransacaoImportada[] = []
  let match
  while ((match = regex.exec(conteudo)) !== null) {
    const bloco = match[1]
    const dtposted = bloco.match(/<DTPOSTED>(\d{8})/)?.[1]
    const trnamt  = bloco.match(/<TRNAMT>([-\d.]+)/)?.[1]
    const memo    = bloco.match(/<MEMO>([^\n<]+)/)?.[1]?.trim()
    const fitid   = bloco.match(/<FITID>([^\n<]+)/)?.[1]?.trim()
    if (!dtposted || !trnamt) continue
    const valor = parseFloat(trnamt)
    const data = `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`
    resultados.push({
      _id: fitid || String(Date.now() + Math.random()),
      descricao: memo || 'Transação',
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'gasto' : 'receita',
      data,
      categoria: '',
      selecionado: true,
      aiCategoria: '',
      aiTipo: valor < 0 ? 'gasto' : 'receita',
    })
  }
  return resultados
}

// Parser CSV simples
function parsearCSV(conteudo: string): TransacaoImportada[] {
  const linhas = conteudo.split('\n').filter(l => l.trim())
  if (linhas.length < 2) return []
  const header = linhas[0].toLowerCase()
  const temData = header.includes('data') || header.includes('date')
  const temValor = header.includes('valor') || header.includes('amount') || header.includes('value')
  if (!temData && !temValor) return []

  return linhas.slice(1).map((linha, i) => {
    const cols = linha.split(';').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 2) return null
    const descricao = cols[1] || cols[0] || 'Transação'
    const valorStr = cols.find(c => /[-\d.,]+/.test(c.replace(/[R$\s]/g, ''))) || '0'
    const valor = Math.abs(parseFloat(valorStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0)
    const dataStr = cols[0] || new Date().toISOString().split('T')[0]
    // Normaliza datas dd/mm/yyyy → yyyy-mm-dd
    const data = dataStr.includes('/')
      ? dataStr.split('/').reverse().join('-')
      : dataStr

    return {
      _id: `csv_${i}`,
      descricao,
      valor,
      tipo: valor < 0 ? 'receita' : 'gasto',
      data: data.slice(0, 10),
      categoria: '',
      selecionado: true,
      aiCategoria: '',
      aiTipo: 'gasto',
    } as TransacaoImportada
  }).filter(Boolean) as TransacaoImportada[]
}

// ── Tipos ────────────────────────────────────────────────────────
interface TransacaoImportada {
  _id: string
  descricao: string
  valor: number
  tipo: 'gasto' | 'receita'
  data: string
  categoria: string
  selecionado: boolean
  aiCategoria: string
  aiTipo: 'gasto' | 'receita'
}

const CAT_GASTOS = ['alimentacao','transporte','saude','lazer','educacao','moradia','vestuario','tecnologia','investimento','outros']
const CAT_RECEITAS = ['pro_labore','freelance','investimentos','aluguel','vendas','outros']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Componente Principal ─────────────────────────────────────────
export function ModalImportarExtratoIA({ userId, onClose, onSave }: {
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload')
  const [transacoes, setTransacoes] = useState<TransacaoImportada[]>([])
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroIA, setErroIA] = useState('')
  const [progresso, setProgresso] = useState(0)

  // ── Lê arquivo ─────────────────────────────────────────────────
  const handleArquivo = useCallback(async (file: File) => {
    const conteudo = await file.text()
    let parsed: TransacaoImportada[] = []
    const ext = file.name.toLowerCase()

    if (ext.endsWith('.ofx') || ext.endsWith('.qif') || conteudo.includes('<STMTTRN>')) {
      parsed = parsearOFX(conteudo)
    } else if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
      parsed = parsearCSV(conteudo)
    } else {
      alert('Formato não suportado. Use OFX ou CSV.')
      return
    }

    if (parsed.length === 0) {
      alert('Nenhuma transação encontrada no arquivo.')
      return
    }

    setTransacoes(parsed)
    await analisarComIA(parsed)
  }, [])

  // ── Analisa com IA ─────────────────────────────────────────────
  const analisarComIA = async (txs: TransacaoImportada[]) => {
    setAnalisando(true)
    setErroIA('')

    try {
      // Envia descrições em lote para a IA
      const lista = txs.map((t, i) =>
        `${i + 1}. "${t.descricao}" | valor: R$ ${t.valor.toFixed(2)} | sinal: ${t.valor < 0 ? 'débito' : 'crédito'}`
      ).join('\n')

      const prompt = `Você é um assistente financeiro. Analise estas transações bancárias e classifique cada uma.

TRANSAÇÕES:
${lista}

Para cada transação, retorne EXATAMENTE neste formato JSON (array):
[
  {"id": 1, "tipo": "gasto", "categoria": "alimentacao"},
  {"id": 2, "tipo": "receita", "categoria": "pro_labore"}
]

CATEGORIAS para gastos: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, investimento, outros
CATEGORIAS para receitas: pro_labore, freelance, investimentos, aluguel, vendas, outros

REGRAS:
- Use "gasto" para débitos, compras, pagamentos, tarifas
- Use "receita" para créditos, salários, transferências recebidas, rendimentos
- Infira a categoria pelo nome da transação
- Retorne SOMENTE o JSON, sem texto adicional`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: 'openai/gpt-4o-mini',
          max_tokens: 2000,
        }),
      })

      const data = await res.json()
      const texto = data.choices?.[0]?.message?.content || ''

      // Extrai JSON da resposta
      const jsonMatch = texto.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const classificacoes: { id: number; tipo: string; categoria: string }[] = JSON.parse(jsonMatch[0])
        setTransacoes(prev => prev.map((t, i) => {
          const cl = classificacoes.find(c => c.id === i + 1)
          if (!cl) return t
          return {
            ...t,
            aiTipo: (cl.tipo === 'receita' ? 'receita' : 'gasto') as 'gasto' | 'receita',
            tipo: (cl.tipo === 'receita' ? 'receita' : 'gasto') as 'gasto' | 'receita',
            aiCategoria: cl.categoria || 'outros',
            categoria: cl.categoria || 'outros',
          }
        }))
      } else {
        setErroIA('IA não retornou categorias válidas. Você pode categorizar manualmente.')
      }
    } catch (err: any) {
      setErroIA('Erro na IA: ' + err.message + ' — Categorize manualmente.')
    }

    setAnalisando(false)
    setStep('review')
  }

  // ── Salva lançamentos ──────────────────────────────────────────
  const salvar = async () => {
    setSalvando(true)
    const selecionadas = transacoes.filter(t => t.selecionado)
    let salvas = 0

    for (const tx of selecionadas) {
      if (tx.tipo === 'gasto') {
        const categoriasValidas = CAT_GASTOS
        const categoria = categoriasValidas.includes(tx.categoria) ? tx.categoria : 'outros'
        await (supabase.from('gastos_pessoais') as any).insert({
          user_id: userId,
          descricao: tx.descricao,
          valor: tx.valor,
          categoria,
          data: tx.data,
          forma_pagamento: 'cartao_credito',
        })
      } else {
        const categoriasValidas = CAT_RECEITAS
        const categoria = categoriasValidas.includes(tx.categoria) ? tx.categoria : 'outros'
        await (supabase.from('receitas_pessoais') as any).insert({
          user_id: userId,
          descricao: tx.descricao,
          valor: tx.valor,
          categoria,
          data: tx.data,
        })
      }
      salvas++
      setProgresso(Math.round((salvas / selecionadas.length) * 100))
    }

    setSalvando(false)
    onSave()
    onClose()
  }

  const totalSelecionadas = transacoes.filter(t => t.selecionado).length
  const totalGastos = transacoes.filter(t => t.selecionado && t.tipo === 'gasto').reduce((a, t) => a + t.valor, 0)
  const totalReceitas = transacoes.filter(t => t.selecionado && t.tipo === 'receita').reduce((a, t) => a + t.valor, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-[#080c15] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-sm font-bold text-white">Importar Extrato com IA</h2>
              <p className="text-[10px] text-fg-disabled">
                {step === 'upload' ? 'Faça upload do extrato OFX ou CSV'
                  : analisando ? 'Analisando com inteligência artificial...'
                  : `${transacoes.length} transações encontradas`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        {/* Step Upload */}
        {step === 'upload' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6">
            {/* Drop zone */}
            <label className="w-full max-w-md cursor-pointer group">
              <input
                type="file"
                accept=".ofx,.qif,.csv,.txt"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleArquivo(e.target.files[0]) }}
              />
              <div className="border-2 border-dashed border-white/10 group-hover:border-amber-500/40 rounded-2xl p-10 text-center transition-all group-hover:bg-amber-500/3">
                <p className="text-4xl mb-3">📂</p>
                <p className="text-sm font-bold text-fg group-hover:text-amber-400 transition-colors">
                  Clique ou arraste o extrato aqui
                </p>
                <p className="text-xs text-fg-disabled mt-1">Aceita OFX (banco) ou CSV (exportação)</p>
              </div>
            </label>

            {/* Instruções */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-md">
              {[
                { icon: '🏦', label: 'OFX/QIF', desc: 'Formato padrão bancário' },
                { icon: '📊', label: 'CSV', desc: 'Excel, Sheets, exportações' },
                { icon: '🤖', label: 'IA Classifica', desc: 'Categoriza automaticamente' },
              ].map(item => (
                <div key={item.label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl mb-1">{item.icon}</p>
                  <p className="text-xs font-bold text-fg">{item.label}</p>
                  <p className="text-[10px] text-fg-disabled">{item.desc}</p>
                </div>
              ))}
            </div>

            {analisando && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <span className="text-amber-400 animate-pulse">⚡</span>
                <p className="text-xs text-amber-300">Analisando transações com IA...</p>
              </div>
            )}
          </div>
        )}

        {/* Step Review */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Status IA */}
            {erroIA && (
              <div className="mx-5 mt-4 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <p className="text-xs text-orange-300">⚠️ {erroIA}</p>
              </div>
            )}

            {!erroIA && (
              <div className="mx-5 mt-4 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-xs text-emerald-300">✨ IA categorizou {transacoes.length} transações automaticamente. Revise e ajuste antes de importar.</p>
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 px-5 mt-4 shrink-0">
              {[
                { label: 'Selecionadas', value: totalSelecionadas, cor: 'text-white' },
                { label: 'Gastos', value: fmt(totalGastos), cor: 'text-red-400' },
                { label: 'Receitas', value: fmt(totalReceitas), cor: 'text-emerald-400' },
              ].map(k => (
                <div key={k.label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                  <p className={`text-base font-bold ${k.cor}`}>{k.value}</p>
                  <p className="text-[9px] text-fg-disabled uppercase tracking-wide mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Tabela de transações */}
            <div className="flex-1 overflow-y-auto px-5 mt-4 min-h-0 space-y-1.5 pb-2">
              {transacoes.map((tx, i) => (
                <div key={tx._id} className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all',
                  tx.selecionado ? 'bg-white/3 border-white/8' : 'bg-transparent border-white/3 opacity-40'
                )}>
                  {/* Checkbox */}
                  <input type="checkbox" checked={tx.selecionado}
                    onChange={e => setTransacoes(prev => prev.map((t, j) => j === i ? { ...t, selecionado: e.target.checked } : t))}
                    className="shrink-0 accent-amber-500" />

                  {/* Data */}
                  <span className="text-[10px] text-fg-disabled shrink-0 w-14">{tx.data.slice(5)}</span>

                  {/* Descrição */}
                  <span className="text-xs text-fg flex-1 truncate">{tx.descricao}</span>

                  {/* Tipo */}
                  <select
                    value={tx.tipo}
                    onChange={e => setTransacoes(prev => prev.map((t, j) => j === i ? { ...t, tipo: e.target.value as any, categoria: '' } : t))}
                    className="text-[10px] bg-transparent border border-white/10 rounded-lg px-1.5 py-1 shrink-0 w-20"
                    style={{ color: tx.tipo === 'gasto' ? '#f87171' : '#34d399' }}
                  >
                    <option value="gasto">💸 Gasto</option>
                    <option value="receita">📈 Receita</option>
                  </select>

                  {/* Categoria */}
                  <select
                    value={tx.categoria}
                    onChange={e => setTransacoes(prev => prev.map((t, j) => j === i ? { ...t, categoria: e.target.value } : t))}
                    className="text-[10px] bg-transparent border border-white/10 rounded-lg px-1.5 py-1 shrink-0 w-28"
                  >
                    <option value="">Categoria...</option>
                    {(tx.tipo === 'gasto' ? CAT_GASTOS : CAT_RECEITAS).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Valor */}
                  <span className={cn('text-xs font-bold shrink-0 w-20 text-right', tx.tipo === 'gasto' ? 'text-red-400' : 'text-emerald-400')}>
                    {tx.tipo === 'gasto' ? '-' : '+'}{fmt(tx.valor)}
                  </span>
                </div>
              ))}
            </div>

            {/* Barra de progresso ao salvar */}
            {salvando && (
              <div className="px-5 py-2 shrink-0">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${progresso}%` }} />
                </div>
                <p className="text-[10px] text-fg-disabled text-center mt-1">Salvando... {progresso}%</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex items-center justify-between gap-3 shrink-0">
          {step === 'review' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTransacoes(prev => prev.map(t => ({ ...t, selecionado: true })))}
                  className="text-xs text-fg-disabled hover:text-fg-secondary"
                >
                  Todas
                </button>
                <span className="text-fg-disabled text-xs">·</span>
                <button
                  onClick={() => setTransacoes(prev => prev.map(t => ({ ...t, selecionado: false })))}
                  className="text-xs text-fg-disabled hover:text-fg-secondary"
                >
                  Nenhuma
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={salvando || totalSelecionadas === 0}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  {salvando ? `Salvando...` : `✓ Importar ${totalSelecionadas} lançamento${totalSelecionadas !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
          {step === 'upload' && (
            <button onClick={onClose} className="btn-secondary text-xs ml-auto">Cancelar</button>
          )}
        </div>
      </div>
    </div>
  )
}
