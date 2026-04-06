'use client'

import { useState, useMemo } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, formatRelative, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'

// ── Types ───────────────────────────────────────────────────
type Operacao = {
  id: string
  ativo: string
  mercado: 'acoes' | 'futuros' | 'cripto' | 'forex' | 'opcoes' | 'fii'
  tipo: 'compra' | 'venda' | 'opcao_call' | 'opcao_put'
  data_entrada: string
  data_saida: string | null
  preco_entrada: number
  preco_saida: number | null
  quantidade: number
  stop_loss: number | null
  take_profit: number | null
  resultado: 'gain' | 'loss' | 'breakeven' | 'aberta'
  lucro_prejuizo: number | null
  percentual: number | null
  erros_cometidos: string | null
  aprendizado: string | null
  // setup info (stored in erros_cometidos field as JSON prefix)
  indicadores_usados?: string[]
  setup_nome?: string
}

type RegraRisco = {
  id: string
  descricao: string
  valor_maximo_operacao: number
  percentual_max_capital: number
  max_operacoes_dia: number
  horario_inicio: string | null
  horario_fim: string | null
  ativo: boolean
}

// ── Constantes ───────────────────────────────────────────────
const INDICADORES = [
  {
    id: 'vwap', nome: 'VWAP', fullName: 'Volume Weighted Avg Price',
    cor: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30',
    winRate: '65–72%', usos: 'Scalp Intraday',
    descricao: 'Compra acima = tendência compradora; abaixo = vendedora',
    emoji: '📊',
  },
  {
    id: 'ema9_21', nome: 'EMA 9+21', fullName: 'Cruzamento de Médias',
    cor: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30',
    winRate: '60–68%', usos: 'Swing Trade',
    descricao: 'EMA 9 cruza acima da EMA 21 → entrada long (volume confirmando)',
    emoji: '📈',
  },
  {
    id: 'rsi_div', nome: 'RSI Divergência', fullName: 'RSI (14) + Divergência',
    cor: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30',
    winRate: '60–68%', usos: 'Reversão M15/H1/H4',
    descricao: 'Preço faz nova mínima, RSI não = reversão de alta conversão',
    emoji: '🔄',
  },
  {
    id: 'bollinger', nome: 'Bollinger Squeeze', fullName: 'Bandas de Bollinger',
    cor: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30',
    winRate: '58–65%', usos: 'Cripto / Mini Índice',
    descricao: 'Bandas comprimem (squeeze) → explosão de preço iminente',
    emoji: '💥',
  },
  {
    id: 'macd', nome: 'MACD Histograma', fullName: 'MACD (sem lag)',
    cor: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30',
    winRate: '58–65%', usos: 'Reversão de Momentum',
    descricao: 'Foco no histograma: virada = momentum mudando antes do sinal visual',
    emoji: '⚡',
  },
  {
    id: 'orderflow', nome: 'Order Flow / Delta', fullName: 'Order Flow / Delta de Volume',
    cor: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30',
    winRate: '70%+', usos: 'Day Trade Profissional',
    descricao: 'Desequilíbrio compradores vs vendedores em tempo real (Bookmap, Sierra Chart)',
    emoji: '🏦',
  },
  {
    id: 'ichimoku', nome: 'Ichimoku Cloud', fullName: 'Ichimoku Completo',
    cor: 'text-pink-400', bg: 'bg-pink-500/15', border: 'border-pink-500/30',
    winRate: '70%+ em tendência', usos: 'Trend Following',
    descricao: 'Preço acima da nuvem + TK cross + Chikou livre = trend forte',
    emoji: '☁️',
  },
]

const SETUPS = [
  { nome: 'Scalp Intraday', indicadores: ['vwap', 'ema9_21'], winRate: 65, cor: 'text-amber-400' },
  { nome: 'Swing Trade', indicadores: ['ema9_21', 'rsi_div'], winRate: 64, cor: 'text-blue-400' },
  { nome: 'Reversão', indicadores: ['bollinger', 'macd'], winRate: 61, cor: 'text-cyan-400' },
  { nome: 'Trend Following', indicadores: ['ichimoku'], winRate: 70, cor: 'text-pink-400' },
  { nome: 'Personalizado', indicadores: [], winRate: 0, cor: 'text-zinc-400' },
]

