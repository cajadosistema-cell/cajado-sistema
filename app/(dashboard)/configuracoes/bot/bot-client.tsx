'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_INBOX_API_URL!

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

function SecaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nome: string; email: string; role: string; setor: string; ativo: boolean }>>([])
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', role: 'atendente', setor: 'vendas' })
  const [adicionando, setAdicionando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    apiGet('/auth/usuarios').then(data => setUsuarios(Array.isArray(data) ? data : []))
  }, [])

  async function handleAdicionar() {
    if (!novo.nome || !novo.email || !novo.senha) return
    setSalvando(true)
    await apiPost('/auth/usuarios', novo)
    const data = await apiGet('/auth/usuarios')
    setUsuarios(Array.isArray(data) ? data : [])
    setNovo({ nome: '', email: '', senha: '', role: 'atendente', setor: 'vendas' })
    setAdicionando(false)
    setSalvando(false)
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Usuários da empresa</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Cada usuário pode acessar o inbox e atender clientes</p>
        </div>
        <button onClick={() => setAdicionando(!adicionando)} className="btn-secondary text-xs">
          {adicionando ? 'Cancelar' : '+ Novo usuário'}
        </button>
      </div>

      {adicionando && (
        <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Nome *</label>
              <input className="input text-xs" value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">E-mail *</label>
              <input className="input text-xs" type="email" value={novo.email} onChange={e => setNovo(n => ({ ...n, email: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Senha *</label>
              <input className="input text-xs" type="password" value={novo.senha} onChange={e => setNovo(n => ({ ...n, senha: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Nível</label>
              <select className="input text-xs" value={novo.role} onChange={e => setNovo(n => ({ ...n, role: e.target.value }))}>
                <option value="atendente">Atendente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button onClick={handleAdicionar} disabled={salvando} className="btn-primary text-xs">
            {salvando ? 'Salvando...' : '+ Adicionar usuário'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {usuarios.map(u => (
          <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-zinc-800/40 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300">
                {u.nome?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-zinc-200">{u.nome}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge text-xs ${u.role === 'admin' ? 'badge-amber' : 'badge-zinc'}`}>{u.role}</span>
              <span className={`text-xs ${u.ativo ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {u.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function ConfiguracoesBotClient() {
  const [aba, setAba] = useState<'prompt' | 'times' | 'usuarios'>('prompt')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Configurações do Bot</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Personalize o assistente e os setores do seu negócio</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg w-fit border border-zinc-800">
        {([
          { key: 'prompt', label: '🤖 Personalidade' },
          { key: 'times', label: '👥 Setores' },
          { key: 'usuarios', label: '🔑 Usuários' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setAba(tab.key)}
            className={`text-xs px-4 py-2 rounded-md transition-colors ${
              aba === tab.key ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'prompt'   && <SecaoPrompt />}
      {aba === 'times'    && <SecaoTimes />}
      {aba === 'usuarios' && <SecaoUsuarios />}
    </div>
  )
}
