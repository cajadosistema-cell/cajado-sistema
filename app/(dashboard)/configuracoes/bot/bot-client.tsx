'use client'

import { useState, useEffect } from 'react'

const API = 'https://visiopro-unified01-production.up.railway.app'

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cajado_inbox_token') : null
}

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  return res.json()
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function apiPatch(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function apiDelete(path: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  })
  return res.json()
}

// ── Tipos ──────────────────────────────────────────────────────

interface Time {
  id: string
  nome: string
  descricao: string
  palavras_chave: string
  cor: string
  emoji: string
  ativo: boolean
}

// ── Seção: Prompt do bot ───────────────────────────────────────

function SecaoPrompt() {
  const [prompt, setPrompt] = useState('')
  const [form, setForm] = useState({ nomeBot: '', nomeEmpresa: '', descricao: '', tom: 'Amigável e consultivo' })
  const [gerando, setGerando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    apiGet('/configuracoes').then(data => {
      setPrompt(data.system_prompt || '')
    })
  }, [])

  async function handleGerar() {
    if (!form.nomeBot || !form.nomeEmpresa || !form.descricao) return
    setGerando(true)
    setMsg('')
    const data = await apiPost('/configuracoes/gerar-prompt', form)
    if (data.prompt) setPrompt(data.prompt)
    setGerando(false)
  }

  async function handleSalvar() {
    setSalvando(true)
    await apiPost('/configuracoes', { system_prompt: prompt })
    setMsg('Salvo com sucesso!')
    setSalvando(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200 mb-1">Personalidade do bot</h2>
        <p className="text-xs text-zinc-500">
          Preencha os campos abaixo para gerar um novo prompt com IA, ou edite diretamente o prompt atual.
        </p>
      </div>

      <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
        <p className="text-xs font-medium text-zinc-400">Gerar novo prompt com IA</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1">Nome do assistente</label>
            <input className="input text-xs" placeholder="Ex: Sol, Ana..." value={form.nomeBot} onChange={e => setForm(f => ({ ...f, nomeBot: e.target.value }))} />
          </div>
          <div>
            <label className="label block mb-1">Nome da empresa</label>
            <input className="input text-xs" placeholder="Ex: Cajado Soluções" value={form.nomeEmpresa} onChange={e => setForm(f => ({ ...f, nomeEmpresa: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label block mb-1">O que sua empresa faz?</label>
          <textarea
            className="input resize-none text-xs"
            rows={2}
            placeholder="Descreva seus serviços, público-alvo e diferencial..."
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          />
        </div>
        <div>
          <label className="label block mb-1">Tom de voz</label>
          <select className="input text-xs" value={form.tom} onChange={e => setForm(f => ({ ...f, tom: e.target.value }))}>
            {['Amigável e consultivo', 'Formal e profissional', 'Direto e objetivo', 'Descontraído e jovem', 'Técnico e especializado'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <button onClick={handleGerar} disabled={gerando} className="btn-secondary text-xs w-full">
          {gerando ? '✨ Gerando...' : '✨ Gerar com IA'}
        </button>
      </div>

      <div>
        <label className="label block mb-1.5">Prompt atual — edite livremente</label>
        <textarea
          className="input resize-none text-xs leading-relaxed font-mono"
          rows={12}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="O prompt do bot aparecerá aqui após gerar ou carregar da configuração..."
        />
        <p className="text-xs text-zinc-600 mt-1">
          Use [TIMES_DISPONIVEIS] e [NOMES_TIMES] para inserir os setores automaticamente.
          Use #TRANSFERIR para indicar quando o bot deve transferir.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleSalvar} disabled={salvando} className="btn-primary">
          {salvando ? 'Salvando...' : 'Salvar prompt'}
        </button>
        {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      </div>
    </div>
  )
}

// ── Seção: Times/Setores ───────────────────────────────────────

function SecaoTimes() {
  const [times, setTimes] = useState<Time[]>([])
  const [novo, setNovo] = useState({ nome: '', descricao: '', palavras_chave: '', cor: '#3b82f6', emoji: '💼' })
  const [adicionando, setAdicionando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    apiGet('/times').then(data => setTimes(Array.isArray(data) ? data : []))
  }, [])

  async function handleAdicionar() {
    if (!novo.nome) return
    setSalvando(true)
    await apiPost('/times', novo)
    const data = await apiGet('/times')
    setTimes(Array.isArray(data) ? data : [])
    setNovo({ nome: '', descricao: '', palavras_chave: '', cor: '#3b82f6', emoji: '💼' })
    setAdicionando(false)
    setSalvando(false)
  }

  async function handleToggle(id: string, ativo: boolean) {
    await apiPatch(`/times/${id}`, { ativo: !ativo })
    setTimes(t => t.map(x => x.id === id ? { ...x, ativo: !ativo } : x))
  }

  const emojis = ['💼', '🛠️', '💰', '📊', '🎯', '🤝', '📱', '🚗', '🏠', '⚡']
  const cores = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316']

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Times / Setores</h2>
          <p className="text-xs text-zinc-500 mt-0.5">O bot usa os setores para direcionar os atendimentos</p>
        </div>
        <button onClick={() => setAdicionando(!adicionando)} className="btn-secondary text-xs">
          {adicionando ? 'Cancelar' : '+ Novo setor'}
        </button>
      </div>

      {adicionando && (
        <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Nome do setor *</label>
              <input className="input text-xs" placeholder="Ex: Licenciamento" value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Descrição</label>
              <input className="input text-xs" placeholder="Ex: Serviços de licenciamento veicular" value={novo.descricao} onChange={e => setNovo(n => ({ ...n, descricao: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label block mb-1">Palavras-chave (o bot usa para identificar)</label>
            <input className="input text-xs" placeholder="Ex: licenciamento, crlv, placa, vistoria" value={novo.palavras_chave} onChange={e => setNovo(n => ({ ...n, palavras_chave: e.target.value }))} />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="label block mb-1">Emoji</label>
              <div className="flex gap-1 flex-wrap">
                {emojis.map(em => (
                  <button key={em} onClick={() => setNovo(n => ({ ...n, emoji: em }))} className={`w-7 h-7 rounded text-sm ${novo.emoji === em ? 'bg-zinc-600' : 'hover:bg-zinc-800'}`}>{em}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label block mb-1">Cor</label>
              <div className="flex gap-1 flex-wrap">
                {cores.map(cor => (
                  <button key={cor} onClick={() => setNovo(n => ({ ...n, cor }))} className={`w-6 h-6 rounded-full border-2 ${novo.cor === cor ? 'border-white' : 'border-transparent'}`} style={{ background: cor }} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={handleAdicionar} disabled={salvando} className="btn-primary text-xs">
            {salvando ? 'Salvando...' : '+ Adicionar setor'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {times.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">Nenhum setor configurado</p>
        )}
        {times.map(t => (
          <div key={t.id} className="flex items-center gap-3 py-2.5 px-3 bg-zinc-800/40 rounded-lg">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: t.cor + '25', border: `1px solid ${t.cor}40` }}>
              {t.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">{t.nome}</p>
              {t.descricao && <p className="text-xs text-zinc-500 truncate">{t.descricao}</p>}
              {t.palavras_chave && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">🔑 {t.palavras_chave}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs ${t.ativo ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {t.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button onClick={() => handleToggle(t.id, t.ativo)} className="btn-ghost text-xs py-1">
                {t.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Seção: Usuários da empresa ─────────────────────────────────

const MODULOS = [
  { id: 'inbox',         label: 'Inbox',         emoji: '💬' },
  { id: 'crm',           label: 'CRM',            emoji: '📊' },
  { id: 'financeiro',    label: 'Financeiro',     emoji: '💰' },
  { id: 'relatorios',    label: 'Relatórios',     emoji: '📈' },
  { id: 'configuracoes', label: 'Configurações',  emoji: '⚙️' },
]

type Usuario = {
  id: string
  nome: string
  email: string
  role: string
  setor: string
  ativo: boolean
  permissoes?: Record<string, boolean>
}

function SecaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const permissoesDefault = (role: string): Record<string, boolean> => ({
    inbox:         true,
    crm:           true,
    financeiro:    role === 'admin',
    relatorios:    role === 'admin',
    configuracoes: role === 'admin',
  })

  const [novo, setNovo] = useState({
    nome: '', email: '', senha: '', role: 'atendente', setor: '',
    permissoes: permissoesDefault('atendente'),
  })

  useEffect(() => {
    apiGet('/auth/usuarios').then(data => setUsuarios(Array.isArray(data) ? data : []))
  }, [])

  async function handleAdicionar() {
    if (!novo.nome || !novo.email || !novo.senha) return
    setSalvando(true)
    await apiPost('/auth/usuarios', {
      nome: novo.nome,
      email: novo.email,
      senha: novo.senha,
      role: novo.role,
      setor: novo.setor,
      permissoes: novo.permissoes,
    })
    const data = await apiGet('/auth/usuarios')
    setUsuarios(Array.isArray(data) ? data : [])
    setNovo({ nome: '', email: '', senha: '', role: 'atendente', setor: '', permissoes: permissoesDefault('atendente') })
    setAdicionando(false)
    setSalvando(false)
    showMsg('Atendente adicionado com sucesso!')
  }

  async function handleToggleAtivo(u: Usuario) {
    await apiPost(`/auth/usuarios/${u.id}/toggle`, { ativo: !u.ativo })
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function handleSalvarPermissoes(u: Usuario) {
    setSalvando(true)
    await apiPost(`/auth/usuarios/${u.id}/permissoes`, { permissoes: u.permissoes })
    setSalvando(false)
    setEditandoId(null)
    showMsg('Permissões salvas!')
  }

  function togglePerm(userId: string, modulo: string) {
    setUsuarios(prev => prev.map(u => {
      if (u.id !== userId) return u
      const perms = { ...(u.permissoes || permissoesDefault(u.role)) }
      perms[modulo] = !perms[modulo]
      return { ...u, permissoes: perms }
    }))
  }

  async function handleExcluir(u: Usuario) {
    if (!confirm(`Tem certeza que deseja EXCLUIR DEFINITIVAMENTE o atendente ${u.nome}? Esta ação não pode ser desfeita.`)) return
    
    setSalvando(true)
    try {
      await apiDelete(`/auth/usuarios/${u.id}`)
      setUsuarios(prev => prev.filter(x => x.id !== u.id))
      showMsg('Atendente excluído com sucesso!')
    } catch {
      showMsg('Erro ao excluir atendente')
    }
    setSalvando(false)
  }

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Atendentes e Permissões</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Controle quais módulos cada usuário pode acessar</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-emerald-400">{msg}</span>}
          <button onClick={() => setAdicionando(!adicionando)} className="btn-secondary text-xs">
            {adicionando ? 'Cancelar' : '+ Novo atendente'}
          </button>
        </div>
      </div>

      {/* Formulário adicionar */}
      {adicionando && (
        <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4 border border-zinc-700/50">
          <p className="text-xs font-semibold text-zinc-300">Novo atendente</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Nome *</label>
              <input className="input text-xs" placeholder="Ex: João Silva" value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">E-mail *</label>
              <input className="input text-xs" type="email" placeholder="joao@empresa.com" value={novo.email} onChange={e => setNovo(n => ({ ...n, email: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Senha *</label>
              <input className="input text-xs" type="password" placeholder="Mínimo 6 caracteres" value={novo.senha} onChange={e => setNovo(n => ({ ...n, senha: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Setor</label>
              <input className="input text-xs" placeholder="Ex: Vendas, Suporte..." value={novo.setor} onChange={e => setNovo(n => ({ ...n, setor: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Nível de acesso</label>
              <select className="input text-xs" value={novo.role} onChange={e => {
                const r = e.target.value
                setNovo(n => ({ ...n, role: r, permissoes: permissoesDefault(r) }))
              }}>
                <option value="atendente">Atendente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin (acesso total)</option>
              </select>
            </div>
          </div>

          {/* Permissões por módulo */}
          <div>
            <p className="text-xs text-zinc-400 font-medium mb-2">Permissões de acesso</p>
            <div className="flex flex-wrap gap-2">
              {MODULOS.map(m => (
                <button key={m.id}
                  onClick={() => setNovo(n => ({ ...n, permissoes: { ...n.permissoes, [m.id]: !n.permissoes[m.id] } }))}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    novo.permissoes[m.id]
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-600'
                  }`}>
                  {m.emoji} {m.label}
                  {novo.permissoes[m.id] ? ' ✓' : ' ✗'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAdicionar} disabled={salvando || !novo.nome || !novo.email || !novo.senha} className="btn-primary text-xs">
            {salvando ? 'Salvando...' : '+ Adicionar atendente'}
          </button>
        </div>
      )}

      {/* Lista de usuários */}
      <div className="space-y-3">
        {usuarios.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">Nenhum atendente cadastrado</p>
        )}
        {usuarios.map(u => {
          const perms = u.permissoes || permissoesDefault(u.role)
          const editando = editandoId === u.id
          return (
            <div key={u.id} className={`rounded-xl border transition-all ${
              editando ? 'border-amber-500/30 bg-amber-500/3' : 'border-zinc-800 bg-zinc-800/30'
            }`}>
              {/* Cabeçalho do card */}
              <div className="flex items-center gap-3 p-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' :
                  u.role === 'supervisor' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-zinc-700 text-zinc-300'
                }`}>
                  {u.nome?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{u.nome}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      u.role === 'admin' ? 'bg-amber-500/15 text-amber-400' :
                      u.role === 'supervisor' ? 'bg-purple-500/15 text-purple-400' :
                      'bg-zinc-700 text-zinc-400'
                    }`}>{u.role}</span>
                    {!u.ativo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">inativo</span>}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{u.email}{u.setor ? ` · ${u.setor}` : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleExcluir(u)}
                    disabled={salvando}
                    className="text-xs px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all transition-colors">
                    🗑️ Excluir
                  </button>
                  <button
                    onClick={() => setEditandoId(editando ? null : u.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      editando ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {editando ? '✕ Fechar' : '⚙️ Permissões'}
                  </button>
                  <button onClick={() => handleToggleAtivo(u)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      u.ativo ? 'border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/30' : 'border-emerald-500/30 text-emerald-400'
                    }`}>
                    {u.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>

              {/* Permissões (quando editando) */}
              {editando && (
                <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                  <p className="text-xs text-zinc-400 font-medium">Módulos permitidos</p>
                  <div className="flex flex-wrap gap-2">
                    {MODULOS.map(m => (
                      <button key={m.id}
                        onClick={() => togglePerm(u.id, m.id)}
                        disabled={u.role === 'admin'}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          perms[m.id]
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-600'
                        }`}>
                        {m.emoji} {m.label}
                        <span className="font-bold">{perms[m.id] ? ' ✓' : ' ✗'}</span>
                      </button>
                    ))}
                  </div>
                  {u.role === 'admin' && (
                    <p className="text-xs text-amber-500/70">Admins têm acesso a todos os módulos por padrão.</p>
                  )}
                  <button onClick={() => handleSalvarPermissoes(u)} disabled={salvando || u.role === 'admin'} className="btn-primary text-xs">
                    {salvando ? 'Salvando...' : '💾 Salvar permissões'}
                  </button>
                </div>
              )}

              {/* Chips de permissoes (quando fechado) */}
              {!editando && (
                <div className="flex flex-wrap gap-1 px-3 pb-3">
                  {MODULOS.map(m => (
                    <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded ${
                      perms[m.id] ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-900 text-zinc-700 line-through'
                    }`}>{m.emoji} {m.label}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Guia passo a passo: Como conectar API Meta ────────────────

const PASSOS_META = [
  {
    num: 1,
    titulo: 'Criar uma conta no Meta for Developers',
    descricao: 'Acesse o portal de desenvolvedores da Meta com sua conta do Facebook.',
    link: 'https://developers.facebook.com',
    linkLabel: 'Acessar developers.facebook.com →',
    dica: 'Use a mesma conta do Facebook da sua empresa.',
    cor: 'blue',
  },
  {
    num: 2,
    titulo: 'Criar um App do tipo "Business"',
    descricao: 'No painel, clique em "Criar app" → selecione "Business" como tipo → dê um nome ao app.',
    link: 'https://developers.facebook.com/apps/creation/',
    linkLabel: 'Criar app agora →',
    dica: 'Não escolha "Consumer" ou "Gaming" — escolha apenas "Business".',
    cor: 'purple',
  },
  {
    num: 3,
    titulo: 'Adicionar o produto WhatsApp ao app',
    descricao: 'Dentro do app criado, vá em "Adicionar produtos" → clique em "Configurar" no card do WhatsApp.',
    link: null,
    linkLabel: null,
    dica: 'Isso abrirá o painel do WhatsApp Business Platform dentro do seu app.',
    cor: 'emerald',
  },
  {
    num: 4,
    titulo: 'Copiar o Phone Number ID',
    descricao: 'Em WhatsApp → Primeiros Passos (API Setup) → você verá "Phone Number ID" logo abaixo do número de teste.',
    link: 'https://developers.facebook.com/apps/',
    linkLabel: 'Ir para Meus Apps →',
    dica: 'O Phone Number ID é um número grande como: 123456789012345. NÃO é o número de telefone.',
    cor: 'amber',
  },
  {
    num: 5,
    titulo: 'Gerar Token de Acesso Permanente',
    descricao: 'Vá em Meta Business Suite → Configurações → Usuários do Sistema → Criar usuário do sistema (Admin) → Gerar token → selecione o app e permissões: whatsapp_business_messaging, whatsapp_business_management.',
    link: 'https://business.facebook.com/settings/system-users',
    linkLabel: 'Acessar Usuários do Sistema →',
    dica: 'IMPORTANTE: Use token de usuário do sistema, não o token temporário. O token temporário expira em 24h.',
    cor: 'red',
  },
  {
    num: 6,
    titulo: 'Configurar o Webhook',
    descricao: 'Em WhatsApp → Configuração → Webhook: cole a URL abaixo no campo "URL de Callback" e defina um token de verificação (você mesmo cria, pode ser qualquer texto).',
    link: null,
    linkLabel: null,
    dica: 'Após colar a URL e o token, clique em "Verificar e salvar". O sistema validará automaticamente.',
    cor: 'zinc',
  },
  {
    num: 7,
    titulo: 'Preencher o formulário e ativar',
    descricao: 'Volte aqui e preencha os campos: Phone Number ID, Token de Acesso e Token do Webhook. Clique em "Ativar API Oficial".',
    link: null,
    linkLabel: null,
    dica: 'Após ativar, seu WhatsApp estará conectado sem risco de banimento — 100% oficial Meta.',
    cor: 'emerald',
  },
]

const COR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  red:     { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     badge: 'bg-red-500/20 text-red-300' },
  zinc:    { bg: 'bg-zinc-800/60',    border: 'border-zinc-700',       text: 'text-zinc-400',    badge: 'bg-zinc-700 text-zinc-300' },
}

function GuiaMeta({ webhookUrl, onClose }: { webhookUrl: string; onClose: () => void }) {
  const [passo, setPasso] = useState(0)
  const total = PASSOS_META.length
  const atual = PASSOS_META[passo]
  const cores = COR_MAP[atual.cor]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Guia: API Oficial WhatsApp Meta</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Passo {passo + 1} de {total}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg transition-colors">✕</button>
        </div>

        {/* Barra de progresso */}
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${((passo + 1) / total) * 100}%` }}
          />
        </div>

        {/* Conteúdo do passo */}
        <div className="p-6 space-y-4 min-h-[320px]">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${cores.badge}`}>
            Passo {atual.num}
          </div>

          <h3 className="text-base font-bold text-zinc-100 leading-snug">{atual.titulo}</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">{atual.descricao}</p>

          {/* Dica de ouro */}
          <div className={`rounded-lg p-3 border ${cores.bg} ${cores.border}`}>
            <p className="text-xs text-zinc-300 flex gap-2">
              <span className="shrink-0">💡</span>
              <span>{atual.dica}</span>
            </p>
          </div>

          {/* URL do webhook no passo 6 */}
          {atual.num === 6 && (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">URL do Callback (copie e cole na Meta)</p>
              <p className="text-xs font-mono text-amber-400 break-all select-all">{webhookUrl}/webhook/oficial</p>
            </div>
          )}

          {/* Link externo */}
          {atual.link && (
            <a
              href={atual.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 text-xs font-medium ${cores.text} hover:underline`}
            >
              {atual.linkLabel}
            </a>
          )}
        </div>

        {/* Navegação */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/40">
          <button
            onClick={() => setPasso(p => Math.max(0, p - 1))}
            disabled={passo === 0}
            className="btn-secondary text-xs disabled:opacity-30"
          >
            ← Anterior
          </button>

          {/* Indicadores de passo */}
          <div className="flex gap-1.5">
            {PASSOS_META.map((_, i) => (
              <button
                key={i}
                onClick={() => setPasso(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === passo ? 'bg-amber-400 w-4' : i < passo ? 'bg-amber-500/40' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>

          {passo < total - 1 ? (
            <button onClick={() => setPasso(p => p + 1)} className="btn-primary text-xs">
              Próximo →
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary text-xs bg-emerald-500 hover:bg-emerald-400">
              ✅ Entendido!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Seção: WhatsApp ──────────────────────────────────────────────

function SecaoWhatsApp() {
  const [metodo, setMetodo] = useState<'qrcode' | 'oficial'>('qrcode')

  // ── QR Code (Evolution API) ──
  const [nomeCanal, setNomeCanal] = useState('WhatsApp Principal')
  const [canal, setCanal] = useState<{ instanceName: string; canalId: string; qrcode: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [conectado, setConectado] = useState(false)
  const [error, setError] = useState('')

  // ── API Oficial Meta ──
  const [apiForm, setApiForm] = useState({
    phoneNumberId: '',
    accessToken: '',
    webhookVerifyToken: '',
    businessAccountId: '',
  })
  const [salvandoApi, setSalvandoApi] = useState(false)
  const [apiSalva, setApiSalva] = useState(false)
  const [showGuia, setShowGuia] = useState(false)

  const webhookUrl = process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://seu-backend.railway.app'

  async function handleCriarInstancia() {
    setLoading(true)
    setError('')
    try {
      const data = await apiPost('/canais/criar-instancia', { nome: nomeCanal })
      setCanal(data)
      iniciarVerificacao(data.instanceName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar instância')
    } finally {
      setLoading(false)
    }
  }

  function iniciarVerificacao(instanceName: string) {
    setVerificando(true)
    const interval = setInterval(async () => {
      try {
        const res = await apiGet(`/canais/${instanceName}/status`)
        if (res && res.connected) {
          clearInterval(interval)
          setConectado(true)
          setVerificando(false)
        }
      } catch {}
    }, 3000)
    setTimeout(() => {
      clearInterval(interval)
      setVerificando(false)
    }, 120000)
  }

  const [apiConectada, setApiConectada] = useState<{ numero: string; nome: string } | null>(null)
  const [apiErro, setApiErro] = useState('')

  async function handleSalvarApiOficial() {
    if (!apiForm.phoneNumberId || !apiForm.accessToken || !apiForm.webhookVerifyToken) return
    setSalvandoApi(true)
    setApiErro('')
    try {
      const res = await apiPost('/canais/configurar-oficial', apiForm) as any
      if (res.ok) {
        setApiConectada({ numero: res.numero, nome: res.nome_verificado || '' })
        setApiSalva(true)
      } else {
        setApiErro(res.erro || 'Erro desconhecido')
      }
    } catch (e: any) {
      setApiErro(e?.message || 'Falha ao conectar com o servidor')
    }
    setSalvandoApi(false)
  }

  return (
    <div className="space-y-5">
      {/* Seletor de método */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Conexão do WhatsApp</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Escolha como conectar seu número ao sistema</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMetodo('qrcode')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              metodo === 'qrcode'
                ? 'border-amber-500/60 bg-amber-500/5'
                : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
            }`}
          >
            <div className="text-2xl mb-2">📱</div>
            <p className="text-sm font-semibold text-zinc-200">QR Code</p>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Conecte qualquer número via Evolution API escaneando o QR Code. Mais simples, ideal para testes e uso imediato.
            </p>
            <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Recomendado para começar
            </span>
          </button>

          <button
            onClick={() => setMetodo('oficial')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              metodo === 'oficial'
                ? 'border-blue-500/60 bg-blue-500/5'
                : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
            }`}
          >
            <div className="text-2xl mb-2">🏢</div>
            <p className="text-sm font-semibold text-zinc-200">API Oficial Meta</p>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              WhatsApp Business API oficial da Meta. Não precisa de celular conectado. Ideal para empresas com volume alto.
            </p>
            <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Para uso empresarial
            </span>
          </button>
        </div>
      </div>

      {/* ── QR Code ── */}
      {metodo === 'qrcode' && (
        <div className="card space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Conectar via QR Code</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Funciona com qualquer número WhatsApp — pessoal ou Business. Sem aprovação da Meta.
            </p>
          </div>

          {conectado && canal ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-emerald-400 font-semibold">WhatsApp conectado!</p>
              <p className="text-xs text-zinc-500">Instância: <strong className="text-zinc-300">{canal.instanceName}</strong></p>
            </div>
          ) : !canal ? (
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3 max-w-sm">
              <div>
                <label className="label block mb-1">Nome do canal</label>
                <input
                  className="input text-xs w-full"
                  value={nomeCanal}
                  onChange={e => setNomeCanal(e.target.value)}
                  placeholder="Ex: WhatsApp Vendas, Suporte..."
                />
              </div>
              {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded">{error}</p>}
              <div className="bg-zinc-800 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Como funciona</p>
                <p className="text-xs text-zinc-400">1. Clique em "Gerar QR Code"</p>
                <p className="text-xs text-zinc-400">2. Abra o WhatsApp no celular</p>
                <p className="text-xs text-zinc-400">3. Vá em ⋮ → Aparelhos conectados → Conectar aparelho</p>
                <p className="text-xs text-zinc-400">4. Escaneie o código com a câmera</p>
              </div>
              <button onClick={handleCriarInstancia} disabled={loading} className="btn-primary text-xs w-full">
                {loading ? '⏳ Gerando...' : '📱 Gerar QR Code'}
              </button>
            </div>
          ) : (
            <div className="bg-zinc-800/50 rounded-lg p-6 flex flex-col items-center max-w-md mx-auto space-y-4">
              <div>
                <p className="text-sm font-semibold text-zinc-200 text-center">Escaneie com o WhatsApp</p>
                <p className="text-xs text-zinc-500 text-center mt-1">O código é válido por 2 minutos</p>
              </div>
              {canal.qrcode ? (
                <div className="bg-white p-3 rounded-xl shadow-xl">
                  <img
                    src={canal.qrcode.startsWith('data:image') ? canal.qrcode : `data:image/png;base64,${canal.qrcode}`}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56"
                  />
                </div>
              ) : (
                <div className="w-56 h-56 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700">
                  <p className="text-xs text-zinc-500">QR Code indisponível</p>
                </div>
              )}
              {verificando && (
                <p className="text-xs text-zinc-400 animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Aguardando conexão...
                </p>
              )}
              <button onClick={() => setCanal(null)} className="btn-secondary text-xs">
                Gerar novo código
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── API Oficial Meta ── */}
      {showGuia && <GuiaMeta webhookUrl={webhookUrl} onClose={() => setShowGuia(false)} />}

      {metodo === 'oficial' && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">API Oficial WhatsApp Business (Meta)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Requer conta Meta Business verificada com número aprovado.
              </p>
            </div>
            <button
              onClick={() => setShowGuia(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
            >
              📋 Ver guia passo a passo
            </button>
          </div>

          {/* Passo a passo */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-400">📋 Pré-requisitos</p>
            <div className="space-y-1 text-xs text-zinc-400">
              <p>1. Acesse <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">developers.facebook.com</a> e crie um app do tipo <strong className="text-zinc-200">Business</strong></p>
              <p>2. Adicione o produto <strong className="text-zinc-200">WhatsApp</strong> ao seu app</p>
              <p>3. Gere um <strong className="text-zinc-200">Token de Acesso Permanente</strong> no Painel de API</p>
              <p>4. Copie o <strong className="text-zinc-200">Phone Number ID</strong> do número verificado</p>
              <p>5. Configure o Webhook com a URL abaixo e o token de verificação escolhido</p>
            </div>
          </div>

          {/* URL do webhook */}
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">URL do Webhook para configurar na Meta</p>
            <p className="text-xs font-mono text-amber-400 break-all select-all">
              {process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://seu-backend.railway.app'}/webhook/oficial
            </p>
          </div>

          {/* Formulário */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">Phone Number ID *</label>
                <input
                  className="input text-xs"
                  placeholder="Ex: 123456789012345"
                  value={apiForm.phoneNumberId}
                  onChange={e => setApiForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                />
              </div>
              <div>
                <label className="label block mb-1">Business Account ID</label>
                <input
                  className="input text-xs"
                  placeholder="Ex: 987654321098765"
                  value={apiForm.businessAccountId}
                  onChange={e => setApiForm(f => ({ ...f, businessAccountId: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label block mb-1">Token de Acesso (permanente) *</label>
              <input
                className="input text-xs font-mono"
                type="password"
                placeholder="EAAxxxxxxxxxxxxx..."
                value={apiForm.accessToken}
                onChange={e => setApiForm(f => ({ ...f, accessToken: e.target.value }))}
              />
            </div>
            <div>
              <label className="label block mb-1">Token de Verificação do Webhook *</label>
              <input
                className="input text-xs"
                placeholder="Crie uma senha para verificar o webhook (ex: cajado-2025)"
                value={apiForm.webhookVerifyToken}
                onChange={e => setApiForm(f => ({ ...f, webhookVerifyToken: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
            {/* Estado: Conectada com sucesso */}
            {apiConectada ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 text-lg">✓</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">API Oficial Meta conectada!</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Número: <strong className="text-zinc-200">{apiConectada.numero}</strong>
                    {apiConectada.nome && <span className="text-zinc-500"> · {apiConectada.nome}</span>}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">Sem risco de banimento — conexão 100% oficial Meta ✅</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {apiErro && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-xs text-red-400">❌ {apiErro}</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSalvarApiOficial}
                    disabled={salvandoApi || !apiForm.phoneNumberId || !apiForm.accessToken || !apiForm.webhookVerifyToken}
                    className="btn-primary text-xs"
                  >
                    {salvandoApi ? '⏳ Validando com a Meta...' : '🔗 Ativar API Oficial'}
                  </button>
                  <p className="text-xs text-zinc-600">O sistema vai validar o token com a Meta antes de salvar</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function ConfiguracoesBotClient({ inModal }: { inModal?: boolean }) {
  const [aba, setAba] = useState<'whatsapp' | 'prompt' | 'times' | 'usuarios'>('whatsapp')

  return (
    <div className={inModal ? 'max-w-4xl mx-auto' : ''}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Configurações do Inbox</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Conecte o WhatsApp, configure o bot e adicione atendentes.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg w-fit border border-zinc-800">
        {([
          { key: 'whatsapp', label: '📱 WhatsApp' },
          { key: 'prompt', label: '🤖 Personalidade da IA' },
          { key: 'times', label: '👥 Setores' },
          { key: 'usuarios', label: '🔑 Atendentes' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setAba(tab.key)}
            className={`text-xs px-4 py-2 rounded-md transition-colors ${
              aba === tab.key ? 'bg-zinc-700 text-zinc-100 font-medium shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'whatsapp' && <SecaoWhatsApp />}
      {aba === 'prompt'   && <SecaoPrompt />}
      {aba === 'times'    && <SecaoTimes />}
      {aba === 'usuarios' && <SecaoUsuarios />}
    </div>
  )
}
