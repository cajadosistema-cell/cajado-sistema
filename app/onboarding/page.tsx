'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// ── Tipos ───────────────────────────────────────────────────
type Etapa = 1 | 2 | 3

const SEGMENTOS = [
  { id: 'servicos',      label: 'Serviços',          emoji: '🔧' },
  { id: 'comercio',      label: 'Comércio',          emoji: '🛒' },
  { id: 'tecnologia',    label: 'Tecnologia',        emoji: '💻' },
  { id: 'saude',         label: 'Saúde',             emoji: '🏥' },
  { id: 'educacao',      label: 'Educação',          emoji: '📚' },
  { id: 'construcao',    label: 'Construção',        emoji: '🏗️' },
  { id: 'alimentacao',   label: 'Alimentação',       emoji: '🍽️' },
  { id: 'financeiro',    label: 'Financeiro',        emoji: '💰' },
  { id: 'logistica',     label: 'Logística',         emoji: '🚚' },
  { id: 'outro',         label: 'Outro',             emoji: '📦' },
]

const PLANOS = [
  {
    id: 'trial',
    label: 'Trial Gratuito',
    preco: 'R$ 0',
    periodo: '5 dias',
    cor: 'border-zinc-600',
    badge: 'Grátis',
    badgeCor: 'bg-zinc-700 text-zinc-300',
    features: ['Todos os módulos', 'Até 3 usuários', 'Suporte básico'],
  },
  {
    id: 'basico',
    label: 'Básico',
    preco: 'R$ 97',
    periodo: '/mês',
    cor: 'border-blue-500/40',
    badge: 'Popular',
    badgeCor: 'bg-blue-500/20 text-blue-400',
    features: ['Todos os módulos', 'Até 5 usuários', 'WhatsApp Inbox', 'Suporte prioritário'],
  },
  {
    id: 'pro',
    label: 'Pro',
    preco: 'R$ 197',
    periodo: '/mês',
    cor: 'border-amber-500/50',
    badge: 'Recomendado',
    badgeCor: 'bg-amber-500/20 text-amber-400',
    features: ['Tudo do Básico', 'Usuários ilimitados', 'IA Avançada (Elena)', 'API de Integração', 'Relatórios personalizados'],
  },
]

