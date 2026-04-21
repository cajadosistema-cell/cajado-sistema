'use client'

import React, { useState } from 'react'
import { PageHeader, EmptyState } from '@/components/shared/ui'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatRelative, cn } from '@/lib/utils'

type TemplatePosVenda = {
  id: string
  nome: string
  mensagem: string
  gatilho: string // 'conclusao_os' | 'dias_7' | 'dias_15' | 'dias_30' | 'manual'
  ativo: boolean
  disparos_total: number
  created_at: string
}

type DisparoHistorico = {
  id: string
  template_id: string | null
  template?: { nome: string } | null
  cliente_nome: string
  cliente_telefone: string | null
  status: 'enviado' | 'entregue' | 'lido' | 'falhou' | 'agendado' | 'na_fila'
  agendado_para: string | null
  enviado_em: string | null
  created_at: string
}

const gatilhoLabels: Record<string, string> = {
  conclusao_os: 'Ao concluir OS',
  dias_7: '7 dias após conclusão',
  dias_15: '15 dias após conclusão',
  dias_30: '30 dias após conclusão',
  manual: 'Disparo manual',
}

const statusConfig: Record<string, { label: string; color: string }> = {
  na_fila:  { label: '⏳ Na fila',   color: 'text-blue-400 bg-blue-500/10' },
  agendado: { label: '📅 Agendado',  color: 'text-zinc-400 bg-zinc-800' },
  enviado:  { label: '✓ Enviado',    color: 'text-zinc-400 bg-zinc-800' },
  entregue: { label: '✓✓ Entregue', color: 'text-zinc-300 bg-zinc-700' },
  lido:     { label: '✓✓ Lido',     color: 'text-blue-400 bg-blue-500/10' },
  falhou:   { label: '❌ Falhou',    color: 'text-red-400 bg-red-500/10' },
}

