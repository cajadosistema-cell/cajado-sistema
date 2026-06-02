'use client'
// ── useElenaSalvar.ts ─────────────────────────────────────────
// Responsável por: resolução de contas PF/PJ, salvamento de cada tipo de ação,
// card de confirmação visual, e execução automática após resposta da IA.
//
// REGRA CRÍTICA: todos os callbacks aqui leem userId/sessaoId via REF (não state)
// para evitar stale closures. Nunca passe userId como prop direta para callbacks.

import { useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcaoIA, ConfirmacaoSalvamento, Msg } from './elena-types'
import {
  CAT_DESPESA_ID,
  CAT_RECEITA_ID,
  FORMAS_PAG_VALIDAS,
  TIPOS_EVENTO_VALIDOS,
  COR_EVENTO,
  TIPOS_REGISTRO_LIVRE,
  CATEGORIAS_IDEIA,
  MAPA_CONFIRMACAO,
  BANDEIRAS_MAP,
} from './elena-constants'
import { buscarDadosRelatorio } from '../ModalRelatorio'

interface UseElenaSalvarProps {
  supabase: SupabaseClient
  userIdRef: React.MutableRefObject<string>
  sessaoIdRef: React.MutableRefObject<string>
  mensagensRef: React.MutableRefObject<Msg[]>     // ref para evitar stale no backup_chat
  colaboradores: { id: string; nome: string }[]
  ultimoRegistroRef: React.MutableRefObject<{ tabela: string; id: string } | null>
  setMensagens: React.Dispatch<React.SetStateAction<Msg[]>>
  setRelatorioData: (data: any) => void
}

interface UseElenaSalvarReturn {
  resolverContaPj: (contaNome?: string, autocriar?: boolean) => Promise<{ id: string; nome: string }>
  resolverContaPf: (contaNome?: string, autocriar?: boolean) => Promise<{ id: string; nome: string }>
  resolverContaQualquer: (contaNome: string) => Promise<{ id: string; nome: string; categoria: string }>
  salvarAcao: (msgId: string, acaoIdx: number, acao: AcaoIA) => Promise<void>
  executarAcoesAuto: (msgId: string, acoes: AcaoIA[], uid: string) => Promise<void>
  setAcaoStatus: (msgId: string, idx: number, status: AcaoIA['status'], errorMsg?: string) => void
}

