'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PageHeader, EmptyState } from '@/components/shared/ui'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ── Tipagens ──────────────────────────────────────────────────
type Funcionario = {
  id: string
  nome: string
  email: string
  ativo: boolean
  cargo: string
  permissoes: string[]
}

const MODULOS_DISPONIVEIS = [
  { id: 'inicio', nome: 'Início (Dashboards)' },
  { id: 'financeiro', nome: 'Gestão Financeira (Empresa)' },
  { id: 'cajado', nome: 'CRM Cajado' },
  { id: 'vendas', nome: 'Vendas e Ordens de Serviço' },
  { id: 'comissoes', nome: 'Comissões e Parceiros' },
  { id: 'diario', nome: 'Diário Estratégico e Memória' },
  { id: 'pos-venda', nome: 'Pós-venda e Automações' },
  { id: 'inbox', nome: 'Inbox / Atendimento WhatsApp' },
  { id: 'saas', nome: 'Administração SaaS Cajado' },
  { id: 'gestao-pessoal', nome: 'Gestão Pessoal' },
  { id: 'patrimonio', nome: 'Patrimônio' },
  { id: 'investimentos', nome: 'Investimentos' },
  { id: 'trader', nome: 'Trader / Operações' },
  { id: 'inteligencia', nome: 'Inteligência Artificial' },
  { id: 'organizacao', nome: 'Organização Geral' },
]