function ModalNovoTemplate({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('templates_pos_venda')
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nome: '',
    mensagem: '',
    gatilho: 'conclusao_os',
    ativo: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!form.mensagem.trim()) { setErro('A mensagem é obrigatória.'); return }
    const result = await insert({
      nome: form.nome,
      mensagem: form.mensagem,
      gatilho: form.gatilho,
      ativo: form.ativo,
      disparos_total: 0,
    })
    if (result.error) { setErro(`Erro: ${result.error}`); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/5 rounded-2xl w-full max-w-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-100">📨 Novo Template de Mensagem</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠️ {erro}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome do template *</label>
            <input required className="input mt-1" value={form.nome}
              onChange={e => setForm(f => ({...f, nome: e.target.value}))}
              placeholder="Ex: Agradecimento imediato, Follow-up 7 dias..." autoFocus />
          </div>
          <div>
            <label className="label">Gatilho de envio</label>
            <select className="input mt-1" value={form.gatilho} onChange={e => setForm(f => ({...f, gatilho: e.target.value}))}>
              {Object.entries(gatilhoLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Mensagem *</label>
            <p className="text-[10px] text-zinc-600 mb-1">Variáveis: {'{{nome_cliente}}'}, {'{{servico}}'}, {'{{empresa}}'}</p>
            <textarea
              className="input mt-1 resize-none"
              rows={5}
              required
              value={form.mensagem}
              onChange={e => setForm(f => ({...f, mensagem: e.target.value}))}
              placeholder={`Ex: Olá {{nome_cliente}}! Obrigado por escolher a {{empresa}}. Foi um prazer realizar o {{servico}} para você! 😊`}
            />
            <div className="text-right text-[10px] text-zinc-600 mt-1">{form.mensagem.length} caracteres</div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ativo-tmpl" className="w-4 h-4 accent-emerald-500" checked={form.ativo} onChange={e => setForm(f => ({...f, ativo: e.target.checked}))} />
            <label htmlFor="ativo-tmpl" className="text-sm text-zinc-400 cursor-pointer">Ativar template imediatamente</label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? '⏳ Salvando...' : '✓ Salvar Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalDispararManual({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('disparos_pos_venda')
  const { data: templates } = useSupabaseQuery<TemplatePosVenda>('templates_pos_venda', {
    filters: { ativo: true }
  })
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ cliente_nome: '', cliente_telefone: '', template_id: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    const result = await insert({
      template_id: form.template_id || null,
      cliente_nome: form.cliente_nome,
      cliente_telefone: form.cliente_telefone || null,
      status: 'na_fila',
      agendado_para: null,
      enviado_em: null,
    })
    if (result.error) { setErro(`Erro: ${result.error}`); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/5 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-100">📤 Disparo Manual</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠️ {erro}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Template de mensagem</label>
            <select className="input mt-1" value={form.template_id} onChange={e => setForm(f => ({...f, template_id: e.target.value}))}>
              <option value="">-- Sem template (mensagem livre) --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nome do cliente *</label>
            <input required className="input mt-1" value={form.cliente_nome}
              onChange={e => setForm(f => ({...f, cliente_nome: e.target.value}))}
              placeholder="Ex: Carlos Eduardo" autoFocus />
          </div>
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input className="input mt-1" value={form.cliente_telefone}
              onChange={e => setForm(f => ({...f, cliente_telefone: e.target.value}))}
              placeholder="(00) 00000-0000" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary bg-teal-600 hover:bg-teal-500 border-teal-600">
              {loading ? '⏳ Enfileirando...' : '🚀 Adicionar à fila'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PosVendaClient() {
  const [modalTemplate, setModalTemplate] = useState(false)
  const [modalDisparo, setModalDisparo] = useState(false)
  const [editarTemplate, setEditarTemplate] = useState<TemplatePosVenda | null>(null)

  const { data: templates, refetch: refetchTemplates } = useSupabaseQuery<TemplatePosVenda>('templates_pos_venda', {
    orderBy: { column: 'created_at', ascending: false }
  })
  const { data: disparos, refetch: refetchDisparos } = useSupabaseQuery<DisparoHistorico>('disparos_pos_venda', {
    select: '*, template:template_id(nome)',
    orderBy: { column: 'created_at', ascending: false },
    limit: 50,
  })
  const { update: updateTemplate } = useSupabaseMutation('templates_pos_venda')

  // Métricas reais
  const pending = disparos.filter(d => d.status === 'na_fila' || d.status === 'agendado').length
  const mesAtual = new Date().toISOString().slice(0, 7)
  const enviadosMes = disparos.filter(d => d.enviado_em?.startsWith(mesAtual) || d.created_at?.startsWith(mesAtual)).length
  const templatesAtivos = templates.filter(t => t.ativo).length
  const falharam = disparos.filter(d => d.status === 'falhou').length

  const toggleTemplate = async (t: TemplatePosVenda) => {
    await updateTemplate(t.id, { ativo: !t.ativo })
    refetchTemplates()
  }

  return (
    <div>
      <PageHeader
        title="Pós-venda"
        subtitle="Mensagens automáticas · Follow-up · Agradecimentos"
      >
        <button onClick={() => setModalTemplate(true)} className="btn-secondary text-xs">+ Template</button>
        <button onClick={() => setModalDisparo(true)} className="btn-primary flex items-center gap-2 bg-teal-600 hover:bg-teal-500 border-teal-600 text-white">
          📤 Disparo manual
        </button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Na fila / Agendados',  value: pending,        color: pending > 0 ? 'text-amber-400' : 'text-zinc-400' },
          { label: 'Enviados este mês',    value: enviadosMes,    color: 'text-emerald-400' },
          { label: 'Templates ativos',     value: templatesAtivos, color: 'text-teal-400' },
          { label: 'Falhas',               value: falharam,       color: falharam > 0 ? 'text-red-400' : 'text-zinc-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(20,184,166,0.06),transparent_70%)]" />
            <p className="text-[10px] font-medium text-[#8b98b8] tracking-[0.06em] uppercase mb-2">{k.label}</p>
            <p className={`text-[22px] font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Templates */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Templates configurados</h2>
            <button onClick={() => setModalTemplate(true)} className="btn-ghost text-xs">+ Novo template</button>
          </div>
          {templates.length === 0 ? (
            <EmptyState message="Nenhum template cadastrado ainda. Clique em + Template para criar." />
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="flex items-start justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-zinc-300 truncate">{t.nome}</p>
                    <p className="text-xs text-zinc-500">{gatilhoLabels[t.gatilho] || t.gatilho}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 line-clamp-1">{t.mensagem}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleTemplate(t)}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-medium border border-current transition-colors',
                        t.ativo ? 'text-emerald-400 hover:text-red-400' : 'text-zinc-500 hover:text-emerald-400'
                      )}
                    >
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      onClick={() => setEditarTemplate(t)}
                      className="btn-ghost text-xs py-0.5 px-2"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disparos na fila */}
        <div className="card min-h-[250px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Disparos pendentes</h2>
            <button onClick={() => setModalDisparo(true)} className="btn-ghost text-xs">+ Agendar</button>
          </div>
          {disparos.filter(d => ['na_fila','agendado'].includes(d.status)).length === 0 ? (
            <EmptyState message="Nenhum disparo pendente. Use 'Disparo manual' para enfileirar uma mensagem." />
          ) : (
            <div className="space-y-3">
              {disparos.filter(d => ['na_fila','agendado'].includes(d.status)).slice(0, 5).map(d => {
                const sc = statusConfig[d.status] || statusConfig.na_fila
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{d.cliente_nome}</p>
                      <p className="text-xs text-teal-400/80 mt-0.5">
                        {(d.template as any)?.nome || 'Manual'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full mb-1 inline-block font-medium', sc.color)}>
                        {sc.label}
                      </span>
                      {d.agendado_para && (
                        <p className="text-xs text-zinc-500">{new Date(d.agendado_para).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Histórico de disparos */}
      <div className="card">
        <h2 className="section-title">Histórico de disparos</h2>
        {disparos.filter(d => !['na_fila','agendado'].includes(d.status)).length === 0 ? (
          <EmptyState message="Nenhum disparo registrado ainda" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Cliente</th>
                <th className="table-header">Template</th>
                <th className="table-header">Data</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {disparos
                .filter(d => !['na_fila','agendado'].includes(d.status))
                .slice(0, 30)
                .map(d => {
                  const sc = statusConfig[d.status] || statusConfig.enviado
                  return (
                    <tr key={d.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3 px-2 text-sm text-zinc-200">{d.cliente_nome}</td>
                      <td className="py-3 px-2 text-xs text-teal-400/80">
                        {(d.template as any)?.nome || 'Manual'}
                      </td>
                      <td className="py-3 px-2 text-xs text-zinc-500">
                        {d.enviado_em ? formatRelative(d.enviado_em) : formatRelative(d.created_at)}
                      </td>
                      <td className="py-3 px-2 text-xs">
                        <span className={cn('px-2 py-0.5 rounded-full font-medium', sc.color)}>{sc.label}</span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        )}
      </div>

      {modalTemplate && (
        <ModalNovoTemplate onClose={() => setModalTemplate(false)} onSave={refetchTemplates} />
      )}
      {modalDisparo && (
        <ModalDispararManual onClose={() => setModalDisparo(false)} onSave={refetchDisparos} />
      )}
    </div>
  )
}
