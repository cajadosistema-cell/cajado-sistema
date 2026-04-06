'use client'

import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_INBOX_API_URL!

type Step = 'empresa' | 'whatsapp' | 'bot' | 'pronto'

interface EmpresaData {
  nome: string
  email: string
  senha: string
  documento: string
  telefone: string
}

interface CanalData {
  instanceName: string
  canalId: string
  qrcode: string | null
}

// ── Helpers de API ────────────────────────────────────────────

async function registerEmpresa(data: EmpresaData) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: data.nome.split(' ')[0],
      email: data.email,
      senha: data.senha,
      empresaNome: data.nome,
      documento: data.documento,
      telefone: data.telefone,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.erro || 'Erro ao criar conta')
  }
  return res.json()
}

async function criarInstancia(token: string, nome: string) {
  const res = await fetch(`${API}/canais/criar-instancia`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nome }),
  })
  if (!res.ok) throw new Error('Erro ao criar instância WhatsApp')
  return res.json()
}

async function verificarConexao(token: string, instanceName: string) {
  const res = await fetch(`${API}/canais/${instanceName}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.connected === true
}

// ── Steps ─────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'empresa', label: 'Empresa' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'bot', label: 'Bot' },
    { key: 'pronto', label: 'Pronto' },
  ]
  const idx = steps.findIndex(s => s.key === step)
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={`flex flex-col items-center gap-1 ${i <= idx ? 'opacity-100' : 'opacity-30'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
              i < idx ? 'bg-amber-500 border-amber-500 text-zinc-950' :
              i === idx ? 'border-amber-500 text-amber-400' :
              'border-zinc-700 text-zinc-600'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className="text-[10px] text-zinc-500">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-0.5 mb-4 mx-1 ${i < idx ? 'bg-amber-500' : 'bg-zinc-800'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 1: Dados da Empresa ──────────────────────────────────

function StepEmpresa({ onNext }: { onNext: (token: string, data: EmpresaData) => void }) {
  const [data, setData] = useState<EmpresaData>({
    nome: '', email: '', senha: '', documento: '', telefone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof EmpresaData, v: string) {
    setData(d => ({ ...d, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await registerEmpresa(data)
      localStorage.setItem('cajado_inbox_token', res.token)
      onNext(res.token, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label block mb-1.5">Nome da empresa</label>
        <input className="input" placeholder="Ex: Cajado Soluções" value={data.nome} onChange={e => set('nome', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1.5">E-mail</label>
          <input className="input" type="email" placeholder="admin@empresa.com" value={data.email} onChange={e => set('email', e.target.value)} required />
        </div>
        <div>
          <label className="label block mb-1.5">Senha</label>
          <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={data.senha} onChange={e => set('senha', e.target.value)} required minLength={6} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1.5">CNPJ / CPF</label>
          <input className="input" placeholder="00.000.000/0001-00" value={data.documento} onChange={e => set('documento', e.target.value)} />
        </div>
        <div>
          <label className="label block mb-1.5">Telefone</label>
          <input className="input" placeholder="(77) 99999-9999" value={data.telefone} onChange={e => set('telefone', e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Criando conta...' : 'Criar conta e continuar →'}
      </button>
    </form>
  )
}

// ── Step 2: Conectar WhatsApp ─────────────────────────────────

function StepWhatsApp({
  token,
  onNext,
}: {
  token: string
  onNext: (canal: CanalData) => void
}) {
  const [nomeCanal, setNomeCanal] = useState('WhatsApp Comercial')
  const [canal, setCanal] = useState<CanalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [conectado, setConectado] = useState(false)
  const [error, setError] = useState('')

  async function handleCriarInstancia() {
    setLoading(true)
    setError('')
    try {
      const data = await criarInstancia(token, nomeCanal)
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
      const ok = await verificarConexao(token, instanceName)
      if (ok) {
        clearInterval(interval)
        setConectado(true)
        setVerificando(false)
      }
    }, 3000)
    setTimeout(() => {
      clearInterval(interval)
      setVerificando(false)
    }, 120000)
  }

  if (conectado && canal) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">✓</span>
        </div>
        <p className="text-emerald-400 font-semibold">WhatsApp conectado com sucesso!</p>
        <button onClick={() => onNext(canal)} className="btn-primary w-full">
          Continuar → Configurar bot
        </button>
      </div>
    )
  }

  if (canal) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-zinc-300 mb-1">Escaneie o QR Code com seu WhatsApp</p>
          <p className="text-xs text-zinc-500 mb-4">
            Abra o WhatsApp → três pontos → Aparelhos conectados → Conectar aparelho
          </p>
          {canal.qrcode ? (
            <div className="inline-block bg-white p-3 rounded-xl">
              <img
                src={canal.qrcode.startsWith('data:image') ? canal.qrcode : `data:image/png;base64,${canal.qrcode}`}
                alt="QR Code WhatsApp"
                className="w-48 h-48"
              />
            </div>
          ) : (
            <div className="w-48 h-48 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto">
              <p className="text-xs text-zinc-500">QR Code indisponível</p>
            </div>
          )}
        </div>
        {verificando && (
          <p className="text-xs text-zinc-500 text-center animate-pulse">
            Aguardando conexão...
          </p>
        )}
        <button
          onClick={() => iniciarVerificacao(canal.instanceName)}
          className="btn-secondary w-full text-xs"
        >
          Verificar conexão manualmente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label block mb-1.5">Nome do canal</label>
        <input
          className="input"
          value={nomeCanal}
          onChange={e => setNomeCanal(e.target.value)}
          placeholder="Ex: WhatsApp Comercial"
        />
        <p className="text-xs text-zinc-600 mt-1">
          Você poderá adicionar mais números depois
        </p>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
      <button onClick={handleCriarInstancia} disabled={loading} className="btn-primary w-full">
        {loading ? 'Criando instância...' : 'Gerar QR Code →'}
      </button>
      <button onClick={() => onNext({ instanceName: '', canalId: '', qrcode: null })} className="btn-ghost w-full text-xs">
        Pular por agora (conectar depois)
      </button>
    </div>
  )
}

// ── Step 3: Configurar Bot ────────────────────────────────────

function StepBot({ token, onNext }: { token: string; onNext: () => void }) {
  const [form, setForm] = useState({
    nomeBot: 'Sol',
    nomeEmpresa: '',
    descricao: '',
    tom: 'Amigável e consultivo',
  })
  const [gerando, setGerando] = useState(false)
  const [promptGerado, setPromptGerado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleGerarPrompt() {
    if (!form.nomeBot || !form.nomeEmpresa || !form.descricao) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    setGerando(true)
    setError('')
    try {
      const res = await fetch(`${API}/configuracoes/gerar-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao gerar prompt')
      setPromptGerado(data.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar prompt')
    } finally {
      setGerando(false)
    }
  }

  async function handleSalvar() {
    if (!promptGerado) return
    setSalvando(true)
    try {
      await fetch(`${API}/configuracoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ system_prompt: promptGerado }),
      })
      onNext()
    } catch {
      setError('Erro ao salvar configuração')
    } finally {
      setSalvando(false)
    }
  }

  const tonsDisponiveis = [
    'Amigável e consultivo',
    'Formal e profissional',
    'Direto e objetivo',
    'Descontraído e jovem',
    'Técnico e especializado',
  ]

  return (
    <div className="space-y-4">
      {!promptGerado ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Nome do assistente *</label>
              <input className="input" placeholder="Ex: Sol, Ana, Max..." value={form.nomeBot} onChange={e => set('nomeBot', e.target.value)} required />
            </div>
            <div>
              <label className="label block mb-1.5">Nome da empresa *</label>
              <input className="input" placeholder="Ex: Cajado Soluções" value={form.nomeEmpresa} onChange={e => set('nomeEmpresa', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label block mb-1.5">O que sua empresa faz? *</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Ex: Somos uma despachante especializada em licenciamento de veículos, transferências, recursos de multas e regularização de CNH em Vitória da Conquista-BA..."
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Quanto mais detalhar, mais personalizado será o bot
            </p>
          </div>
          <div>
            <label className="label block mb-1.5">Tom de voz</label>
            <div className="grid grid-cols-2 gap-2">
              {tonsDisponiveis.map(tom => (
                <button
                  key={tom}
                  type="button"
                  onClick={() => set('tom', tom)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                    form.tom === tom
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {tom}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <button onClick={handleGerarPrompt} disabled={gerando} className="btn-primary w-full">
            {gerando ? '✨ Gerando com IA...' : '✨ Gerar personalidade do bot com IA →'}
          </button>
        </>
      ) : (
        <>
          <div>
            <label className="label block mb-1.5">Prompt gerado — revise e ajuste se necessário</label>
            <textarea
              className="input resize-none text-xs leading-relaxed"
              rows={10}
              value={promptGerado}
              onChange={e => setPromptGerado(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPromptGerado('')} className="btn-secondary flex-1 text-xs">
              ← Regenerar
            </button>
            <button onClick={handleSalvar} disabled={salvando} className="btn-primary flex-1">
              {salvando ? 'Salvando...' : 'Salvar e finalizar →'}
            </button>
          </div>
        </>
      )}
      <button onClick={onNext} className="btn-ghost w-full text-xs">
        Pular por agora (configurar depois)
      </button>
    </div>
  )
}

// ── Step 4: Pronto ────────────────────────────────────────────

function StepPronto() {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
        <span className="text-4xl">🎉</span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Tudo configurado!</h2>
        <p className="text-sm text-zinc-400">
          Seu WhatsApp está conectado e o bot está pronto para atender.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { icon: '💬', label: 'Abrir Inbox', href: '/inbox' },
          { icon: '🤖', label: 'Editar Bot', href: '/configuracoes/bot' },
          { icon: '👥', label: 'Criar equipe', href: '/configuracoes/equipe' },
          { icon: '📊', label: 'Ver dashboard', href: '/' },
        ].map(item => (
          <a
            key={item.href}
            href={item.href}
            className="card-sm flex items-center gap-3 hover:bg-zinc-800 transition-colors border border-zinc-800 p-4 rounded-lg"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm text-zinc-300">{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function OnboardingClient() {
  const [step, setStep] = useState<Step>('empresa')
  const [token, setToken] = useState('')
  const [canal, setCanal] = useState<CanalData | null>(null)

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-zinc-950 font-bold text-xl">C</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100">Configurar nova empresa</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure tudo em menos de 5 minutos</p>
      </div>

      <StepIndicator step={step} />

      <div className="card">
        {step === 'empresa' && (
          <StepEmpresa
            onNext={(tk, _data) => {
              setToken(tk)
              setStep('whatsapp')
            }}
          />
        )}
        {step === 'whatsapp' && (
          <StepWhatsApp
            token={token}
            onNext={(c) => {
              setCanal(c)
              setStep('bot')
            }}
          />
        )}
        {step === 'bot' && (
          <StepBot token={token} onNext={() => setStep('pronto')} />
        )}
        {step === 'pronto' && <StepPronto />}
      </div>
    </div>
  )
}
