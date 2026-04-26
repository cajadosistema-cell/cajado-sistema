'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Parser OFX ─────────────────────────────────────────────────
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
    const data = `${dtposted.slice(0,4)}-${dtposted.slice(4,6)}-${dtposted.slice(6,8)}`
    resultados.push({
      _id: fitid || String(Date.now() + Math.random()),
      descricao: memo || 'Transação',
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'despesa' : 'receita',
      data, categoria: '', selecionado: true, aiCategoria: '',
    })
  }
  return resultados
}

// ── Parser CSV ─────────────────────────────────────────────────
function parsearCSV(conteudo: string): TransacaoImportada[] {
  const linhas = conteudo.split('\n').filter(l => l.trim())
  if (linhas.length < 2) return []
  return linhas.slice(1).map((linha, i) => {
    const cols = linha.split(';').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 2) return null
    const descricao = cols[1] || cols[0] || 'Transação'
    const valorStr = cols.find(c => /[-\d.,]+/.test(c.replace(/[R$\s]/g, ''))) || '0'
    const valor = Math.abs(parseFloat(valorStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0)
    const dataStr = cols[0] || new Date().toISOString().split('T')[0]
    const data = dataStr.includes('/') ? dataStr.split('/').reverse().join('-') : dataStr
    return { _id: `csv_${i}`, descricao, valor, tipo: 'despesa' as const, data: data.slice(0,10), categoria: '', selecionado: true, aiCategoria: '' }
  }).filter(Boolean) as TransacaoImportada[]
}

// ── Tipos ───────────────────────────────────────────────────────
interface TransacaoImportada {
  _id: string; descricao: string; valor: number
  tipo: 'despesa' | 'receita'; data: string
  categoria: string; selecionado: boolean; aiCategoria: string
}

interface Conta { id: string; nome: string; tipo: string }

// PF usa categorias nomeadas; PJ usa campos da tabela lancamentos
const CAT_PF_DESPESA  = ['alimentacao','transporte','saude','lazer','educacao','moradia','vestuario','tecnologia','investimento','outros']
const CAT_PF_RECEITA  = ['pro_labore','freelance','investimentos','aluguel','vendas','outros']
const CAT_PJ_DESPESA  = ['operacional','marketing','pessoal','infraestrutura','impostos','outros']
const CAT_PJ_RECEITA  = ['servicos','produtos','recorrente','avulso','outros']

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

// ── Props ───────────────────────────────────────────────────────
interface Props {
  userId: string
  modo: 'pf' | 'pj'          // PF → gastos_pessoais/receitas_pessoais | PJ → lancamentos
  contasPJ?: Conta[]          // lista de contas bancárias (apenas modo PJ)
  onClose: () => void
  onSave: () => void
}

