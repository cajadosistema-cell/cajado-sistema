'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/ui'
import { cn } from '@/lib/utils'

// ── DISC Questions ────────────────────────────────────────────────
const DISC_PERGUNTAS = [
  { id: 1, texto: 'Quando há um problema, prefiro agir imediatamente e tomar a frente.', dim: 'D' },
  { id: 2, texto: 'Gosto de convencer pessoas e influenciar decisões do grupo.', dim: 'I' },
  { id: 3, texto: 'Prefiro ambientes estáveis e previsíveis a mudanças frequentes.', dim: 'S' },
  { id: 4, texto: 'Analiso cada detalhe antes de tomar uma decisão.', dim: 'C' },
  { id: 5, texto: 'Sou direto, objetivo e não tenho medo de confronto quando necessário.', dim: 'D' },
  { id: 6, texto: 'Sou animado, otimista e gosto de trabalhar em equipe.', dim: 'I' },
  { id: 7, texto: 'Sou paciente e prefiro terminar uma tarefa antes de começar outra.', dim: 'S' },
  { id: 8, texto: 'Sigo regras e procedimentos à risca — qualidade importa mais que velocidade.', dim: 'C' },
  { id: 9, texto: 'Gosto de liderar e não me incomodo em assumir riscos.', dim: 'D' },
  { id: 10, texto: 'Me relaciono facilmente com qualquer tipo de pessoa.', dim: 'I' },
  { id: 11, texto: 'Valorizo lealdade, harmonia e evito conflitos.', dim: 'S' },
  { id: 12, texto: 'Preciso de dados e evidências para tomar decisões importantes.', dim: 'C' },
]

const TEMP_PERGUNTAS = [
  { id: 1, texto: 'Sou naturalmente líder, determinado e muitas vezes impaciente.', temp: 'C' },
  { id: 2, texto: 'Sou sensível, perfeccionista e me aprofundo muito nas coisas.', temp: 'M' },
  { id: 3, texto: 'Sou calmo, paciente e raramente me exalto emocionalmente.', temp: 'F' },
  { id: 4, texto: 'Sou alegre, sociável e às vezes me distraio com facilidade.', temp: 'S' },
  { id: 5, texto: 'Tenho forte senso de propósito e dificuldade em aceitar limites.', temp: 'C' },
  { id: 6, texto: 'Tenho altos e baixos emocionais e sou muito criativo.', temp: 'M' },
  { id: 7, texto: 'Adapto-me facilmente e prefiro não criar conflito.', temp: 'F' },
  { id: 8, texto: 'Sou espontâneo, entusiasmado e adoro o centro das atenções.', temp: 'S' },
  { id: 9, texto: 'Sou independente e prefiro fazer do meu jeito.', temp: 'C' },
  { id: 10, texto: 'Analiso muito antes de agir e tenho medo de errar.', temp: 'M' },
  { id: 11, texto: 'Prefiro a paz e a estabilidade a qualquer custo.', temp: 'F' },
  { id: 12, texto: 'Sou comunicativo, otimista e vivo o presente.', temp: 'S' },
]

const DISC_INFO: Record<string, { nome: string; cor: string; icon: string; desc: string; pontos: string[] }> = {
  D: { nome: 'Executor', cor: '#ef4444', icon: '⚡', desc: 'Dominância — Foco em resultados, decisivo e direto.',
       pontos: ['Toma decisões rápidas', 'Aceita desafios', 'Age sob pressão', 'Liderança natural'] },
  I: { nome: 'Comunicador', cor: '#f59e0b', icon: '💬', desc: 'Influência — Comunicativo, otimista e persuasivo.',
       pontos: ['Inspira equipes', 'Resolve conflitos', 'Cria conexões', 'Pensa fora da caixa'] },
  S: { nome: 'Planejador', cor: '#10b981', icon: '🛡️', desc: 'Estabilidade — Confiável, paciente e consistente.',
       pontos: ['Leal e dedicado', 'Trabalho consistente', 'Suporte às equipes', 'Ambiente harmônico'] },
  C: { nome: 'Analista', cor: '#3b82f6', icon: '🔬', desc: 'Conformidade — Analítico, preciso e orientado a qualidade.',
       pontos: ['Alta precisão', 'Segue processos', 'Pensamento crítico', 'Excelência técnica'] },
}

