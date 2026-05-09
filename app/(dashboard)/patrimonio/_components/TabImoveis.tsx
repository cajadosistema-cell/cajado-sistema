'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency, cn } from '@/lib/utils'
import { exportCSV } from '@/lib/export-utils'

type Imovel = {
  id: string
  titulo: string
  endereco: string | null
  tipo_imovel: 'residencial' | 'comercial' | 'terreno' | 'galpao'
  area_m2: number | null
  quartos: number | null
  vagas: number | null
  valor_compra: number | null
  valor_mercado: number | null
  status: 'alugado' | 'disponivel' | 'em_reforma' | 'vendido'
  construtora: string | null
  unidade: string | null
  valor_total_contrato: number | null
  valor_parcela: number | null
  parcelas_total: number | null
  parcelas_pagas: number | null
  indexador: string | null
  data_aquisicao: string | null
  dia_vencimento: number | null
  categoria_financeira: string | null
  taxa_juros_anual: number | null
}

const STATUS_CONFIG = {
  alugado:    { label: 'Alugado',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  disponivel: { label: 'Disponível',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  em_reforma: { label: 'Em Reforma',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  vendido:    { label: 'Vendido',     color: 'text-fg-secondary bg-muted border-border-subtle' },
}

const FORM_INICIAL = {
  titulo: '', endereco: '', tipo_imovel: 'residencial' as Imovel['tipo_imovel'],
  area_m2: '', quartos: '', vagas: '', valor_compra: '', valor_mercado: '',
  status: 'disponivel' as Imovel['status'], construtora: '', unidade: '',
  valor_total_contrato: '', valor_parcela: '', parcelas_total: '',
  parcelas_pagas: '0', indexador: '', data_aquisicao: '',
  dia_vencimento: '', categoria_financeira: 'Financiamento Imobiliário',
  taxa_juros_anual: '',
}

// ── Modal Análise de Quitação ────────────────────────────────
function ModalAnalisarQuitacao({ item, onClose }: {
  item: { titulo: string; valor_parcela: number | null; parcelas_total: number | null; parcelas_pagas: number | null; taxa_juros_anual: number | null; indexador?: string | null }
  onClose: () => void
}) {
  const [cdi, setCdi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Busca CDI atual via API pública do Banco Central
  useState(() => {
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json')
      .then(r => r.json())
      .then(d => { setCdi(parseFloat(d[0]?.valor ?? '10.5')); setLoading(false) })
      .catch(() => { setCdi(10.5); setLoading(false) }) // fallback CDI 10.5%
  })

  const pt = item.parcelas_total ?? 0
  const pp = item.parcelas_pagas ?? 0
  const faltam = pt - pp
  const valParc = item.valor_parcela ?? 0
  const saldoApprox = faltam * valParc
  const taxa = item.taxa_juros_anual
  const jurosEstimados = taxa ? saldoApprox - (saldoApprox / (1 + taxa / 100)) : null

  const recomendacao = () => {
    if (!taxa || !cdi) return null
    if (taxa > cdi) return {
      icone: '🟢', cor: 'text-emerald-400',
      texto: `Sua taxa (${taxa}% a.a.) está acima do CDI atual (${cdi.toFixed(2)}% a.a.). Vale a pena quitar antecipado!`,
      acao: 'Quitar o quanto antes — você paga mais de juros do que ganharia investindo.'
    }
    return {
      icone: '🟡', cor: 'text-amber-400',
      texto: `Sua taxa (${taxa}% a.a.) está abaixo do CDI atual (${cdi.toFixed(2)}% a.a.).`,
      acao: 'Pode valer mais investir o dinheiro da quitação do que pagar antecipado.'
    }
  }

  const rec = recomendacao()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">📈 Análise de Quitação</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">{item.titulo}</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">📦 Parcelas restantes</p>
              <p className="text-lg font-bold text-fg">{faltam}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">💰 Saldo estimado</p>
              <p className="text-lg font-bold text-red-400">
                {faltam > 0 && valParc > 0 ? `R$ ${saldoApprox.toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">🏦 CDI Atual (BACEN)</p>
              <p className="text-lg font-bold text-blue-400">
                {loading ? '⏳...' : `${cdi?.toFixed(2)}% a.a.`}
              </p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">📊 Taxa Financiamento</p>
              <p className="text-lg font-bold text-amber-400">
                {taxa ? `${taxa}% a.a.` : 'Não informado'}
              </p>
            </div>
          </div>

          {jurosEstimados && jurosEstimados > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">🔥 Juros estimados ainda a pagar</p>
              <p className="text-sm font-bold text-red-400">
                R$ {jurosEstimados.toLocaleString('pt-BR', {minimumFractionDigits:2})}
              </p>
              <p className="text-[10px] text-fg-disabled mt-1">Cálculo aproximado baseado na taxa anual e saldo devedor estimado</p>
            </div>
          )}

          {item.indexador && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
              <p>📌 Indexador: <strong>{item.indexador}</strong> — o valor das parcelas pode variar mensalmente.</p>
            </div>
          )}

          {rec ? (
            <div className={`rounded-xl p-4 border ${ rec.icone === '🟢' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <p className={`text-sm font-bold mb-1 ${rec.cor}`}>{rec.icone} {rec.texto}</p>
              <p className="text-xs text-fg-secondary">{rec.acao}</p>
            </div>
          ) : !taxa ? (
            <div className="bg-muted rounded-xl p-3 text-xs text-fg-tertiary">
              ⚠️ Taxa de juros não informada. Edite o item e preencha a taxa para obter a análise completa.
            </div>
          ) : null}
        </div>

        <button onClick={onClose} className="btn-secondary w-full mt-5">Fechar</button>
      </div>
    </div>
  )
}

// ── Modal Lançar Parcela no Financeiro ────────────────────────────
function ModalLancarParcela({ imovel, onClose, onLancado }: {
  imovel: Imovel
  onClose: () => void
  onLancado: () => void
}) {
  const supabase = createClient()
  const [contas, setContas] = useState<{id:string;nome:string;tipo:string}[]>([])
  const hoje = new Date()
  const diaVenc = imovel.dia_vencimento || 10
  const dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc)
  const dataVencStr = dataVenc.toISOString().split('T')[0]
  const proxParcela = (imovel.parcelas_pagas ?? 0) + 1

  const [form, setForm] = useState({
    conta_id: '',
    valor: String(imovel.valor_parcela || ''),
    descricao: `Parcela ${proxParcela}/${imovel.parcelas_total ?? '?'} – ${imovel.titulo}`,
    data_competencia: dataVencStr,
    categoria_financeira: imovel.categoria_financeira || 'Financiamento Imobiliário',
  })
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'erro'>('idle')
  const [msg, setMsg] = useState('')

  useState(() => {
    supabase.from('contas').select('id,nome,tipo').then(({ data }) => {
      if (data) setContas(data as any)
    })
  })

  const handleLancar = async () => {
    if (!form.conta_id) { setMsg('❗ Selecione uma conta'); return }
    setStatus('loading')
    try {
      // 1. Busca ou cria categoria
      let catId: string | null = null
      const { data: cats } = await supabase
        .from('categorias_financeiras')
        .select('id').eq('nome', form.categoria_financeira).maybeSingle()
      if (cats?.id) {
        catId = cats.id
      } else {
        const { data: novaCat } = await (supabase.from('categorias_financeiras') as any)
          .insert({ nome: form.categoria_financeira, tipo: 'despesa', cor: '#F59E0B' })
          .select('id').single()
        catId = novaCat?.id ?? null
      }

      // 2. Cria o lançamento
      const { error } = await (supabase.from('lancamentos') as any).insert({
        conta_id: form.conta_id,
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        tipo: 'despesa',
        regime: 'competencia',
        status: 'pendente',
        data_competencia: form.data_competencia,
        categoria_id: catId,
        parcela_atual: proxParcela,
        total_parcelas: imovel.parcelas_total,
        observacoes: `Imóvel: ${imovel.titulo} | Indexador: ${imovel.indexador || '-'}`,
      })
      if (error) throw new Error(error.message)

      // 3. Incrementa parcelas_pagas
      await (supabase.from('imoveis') as any)
        .update({ parcelas_pagas: proxParcela })
        .eq('id', imovel.id)

      setStatus('ok')
      setMsg(`✅ Parcela ${proxParcela} lançada no Financeiro!`)
      setTimeout(() => { onLancado(); onClose() }, 1500)
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">💳 Lançar Parcela no Financeiro</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">{imovel.titulo}</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <div className="space-y-3">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            <p>📊 Parcela <strong>{proxParcela}/{imovel.parcelas_total ?? '?'}</strong> &nbsp;·&nbsp; Vencimento: <strong>dia {diaVenc}</strong></p>
            {imovel.indexador && <p className="mt-1">📌 Indexador: {imovel.indexador}</p>}
          </div>

          <div>
            <label className="label">Valor da parcela (R$)</label>
            <input type="number" step="0.01" className="input mt-1" value={form.valor}
              onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
          </div>

          <div>
            <label className="label">Data de vencimento</label>
            <input type="date" className="input mt-1" value={form.data_competencia}
              onChange={e => setForm(f => ({...f, data_competencia: e.target.value}))} />
          </div>

          <div>
            <label className="label">Conta para débito *</label>
            <select className="input mt-1" value={form.conta_id}
              onChange={e => setForm(f => ({...f, conta_id: e.target.value}))}>
              <option value="">Selecione a conta...</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
            </select>
          </div>

          <div>
            <label className="label">Categoria financeira</label>
            <input className="input mt-1" value={form.categoria_financeira}
              onChange={e => setForm(f => ({...f, categoria_financeira: e.target.value}))} />
          </div>

          <div>
            <label className="label">Descrição do lançamento</label>
            <input className="input mt-1" value={form.descricao}
              onChange={e => setForm(f => ({...f, descricao: e.target.value}))} />
          </div>
        </div>

        {msg && (
          <div className={cn('rounded-xl p-3 mt-4 text-sm',
            status==='ok' ? 'bg-emerald-500/10 text-emerald-400' :
            status==='erro' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400')}>
            {status==='loading' && <span className="animate-pulse">⏳ </span>}{msg}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleLancar} disabled={status==='loading'} className="btn-primary">
            {status==='loading' ? '⏳ Lançando...' : '💳 Confirmar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de Importação via IA ──────────────────────────────────
function ModalImportarIA({ onClose, onImportado }: { onClose: () => void; onImportado: () => void }) {
  const supabase = createClient()
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview' | 'saving' | 'ok' | 'erro'>('idle')
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

    if (isPDF) {
      // PDF é binário — precisa extrair texto no servidor
      setStatus('loading')
      setMsg('Extraindo texto do PDF...')
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Erro ao ler PDF')
        const textoExtraido = (data.text ?? data.texto ?? '').trim()
        if (!textoExtraido) throw new Error('PDF sem texto extraível. Tente copiar e colar o conteúdo.')
        setTexto(textoExtraido)
        setStatus('idle')
        setMsg(`✅ PDF lido: ${textoExtraido.length} caracteres extraídos. Clique em "Importar com IA".`)
      } catch (err: any) {
        setStatus('erro')
        setMsg(`❌ ${err.message}`)
      }
      return
    }

    // CSV / TXT — lê normalmente como texto
    const reader = new FileReader()
    reader.onload = ev => setTexto(ev.target?.result as string ?? '')
    reader.readAsText(file, 'utf-8')
  }

  const handleImportar = async () => {
    if (!texto.trim()) return
    setStatus('loading')
    setMsg('Analisando documento com IA...')
    try {
      // Detecta CSV por ponto-e-vírgula
      const linhas = texto.split('\n').filter(l => l.trim())
      const isCSV = texto.includes(';') && linhas.length > 1
      const header = linhas[0] || ''
      const dadosSample = linhas.slice(1, 4).join('\n')

      const promptCSV = `Este é um relatório CSV de financiamento imobiliário separado por ponto-e-vírgula (;).
Colunas: ${header}
Dados (primeiras 3 linhas):
${dadosSample}

Extraia os dados do PRIMEIRO imóvel e retorne APENAS o JSON abaixo sem texto adicional, sem markdown:
{"titulo":"construtora + unidade","construtora":"empresa","unidade":"cod","endereco":null,"tipo_imovel":"residencial","area_m2":null,"quartos":null,"valor_compra":0,"valor_total_contrato":0,"valor_parcela":0,"parcelas_total":0,"parcelas_pagas":0,"indexador":"REAL","taxa_juros_anual":null,"data_aquisicao":"YYYY-MM-DD","status":"disponivel"}`

      // Para PDFs longos: envia o início (cabeçalho + primeiras parcelas) E o final (resumo/totais)
      const textoInicio = texto.substring(0, 12000)
      const textoFinal = texto.length > 14000 ? texto.substring(texto.length - 3000) : ''
      const textoParaIA = textoFinal
        ? `=== INÍCIO DO DOCUMENTO ===\n${textoInicio}\n\n=== FINAL DO DOCUMENTO (resumo/totais) ===\n${textoFinal}`
        : textoInicio

      const promptDoc = `Você está analisando um documento "Saldo Devedor Presente" de financiamento imobiliário brasileiro.
O documento pode conter MÚLTIPLOS contratos/imóveis. Se houver mais de um, escolha o imóvel com MAIS parcelas futuras a vencer (o contrato ativo principal).

REGRAS CRÍTICAS para extração:
1. "parcelas_total" = PRIORIDADE: use o campo "Ano próximo" ou "Total parcelas" ou conte o número de parcela mais alto visível na tabela. NÃO conte apenas as linhas visíveis.
2. "parcelas_pagas" = procure na seção "VALORES PAGOS" — conte quantas linhas existem, ou use "Total parcelas pagas" se existir no resumo
3. Se o documento tiver seção "=== FINAL DO DOCUMENTO ===" com totalizadores, USE esses valores para parcelas_total e parcelas_pagas
4. "valor_parcela" = valor da parcela mensal (campo "Valor Original" ou "Valor Atualizado" de uma linha típica)
5. "valor_total_contrato" = campo "Valor total do contrato"
6. "titulo" = nome da empresa construtora + unidade (ex: "GMS SPE LTDA — S01-Q05-LT14")
7. "indexador" = campo Indexador (ex: REAL, INCC-M, IGP-M, TR, IPCA)
8. "status" = use APENAS uma destas palavras exatas: disponivel, alugado, vendido, em_reforma
9. "tipo_imovel" = use APENAS: residencial, comercial, terreno, galpao

Documento (${texto.length} chars totais):
${textoParaIA}

Retorne APENAS JSON válido sem markdown:
{"titulo":"empresa + unidade","construtora":"nome empresa","unidade":"cod","endereco":null,"tipo_imovel":"residencial","area_m2":null,"quartos":null,"valor_compra":null,"valor_total_contrato":null,"valor_parcela":null,"parcelas_total":null,"parcelas_pagas":0,"indexador":null,"taxa_juros_anual":null,"data_aquisicao":null,"status":"disponivel"}`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: isCSV ? promptCSV : promptDoc,
          context: '',
          systemInstruction: 'Retorne APENAS o objeto JSON puro. Sem texto antes, sem texto depois, sem markdown, sem explicação.'
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro na IA')

      // Extrai JSON da resposta — 3 tentativas
      let raw = (data.result ?? '').trim()
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      console.log('[TabImoveis] IA raw (500):', raw.substring(0, 500))

      let parsed: any = null
      // T1: parse direto
      try { parsed = JSON.parse(raw) } catch (_) {}
      // T2: extrai { ... } usando indexOf
      if (!parsed) {
        const s = raw.indexOf('{')
        const e = raw.lastIndexOf('}')
        if (s !== -1 && e > s) try { parsed = JSON.parse(raw.substring(s, e + 1)) } catch (_) {}
      }
      // T3: extrai [ ... ]
      if (!parsed) {
        const s = raw.indexOf('[')
        const e = raw.lastIndexOf(']')
        if (s !== -1 && e > s) {
          try {
            const arr = JSON.parse(raw.substring(s, e + 1))
            if (Array.isArray(arr) && arr.length > 0) parsed = arr[0]
          } catch (_) {}
        }
      }
      if (!parsed) throw new Error('IA retornou formato inválido. Tente colar apenas as primeiras linhas do documento.')
      if (Array.isArray(parsed)) parsed = parsed[0]

      // empresa_id deve ser o UUID da empresa (perfis.empresa_id), exigido pela RLS
      const { data: userData } = await supabase.auth.getUser()
      let empId: string | null = null
      if (userData.user) {
        const { data: perf } = await supabase
          .from('perfis').select('empresa_id').eq('id', userData.user.id).single()
        empId = perf?.empresa_id ?? null
      }
      setEmpresaId(empId)

      // Mostra preview para o usuário confirmar/corrigir antes de salvar
      setPreview({
        titulo: parsed.titulo || 'Imóvel importado',
        construtora: parsed.construtora || '',
        unidade: parsed.unidade || '',
        tipo_imovel: parsed.tipo_imovel || 'residencial',
        valor_total_contrato: parsed.valor_total_contrato || parsed.valor_compra || '',
        valor_parcela: parsed.valor_parcela || '',
        parcelas_total: parsed.parcelas_total || '',
        parcelas_pagas: parsed.parcelas_pagas ?? 0,
        indexador: parsed.indexador || '',
        data_aquisicao: parsed.data_aquisicao || '',
        status: parsed.status || 'disponivel',
      })
      setStatus('preview')
      setMsg('')
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ Erro: ${err.message}`)
    }
  }

  const handleSalvarPreview = async () => {
    if (!preview) return
    setStatus('saving')
    setMsg('Salvando imóvel...')
    try {
      const STATUS_VALIDOS = ['disponivel', 'alugado', 'vendido', 'em_reforma', 'em_obra', 'quitado', 'financiado']
      const TIPO_VALIDOS   = ['residencial', 'comercial', 'terreno', 'galpao']
      const sanitizeStatus = (v: string) => {
        const norm = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        if (norm.includes('quitad') || norm.includes('liquidado')) return 'disponivel'
        if (norm.includes('alugad')) return 'alugado'
        if (norm.includes('vendid')) return 'vendido'
        if (norm.includes('reforma') || norm.includes('obra') || norm.includes('financiad') || norm.includes('incorpora')) return 'em_reforma'
        return STATUS_VALIDOS.find(s => norm === s) ?? 'disponivel'
      }
      const sanitizeTipo = (v: string) => {
        const norm = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        return TIPO_VALIDOS.find(t => norm.includes(t)) ?? 'residencial'
      }

      const { error } = await (supabase.from('imoveis') as any).insert({
        empresa_id: empresaId,
        titulo: preview.titulo || 'Imóvel importado',
        construtora: preview.construtora || null,
        unidade: preview.unidade || null,
        tipo_imovel: sanitizeTipo(preview.tipo_imovel || 'residencial'),
        valor_compra: parseFloat(String(preview.valor_total_contrato)) || null,
        valor_total_contrato: parseFloat(String(preview.valor_total_contrato)) || null,
        valor_parcela: parseFloat(String(preview.valor_parcela)) || null,
        parcelas_total: parseInt(String(preview.parcelas_total)) || null,
        parcelas_pagas: parseInt(String(preview.parcelas_pagas)) || 0,
        indexador: preview.indexador || null,
        data_aquisicao: preview.data_aquisicao || null,
        status: sanitizeStatus(preview.status || 'disponivel'),
        area_m2: null, quartos: null, vagas: null, valor_mercado: null,
        taxa_juros_anual: null, dia_vencimento: null, categoria_financeira: null,
      })
      if (error) throw new Error(error.message)
      setStatus('ok')
      setMsg(`✅ Imóvel "${preview.titulo}" importado com sucesso!`)
      setTimeout(() => { onImportado(); onClose() }, 1500)
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ Erro: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">🤖 Importar Imóvel via IA</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">
              {status === 'preview' ? '✅ IA extraiu os dados — revise e confirme' : 'Cole o texto do documento ou selecione um arquivo'}
            </p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        {/* PASSO 1: Input do documento */}
        {status !== 'preview' && (
          <>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300 space-y-1">
              <p className="font-semibold">📄 Formatos aceitos:</p>
              <p>• Copie e cole o texto do PDF "Saldo Devedor Presente"</p>
              <p>• Arquivo CSV com dados do imóvel</p>
              <p>• Qualquer texto com: nome, valor do contrato, parcelas, construtora</p>
            </div>
            <textarea
              className="input w-full h-36 text-xs font-mono resize-none mb-3"
              placeholder="Cole aqui o conteúdo do documento do imóvel..."
              value={texto}
              onChange={e => setTexto(e.target.value)}
            />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-fg-tertiary">ou</span>
              <input ref={fileRef} type="file" accept=".csv,.txt,.pdf" onChange={handleFile} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
                📂 Selecionar arquivo (PDF, CSV, TXT)
              </button>
              {texto && <span className="text-xs text-emerald-400">✓ {texto.length} caracteres</span>}
            </div>
          </>
        )}

        {/* PASSO 2: Preview/edição dos dados extraídos */}
        {status === 'preview' && preview && (
          <div className="space-y-3">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 mb-2">
              🎯 Verifique os dados abaixo. Corrija se necessário antes de salvar.
            </div>
            <div>
              <label className="label text-[10px]">Título</label>
              <input className="input mt-1 text-xs" value={preview.titulo}
                onChange={e => setPreview((p: any) => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-[10px]">Construtora</label>
                <input className="input mt-1 text-xs" value={preview.construtora}
                  onChange={e => setPreview((p: any) => ({ ...p, construtora: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">Unidade</label>
                <input className="input mt-1 text-xs" value={preview.unidade}
                  onChange={e => setPreview((p: any) => ({ ...p, unidade: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-[10px]">Valor Total Contrato</label>
                <input className="input mt-1 text-xs" type="number" value={preview.valor_total_contrato}
                  onChange={e => setPreview((p: any) => ({ ...p, valor_total_contrato: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">Parcela Mensal</label>
                <input className="input mt-1 text-xs" type="number" value={preview.valor_parcela}
                  onChange={e => setPreview((p: any) => ({ ...p, valor_parcela: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[10px]">✅ Pagas</label>
                <input className="input mt-1 text-xs" type="number" value={preview.parcelas_pagas}
                  onChange={e => setPreview((p: any) => ({ ...p, parcelas_pagas: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">📦 Total</label>
                <input className="input mt-1 text-xs" type="number" value={preview.parcelas_total}
                  onChange={e => setPreview((p: any) => ({ ...p, parcelas_total: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">Indexador</label>
                <input className="input mt-1 text-xs" value={preview.indexador}
                  onChange={e => setPreview((p: any) => ({ ...p, indexador: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {msg && (
          <div className={cn('rounded-xl p-3 mt-3 text-sm', status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : status === 'erro' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400')}>
            {(status === 'loading' || status === 'saving') && <span className="animate-pulse">⏳ </span>}{msg}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          {status === 'preview' ? (
            <>
              <button onClick={() => { setStatus('idle'); setPreview(null) }} className="btn-secondary">← Voltar</button>
              <button onClick={handleSalvarPreview} disabled={status === 'saving' as any} className="btn-primary">
                💾 Confirmar e Salvar
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary">Cancelar</button>
              <button onClick={handleImportar} disabled={!texto.trim() || status === 'loading'} className="btn-primary">
                {status === 'loading' ? '⏳ Processando...' : '🤖 Analisar com IA'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────
export function TabImoveis() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showImportIA, setShowImportIA] = useState(false)
  const [imovelLancar, setImovelLancar] = useState<Imovel | null>(null)
  const [imovelAnalisar, setImovelAnalisar] = useState<Imovel | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)

  const { data: imoveis, refetch } = useSupabaseQuery<Imovel>('imoveis', {
    orderBy: { column: 'criado_em', ascending: false }
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      titulo: form.titulo,
      endereco: form.endereco || null,
      tipo_imovel: form.tipo_imovel,
      area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      quartos: form.quartos ? parseInt(form.quartos) : null,
      vagas: form.vagas ? parseInt(form.vagas) : null,
      valor_compra: form.valor_compra ? parseFloat(form.valor_compra) : null,
      valor_mercado: form.valor_mercado ? parseFloat(form.valor_mercado) : null,
      status: form.status,
      construtora: form.construtora || null,
      unidade: form.unidade || null,
      valor_total_contrato: form.valor_total_contrato ? parseFloat(form.valor_total_contrato) : null,
      valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
      parcelas_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
      parcelas_pagas: form.parcelas_pagas ? parseInt(form.parcelas_pagas) : 0,
      indexador: form.indexador || null,
      data_aquisicao: form.data_aquisicao || null,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      categoria_financeira: form.categoria_financeira || null,
      taxa_juros_anual: form.taxa_juros_anual ? parseFloat(form.taxa_juros_anual) : null,
    }
    
    if (editId) {
      await (supabase.from('imoveis') as any).update(payload).eq('id', editId)
    } else {
      // empresa_id = UUID da empresa (exigido pela RLS policy)
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: perf } = await supabase
          .from('perfis').select('empresa_id').eq('id', userData.user.id).single()
        if (perf?.empresa_id) payload.empresa_id = perf.empresa_id
      }
      await (supabase.from('imoveis') as any).insert(payload)
    }
    setShowForm(false); setEditId(null); refetch(); setForm(FORM_INICIAL)
  }

  const handleExcluir = async (id: string, titulo: string) => {
    if (!confirm(`Excluir o imóvel "${titulo}"?`)) return
    await (supabase.from('imoveis') as any).delete().eq('id', id)
    refetch()
  }

  const handleEdit = (im: Imovel) => {
    setForm({
      titulo: im.titulo, endereco: im.endereco || '', tipo_imovel: im.tipo_imovel,
      area_m2: im.area_m2 ? String(im.area_m2) : '', quartos: im.quartos ? String(im.quartos) : '',
      vagas: im.vagas ? String(im.vagas) : '',
      valor_compra: im.valor_compra ? String(im.valor_compra) : '',
      valor_mercado: im.valor_mercado ? String(im.valor_mercado) : '',
      status: im.status, construtora: im.construtora || '', unidade: im.unidade || '',
      valor_total_contrato: im.valor_total_contrato ? String(im.valor_total_contrato) : '',
      valor_parcela: im.valor_parcela ? String(im.valor_parcela) : '',
      parcelas_total: im.parcelas_total ? String(im.parcelas_total) : '',
      parcelas_pagas: im.parcelas_pagas ? String(im.parcelas_pagas) : '0',
      indexador: im.indexador || '', data_aquisicao: im.data_aquisicao || '',
      dia_vencimento: im.dia_vencimento ? String(im.dia_vencimento) : '',
      categoria_financeira: im.categoria_financeira || 'Financiamento Imobiliário',
      taxa_juros_anual: im.taxa_juros_anual ? String(im.taxa_juros_anual) : '',
    })
    setEditId(im.id); setShowForm(true)
  }

  const mudarStatus = async (id: string, status: Imovel['status']) => {
    await (supabase.from('imoveis') as any).update({ status }).eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-fg">🏠 Carteira de Imóveis</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => {
            exportCSV(`imoveis_${new Date().toISOString().slice(0,10)}.csv`,
              ['Título','Tipo','Status','Construtora','Unidade','Valor Compra','Valor Mercado','Contrato Total','Parcela','Pagas','Total','Taxa% a.a.','Indexador','Data Aquisição'],
              imoveis.map(im => [
                im.titulo, im.tipo_imovel, im.status,
                im.construtora||'', im.unidade||'',
                im.valor_compra??'', im.valor_mercado??'',
                im.valor_total_contrato??'', im.valor_parcela??'',
                im.parcelas_pagas??'', im.parcelas_total??'',
                im.taxa_juros_anual??'', im.indexador||'',
                im.data_aquisicao||'',
              ])
            )
          }} className="btn-secondary text-xs">📥 Exportar CSV</button>
          <button onClick={async () => {
            const { exportPDF } = await import('@/lib/export-utils')
            await exportPDF(
              `imoveis_${new Date().toISOString().slice(0,10)}.pdf`,
              '🏠 Carteira de Imóveis', `Total: ${imoveis.length} imóveis`,
              ['Título','Tipo','Status','Valor Compra','Valor Mercado','Parcelas','Taxa'],
              imoveis.map(im => [[im.titulo],[im.tipo_imovel],[im.status],
                [im.valor_compra ? `R$ ${im.valor_compra.toLocaleString('pt-BR')}` : '—'],
                [im.valor_mercado ? `R$ ${im.valor_mercado.toLocaleString('pt-BR')}` : '—'],
                [`${im.parcelas_pagas||0}/${im.parcelas_total||0}`],
                [im.taxa_juros_anual ? `${im.taxa_juros_anual}% a.a.` : '—']
              ])
            )
          }} className="btn-secondary text-xs">📄 Exportar PDF</button>
          <button onClick={() => setShowImportIA(true)} className="btn-secondary text-xs">
            🤖 Importar Documento
          </button>
          <button onClick={() => {
            if (showForm) { setShowForm(false); setEditId(null); setForm(FORM_INICIAL) }
            else setShowForm(true)
          }} className="btn-primary text-xs">
            {showForm ? '✕ Cancelar' : '+ Cadastrar Imóvel'}
          </button>
        </div>
      </div>

      {/* Formulário manual */}
      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título / Apelido *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                placeholder="Ex: Apto 302 Centro" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo_imovel} onChange={e => setForm(f => ({...f, tipo_imovel: e.target.value as any}))}>
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
                <option value="galpao">Galpão</option>
                <option value="terreno">Terreno</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Construtora / Incorporadora</label>
              <input className="input mt-1" value={form.construtora}
                onChange={e => setForm(f => ({...f, construtora: e.target.value}))}
                placeholder="Ex: VCA Empreendimentos" />
            </div>
            <div>
              <label className="label">Unidade / Bloco</label>
              <input className="input mt-1" value={form.unidade}
                onChange={e => setForm(f => ({...f, unidade: e.target.value}))}
                placeholder="Ex: BL29-APT06" />
            </div>
          </div>
          <div>
            <label className="label">Endereço Completo</label>
            <input className="input mt-1" value={form.endereco}
              onChange={e => setForm(f => ({...f, endereco: e.target.value}))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Área (m²)</label><input type="number" className="input mt-1" value={form.area_m2} onChange={e => setForm(f => ({...f, area_m2: e.target.value}))} /></div>
            <div><label className="label">Quartos</label><input type="number" className="input mt-1" value={form.quartos} onChange={e => setForm(f => ({...f, quartos: e.target.value}))} /></div>
            <div><label className="label">Vagas</label><input type="number" className="input mt-1" value={form.vagas} onChange={e => setForm(f => ({...f, vagas: e.target.value}))} /></div>
          </div>

          {/* Separador financiamento */}
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest pt-1 border-t border-border-subtle">💰 Valores e Parcelamento</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Valor Total do Contrato (R$)</label><input type="number" step="0.01" className="input mt-1" value={form.valor_total_contrato} onChange={e => setForm(f => ({...f, valor_total_contrato: e.target.value, valor_compra: e.target.value}))} /></div>
            <div><label className="label">Valor de Mercado (R$)</label><input type="number" step="0.01" className="input mt-1" value={form.valor_mercado} onChange={e => setForm(f => ({...f, valor_mercado: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Valor Parcela</label><input type="number" step="0.01" className="input mt-1" value={form.valor_parcela} onChange={e => setForm(f => ({...f, valor_parcela: e.target.value}))} /></div>
            <div><label className="label">Parcelas Total</label><input type="number" className="input mt-1" value={form.parcelas_total} onChange={e => setForm(f => ({...f, parcelas_total: e.target.value}))} /></div>
            <div><label className="label">Parcelas Pagas</label><input type="number" className="input mt-1" value={form.parcelas_pagas} onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} /></div>
            <div>
              <label className="label">Indexador</label>
              <select className="input mt-1" value={form.indexador} onChange={e => setForm(f => ({...f, indexador: e.target.value}))}>
                <option value="">—</option>
                <option value="INCC-M">INCC-M</option>
                <option value="IPCA">IPCA</option>
                <option value="IGP-M">IGP-M</option>
                <option value="REAL">REAL (sem correção)</option>
              </select>
            </div>
          </div>
          {/* Vencimento e Categoria (novos campos) */}
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest pt-1 border-t border-border-subtle">📅 Lançamento Automático de Parcela</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dia do vencimento (1–31)</label>
              <input type="number" min="1" max="31" className="input mt-1" value={form.dia_vencimento}
                placeholder="Ex: 10" onChange={e => setForm(f => ({...f, dia_vencimento: e.target.value}))} />
            </div>
            <div>
              <label className="label">Categoria financeira</label>
              <input className="input mt-1" value={form.categoria_financeira}
                placeholder="Ex: Financiamento Imobiliário"
                onChange={e => setForm(f => ({...f, categoria_financeira: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Data de Aquisição</label><input type="date" className="input mt-1" value={form.data_aquisicao} onChange={e => setForm(f => ({...f, data_aquisicao: e.target.value}))} /></div>
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
                <option value="disponivel">Disponível</option>
                <option value="alugado">Alugado</option>
                <option value="em_reforma">Em Reforma</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">
              {editId ? 'Salvar Alterações' : 'Salvar Imóvel'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de imóveis */}
      {imoveis.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8">
          <EmptyState message="Nenhum imóvel cadastrado" />
          <p className="text-xs text-fg-tertiary text-center mt-2">Use o botão "🤖 Importar Documento" para importar um contrato ou saldo devedor automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imoveis.map(im => {
            const pt = im.parcelas_total ?? 0
            const pp = im.parcelas_pagas ?? 0
            const prog = pt > 0 ? Math.min(100, Math.round((pp / pt) * 100)) : 0
            const saldoDevedor = pt > 0 && im.valor_parcela ? (pt - pp) * im.valor_parcela : null

            return (
              <div key={im.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border transition-colors">
                {/* Header do card */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-fg">{im.titulo}</h3>
                    <p className="text-xs text-fg-tertiary capitalize">{im.tipo_imovel}</p>
                    {im.construtora && <p className="text-[10px] text-fg-disabled mt-0.5">🏗️ {im.construtora}{im.unidade ? ` · ${im.unidade}` : ''}</p>}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <select className={cn('text-[10px] px-2 py-1 rounded-full border bg-page outline-none', STATUS_CONFIG[im.status].color)}
                      value={im.status} onChange={e => mudarStatus(im.id, e.target.value as Imovel['status'])}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button onClick={() => handleEdit(im)} className="text-fg-disabled hover:text-blue-400 transition-colors" title="Editar">✏️</button>
                    <button onClick={() => handleExcluir(im.id, im.titulo)} className="text-fg-disabled hover:text-red-400 transition-colors" title="Excluir">🗑️</button>
                  </div>
                </div>

                {im.endereco && <p className="text-[10px] text-fg-secondary mb-3 line-clamp-1">📍 {im.endereco}</p>}

                <div className="flex gap-4 mb-3">
                  {im.area_m2 && <div className="text-xs text-fg-tertiary">📏 <span className="text-fg-secondary font-medium">{im.area_m2}m²</span></div>}
                  {im.quartos && <div className="text-xs text-fg-tertiary">🛏️ <span className="text-fg-secondary font-medium">{im.quartos}</span></div>}
                  {im.data_aquisicao && <div className="text-xs text-fg-tertiary">📅 <span className="text-fg-secondary font-medium">{new Date(im.data_aquisicao + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span></div>}
                </div>

                {/* Parcelamento */}
                {pt > 0 && (
                  <div className="mb-3 p-3 rounded-xl bg-surface border border-border-subtle space-y-3">
                    {/* Título do bloco */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">
                        📦 Parcelamento {im.indexador ? `· ${im.indexador}` : ''}
                      </span>
                      {im.taxa_juros_anual && (
                        <span className="text-[10px] text-fg-disabled">📊 {im.taxa_juros_anual}% a.a.</span>
                      )}
                    </div>

                    {/* KPIs de parcelas — 4 caixas */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-emerald-400 uppercase font-semibold">✅ Pagas</p>
                        <p className="text-base font-bold text-emerald-400">{pp}</p>
                      </div>
                      <div className="bg-surface border border-border-subtle rounded-lg p-2 text-center">
                        <p className="text-[9px] text-fg-tertiary uppercase font-semibold">Total</p>
                        <p className="text-base font-bold text-fg">{pt}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-amber-400 uppercase font-semibold">⏳ Faltam</p>
                        <p className="text-base font-bold text-amber-400">{pt - pp}</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-blue-400 uppercase font-semibold">% Pago</p>
                        <p className="text-base font-bold text-blue-400">{prog}%</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div>
                      <div className="flex justify-between text-[10px] text-fg-tertiary mb-1">
                        <span>{pp} parcela{pp !== 1 ? 's' : ''} paga{pp !== 1 ? 's' : ''}</span>
                        <span className="font-semibold" style={{ color: prog >= 90 ? '#10b981' : prog >= 50 ? '#3b82f6' : '#f59e0b' }}>
                          {prog}% concluído
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${prog}%`,
                            background: prog >= 90
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : prog >= 50
                              ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                              : 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-fg-disabled mt-0.5">
                        <span>Parcela {pp + 1 <= pt ? pp + 1 : pt}/{pt}</span>
                        {im.dia_vencimento && <span>Vence dia {im.dia_vencimento}</span>}
                      </div>
                    </div>

                    {/* Valores: parcela mensal + saldo restante */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-subtle/60">
                      {im.valor_parcela && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Parcela mensal</p>
                          <p className="text-xs font-bold text-amber-400">{formatCurrency(im.valor_parcela)}</p>
                        </div>
                      )}
                      {saldoDevedor !== null && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Saldo restante est.</p>
                          <p className="text-xs font-bold text-red-400">{formatCurrency(saldoDevedor)}</p>
                        </div>
                      )}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      {prog < 100 && (
                        <button
                          onClick={() => setImovelLancar(im)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          💳 Lançar Parcela {pp + 1}/{pt}
                        </button>
                      )}
                      <button
                        onClick={() => setImovelAnalisar(im)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        📈 Analisar Quitação
                      </button>
                    </div>
                  </div>
                )}

                {/* Valores */}
                <div className="pt-3 border-t border-border-subtle/80 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Compra</p>
                    <p className="text-sm font-semibold text-fg-secondary">{im.valor_compra ? formatCurrency(im.valor_compra) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Mercado</p>
                    <p className="text-sm font-semibold text-emerald-400">{im.valor_mercado ? formatCurrency(im.valor_mercado) : '—'}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showImportIA && (
        <ModalImportarIA onClose={() => setShowImportIA(false)} onImportado={refetch} />
      )}
      {imovelLancar && (
        <ModalLancarParcela
          imovel={imovelLancar}
          onClose={() => setImovelLancar(null)}
          onLancado={refetch}
        />
      )}
      {imovelAnalisar && (
        <ModalAnalisarQuitacao item={imovelAnalisar} onClose={() => setImovelAnalisar(null)} />
      )}
    </div>
  )
}