// ── Componente ──────────────────────────────────────────────────
export function ModalImportarExtratoIA({ userId, modo, contasPJ = [], onClose, onSave }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [transacoes, setTransacoes] = useState<TransacaoImportada[]>([])
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroIA, setErroIA] = useState('')
  const [progresso, setProgresso] = useState(0)
  const [contaId, setContaId] = useState(contasPJ[0]?.id || '')

  useEffect(() => {
    if (contasPJ.length > 0 && !contaId) setContaId(contasPJ[0].id)
  }, [contasPJ])

  // ── Lê arquivo ────────────────────────────────────────────────
  const handleArquivo = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase()
    
    // Processamento especial para PDF
    if (ext.endsWith('.pdf')) {
      setAnalisando(true)
      setErroIA('')
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (!data.text || data.text.trim().length < 10) {
          throw new Error('O PDF parece estar vazio ou não é texto pesquisável (imagem).')
        }
        await extrairEClassificarComIA(data.text)
      } catch (err: any) {
        alert('Erro ao processar PDF: ' + err.message)
        setAnalisando(false)
      }
      return
    }

    const conteudo = await file.text()
    let parsed: TransacaoImportada[] = []
    
    if (ext.endsWith('.ofx') || ext.endsWith('.qif') || conteudo.includes('<STMTTRN>')) {
      parsed = parsearOFX(conteudo)
    } else if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
      parsed = parsearCSV(conteudo)
    } else { alert('Formato não suportado. Use OFX, CSV ou PDF.'); return }
    
    if (parsed.length === 0) { alert('Nenhuma transação encontrada no arquivo.'); return }
    setTransacoes(parsed)
    await analisarComIA(parsed)
  }, [modo])

  // ── Verifica Duplicatas ────────────────────────────────────────
  const verificarDuplicatas = async (txs: TransacaoImportada[]) => {
    if (txs.length === 0) return txs
    const datas = txs.map(t => t.data).sort()
    const min = datas[0]
    const max = datas[datas.length - 1]

    let dbTxs: any[] = []
    if (modo === 'pj') {
      if (!contaId) return txs
      const { data } = await supabase.from('lancamentos').select('valor, data_competencia')
        .eq('conta_id', contaId).gte('data_competencia', min).lte('data_competencia', max)
      if (data) dbTxs = data.map(d => ({ v: Number(d.valor), d: d.data_competencia }))
    } else {
      const [g, r] = await Promise.all([
        supabase.from('gastos_pessoais').select('valor, data').eq('user_id', userId).gte('data', min).lte('data', max),
        supabase.from('receitas_pessoais').select('valor, data').eq('user_id', userId).gte('data', min).lte('data', max)
      ])
      const gD = (g.data || []).map(d => ({ v: Number(d.valor), d: d.data }))
      const rD = (r.data || []).map(d => ({ v: Number(d.valor), d: d.data }))
      dbTxs = [...gD, ...rD]
    }

    return txs.map(t => {
      const isDup = dbTxs.some(db => Math.abs(db.v - t.valor) < 0.01 && db.d === t.data)
      return { ...t, duplicata: isDup, selecionado: !isDup }
    })
  }

  // ── IA extrai e categoriza (PDF) ───────────────────────────────
  const extrairEClassificarComIA = async (texto: string) => {
    try {
      const catDesp = modo === 'pj' ? CAT_PJ_DESPESA.join(', ') : CAT_PF_DESPESA.join(', ')
      const catRec  = modo === 'pj' ? CAT_PJ_RECEITA.join(', ') : CAT_PF_RECEITA.join(', ')

      const prompt = `Você é um extrator de dados financeiros. Leia o texto extraído de um extrato em PDF e extraia TODAS as transações financeiras.

TEXTO DO EXTRATO:
${texto.slice(0, 15000)}

Extraia e retorne SOMENTE um JSON array no formato exato:
[
  {"descricao":"MERCADO MUNICIPAL","valor":150.50,"data":"2023-10-25","tipo":"despesa","categoria":"alimentacao"},
  {"descricao":"PIX JOAO","valor":500.00,"data":"2023-10-26","tipo":"receita","categoria":"servicos"}
]

Categorias de despesa: ${catDesp}
Categorias de receita: ${catRec}

REGRAS:
- "despesa" = débito, compra, pagamento, tarifa, saque (retorne valor numérico positivo)
- "receita" = crédito, salário, pix recebido, rendimento, estorno
- Use o formato de data YYYY-MM-DD. Tente inferir o ano se não estiver explícito.
- Ignore saldos iniciais/finais, avisos ou cabeçalhos.
- Retorne SOMENTE o JSON array`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: 'openai/gpt-4o-mini', max_tokens: 3000,
        }),
      })
      const data = await res.json()
      const respTexto = data.choices?.[0]?.message?.content || ''
      const jsonMatch = respTexto.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const cls: any[] = JSON.parse(jsonMatch[0])
        const mapeado = cls.map((c, i) => ({
          _id: `pdf_${i}`,
          descricao: c.descricao || 'Transação',
          valor: Math.abs(c.valor || 0),
          data: c.data || new Date().toISOString().split('T')[0],
          tipo: (c.tipo === 'receita' ? 'receita' : 'despesa') as any,
          categoria: c.categoria || 'outros',
          selecionado: true,
          aiCategoria: c.categoria || ''
        }))
        const verificados = await verificarDuplicatas(mapeado)
        setTransacoes(verificados)
        if (verificados.length === 0) setErroIA('Nenhuma transação encontrada no PDF.')
      } else {
        setErroIA('IA não conseguiu extrair transações. O PDF pode estar ilegível ou ser uma imagem.')
      }
    } catch (err: any) {
      setErroIA('Erro na IA: ' + err.message)
    }
    setAnalisando(false)
    setStep('review')
  }

  // ── IA categoriza em lote ──────────────────────────────────────
  const analisarComIA = async (txs: TransacaoImportada[]) => {
    setAnalisando(true); setErroIA('')
    try {
      const lista = txs.map((t, i) =>
        `${i + 1}. "${t.descricao}" | valor: R$ ${t.valor.toFixed(2)}`
      ).join('\n')

      const catDesp = modo === 'pj' ? CAT_PJ_DESPESA.join(', ') : CAT_PF_DESPESA.join(', ')
      const catRec  = modo === 'pj' ? CAT_PJ_RECEITA.join(', ') : CAT_PF_RECEITA.join(', ')

      const prompt = `Classifique estas transações bancárias. Retorne SOMENTE um JSON array.

TRANSAÇÕES:
${lista}

Formato exato:
[{"id":1,"tipo":"despesa","categoria":"alimentacao"},{"id":2,"tipo":"receita","categoria":"servicos"}]

Categorias de despesa: ${catDesp}
Categorias de receita: ${catRec}

REGRAS:
- "despesa" = débito, compra, pagamento, tarifa, saque
- "receita" = crédito, salário, pix recebido, rendimento, estorno
- Infira a categoria pelo nome da transação
- Retorne SOMENTE o JSON`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: 'openai/gpt-4o-mini', max_tokens: 2000,
        }),
      })
      const data = await res.json()
      const texto = data.choices?.[0]?.message?.content || ''
      const jsonMatch = texto.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const cls: { id: number; tipo: string; categoria: string }[] = JSON.parse(jsonMatch[0])
        setTransacoes(prev => prev.map((t, i) => {
          const c = cls.find(x => x.id === i + 1)
          if (!c) return t
          return { ...t, tipo: (c.tipo === 'receita' ? 'receita' : 'despesa') as any, categoria: c.categoria || 'outros', aiCategoria: c.categoria || '' }
        })
        const verificadas = await verificarDuplicatas(atualizadas)
        setTransacoes(verificadas)
      } else {
        setErroIA('IA não retornou categorias. Classifique manualmente.')
      }
    } catch (err: any) {
      setErroIA('Erro na IA: ' + err.message)
    }
    setAnalisando(false)
    setStep('review')
  }

  // ── Salva ──────────────────────────────────────────────────────
  const salvar = async () => {
    setSalvando(true)
    const selecionadas = transacoes.filter(t => t.selecionado)
    let salvas = 0

    for (const tx of selecionadas) {
      if (modo === 'pj') {
        // ── PJ → tabela lancamentos (vinculada à conta bancária) ──
        await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: tx.descricao,
          valor: tx.valor,
          tipo: tx.tipo === 'despesa' ? 'despesa' : 'receita',
          regime: 'caixa',
          status: 'automatico',
          data_competencia: tx.data,
          data_caixa: tx.data,
          conciliado: false,
          total_parcelas: 1,
        })
      } else {
        // ── PF → tabelas gastos_pessoais / receitas_pessoais ──────
        if (tx.tipo === 'despesa') {
          const validos = CAT_PF_DESPESA
          await (supabase.from('gastos_pessoais') as any).insert({
            user_id: userId, descricao: tx.descricao, valor: tx.valor,
            categoria: validos.includes(tx.categoria) ? tx.categoria : 'outros',
            data: tx.data, forma_pagamento: 'transferencia',
          })
        } else {
          const validos = CAT_PF_RECEITA
          await (supabase.from('receitas_pessoais') as any).insert({
            user_id: userId, descricao: tx.descricao, valor: tx.valor,
            categoria: validos.includes(tx.categoria) ? tx.categoria : 'outros',
            data: tx.data,
          })
        }
      }
      salvas++
      setProgresso(Math.round((salvas / selecionadas.length) * 100))
    }
    setSalvando(false)
    onSave(); onClose()
  }

  const totalSel  = transacoes.filter(t => t.selecionado).length
  const totalDesp = transacoes.filter(t => t.selecionado && t.tipo === 'despesa').reduce((a, t) => a + t.valor, 0)
  const totalRec  = transacoes.filter(t => t.selecionado && t.tipo === 'receita').reduce((a, t) => a + t.valor, 0)
  const catDesp   = modo === 'pj' ? CAT_PJ_DESPESA : CAT_PF_DESPESA
  const catRec    = modo === 'pj' ? CAT_PJ_RECEITA : CAT_PF_RECEITA

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-[#080c15] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-sm font-bold text-white">
                Importar Extrato com IA · {modo === 'pj' ? '🏢 PJ' : '👤 PF'}
              </h2>
              <p className="text-[10px] text-fg-disabled">
                {step === 'upload'
                  ? 'Faça upload do extrato OFX, CSV ou PDF'
                  : analisando
                  ? 'Analisando com inteligência artificial...'
                  : `${transacoes.length} transações encontradas`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center gap-5">

            {/* Seletor de conta PJ */}
            {modo === 'pj' && contasPJ.length > 0 && (
              <div className="w-full max-w-md">
                <label className="label mb-1 block">📂 Conta de Destino *</label>
                <select className="input w-full" value={contaId} onChange={e => setContaId(e.target.value)}>
                  {contasPJ.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <p className="text-[10px] text-fg-disabled mt-1">Os lançamentos serão associados a esta conta</p>
              </div>
            )}

            <label className="w-full max-w-md cursor-pointer group">
              <input type="file" accept=".ofx,.qif,.csv,.txt,.pdf" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleArquivo(e.target.files[0]) }} />
              <div className="border-2 border-dashed border-white/10 group-hover:border-amber-500/40 rounded-2xl p-10 text-center transition-all group-hover:bg-amber-500/3">
                <p className="text-4xl mb-3">📂</p>
                <p className="text-sm font-bold text-fg group-hover:text-amber-400 transition-colors">
                  Clique ou arraste o extrato aqui
                </p>
                <p className="text-xs text-fg-disabled mt-1">OFX (banco) · CSV (Excel) · PDF (fatura/extrato)</p>
              </div>
            </label>

            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
              {[
                { icon: '🏦', label: 'OFX/CSV', desc: 'Formatos padrão bancários' },
                { icon: '📄', label: 'PDF', desc: 'A IA extrai faturas e extratos' },
                { icon: '🤖', label: 'Classificação', desc: modo === 'pj' ? 'Lança nas contas PJ' : 'Categoriza para PF' },
              ].map(item => (
                <div key={item.label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl mb-1">{item.icon}</p>
                  <p className="text-xs font-bold text-fg">{item.label}</p>
                  <p className="text-[10px] text-fg-disabled">{item.desc}</p>
                </div>
              ))}
            </div>

            {analisando && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl w-full max-w-md">
                <span className="text-amber-400 animate-pulse">⚡</span>
                <p className="text-xs text-amber-300">Analisando transações com IA...</p>
              </div>
            )}

            <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
          </div>
        )}

        {/* REVIEW */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Avisos IA */}
            <div className="mx-5 mt-4 shrink-0">
              {erroIA ? (
                <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                  <p className="text-xs text-orange-300">⚠️ {erroIA}</p>
                </div>
              ) : (
                <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <p className="text-xs text-emerald-300">
                    ✨ IA categorizou {transacoes.length} transações.
                    {modo === 'pj' ? ' Serão lançados na conta bancária selecionada.' : ' Revise e confirme.'}
                  </p>
                </div>
              )}
            </div>

            {/* Conta PJ selecionada */}
            {modo === 'pj' && (
              <div className="mx-5 mt-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl shrink-0">
                <p className="text-[10px] text-blue-300">
                  🏦 Destino: <strong>{contasPJ.find(c => c.id === contaId)?.nome || 'Conta não selecionada'}</strong>
                  {' · '}
                  <button onClick={() => setStep('upload')} className="underline hover:text-blue-200">Trocar conta</button>
                </p>
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 px-5 mt-3 shrink-0">
              {[
                { label: 'Selecionadas', value: totalSel, cor: 'text-white', isNum: true },
                { label: 'Despesas',    value: fmt(totalDesp), cor: 'text-red-400', isNum: false },
                { label: 'Receitas',    value: fmt(totalRec),  cor: 'text-emerald-400', isNum: false },
              ].map(k => (
                <div key={k.label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                  <p className={`text-base font-bold ${k.cor}`}>{k.value}</p>
                  <p className="text-[9px] text-fg-disabled uppercase tracking-wide mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Lista editável */}
            <div className="flex-1 overflow-y-auto px-5 mt-3 min-h-0 space-y-1.5 pb-2">
              {transacoes.map((tx, i) => (
                <div key={tx._id} className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all',
                  tx.selecionado ? 'bg-white/3 border-white/8' : 'bg-transparent border-white/3 opacity-40'
                )}>
                  <input type="checkbox" checked={tx.selecionado} className="shrink-0 accent-amber-500"
                    onChange={e => setTransacoes(prev => prev.map((t, j) => j === i ? { ...t, selecionado: e.target.checked } : t))} />

                  <span className="text-[10px] text-fg-disabled shrink-0 w-12">{tx.data.slice(5)}</span>
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className="text-xs text-fg truncate">{tx.descricao}</span>
                    {tx.duplicata && <span className="text-[9px] text-orange-400 font-bold uppercase tracking-wider">⚠️ Provável Duplicata</span>}
                  </div>

                  {/* Tipo */}
                  <select value={tx.tipo} className="text-[10px] bg-transparent border border-white/10 rounded-lg px-1.5 py-1 shrink-0 w-24"
                    style={{ color: tx.tipo === 'despesa' ? '#f87171' : '#34d399' }}
                    onChange={e => setTransacoes(prev => prev.map((t, j) => j === i ? { ...t, tipo: e.target.value as any, categoria: '' } : t))}>
                    <option value="despesa">💸 Despesa</option>
                    <option value="receita">📈 Receita</option>
                  </select>

                  {/* Categoria */}
                  <select value={tx.categoria} className="text-[10px] bg-transparent border border-white/10 rounded-lg px-1.5 py-1 shrink-0 w-28"
                    onChange={e => setTransacoes(prev => prev.map((t, j) => j === i ? { ...t, categoria: e.target.value } : t))}>
                    <option value="">Categoria...</option>
                    {(tx.tipo === 'despesa' ? catDesp : catRec).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <span className={cn('text-xs font-bold shrink-0 w-20 text-right', tx.tipo === 'despesa' ? 'text-red-400' : 'text-emerald-400')}>
                    {tx.tipo === 'despesa' ? '-' : '+'}{fmt(tx.valor)}
                  </span>
                </div>
              ))}
            </div>

            {/* Progresso */}
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
                <button onClick={() => setTransacoes(prev => prev.map(t => ({ ...t, selecionado: true })))}
                  className="text-xs text-fg-disabled hover:text-fg-secondary">Todas</button>
                <span className="text-fg-disabled">·</span>
                <button onClick={() => setTransacoes(prev => prev.map(t => ({ ...t, selecionado: false })))}
                  className="text-xs text-fg-disabled hover:text-fg-secondary">Nenhuma</button>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
                <button onClick={salvar} disabled={salvando || totalSel === 0 || (modo === 'pj' && !contaId)}
                  className="btn-primary text-xs disabled:opacity-50">
                  {salvando ? 'Salvando...' : `✓ Importar ${totalSel} lançamento${totalSel !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