// ── Checklist de Confluência ─────────────────────────────────
function ChecklistConfluencia({
  selecionados, onChange,
}: { selecionados: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => {
    onChange(selecionados.includes(id)
      ? selecionados.filter(s => s !== id)
      : [...selecionados, id]
    )
  }

  const score = selecionados.length
  const scoreColor = score >= 3 ? 'text-emerald-400' : score >= 2 ? 'text-amber-400' : 'text-red-400'
  const scoreLabel = score >= 3 ? 'Alta confluência ✅' : score >= 2 ? 'Confluência moderada ⚠️' : 'Confluência fraca ❌'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="label">Indicadores do setup (confluência)</label>
        <span className={cn('text-xs font-semibold', scoreColor)}>
          {score}/7 — {scoreLabel}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {INDICADORES.map(ind => (
          <label key={ind.id}
            className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
              selecionados.includes(ind.id)
                ? `${ind.bg} ${ind.border}`
                : 'bg-zinc-800/30 border-zinc-800 hover:border-zinc-700'
            )}>
            <input
              type="checkbox"
              checked={selecionados.includes(ind.id)}
              onChange={() => toggle(ind.id)}
              className="sr-only"
            />
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
              selecionados.includes(ind.id)
                ? `${ind.cor} border-current bg-current`
                : 'border-zinc-600'
            )}>
              {selecionados.includes(ind.id) && (
                <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-zinc-950" fill="currentColor">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <span className="text-base shrink-0">{ind.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-semibold', selecionados.includes(ind.id) ? ind.cor : 'text-zinc-400')}>
                  {ind.nome}
                </span>
                <span className="text-[10px] text-zinc-600">~{ind.winRate}</span>
              </div>
              <p className="text-[10px] text-zinc-600 truncate">{ind.descricao}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Modal Operação ───────────────────────────────────────────
function ModalOperacao({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('operacoes')
  const [step, setStep] = useState<'setup' | 'entrada' | 'saida'>('setup')
  const [setupSelecionado, setSetupSelecionado] = useState(SETUPS[0])
  const [indicadoresSelecionados, setIndicadoresSelecionados] = useState<string[]>(['vwap', 'ema9_21'])
  const [form, setForm] = useState({
    ativo: '',
    mercado: 'futuros' as Operacao['mercado'],
    tipo: 'compra' as Operacao['tipo'],
    preco_entrada: '',
    quantidade: '',
    stop_loss: '',
    take_profit: '',
    preco_saida: '',
    resultado: 'aberta' as Operacao['resultado'],
    erros_cometidos: '',
    aprendizado: '',
  })

  // Calcula R/R ratio e P&L estimado
  const entrada = parseFloat(form.preco_entrada) || 0
  const stop = parseFloat(form.stop_loss) || 0
  const alvo = parseFloat(form.take_profit) || 0
  const qtd = parseFloat(form.quantidade) || 0
  const risco = entrada > 0 && stop > 0 ? Math.abs(entrada - stop) : 0
  const retorno = entrada > 0 && alvo > 0 ? Math.abs(alvo - entrada) : 0
  const rrRatio = risco > 0 ? (retorno / risco).toFixed(2) : '—'
  const plEstimado = risco > 0 && qtd > 0 ? risco * qtd : 0

  const calcularResultado = () => {
    if (!form.preco_saida || !form.preco_entrada || !form.quantidade) return null
    const pnl = (parseFloat(form.preco_saida) - parseFloat(form.preco_entrada))
      * parseFloat(form.quantidade)
      * (form.tipo === 'venda' ? -1 : 1)
    const pct = ((parseFloat(form.preco_saida) - parseFloat(form.preco_entrada)) / parseFloat(form.preco_entrada)) * 100
    return { pnl, pct }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const calc = calcularResultado()
    const indicadoresInfo = indicadoresSelecionados.join(',')

    await insert({
      ativo: form.ativo.toUpperCase(),
      mercado: form.mercado,
      tipo: form.tipo,
      data_entrada: new Date().toISOString(),
      data_saida: form.preco_saida ? new Date().toISOString() : null,
      preco_entrada: parseFloat(form.preco_entrada),
      preco_saida: form.preco_saida ? parseFloat(form.preco_saida) : null,
      quantidade: parseFloat(form.quantidade),
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      resultado: form.resultado,
      lucro_prejuizo: calc?.pnl ?? null,
      percentual: calc?.pct ?? null,
      erros_cometidos: `[${indicadoresInfo}] ${setupSelecionado.nome} | ${form.erros_cometidos}`,
      aprendizado: form.aprendizado || null,
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Registrar Operação</h2>
            <div className="flex items-center gap-2 mt-2">
              {(['setup', 'entrada', 'saida'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStep(s)}
                    className={cn(
                      'text-xs px-3 py-1 rounded-full transition-all border',
                      step === s
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'text-zinc-600 border-zinc-800 hover:text-zinc-400'
                    )}>
                    {i + 1}. {s === 'setup' ? 'Setup' : s === 'entrada' ? 'Entrada' : 'Resultado'}
                  </button>
                  {i < 2 && <span className="text-zinc-700 text-xs">→</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Step 1: Setup */}
            {step === 'setup' && (
              <div className="space-y-5">
                <div>
                  <label className="label mb-2 block">Escolha o setup</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SETUPS.map(s => (
                      <button
                        key={s.nome}
                        type="button"
                        onClick={() => {
                          setSetupSelecionado(s)
                          if (s.indicadores.length > 0) setIndicadoresSelecionados(s.indicadores)
                        }}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all',
                          setupSelecionado.nome === s.nome
                            ? 'bg-amber-500/15 border-amber-500/40'
                            : 'bg-zinc-800/30 border-zinc-800 hover:border-zinc-700'
                        )}>
                        <p className={cn('text-xs font-semibold', setupSelecionado.nome === s.nome ? 'text-amber-400' : 'text-zinc-400')}>
                          {s.nome}
                        </p>
                        {s.winRate > 0 && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">~{s.winRate}% win rate</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <ChecklistConfluencia
                  selecionados={indicadoresSelecionados}
                  onChange={setIndicadoresSelecionados}
                />

                {/* Regra da confluência */}
                {indicadoresSelecionados.length < 2 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-red-400">⚠️</span>
                    <p className="text-xs text-red-400">
                      <strong>Regra fundamental:</strong> use pelo menos 2–3 indicadores juntos. Nenhum é confiável sozinho.
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="button" onClick={() => setStep('entrada')} className="btn-primary">
                    Próximo → Entrada
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Entrada */}
            {step === 'entrada' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Ativo *</label>
                    <input className="input mt-1 uppercase" required value={form.ativo}
                      onChange={e => setForm(f => ({ ...f, ativo: e.target.value }))}
                      placeholder="WINFUT, BTC, PETR4..." />
                  </div>
                  <div>
                    <label className="label">Mercado</label>
                    <select className="input mt-1" value={form.mercado}
                      onChange={e => setForm(f => ({ ...f, mercado: e.target.value as Operacao['mercado'] }))}>
                      <option value="futuros">Futuros</option>
                      <option value="acoes">Ações</option>
                      <option value="cripto">Cripto</option>
                      <option value="forex">Forex</option>
                      <option value="opcoes">Opções</option>
                      <option value="fii">FII</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Direção</label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: 'compra' }))}
                        className={cn('py-2 rounded-lg text-xs font-semibold border transition-all',
                          form.tipo === 'compra'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        )}>
                        ▲ Long
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: 'venda' }))}
                        className={cn('py-2 rounded-lg text-xs font-semibold border transition-all',
                          form.tipo === 'venda'
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        )}>
                        ▼ Short
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Preço de entrada *</label>
                    <input className="input mt-1" type="number" step="0.01" required
                      value={form.preco_entrada}
                      onChange={e => setForm(f => ({ ...f, preco_entrada: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Quantidade *</label>
                    <input className="input mt-1" type="number" step="1" required
                      value={form.quantidade}
                      onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Stop Loss</label>
                    <input className="input mt-1 border-red-500/30 focus:border-red-500/60"
                      type="number" step="0.01"
                      value={form.stop_loss}
                      onChange={e => setForm(f => ({ ...f, stop_loss: e.target.value }))}
                      placeholder="Obrigatório — stop técnico" />
                  </div>
                  <div>
                    <label className="label">Take Profit</label>
                    <input className="input mt-1 border-emerald-500/30 focus:border-emerald-500/60"
                      type="number" step="0.01"
                      value={form.take_profit}
                      onChange={e => setForm(f => ({ ...f, take_profit: e.target.value }))} />
                  </div>
                </div>

                {/* Risk Manager em tempo real */}
                {entrada > 0 && stop > 0 && (
                  <div className={cn(
                    'rounded-xl p-4 border',
                    parseFloat(rrRatio) >= 2 ? 'bg-emerald-500/10 border-emerald-500/30' :
                    parseFloat(rrRatio) >= 1.5 ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-red-500/10 border-red-500/30'
                  )}>
                    <p className="text-xs font-semibold text-zinc-400 mb-2">⚡ Risk Manager</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-zinc-600">Risco por op.</p>
                        <p className="text-sm font-bold text-red-400">
                          {qtd > 0 ? formatCurrency(risco * qtd) : `${risco.toFixed(2)} pts`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600">R/R Ratio</p>
                        <p className={cn('text-lg font-bold',
                          parseFloat(rrRatio) >= 2 ? 'text-emerald-400' :
                          parseFloat(rrRatio) >= 1.5 ? 'text-amber-400' : 'text-red-400'
                        )}>
                          1:{rrRatio}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600">Alvo estimado</p>
                        <p className="text-sm font-bold text-emerald-400">
                          {qtd > 0 ? formatCurrency(retorno * qtd) : `${retorno.toFixed(2)} pts`}
                        </p>
                      </div>
                    </div>
                    {parseFloat(rrRatio) < 1.5 && rrRatio !== '—' && (
                      <p className="text-[10px] text-red-400 mt-2 text-center">
                        ⚠️ R/R abaixo de 1:1.5 — considere revisar alvos ou stop
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep('setup')} className="btn-secondary">← Voltar</button>
                  <button type="button" onClick={() => setStep('saida')} className="btn-primary">
                    Próximo → Resultado
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Saída / Resultado */}
            {step === 'saida' && (
              <div className="space-y-4">
                <div>
                  <label className="label">Status da operação</label>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {(['aberta', 'gain', 'loss', 'breakeven'] as const).map(r => (
                      <button type="button" key={r}
                        onClick={() => setForm(f => ({ ...f, resultado: r }))}
                        className={cn('py-2 rounded-lg text-xs font-semibold border transition-all capitalize',
                          form.resultado === r
                            ? r === 'gain' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : r === 'loss' ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : r === 'aberta' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                              : 'bg-zinc-700 text-zinc-300 border-zinc-600'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        )}>
                        {r === 'gain' ? '✅ Gain' : r === 'loss' ? '❌ Loss' : r === 'aberta' ? '⏳ Aberta' : '⚖️ BE'}
                      </button>
                    ))}
                  </div>
                </div>

                {form.resultado !== 'aberta' && (
                  <div>
                    <label className="label">Preço de saída</label>
                    <input className="input mt-1" type="number" step="0.01"
                      value={form.preco_saida}
                      onChange={e => setForm(f => ({ ...f, preco_saida: e.target.value }))} />
                    {calcularResultado() && (
                      <div className={cn('mt-2 px-3 py-2 rounded-lg text-sm font-bold', (calcularResultado()?.pnl ?? 0) >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
                        P&L: {formatCurrency(calcularResultado()?.pnl ?? 0)} ({(calcularResultado()?.pct ?? 0).toFixed(2)}%)
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="label">Erros cometidos / O que fugiu do plano?</label>
                  <textarea className="input mt-1 resize-none" rows={3}
                    value={form.erros_cometidos}
                    onChange={e => setForm(f => ({ ...f, erros_cometidos: e.target.value }))}
                    placeholder="Ex: Entrei sem confirmação de volume, movi o stop por emoção..." />
                </div>
                <div>
                  <label className="label">💡 Aprendizado desta operação</label>
                  <textarea className="input mt-1 resize-none border-amber-500/20 focus:border-amber-500/40" rows={3}
                    value={form.aprendizado}
                    onChange={e => setForm(f => ({ ...f, aprendizado: e.target.value }))}
                    placeholder="O que você leva desta operação para melhorar?" />
                </div>

                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep('entrada')} className="btn-secondary">← Voltar</button>
                  <button type="submit" className="btn-primary" disabled={loading || !form.ativo || !form.preco_entrada}>
                    {loading ? 'Salvando...' : '✅ Registrar Operação'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card de Operação ─────────────────────────────────────────
function OperacaoCard({ op }: { op: Operacao }) {
  const pnlPos = (op.lucro_prejuizo ?? 0) >= 0
  const indicadoresStr = op.erros_cometidos?.match(/^\[([^\]]+)\]/)?.[1] ?? ''
  const indicadoresIds = indicadoresStr ? indicadoresStr.split(',') : []
  const setupNome = op.erros_cometidos?.match(/\] ([^|]+) \|/)?.[1]?.trim() ?? ''

  return (
    <div className={cn(
      'card-sm border-l-2 transition-all hover:bg-zinc-800/60',
      op.resultado === 'gain' ? 'border-emerald-500' :
      op.resultado === 'loss' ? 'border-red-500' :
      op.resultado === 'aberta' ? 'border-blue-500' : 'border-zinc-600'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100">{op.ativo}</span>
            <span className="text-[10px] text-zinc-600 uppercase">{op.mercado}</span>
            <span className={cn('text-[10px] font-semibold px-1.5 rounded',
              op.tipo === 'compra' ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'
            )}>
              {op.tipo === 'compra' ? '▲ Long' : '▼ Short'}
            </span>
          </div>
          {setupNome && <p className="text-[10px] text-zinc-600 mt-0.5">{setupNome}</p>}
        </div>
        <div className="text-right">
          <StatusBadge status={op.resultado} />
          {op.lucro_prejuizo !== null && (
            <p className={cn('text-sm font-bold mt-1', pnlPos ? 'text-emerald-400' : 'text-red-400')}>
              {pnlPos ? '+' : ''}{formatCurrency(op.lucro_prejuizo)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-600">
        <span>Entrada: <span className="text-zinc-400">{op.preco_entrada}</span></span>
        {op.preco_saida && <span>Saída: <span className="text-zinc-400">{op.preco_saida}</span></span>}
        {op.percentual !== null && (
          <span className={cn(op.percentual >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {op.percentual >= 0 ? '+' : ''}{op.percentual.toFixed(2)}%
          </span>
        )}
        <span className="ml-auto">{formatRelative(op.data_entrada)}</span>
      </div>

      {/* Indicadores usados */}
      {indicadoresIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {indicadoresIds.map(id => {
            const ind = INDICADORES.find(i => i.id === id)
            if (!ind) return null
            return (
              <span key={id} className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ind.bg, ind.cor)}>
                {ind.emoji} {ind.nome}
              </span>
            )
          })}
        </div>
      )}

      {op.aprendizado && (
        <p className="text-[10px] text-amber-400/70 mt-2 italic border-t border-zinc-800 pt-2">
          💡 {op.aprendizado}
        </p>
      )}
    </div>
  )
}

// ── Modal Mentor IA ──────────────────────────────────────────
function ModalMentorIA({ operacoes, onClose }: { operacoes: Operacao[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState<string>('')
  const [error, setError] = useState('')

  const gerarDiagnostico = async () => {
    setLoading(true)
    setError('')
    try {
      const recentOps = operacoes.filter(o => o.resultado !== 'aberta').slice(0, 15)
      if (recentOps.length === 0) throw new Error('O Mentor precisa de pelo menos 1 operação finalizada para analisar.')

      const wr = Math.round((recentOps.filter(o => o.resultado === 'gain').length / recentOps.length) * 100)
      const opStrings = recentOps.map(o => `- ${o.ativo} (${o.tipo}): ${o.resultado.toUpperCase()} | PnL: ${o.lucro_prejuizo} | Falhas mapeadas: ${o.erros_cometidos || 'nenhuma'}`)
      
      const prompt = `Taxa de acerto recente: ${wr}%.
Histórico (últimas \n${recentOps.length} ops):\n${opStrings.join('\n')}

Por favor, forneça um diagnóstico técnico e psicológico curto (máx 2 parágrafos) focado no motivo principal das perdas ou nos padrões de erro cometidos. Seja um Mentor duro, mas focado na melhoria do trader.`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          systemInstruction: 'Você é um Mentor de Trading Institucional. Especialista em gestão de risco, order flow e psicologia financeira. Seu tom é direto, analítico e de alto nível.',
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao consultar o Mentor')

      setInsight(data.result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl w-full max-w-lg p-6 shadow-[0_0_40px_rgba(245,166,35,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-red-500"></div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h2 className="text-base font-semibold text-zinc-100">Mentor IA de Trading</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        
        {error && <div className="mb-4 text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{error}</div>}

        {!insight ? (
          <div className="text-center py-6">
            <p className="text-sm text-zinc-400 mb-6">O Mentor analisará suas últimas 15 operações (Loss vs Gains e seus registros de erros) para lhe dar um choque de realidade e direcionamento.</p>
            <button onClick={gerarDiagnostico} disabled={loading} className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25">
              {loading ? '⏳ Analisando Diário de Trading...' : '⚡ Requisitar Diagnóstico do Mentor'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
              <p className="text-sm text-amber-50 leading-relaxed whitespace-pre-wrap">{insight}</p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="btn-secondary">Entendido</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Indicadores (Guia) ──────────────────────────────────
function TabGuia() {
  return (
    <div className="space-y-6">
      {/* Cards de indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {INDICADORES.map(ind => (
          <div key={ind.id} className={cn('card border', ind.border, ind.bg)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{ind.emoji}</span>
                <div>
                  <p className={cn('text-sm font-bold', ind.cor)}>{ind.nome}</p>
                  <p className="text-[10px] text-zinc-600">{ind.fullName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600">Win Rate</p>
                <p className={cn('text-sm font-bold', ind.cor)}>{ind.winRate}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{ind.descricao}</p>
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', ind.bg, ind.cor)}>
                {ind.usos}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Setups vencedores */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">🔥 Combinações que mais convertem</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Setup</th>
                <th className="table-header">Indicadores</th>
                <th className="table-header text-right">Win Rate médio</th>
              </tr>
            </thead>
            <tbody>
              {[
                { setup: 'Scalp Intraday', inds: ['VWAP', 'EMA 9', 'Volume'], wr: '65–72%', cor: 'text-amber-400' },
                { setup: 'Swing Trade', inds: ['EMA 21/50', 'RSI Divergência'], wr: '60–68%', cor: 'text-blue-400' },
                { setup: 'Reversão', inds: ['Bollinger Squeeze', 'MACD'], wr: '58–65%', cor: 'text-cyan-400' },
                { setup: 'Trend Following', inds: ['Ichimoku', 'EMA 200'], wr: '70%+ em tendência', cor: 'text-pink-400' },
              ].map(row => (
                <tr key={row.setup} className="table-row">
                  <td className="table-cell font-medium text-zinc-200">{row.setup}</td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {row.inds.map(i => (
                        <span key={i} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {i}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={cn('table-cell text-right font-bold text-sm', row.cor)}>{row.wr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regras de ouro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: '🎯', titulo: 'Confluência', desc: 'Nunca opere com 1 indicador sozinho. Use 2–3 em conjunto.' },
          { icon: '📊', titulo: 'Volume sempre', desc: 'Qualquer sinal sem confirmação de volume é fraco.' },
          { icon: '🛡️', titulo: 'Stop técnico', desc: 'Stop-loss obrigatório antes de entrar na operação.' },
          { icon: '🌐', titulo: 'Contexto macro', desc: 'Entenda o que o mercado está fazendo no geral antes de operar.' },
        ].map(r => (
          <div key={r.titulo} className="card-sm bg-zinc-800/40 text-center">
            <p className="text-2xl mb-2">{r.icon}</p>
            <p className="text-xs font-bold text-zinc-200 mb-1">{r.titulo}</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function TraderClient() {
  const [tab, setTab] = useState<'operacoes' | 'guia' | 'risco'>('operacoes')
  const [modalOp, setModalOp] = useState(false)
  const [modalMentorIA, setModalMentorIA] = useState(false)
  const [filtroResultado, setFiltroResultado] = useState<string>('todos')

  const { data: operacoes, refetch } = useSupabaseQuery<Operacao>('operacoes', {
    orderBy: { column: 'data_entrada', ascending: false },
  })
  const { data: regras } = useSupabaseQuery<RegraRisco>('regras_risco', {
    filters: { ativo: true },
  })
  const { insert: insertRegra, loading: loadingRegra } = useSupabaseMutation('regras_risco')

  // Métricas calculadas
  const encerradas = operacoes.filter(o => o.resultado !== 'aberta')
  const gains = operacoes.filter(o => o.resultado === 'gain').length
  const losses = operacoes.filter(o => o.resultado === 'loss').length
  const winRate = encerradas.length > 0 ? Math.round((gains / encerradas.length) * 100) : 0
  const pnlTotal = operacoes.reduce((a, o) => a + (o.lucro_prejuizo ?? 0), 0)
  const abiertas = operacoes.filter(o => o.resultado === 'aberta').length

  // Média de ganhos vs perdas
  const mediaGain = gains > 0
    ? operacoes.filter(o => o.resultado === 'gain').reduce((a, o) => a + (o.lucro_prejuizo ?? 0), 0) / gains
    : 0
  const mediaLoss = losses > 0
    ? Math.abs(operacoes.filter(o => o.resultado === 'loss').reduce((a, o) => a + (o.lucro_prejuizo ?? 0), 0) / losses)
    : 0
  const expectancia = mediaGain * (winRate / 100) - mediaLoss * (1 - winRate / 100)

  // Filtros
  const opsFiltradas = operacoes.filter(o =>
    filtroResultado === 'todos' || o.resultado === filtroResultado
  )

  // Regra de risco default form
  const [formRegra, setFormRegra] = useState({
    descricao: '',
    valor_maximo_operacao: '',
    percentual_max_capital: '2',
    max_operacoes_dia: '5',
    horario_inicio: '09:00',
    horario_fim: '17:00',
  })

  const handleSaveRegra = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertRegra({
      descricao: formRegra.descricao,
      valor_maximo_operacao: parseFloat(formRegra.valor_maximo_operacao),
      percentual_max_capital: parseFloat(formRegra.percentual_max_capital),
      max_operacoes_dia: parseInt(formRegra.max_operacoes_dia),
      horario_inicio: formRegra.horario_inicio,
      horario_fim: formRegra.horario_fim,
      ativo: true,
    })
    refetch()
  }

  const TABS = [
    { key: 'operacoes', label: '📋 Operações' },
    { key: 'guia', label: '🏆 Indicadores' },
    { key: 'risco', label: '🛡️ Gestão de Risco' },
  ] as const

  return (
    <>
      <PageHeader title="Trader" subtitle="Operações · Indicadores · Gestão de Risco · Aprendizado">
        <button onClick={() => setModalOp(true)} className="btn-primary">+ Operação</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Win Rate</p>
          <p className={cn('metric-value', winRate >= 60 ? 'text-emerald-400' : winRate >= 50 ? 'text-amber-400' : 'text-red-400')}>
            {winRate}%
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">{gains}G · {losses}L · {abiertas} abertas</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">P&L Total</p>
          <p className={cn('metric-value', pnlTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {formatCurrency(pnlTotal)}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Média por Gain</p>
          <p className="metric-value text-emerald-400">{formatCurrency(mediaGain)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Média por Loss</p>
          <p className="metric-value text-red-400">{formatCurrency(mediaLoss)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Expectância</p>
          <p className={cn('metric-value', expectancia >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {formatCurrency(expectancia)}
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">por operação</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Operações */}
      {tab === 'operacoes' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            {(['todos', 'gain', 'loss', 'aberta', 'breakeven'] as const).map(f => (
              <button key={f} onClick={() => setFiltroResultado(f)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  filtroResultado === f
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                    : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
                )}>
                {f === 'todos' ? 'Todos' : f === 'gain' ? '✅ Gains' : f === 'loss' ? '❌ Losses' : f === 'aberta' ? '⏳ Abertas' : '⚖️ Breakeven'}
              </button>
            ))}
            <div className="flex-1"></div>
            <button onClick={() => setModalMentorIA(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-90 shadow-lg shadow-amber-500/20 transition-opacity">
              🧠 Mentor IA
            </button>
          </div>

          {opsFiltradas.length === 0 ? (
            <div className="card">
              <EmptyState message="Nenhuma operação registrada. Clique em '+ Operação' para começar." />
            </div>
          ) : (
            <div className="space-y-2">
              {opsFiltradas.map(op => <OperacaoCard key={op.id} op={op} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Guia de Indicadores */}
      {tab === 'guia' && <TabGuia />}

      {/* Tab: Gestão de Risco */}
      {tab === 'risco' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Regras ativas */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">Regras de risco ativas</h2>
            {regras.length === 0 ? (
              <div className="card"><EmptyState message="Nenhuma regra configurada" /></div>
            ) : (
              regras.map(r => (
                <div key={r.id} className="card space-y-2">
                  <p className="text-sm font-semibold text-zinc-200">{r.descricao}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-600">Máx por operação</p>
                      <p className="text-red-400 font-semibold">{r.percentual_max_capital}% do capital</p>
                    </div>
                    <div>
                      <p className="text-zinc-600">Máx operações/dia</p>
                      <p className="text-amber-400 font-semibold">{r.max_operacoes_dia} ops</p>
                    </div>
                    {(r.horario_inicio || r.horario_fim) && (
                      <div className="col-span-2">
                        <p className="text-zinc-600">Janela de operação</p>
                        <p className="text-zinc-300">{r.horario_inicio} → {r.horario_fim}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Form nova regra */}
          <div className="card">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">+ Nova regra de risco</h2>
            <form onSubmit={handleSaveRegra} className="space-y-3">
              <div>
                <label className="label">Descrição *</label>
                <input className="input mt-1" required value={formRegra.descricao}
                  onChange={e => setFormRegra(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Meu plano de risco diário" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">% máx por operação</label>
                  <input className="input mt-1" type="number" step="0.5" min="0.5" max="10"
                    value={formRegra.percentual_max_capital}
                    onChange={e => setFormRegra(f => ({ ...f, percentual_max_capital: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Máx ops/dia</label>
                  <input className="input mt-1" type="number" min="1" max="50"
                    value={formRegra.max_operacoes_dia}
                    onChange={e => setFormRegra(f => ({ ...f, max_operacoes_dia: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Início das ops</label>
                  <input className="input mt-1" type="time" value={formRegra.horario_inicio}
                    onChange={e => setFormRegra(f => ({ ...f, horario_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Fim das ops</label>
                  <input className="input mt-1" type="time" value={formRegra.horario_fim}
                    onChange={e => setFormRegra(f => ({ ...f, horario_fim: e.target.value }))} />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loadingRegra}>
                {loadingRegra ? 'Salvando...' : 'Salvar regra'}
              </button>
            </form>
          </div>
        </div>
      )}

      {modalOp && (
        <ModalOperacao onClose={() => setModalOp(false)} onSave={refetch} />
      )}
      {modalMentorIA && (
        <ModalMentorIA operacoes={operacoes} onClose={() => setModalMentorIA(false)} />
      )}
    </>
  )
}