const TEMP_INFO: Record<string, { nome: string; cor: string; icon: string; desc: string; pontos: string[] }> = {
  C: { nome: 'Colérico', cor: '#ef4444', icon: '🔥', desc: 'Forte, decidido e com grande força de vontade.',
       pontos: ['Líder nato', 'Autoconfiante', 'Determinado', 'Pode ser impaciente'] },
  M: { nome: 'Melancólico', cor: '#8b5cf6', icon: '🎨', desc: 'Analítico, sensível e profundo em seus pensamentos.',
       pontos: ['Perfeccionista', 'Criativo', 'Empático', 'Pode ser pessimista'] },
  F: { nome: 'Fleumático', cor: '#06b6d4', icon: '🌊', desc: 'Calmo, equilibrado e um pacificador natural.',
       pontos: ['Diplomático', 'Consistente', 'Paciente', 'Pode evitar conflitos'] },
  S: { nome: 'Sanguíneo', cor: '#f59e0b', icon: '☀️', desc: 'Animado, sociável e cheio de entusiasmo.',
       pontos: ['Carismático', 'Motivador', 'Adaptável', 'Pode ser impulsivo'] },
}

function BarraPerfil({ label, valor, cor, icon }: { label: string; valor: number; cor: string; icon: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-fg-secondary font-medium">{icon} {label}</span>
        <span className="font-bold" style={{ color: cor }}>{valor}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${valor}%`, backgroundColor: cor }} />
      </div>
    </div>
  )
}

function Questionario({ perguntas, onFim }: {
  perguntas: typeof DISC_PERGUNTAS; onFim: (r: Record<string, number>) => void
}) {
  const [idx, setIdx] = useState(0)
  const [respostas, setRespostas] = useState<Record<number, number>>({})
  const total = perguntas.length
  const p = perguntas[idx]

  const responder = (nota: number) => {
    const novas = { ...respostas, [p.id]: nota }
    setRespostas(novas)
    if (idx + 1 < total) {
      setIdx(i => i + 1)
    } else {
      // Calcular pontuação por dimensão
      const dims: Record<string, number[]> = {}
      perguntas.forEach(q => {
        const key = (q as any).dim || (q as any).temp
        if (!dims[key]) dims[key] = []
        dims[key].push(novas[q.id] || 0)
      })
      const resultado: Record<string, number> = {}
      Object.entries(dims).forEach(([k, vals]) => {
        resultado[k] = Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 4)) * 100)
      })
      onFim(resultado)
    }
  }

  const pct = Math.round(((idx) / total) * 100)
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-xs text-fg-tertiary mb-1">
          <span>Pergunta {idx + 1} de {total}</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="bg-page border border-border-subtle rounded-2xl p-6 text-center">
        <p className="text-sm font-medium text-fg leading-relaxed mb-8">{p.texto}</p>
        <p className="text-[10px] text-fg-disabled mb-4 uppercase tracking-widest">Com que frequência isso descreve você?</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { nota: 1, label: 'Raramente', cor: 'border-zinc-600 hover:border-zinc-500' },
            { nota: 2, label: 'Às vezes', cor: 'border-blue-700 hover:border-blue-500' },
            { nota: 3, label: 'Frequente', cor: 'border-amber-700 hover:border-amber-500' },
            { nota: 4, label: 'Sempre', cor: 'border-emerald-700 hover:border-emerald-500' },
          ].map(({ nota, label, cor }) => (
            <button key={nota} onClick={() => responder(nota)}
              className={cn('py-3 rounded-xl border text-xs font-semibold transition-all hover:scale-105 active:scale-95', cor,
                'hover:bg-white/5 text-fg-tertiary hover:text-fg'
              )}>
              <span className="text-lg block mb-1">{nota === 1 ? '😐' : nota === 2 ? '🙂' : nota === 3 ? '😊' : '🤩'}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
      {idx > 0 && (
        <button onClick={() => setIdx(i => i - 1)} className="mt-3 text-xs text-fg-tertiary hover:text-fg">
          ← Voltar
        </button>
      )}
    </div>
  )
}

function CardPerfil({ chave, valor, info, dominante }: {
  chave: string; valor: number; info: typeof DISC_INFO[string]; dominante: boolean
}) {
  return (
    <div className={cn('bg-page border rounded-2xl p-5 transition-all', dominante ? 'border-2 shadow-lg' : 'border-border-subtle')}
      style={dominante ? { borderColor: info.cor + '80', boxShadow: `0 0 20px ${info.cor}20` } : {}}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <p className="text-sm font-bold text-fg">{info.nome}</p>
            {dominante && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: info.cor + '20', color: info.cor }}>Dominante</span>}
          </div>
        </div>
        <span className="text-2xl font-black" style={{ color: info.cor }}>{valor}%</span>
      </div>
      <p className="text-xs text-fg-tertiary mb-3">{info.desc}</p>
      <div className="w-full bg-muted rounded-full h-2 mb-3">
        <div className="h-2 rounded-full" style={{ width: `${valor}%`, backgroundColor: info.cor }} />
      </div>
      <ul className="space-y-1">
        {info.pontos.map(p => (
          <li key={p} className="text-[10px] text-fg-secondary flex items-center gap-1.5">
            <span style={{ color: info.cor }}>▸</span> {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PerfisClient() {
  const supabase = createClient()
  const [aba, setAba] = useState<'resultado' | 'disc' | 'temp'>('resultado')
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [discRespostas, setDiscRespostas] = useState<Record<string, number> | null>(null)
  const [tempRespostas, setTempRespostas] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await (supabase.from('perfis_comportamentais') as any).select('*').eq('user_id', user?.id).maybeSingle()
      setPerfil(data)
      setLoading(false)
    }
    load()
  }, [])

  const salvarPerfil = async (disc: Record<string, number>, temp: Record<string, number>) => {
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    const discDom = Object.entries(disc).sort((a, b) => b[1] - a[1])[0]?.[0]
    const tempDom = Object.entries(temp).sort((a, b) => b[1] - a[1])[0]?.[0]
    const payload = {
      user_id: user?.id,
      disc_dominancia: disc.D ?? 0, disc_influencia: disc.I ?? 0,
      disc_estabilidade: disc.S ?? 0, disc_conformidade: disc.C ?? 0,
      disc_perfil_dominante: discDom,
      temp_colerico: temp.C ?? 0, temp_melancolico: temp.M ?? 0,
      temp_fleumatico: temp.F ?? 0, temp_sanguineo: temp.S ?? 0,
      temp_perfil_dominante: tempDom,
      respondido_em: new Date().toISOString(),
    }
    const { data } = await (supabase.from('perfis_comportamentais') as any)
      .upsert(payload, { onConflict: 'user_id' }).select().single()
    setPerfil(data)
    setDiscRespostas(null)
    setTempRespostas(null)
    setAba('resultado')
    setSalvando(false)
  }

  const discFimHandler = (r: Record<string, number>) => {
    setDiscRespostas(r)
    setAba('temp')
  }

  const tempFimHandler = async (r: Record<string, number>) => {
    setTempRespostas(r)
    if (discRespostas) await salvarPerfil(discRespostas, r)
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-fg-tertiary text-sm">⏳ Carregando...</div>

  const disc = perfil ? {
    D: perfil.disc_dominancia, I: perfil.disc_influencia,
    S: perfil.disc_estabilidade, C: perfil.disc_conformidade,
  } : null
  const temp = perfil ? {
    C: perfil.temp_colerico, M: perfil.temp_melancolico,
    F: perfil.temp_fleumatico, S: perfil.temp_sanguineo,
  } : null

  return (
    <div>
      <PageHeader title="🧠 Perfis Comportamentais" subtitle="DISC Profissional · Temperamentos Pessoais · Autoconhecimento">
        <button onClick={() => setAba('disc')} className="btn-primary">
          {perfil ? '🔄 Refazer Questionário' : '✏️ Responder Questionário'}
        </button>
      </PageHeader>

      {/* Tabs */}
      {perfil && (
        <div className="flex gap-1 bg-page border border-border-subtle rounded-xl p-1 mb-6 w-fit">
          {[
            { id: 'resultado', label: '📊 Resultado Completo' },
            { id: 'disc', label: '⚡ Refazer DISC' },
            { id: 'temp', label: '🌡️ Refazer Temperamento' },
          ].map(t => (
            <button key={t.id} onClick={() => setAba(t.id as any)}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-medium transition-colors',
                aba === t.id ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              )}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Questionários */}
      {aba === 'disc' && <Questionario perguntas={DISC_PERGUNTAS} onFim={discFimHandler} />}
      {aba === 'temp' && <Questionario perguntas={TEMP_PERGUNTAS} onFim={tempFimHandler} />}
      {salvando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-page border border-border-subtle rounded-2xl p-8 text-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-fg">Salvando seu perfil...</p>
          </div>
        </div>
      )}

      {/* Resultado */}
      {aba === 'resultado' && !perfil && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-6xl mb-4">🧠</span>
          <h3 className="text-lg font-semibold text-fg mb-2">Descubra seu perfil</h3>
          <p className="text-sm text-fg-tertiary mb-6 max-w-md">
            Responda os questionários DISC (perfil profissional) e Temperamentos (perfil pessoal)
            para obter uma análise completa do seu comportamento.
          </p>
          <button onClick={() => setAba('disc')} className="btn-primary px-8">✏️ Começar questionário</button>
          <p className="text-xs text-fg-disabled mt-3">~5 minutos · 24 perguntas no total</p>
        </div>
      )}

      {aba === 'resultado' && perfil && disc && temp && (
        <div className="space-y-8">
          {/* Banner dominantes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { tipo: 'Perfil Profissional (DISC)', chave: perfil.disc_perfil_dominante, info: DISC_INFO[perfil.disc_perfil_dominante as keyof typeof DISC_INFO] },
              { tipo: 'Temperamento Pessoal', chave: perfil.temp_perfil_dominante, info: TEMP_INFO[perfil.temp_perfil_dominante as keyof typeof TEMP_INFO] },
            ].filter(b => b.info).map(b => (
              <div key={b.tipo} className="rounded-2xl p-5 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${b.info.cor}25, ${b.info.cor}10)`, border: `1px solid ${b.info.cor}30` }}>
                <p className="text-[10px] text-fg-disabled uppercase tracking-widest mb-2">{b.tipo}</p>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{b.info.icon}</span>
                  <div>
                    <h3 className="text-2xl font-black text-fg">{b.info.nome}</h3>
                    <p className="text-xs text-fg-tertiary mt-0.5">{b.info.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DISC */}
          <div>
            <h2 className="text-base font-bold text-fg mb-4">⚡ Perfil DISC — Profissional</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(DISC_INFO).map(([k, info]) => (
                <CardPerfil key={k} chave={k} valor={disc[k as keyof typeof disc] ?? 0} info={info}
                  dominante={perfil.disc_perfil_dominante === k} />
              ))}
            </div>
          </div>

          {/* Temperamentos */}
          <div>
            <h2 className="text-base font-bold text-fg mb-4">🌡️ Temperamentos — Pessoal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(TEMP_INFO).map(([k, info]) => (
                <CardPerfil key={k} chave={k} valor={temp[k as keyof typeof temp] ?? 0} info={info}
                  dominante={perfil.temp_perfil_dominante === k} />
              ))}
            </div>
          </div>

          {/* Combinação */}
          <div className="bg-page border border-border-subtle rounded-2xl p-5">
            <h2 className="text-sm font-bold text-fg mb-3">🎯 Sua Combinação de Perfis</h2>
            <p className="text-xs text-fg-secondary leading-relaxed">
              Profissionalmente você é um <strong className="text-amber-400">
                {DISC_INFO[perfil.disc_perfil_dominante as keyof typeof DISC_INFO]?.nome || '—'}
              </strong> (DISC/{perfil.disc_perfil_dominante}), 
              que combina com o temperamento <strong className="text-amber-400">
                {TEMP_INFO[perfil.temp_perfil_dominante as keyof typeof TEMP_INFO]?.nome || '—'}
              </strong>.
              Essa combinação indica um perfil {' '}
              {perfil.disc_perfil_dominante === 'D' && perfil.temp_perfil_dominante === 'C'
                ? 'altamente orientado a resultados, com grande força de liderança e determinação.'
                : perfil.disc_perfil_dominante === 'I' && perfil.temp_perfil_dominante === 'S'
                ? 'comunicativo e inspirador, que motiva pessoas naturalmente.'
                : perfil.disc_perfil_dominante === 'S' && perfil.temp_perfil_dominante === 'F'
                ? 'estável e pacificador, excelente em manter equipes coesas.'
                : perfil.disc_perfil_dominante === 'C' && perfil.temp_perfil_dominante === 'M'
                ? 'analítico e perfeccionista, ideal para funções técnicas e estratégicas.'
                : 'único e multidimensional, com capacidades em diferentes áreas.'}
            </p>
            <p className="text-[10px] text-fg-disabled mt-2">
              Última atualização: {perfil.respondido_em ? new Date(perfil.respondido_em).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