// ── Modal de Cadastro de Funcionário ──────────────────────────
function ModalFuncionario({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('funcionarios')
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: '',
    permissoes: [] as string[]
  })

  const togglePermissao = (id: string) => {
    setForm(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(id)
        ? prev.permissoes.filter(p => p !== id)
        : [...prev.permissoes, id]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const result = await insert({
      nome: form.nome,
      email: form.email,
      cargo: form.cargo,
      ativo: true,
      permissoes: form.permissoes,
    } as any)
    
    if (result) {
      // Sincronizar o acesso para o módulo de Inbox do WhatsApp (Railway)
      try {
        const inboxUrl = process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://cajado-sistema-production.up.railway.app';
        await fetch(`${inboxUrl}/auth/integrations/sync-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            nome: form.nome,
            email: form.email,
            senha: form.senha,
            role: form.cargo === "manager" ? "admin" : "atendente",
            integration_key: "fe735c00cfb3613832c4e8b7e88a67af7892cdb6d5c94b901e028e3f25d06ebb"
          })
        });
      } catch (e) {
        console.error("Aviso: Falha ao sincronizar atendente com o Inbox", e);
      }

      onSave()
      onClose()
    } else {
      alert(`Erro ao tentar salvar: Certifique-se de que a tabela 'funcionarios' foi criada no Supabase.\nConsulte as instruções do desenvolvedor.`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/5 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="flex items-center justify-between mb-5 relative z-10">
          <h2 className="text-xl font-['Syne'] font-bold text-zinc-100">Novo Acesso (Funcionário)</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome Completo *</label>
              <input className="input mt-1" required value={form.nome} placeholder="Ex: Roberto Silva"
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label">Cargo / Função</label>
              <input className="input mt-1" value={form.cargo} placeholder="Ex: Analista Financeiro"
                onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email de Acesso (Login) *</label>
              <input className="input mt-1" type="email" required value={form.email} placeholder="roberto@empresa.com"
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Senha Inicial *</label>
              <input className="input mt-1" type="password" required value={form.senha} placeholder="Mínimo 6 caracteres"
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label mb-2 block">Áreas Permitidas (Restrição de Módulos)</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {MODULOS_DISPONIVEIS.map(mod => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => togglePermissao(mod.id)}
                  className={cn(
                    "flex flex-col items-start px-3 py-2 border rounded-lg transition-all text-left",
                    form.permissoes.includes(mod.id)
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,166,35,0.05)]"
                      : "bg-[#080b14]/50 border-white/5 text-zinc-400 hover:border-white/10"
                  )}
                >
                  <span className="text-xs font-semibold">{mod.nome}</span>
                  <span className="text-[9px] mt-0.5 opacity-70">
                    {form.permissoes.includes(mod.id) ? '✓ Permitido' : 'Bloqueado'}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              O sistema ocultará automaticamente barras laterais, relatórios e menus das áreas bloqueadas.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary flex gap-2 items-center" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Criar Acesso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Client Component ────────────────────────────────────────────
export default function ConfiguracoesClient() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'empresa' | 'funcionarios'>('empresa')
  const [modalOpen, setModalOpen] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Estado controlado dos campos da empresa
  const [empresa, setEmpresa] = useState({
    nome_fantasia: 'Sistema Cajado',
    razao_social: '',
    cnpj: '',
    inscricao_estadual: '',
    email_suporte: '',
    whatsapp_principal: '',
    website: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade_estado: '',
  })

  // Carregar dados existentes do Supabase
  useEffect(() => {
    supabase
      .from('configuracoes_empresa')
      .select('*')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setEmpresa(prev => ({ ...prev, ...(data as any) }))
      })
  }, [])

  // Salvar no Supabase
  const handleSaveEmpresa = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      // Tenta buscar se já existe algum registro
      const { data: existing } = await supabase
        .from('configuracoes_empresa')
        .select('id')
        .limit(1)
        .single()

      if (existing?.id) {
        await supabase
          .from('configuracoes_empresa')
          .update(empresa)
          .eq('id', existing.id)
      } else {
        await supabase
          .from('configuracoes_empresa')
          .insert(empresa)
      }
      setSaveMsg('ok')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveMsg('erro')
      setTimeout(() => setSaveMsg(''), 4000)
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Fetch dados do Supabase
  const { data: funcionarios, refetch } = useSupabaseQuery<Funcionario>('funcionarios')

  const totalFuncionarios = funcionarios.filter(f => f.ativo).length

  return (
    <>
      <PageHeader 
        title="Configurações do Sistema" 
        subtitle="Gerencie empresa, acessos e restrições de equipe"
      >
        <button onClick={() => setModalOpen(true)} className="btn-primary shadow-[0_0_20px_rgba(245,166,35,0.3)]">+ Novo Funcionário</button>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Menu Lateral das Configurações */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="card !p-3 flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('empresa')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all",
                activeTab === 'empresa' ? "bg-[#1f2744] text-white" : "text-[#8b98b8] hover:bg-white/5 hover:text-white"
              )}
            >
              🏢 Visão Geral (Empresa)
            </button>
            <button 
              onClick={() => setActiveTab('funcionarios')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all flex items-center justify-between",
                activeTab === 'funcionarios' ? "bg-[#1f2744] text-white" : "text-[#8b98b8] hover:bg-white/5 hover:text-white"
              )}
            >
              <span>👥 Equipe e Restrições</span>
              <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">{totalFuncionarios}</span>
            </button>
          </div>
        </div>

        {/* Área Principal */}
        <div className="flex-1">
          {activeTab === 'empresa' && (
            <div className="space-y-6">
              
              {/* Identidade e Documentação */}
              <div className="card">
                <h2 className="section-title">Identidade Policial & Documentação</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="md:col-span-2">
                    <label className="label">Símbolo / Marca Oficial</label>
                    <div className="mt-2 flex items-center gap-4 p-4 border border-white/5 rounded-lg bg-[#080b14]/50">
                       <div className="w-16 h-16 shrink-0 bg-gradient-to-br from-[#f5a623] to-[#c07000] rounded-lg flex items-center justify-center text-zinc-950 font-bold text-2xl shadow-lg shadow-amber-500/20 overflow-hidden relative group">
                         {logoPreview ? (
                           <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                         ) : (
                           <span>C</span>
                         )}
                       </div>
                       <div>
                         <p className="text-sm font-medium text-zinc-100">Logo principal</p>
                         <p className="text-[10px] text-zinc-500 mb-2">Recomendado: 500x500px em formato PNG/SVG sem fundo.</p>
                         <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileUpload} />
                         <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs bg-white/5 border-white/10 hover:bg-white/10">Atualizar imagem</button>
                       </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Nome Fantasia (Como aparece no sistema)</label>
                    <input className="input mt-1" value={empresa.nome_fantasia}
                      onChange={e => setEmpresa(p => ({...p, nome_fantasia: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Razão Social Jurídica</label>
                    <input className="input mt-1" value={empresa.razao_social}
                      placeholder="VisioPro Agência de Marketing LTDA"
                      onChange={e => setEmpresa(p => ({...p, razao_social: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">CNPJ</label>
                    <input className="input mt-1" value={empresa.cnpj}
                      placeholder="00.000.000/0001-00"
                      onChange={e => setEmpresa(p => ({...p, cnpj: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Inscrição Estadual (IE)</label>
                    <input className="input mt-1" value={empresa.inscricao_estadual}
                      placeholder="000.000.000.000"
                      onChange={e => setEmpresa(p => ({...p, inscricao_estadual: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Contatos Corporativos */}
              <div className="card">
                <h2 className="section-title">Informações de Contato Oficiais</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="label">Email de Faturamento/Suporte</label>
                    <input className="input mt-1" type="email" value={empresa.email_suporte}
                      placeholder="contato@empresa.com.br"
                      onChange={e => setEmpresa(p => ({...p, email_suporte: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">WhatsApp (Nº Principal) *</label>
                    <input className="input mt-1" type="tel" value={empresa.whatsapp_principal}
                      placeholder="+55 (11) 99999-9999"
                      onChange={e => setEmpresa(p => ({...p, whatsapp_principal: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Website ou Landing Page</label>
                    <input className="input mt-1" type="url" value={empresa.website}
                      placeholder="https://meusite.com.br"
                      onChange={e => setEmpresa(p => ({...p, website: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Endereço e Faturamento */}
              <div className="card">
                <h2 className="section-title">Sede / Endereço Fiscal</h2>
                <div className="grid grid-cols-6 gap-4 mt-4">
                  <div className="col-span-6 md:col-span-2">
                    <label className="label">CEP *</label>
                    <input className="input mt-1" value={empresa.cep}
                      placeholder="00000-000"
                      onChange={e => setEmpresa(p => ({...p, cep: e.target.value}))} />
                  </div>
                  <div className="col-span-6 md:col-span-4">
                    <label className="label">Logradouro / Avenida</label>
                    <input className="input mt-1" value={empresa.logradouro}
                      placeholder="Ex: Av. Paulista, Jardim Botânico..."
                      onChange={e => setEmpresa(p => ({...p, logradouro: e.target.value}))} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="label">Número</label>
                    <input className="input mt-1" value={empresa.numero}
                      placeholder="Ex: 1000 - Sala 42"
                      onChange={e => setEmpresa(p => ({...p, numero: e.target.value}))} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="label">Bairro</label>
                    <input className="input mt-1" value={empresa.bairro}
                      placeholder="Bairro"
                      onChange={e => setEmpresa(p => ({...p, bairro: e.target.value}))} />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="label">Cidade / Estado (UF)</label>
                    <input className="input mt-1" value={empresa.cidade_estado}
                      placeholder="São Paulo / SP"
                      onChange={e => setEmpresa(p => ({...p, cidade_estado: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="sticky bottom-6 mt-8 flex justify-end z-50 w-full pr-2 pointer-events-none">
                <button
                  id="btn-salvar-emp"
                  onClick={handleSaveEmpresa}
                  disabled={saving}
                  className="btn-primary pointer-events-auto flex gap-2 items-center px-8 py-4 text-[15px] font-bold shadow-[0_10px_40px_rgba(245,166,35,0.7)] hover:shadow-[0_10px_50px_rgba(245,166,35,0.9)] hover:-translate-y-1 transition-all rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 border-4 border-zinc-950 disabled:opacity-60"
                >
                  {saving ? '⏳ Salvando...' : saveMsg === 'ok' ? '✅ Salvo com Sucesso!' : saveMsg === 'erro' ? '❌ Erro ao salvar' : '✓ Salvar Todas Alterações da Empresa'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'funcionarios' && (
            <div className="card flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="section-title mb-0">Contas de Acesso Restrito</h2>
                  <p className="text-xs text-zinc-500">Gerencie e restrinja as áreas que os membros da sua equipe podem visualizar.</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="btn-secondary text-xs">+ Adicionar Membro</button>
              </div>

              {funcionarios.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState message="Nenhum outro funcionário cadastrado. Somente você (CEO) possui acesso irrestrito." />
                </div>
              ) : (
                <div className="space-y-3">
                  {funcionarios.map(func => (
                    <div key={func.id} className="p-4 rounded-xl border border-white/5 bg-[#080b14]/50 flex items-start justify-between hover:border-white/10 transition-colors">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                          <span className="text-indigo-400 font-bold text-sm font-['Syne']">{func.nome.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{func.nome} <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-emerald-500/10 text-emerald-400">Ativo</span></p>
                          <p className="text-xs text-[#8b98b8] mt-0.5">{func.cargo} · {func.email}</p>
                          
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {func.permissoes && func.permissoes.map((pID: string) => {
                              const moduleMatch = MODULOS_DISPONIVEIS.find(m => m.id === pID)
                              return (
                                <span key={pID} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-[10px] font-medium text-zinc-300">
                                  {moduleMatch?.nome ?? pID}
                                </span>
                              )
                            })}
                            {(!func.permissoes || func.permissoes.length === 0) && (
                              <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md text-[10px] font-medium text-red-400">
                                Sem acessos (Bloqueado)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium transition-colors">Editar Limites</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <ModalFuncionario 
          onClose={() => setModalOpen(false)} 
          onSave={() => {
            refetch()
            setModalOpen(false)
          }} 
        />
      )}
    </>
  )
}