// ── Indicador de progresso ───────────────────────────────────
function StepIndicator({ etapa }: { etapa: Etapa }) {
  const steps = [
    { num: 1, label: 'Sua empresa' },
    { num: 2, label: 'Plano' },
    { num: 3, label: 'Pronto!' },
  ]
  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300',
              etapa > s.num
                ? 'bg-amber-500 border-amber-500 text-black'
                : etapa === s.num
                  ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                  : 'border-zinc-700 text-zinc-600 bg-transparent'
            )}>
              {etapa > s.num ? '✓' : s.num}
            </div>
            <span className={cn(
              'text-[10px] mt-1.5 font-medium tracking-wide',
              etapa >= s.num ? 'text-fg-secondary' : 'text-fg-disabled'
            )}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              'h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-all duration-500',
              etapa > s.num ? 'bg-amber-500' : 'bg-zinc-800'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome_empresa: '',
    cnpj: '',
    telefone: '',
    segmento: '',
    plano: 'trial',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleCriarEmpresa = async () => {
    if (!form.nome_empresa.trim()) { setErro('Informe o nome da empresa.'); return }
    if (!form.segmento) { setErro('Selecione o segmento de atuação.'); return }
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/criar-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar empresa')
      setEtapa(3)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFinalizar = () => {
    router.push('/inicio')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Cajado Soluções" className="h-14 w-auto mx-auto mb-4 object-contain drop-shadow-lg" />
          <h1 className="text-2xl font-bold text-fg">Bem-vindo ao Cajado Sistema</h1>
          <p className="text-sm text-fg-tertiary mt-1">Vamos configurar sua empresa em menos de 2 minutos.</p>
        </div>

        <StepIndicator etapa={etapa} />

        {/* ── ETAPA 1: Dados da empresa ── */}
        {etapa === 1 && (
          <div className="bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-fg mb-1">🏢 Sobre sua empresa</h2>
              <p className="text-sm text-fg-tertiary">Essas informações aparecem nos relatórios e documentos do sistema.</p>
            </div>

            <div>
              <label className="label">Nome da empresa *</label>
              <input
                id="nome-empresa"
                className="input mt-1"
                placeholder="Ex: Cajado Soluções em Segurança"
                value={form.nome_empresa}
                onChange={e => set('nome_empresa', e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">CNPJ (opcional)</label>
                <input
                  id="cnpj"
                  className="input mt-1"
                  placeholder="00.000.000/0001-00"
                  value={form.cnpj}
                  onChange={e => set('cnpj', e.target.value)}
                />
              </div>
              <div>
                <label className="label">WhatsApp / Telefone</label>
                <input
                  id="telefone"
                  className="input mt-1"
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={e => set('telefone', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Segmento de atuação *</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                {SEGMENTOS.map(s => (
                  <button
                    key={s.id}
                    id={`seg-${s.id}`}
                    type="button"
                    onClick={() => set('segmento', s.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all',
                      form.segmento === s.id
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                        : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg hover:bg-muted/50'
                    )}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <span className="leading-tight text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {erro && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                ⚠️ {erro}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                id="btn-proximo-etapa1"
                onClick={() => {
                  if (!form.nome_empresa.trim()) { setErro('Informe o nome da empresa.'); return }
                  if (!form.segmento) { setErro('Selecione o segmento de atuação.'); return }
                  setErro('')
                  setEtapa(2)
                }}
                className="btn-primary px-8"
              >
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* ── ETAPA 2: Escolha do plano ── */}
        {etapa === 2 && (
          <div className="bg-surface border border-white/5 rounded-2xl p-8 shadow-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-fg mb-1">🚀 Escolha seu plano</h2>
              <p className="text-sm text-fg-tertiary">Comece no trial gratuito. Faça upgrade a qualquer momento.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PLANOS.map(p => (
                <button
                  key={p.id}
                  id={`plano-${p.id}`}
                  type="button"
                  onClick={() => set('plano', p.id)}
                  className={cn(
                    'relative flex flex-col p-5 rounded-2xl border-2 text-left transition-all duration-200',
                    form.plano === p.id
                      ? `${p.cor} bg-white/5 shadow-lg scale-[1.02]`
                      : 'border-border-subtle hover:border-border hover:bg-muted/30'
                  )}
                >
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full self-start mb-3', p.badgeCor)}>
                    {p.badge}
                  </span>
                  <p className="text-sm font-bold text-fg mb-0.5">{p.label}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-black text-amber-400">{p.preco}</span>
                    <span className="text-xs text-fg-tertiary">{p.periodo}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-fg-secondary">
                        <span className="text-emerald-400 text-[10px]">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {form.plano === p.id && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-black text-black">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {form.plano !== 'trial' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-400">
                💳 O pagamento será configurado após a criação da conta. Você terá 5 dias de trial gratuito para explorar tudo.
              </div>
            )}

            {erro && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                ⚠️ {erro}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                id="btn-voltar-etapa2"
                onClick={() => { setErro(''); setEtapa(1) }}
                className="btn-secondary"
              >
                ← Voltar
              </button>
              <button
                id="btn-criar-empresa"
                onClick={handleCriarEmpresa}
                disabled={loading}
                className="btn-primary px-8 min-w-[160px]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Criando...
                  </span>
                ) : '🚀 Criar minha empresa'}
              </button>
            </div>
          </div>
        )}

        {/* ── ETAPA 3: Sucesso ── */}
        {etapa === 3 && (
          <div className="bg-surface border border-white/5 rounded-2xl p-10 shadow-2xl text-center space-y-6">
            {/* Animação de sucesso */}
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping opacity-75" />
              <div className="relative w-24 h-24 bg-amber-500/10 border-2 border-amber-500/40 rounded-full flex items-center justify-center">
                <span className="text-4xl">🎉</span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-fg mb-2">Tudo pronto, {form.nome_empresa}!</h2>
              <p className="text-fg-tertiary text-sm leading-relaxed max-w-md mx-auto">
                Sua empresa foi criada com sucesso. Você já tem acesso completo ao sistema com todas as configurações iniciais prontas.
              </p>
            </div>

            {/* Checklist do que foi criado */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-6 py-4 text-left space-y-2 max-w-sm mx-auto">
              {[
                'Empresa cadastrada no sistema',
                'Categorias financeiras criadas (10)',
                'Você é o Administrador',
                `Plano: ${PLANOS.find(p => p.id === form.plano)?.label}`,
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-emerald-400">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span className="text-fg-secondary">{item}</span>
                </div>
              ))}
            </div>

            <button
              id="btn-entrar-sistema"
              onClick={handleFinalizar}
              className="btn-primary px-12 py-3 text-base font-bold mx-auto"
            >
              Entrar no Sistema →
            </button>

            <p className="text-xs text-fg-disabled">
              Você pode configurar mais detalhes em <strong className="text-fg-tertiary">Configurações</strong> a qualquer momento.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