export function useElenaSalvar({
  supabase,
  userIdRef,
  sessaoIdRef,
  mensagensRef,
  colaboradores,
  ultimoRegistroRef,
  setMensagens,
  setRelatorioData,
}: UseElenaSalvarProps): UseElenaSalvarReturn {

  // Cache da conta PJ padrão para evitar queries repetidas
  const contaPjIdRef = useRef<string | null>(null)

  // ── Helpers internos ──────────────────────────────────────────
  const hoje = () => new Date().toISOString().split('T')[0]

  const validarData = (data: any) =>
    data && /^\d{4}-\d{2}-\d{2}$/.test(String(data)) ? String(data) : hoje()

  const validarFormaPag = (forma: any) =>
    FORMAS_PAG_VALIDAS.includes(forma) ? forma : 'pix'

  // ── setAcaoStatus ─────────────────────────────────────────────
  const setAcaoStatus = useCallback((msgId: string, idx: number, status: AcaoIA['status'], errorMsg?: string) => {
    setMensagens(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, acoes: m.acoes?.map((a, i) => i === idx ? { ...a, status, errorMsg } : a) }
        : m
    ))
  }, [setMensagens])

  // ── exibirConfirmacaoSalvamento ───────────────────────────────
  const exibirConfirmacaoSalvamento = useCallback((
    tipo: string,
    dados: Record<string, any>,
    contaNomeResolvido?: string,
    ultimoId?: string,
    ultimaTabela?: string,
  ) => {
    const info = MAPA_CONFIRMACAO[tipo] || { modulo: tipo, rota: '', icone: '✅' }
    const descricao = dados.descricao || dados.titulo || dados.chave || ''
    const valor = dados.valor ? Number(dados.valor) : undefined
    const categoria = dados.categoria || dados.mes_referencia || undefined
    const dataFmt = dados.data
      ? new Date(dados.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : dados.data_inicio
        ? new Date(dados.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

    const confirmacao: ConfirmacaoSalvamento = {
      tipo, descricao, valor,
      contaNome: contaNomeResolvido || dados.conta_nome || undefined,
      data: dataFmt, categoria,
      modulo: info.modulo, rota: info.rota, icone: info.icone,
      ultimoId, ultimaTabela,
    }

    setMensagens(prev => [...prev, {
      id: Date.now().toString() + '_conf',
      role: 'ai',
      texto: '',
      confirmacao,
    }])
  }, [setMensagens])

  // ── resolverContaPj ───────────────────────────────────────────
  const resolverContaPj = useCallback(async (contaNome?: string, autocriar = true): Promise<{ id: string; nome: string }> => {
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, tipo')
      .eq('categoria', 'pj').eq('ativo', true)
      .order('created_at', { ascending: true })

    if (!contas || contas.length === 0) return { id: '', nome: '' }

    if (contaNome?.trim()) {
      const busca = contaNome.toLowerCase().trim()
      const porBandeira = contas.find((c: any) => c.bandeira?.toLowerCase().includes(busca))
      if (porBandeira) return { id: porBandeira.id, nome: porBandeira.nome }
      const porNome = contas.find((c: any) => {
        const nome = (c.nome || '').toLowerCase()
        return nome.includes(busca) || busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
      })
      if (porNome) return { id: porNome.id, nome: porNome.nome }

      if (autocriar && contaNome.trim().length >= 2) {
        try {
          const nomeNovo = contaNome.trim()
          const bandeira = Object.entries(BANDEIRAS_MAP).find(([k]) => nomeNovo.toLowerCase().includes(k))?.[1] || null
          const tipo = bandeira ? 'cartao_credito' : 'corrente'
          const { data: nova, error } = await (supabase.from('contas') as any).insert({
            nome: nomeNovo, tipo, categoria: 'pj', bandeira,
            saldo_inicial: 0, saldo_atual: 0, ativo: true,
          }).select('id, nome').single()
          if (!error && nova) return { id: nova.id, nome: nova.nome }
        } catch { /* silencioso */ }
      }
    }

    if (!contaPjIdRef.current) contaPjIdRef.current = contas[0].id
    return { id: contas[0].id, nome: contas[0].nome }
  }, [supabase])

  // ── resolverContaPf ───────────────────────────────────────────
  const resolverContaPf = useCallback(async (contaNome?: string, autocriar = true): Promise<{ id: string; nome: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '' }
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, tipo')
      .eq('categoria', 'pf').eq('ativo', true)
      .order('created_at', { ascending: true })

    const busca = contaNome.toLowerCase().trim()
    if (contas?.length) {
      const porBandeira = contas.find((c: any) => c.bandeira?.toLowerCase().includes(busca))
      if (porBandeira) return { id: porBandeira.id, nome: porBandeira.nome }
      const porNome = contas.find((c: any) => {
        const nome = (c.nome || '').toLowerCase()
        return nome.includes(busca) || busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
      })
      if (porNome) return { id: porNome.id, nome: porNome.nome }
    }

    if (autocriar && contaNome.trim().length >= 2) {
      try {
        const nomeNovo = contaNome.trim()
        const bandeira = Object.entries(BANDEIRAS_MAP).find(([k]) => nomeNovo.toLowerCase().includes(k))?.[1] || null
        const tipo = bandeira ? 'cartao_credito' : 'corrente'
        const { data: nova, error } = await (supabase.from('contas') as any).insert({
          nome: nomeNovo, tipo, categoria: 'pf', bandeira,
          saldo_inicial: 0, saldo_atual: 0, ativo: true,
        }).select('id, nome').single()
        if (!error && nova) return { id: nova.id, nome: nova.nome }
      } catch { /* silencioso */ }
    }

    return { id: '', nome: '' }
  }, [supabase])

  // ── resolverContaQualquer ─────────────────────────────────────
  const resolverContaQualquer = useCallback(async (contaNome: string): Promise<{ id: string; nome: string; categoria: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '', categoria: '' }
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, categoria').eq('ativo', true)
    if (!contas?.length) return { id: '', nome: '', categoria: '' }
    const busca = contaNome.toLowerCase().trim()
    const match = contas.find((c: any) => {
      const nome = (c.nome || '').toLowerCase()
      const bandeira = (c.bandeira || '').toLowerCase()
      return nome.includes(busca) || bandeira.includes(busca) ||
        busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
    })
    return match ? { id: match.id, nome: match.nome, categoria: match.categoria } : { id: '', nome: '', categoria: '' }
  }, [supabase])

  // ── salvarAcao ────────────────────────────────────────────────
  const salvarAcao = useCallback(async (msgId: string, acaoIdx: number, acao: AcaoIA) => {
    // Lê userId da ref — nunca fica stale
    const uid = userIdRef.current

    try {
      // ── GASTO PF ─────────────────────────────────────────────
      if (acao.tipo === 'gasto') {
        const dataGasto = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        const { data: dups } = await supabase.from('gastos_pessoais').select('id')
          .eq('user_id', uid).eq('data', dataGasto).eq('valor', valor)
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe um gasto com este valor nesta data.')
        }
        const forma = validarFormaPag(acao.dados.forma_pagamento)
        const contaPf = await resolverContaPf(acao.dados.conta_nome)
        const numParcelas = Number(acao.dados.parcelas) || 1
        const valorTotal = valor
        const notasParcelas = numParcelas > 1 ? `Parcela 1/${numParcelas} — Total R$ ${valorTotal.toFixed(2)} | ` : ''
        const notasFinais = contaPf.nome
          ? `${notasParcelas}Cartão/Conta: ${contaPf.nome} | Registrado pela Elena`
          : `${notasParcelas}Registrado pela Elena`

        const { data: novoGasto, error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: uid,
          descricao: numParcelas > 1 ? `${acao.dados.descricao || 'Gasto via Elena'} (${numParcelas}x)` : (acao.dados.descricao || 'Gasto via Elena'),
          valor: valorTotal,
          categoria: acao.dados.categoria || 'outros',
          forma_pagamento: forma,
          data: dataGasto,
          recorrente: false,
          parcelas: numParcelas > 1 ? numParcelas : null,
          conta_id: contaPf.id || null,
          notas: notasFinais,
        }).select('id').single()
        if (error) throw new Error(error.message)
        if (novoGasto?.id) ultimoRegistroRef.current = { tabela: 'gastos_pessoais', id: novoGasto.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('gasto', acao.dados, contaPf.nome, novoGasto?.id, 'gastos_pessoais')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── RECEITA PF ───────────────────────────────────────────
      } else if (acao.tipo === 'receita') {
        const dataReceita = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        const { data: dups } = await supabase.from('receitas_pessoais').select('id')
          .eq('user_id', uid).eq('data', dataReceita).eq('valor', valor)
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe uma receita com este valor nesta data.')
        }
        const contaPf = await resolverContaPf(acao.dados.conta_nome)
        const forma = validarFormaPag(acao.dados.forma_pagamento)
        const notaReceita = [
          contaPf.nome ? `Conta: ${contaPf.nome}` : null,
          `Forma: ${forma}`,
          'Registrado pela Elena',
        ].filter(Boolean).join(' | ')
        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor, categoria: acao.dados.categoria || 'pro_labore',
          data: dataReceita, recorrente: false,
          conta_id: contaPf.id || null, notas: notaReceita,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('receita', acao.dados, contaPf.nome)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── GASTO EMPRESA ────────────────────────────────────────
      } else if (acao.tipo === 'gasto_empresa') {
        const dataComp = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        const { id: contaId, nome: contaNome } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada. Cadastre uma conta PJ em Financeiro > Contas.')
        const { data: dups } = await supabase.from('lancamentos').select('id')
          .eq('conta_id', contaId).eq('data_competencia', dataComp).eq('valor', valor).eq('tipo', 'despesa')
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma despesa de R$ ${valor} na conta ${contaNome} nesta data.`)
        }
        const forma = validarFormaPag(acao.dados.forma_pagamento)
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Despesa via Elena',
          valor, tipo: 'despesa', regime: 'caixa', status: 'validado',
          data_competencia: dataComp, data_caixa: dataComp,
          categoria_id: CAT_DESPESA_ID,
          created_by: uid,
          observacoes: `Conta: ${contaNome} | Pagamento: ${forma} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('gasto_empresa', acao.dados, contaNome)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── RECEITA EMPRESA ──────────────────────────────────────
      } else if (acao.tipo === 'receita_empresa') {
        const dataComp = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        const { id: contaId, nome: contaNome } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada.')
        const { data: dups } = await supabase.from('lancamentos').select('id')
          .eq('conta_id', contaId).eq('data_competencia', dataComp).eq('valor', valor).eq('tipo', 'receita')
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma receita de R$ ${valor} na conta ${contaNome} nesta data.`)
        }
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor, tipo: 'receita', regime: 'caixa', status: 'validado',
          data_competencia: dataComp, data_caixa: dataComp,
          categoria_id: CAT_RECEITA_ID, created_by: uid,
          observacoes: `Conta: ${contaNome} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('receita_empresa', acao.dados, contaNome)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── AGENDA ───────────────────────────────────────────────
      } else if (acao.tipo === 'agenda') {
        let dataInicio: Date
        if (acao.dados.data_inicio) {
          const strData = String(acao.dados.data_inicio)
          const strCorrigida = /^\d{4}-\d{2}-\d{2}$/.test(strData.trim())
            ? strData.trim() + 'T12:00:00' : strData
          dataInicio = new Date(strCorrigida)
        } else {
          dataInicio = new Date(Date.now() + 86400000)
        }
        const anoCorreto = new Date().getFullYear()
        if (dataInicio.getFullYear() < anoCorreto) dataInicio.setFullYear(anoCorreto)
        const tipoEvento = TIPOS_EVENTO_VALIDOS.includes(acao.dados.tipo) ? acao.dados.tipo : 'compromisso'
        const { error } = await (supabase.from('agenda_eventos') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Evento via Elena',
          descricao: acao.dados.descricao || null,
          tipo: tipoEvento,
          data_inicio: dataInicio.toISOString(),
          data_fim: null, dia_inteiro: false,
          status: 'pendente', prioridade: 'normal',
          cor: COR_EVENTO[tipoEvento] || '#f59e0b',
          origem: 'ia',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('agenda', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))

      // ── OCORRÊNCIA ───────────────────────────────────────────
      } else if (acao.tipo === 'ocorrencia') {
        let colaboradorId: string | null = null
        if (acao.dados.colaborador_nome) {
          const nomeBusca = acao.dados.colaborador_nome.toLowerCase()
          const enc = colaboradores.find(c =>
            c.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(c.nome.toLowerCase().split(' ')[0])
          )
          colaboradorId = enc?.id || null
        }
        const { error } = await (supabase.from('ocorrencias') as any).insert({
          tipo: acao.dados.tipo || 'alerta',
          descricao: acao.dados.descricao || 'Ocorrência via Elena',
          colaborador_id: colaboradorId,
          modulo: acao.dados.modulo || null,
          impacto: acao.dados.impacto || 'medio',
          resolvida: false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('ocorrencia', acao.dados)

      // ── IDEIA ────────────────────────────────────────────────
      } else if (acao.tipo === 'ideia') {
        const categoria = CATEGORIAS_IDEIA.includes(acao.dados.categoria) ? acao.dados.categoria : 'geral'
        const { error } = await (supabase.from('elena_ideias') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Ideia via Elena',
          descricao: acao.dados.descricao || null,
          categoria, status: 'rascunho', progresso: 5,
          notas: 'Capturada pela Elena durante conversa',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('ideia', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:ideia-salva'))

      // ── REGISTRO GENÉRICO ────────────────────────────────────
      } else if (acao.tipo === 'registro') {
        const tipo = TIPOS_REGISTRO_LIVRE.includes(acao.dados.tipo) ? acao.dados.tipo : 'geral'
        const { error } = await (supabase.from('elena_registro') as any).insert({
          user_id: uid, tipo,
          chave: acao.dados.chave || null,
          titulo: acao.dados.titulo || acao.dados.descricao?.substring(0, 100) || 'Registro via Elena',
          conteudo: acao.dados.descricao || acao.dados.conteudo || null,
          importante: acao.dados.importante ?? false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── RELATÓRIO ────────────────────────────────────────────
      } else if (acao.tipo === 'relatorio') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dados = await buscarDadosRelatorio(supabase, uid, acao.dados.periodo || 'mes_atual')
        setRelatorioData(dados)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── BACKUP CHAT ──────────────────────────────────────────
      } else if (acao.tipo === 'backup_chat') {
        const textoBackup = mensagensRef.current
          .filter(m => m.texto && m.texto !== '...')
          .map(m => {
            const data = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
            return `[${data}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}:\n${m.texto}`
          })
          .join('\n\n----------------------------------------\n\n')
        const blob = new Blob([textoBackup], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `elena-chat-${new Date().toISOString().split('T')[0]}.txt`
        a.click()
        URL.revokeObjectURL(url)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── FATURA CARTÃO ────────────────────────────────────────
      } else if (acao.tipo === 'fatura_cartao') {
        const valor = Number(acao.dados.valor) || 0
        const mesRef = acao.dados.mes_referencia || new Date().toISOString().substring(0, 7)
        const contaPf = await resolverContaPf(acao.dados.conta_nome)
        if (!contaPf.id) throw new Error('Cartão não encontrado.')
        
        const { error } = await (supabase.from('faturas_cartoes') as any).upsert({
          user_id: uid,
          conta_id: contaPf.id,
          valor_fechado: valor,
          mes_referencia: mesRef,
          notas: acao.dados.notas || 'Registrado pela Elena',
        }, { onConflict: 'conta_id,mes_referencia' })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('fatura_cartao', acao.dados, contaPf.nome)

      // ── TRANSFERÊNCIA ────────────────────────────────────────
      } else if (acao.tipo === 'transferencia') {
        const valor = Number(acao.dados.valor) || 0
        const { id: origemId } = await resolverContaQualquer(acao.dados.conta_origem)
        const { id: destinoId } = await resolverContaQualquer(acao.dados.conta_destino)
        if (!origemId || !destinoId) throw new Error('Conta de origem ou destino não encontrada.')
        const dataT = hoje()
        const { error: e1 } = await (supabase.from('lancamentos') as any).insert({
          conta_id: origemId, descricao: acao.dados.descricao || 'Transferência via Elena',
          valor, tipo: 'despesa', regime: 'caixa', status: 'validado',
          data_competencia: dataT, data_caixa: dataT, categoria_id: CAT_DESPESA_ID, created_by: uid,
        })
        const { error: e2 } = await (supabase.from('lancamentos') as any).insert({
          conta_id: destinoId, descricao: acao.dados.descricao || 'Transferência via Elena',
          valor, tipo: 'receita', regime: 'caixa', status: 'validado',
          data_competencia: dataT, data_caixa: dataT, categoria_id: CAT_RECEITA_ID, created_by: uid,
        })
        if (e1 || e2) throw new Error('Erro ao registrar transferência.')
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('transferencia', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── CANCELAR ÚLTIMO ──────────────────────────────────────
      } else if (acao.tipo === 'cancelar') {
        if (!ultimoRegistroRef.current) throw new Error('Nenhum registro recente para cancelar.')
        const { tabela, id } = ultimoRegistroRef.current
        const { error } = await (supabase.from(tabela) as any).delete().eq('id', id)
        if (error) throw new Error(error.message)
        ultimoRegistroRef.current = null
        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, { id: 'cancel-' + Date.now(), role: 'ai', texto: '↩️ Último registro cancelado com sucesso!' }])
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── DEFINIR META ─────────────────────────────────────────
      } else if (acao.tipo === 'definir_meta') {
        const metasStr = localStorage.getItem(`elena_metas_${uid}`)
        const metas: Record<string, number> = metasStr ? JSON.parse(metasStr) : {}
        metas[acao.dados.categoria || 'total'] = Number(acao.dados.valor_limite) || 0
        localStorage.setItem(`elena_metas_${uid}`, JSON.stringify(metas))
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('definir_meta', acao.dados)

      // ── REGISTRO LIVRE ───────────────────────────────────────
      } else if (acao.tipo === 'registro_livre') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const { chave, titulo, conteudo, tipo: tipoReg, dados: dadosReg, importante, tags } = acao.dados
        if (!titulo && !conteudo) { setAcaoStatus(msgId, acaoIdx, 'error', 'Sem conteúdo para salvar'); return }

        const payload: Record<string, any> = {
          user_id: uid, tipo: tipoReg || 'anotacao',
          titulo: titulo || conteudo?.substring(0, 80) || 'Registro',
          conteudo: conteudo || null,
          dados: dadosReg && Object.keys(dadosReg).length > 0 ? dadosReg : null,
          importante: importante === true || importante === 'true',
          tags: Array.isArray(tags) ? tags : [],
          atualizado_em: new Date().toISOString(),
        }
        if (chave) payload.chave = chave

        let salvo = false, isUpdate = false
        try {
          if (chave) {
            const { data: existing } = await (supabase.from('elena_registro') as any)
              .select('id').eq('user_id', uid).eq('chave', chave).maybeSingle()
            isUpdate = !!existing
            const { error } = await (supabase.from('elena_registro') as any)
              .upsert(payload, { onConflict: 'user_id,chave' })
            if (!error) salvo = true
          } else {
            const { error } = await (supabase.from('elena_registro') as any).insert(payload)
            if (!error) salvo = true
          }
        } catch { /* silencioso */ }

        const icon = tipoReg === 'preferencia' ? '⭐' : tipoReg === 'regra_negocio' ? '📋'
          : tipoReg === 'contato' ? '📞' : tipoReg === 'acordo' ? '🤝'
          : tipoReg === 'dado_pessoal' ? '👤' : '🧠'

        setMensagens(prev => [...prev, {
          id: `reg-${Date.now()}`, role: 'ai' as const,
          texto: salvo
            ? `${icon} **${isUpdate ? 'Atualizado' : 'Anotado'}:** _${titulo || conteudo?.substring(0, 60)}_\nGuardei isso na minha memória, Sr. Max! 💾`
            : `${icon} **Anotado localmente:** _${titulo || conteudo?.substring(0, 60)}_\n_(Houve um problema ao salvar no banco)_`,
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── AÇÃO DESCONHECIDA → ignora silenciosamente ───────────
      } else {
        setAcaoStatus(msgId, acaoIdx, 'saved')
      }

    } catch (err: any) {
      setAcaoStatus(msgId, acaoIdx, 'error', err?.message || 'Erro ao salvar')
    }
  }, [
    supabase, userIdRef, mensagensRef, colaboradores, ultimoRegistroRef,
    resolverContaPf, resolverContaPj, resolverContaQualquer,
    setAcaoStatus, exibirConfirmacaoSalvamento, setMensagens, setRelatorioData,
  ])

  // ── executarAcoesAuto ─────────────────────────────────────────
  // Executa todas as ações de uma mensagem em sequência.
  const executarAcoesAuto = useCallback(async (msgId: string, acoes: AcaoIA[], uid: string) => {
    for (let i = 0; i < acoes.length; i++) {
      if (acoes[i].status === 'pending') {
        await salvarAcao(msgId, i, acoes[i])
      }
    }
  }, [salvarAcao])

  return {
    resolverContaPj,
    resolverContaPf,
    resolverContaQualquer,
    salvarAcao,
    executarAcoesAuto,
    setAcaoStatus,
  }
}
