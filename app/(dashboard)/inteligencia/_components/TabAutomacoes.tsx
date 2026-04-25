'use client'

import { useState } from 'react'

export function TabAutomacoes() {
  const [frequencia, setFrequencia] = useState('semanal')
  const [diaEnvio, setDiaEnvio] = useState('sexta')
  const [whatsapp, setWhatsapp] = useState('+55')

  const [alertas, setAlertas] = useState([
    { id: 'caixa', nome: 'Saldo Baixo / Risco de Caixa', ativo: true, desc: 'Notifica se a Previsão de Caixa ficar negativa' },
    { id: 'okr', nome: 'Mudança de Status de OKRs', ativo: true, desc: 'Avisa quando uma meta entra "Em Risco" ou "Atrasada"' },
    { id: 'vendas', nome: 'Fechamento de Negócios Acima de R$10k', ativo: false, desc: 'Aviso em tempo real no grupo da diretoria' }
  ])

  const toggleAlerta = (id: string) => {
    setAlertas(alertas.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a))
  }

  const [healthScore] = useState(85) // Pode ser gerado pelo backend nas Edge Functions

  return (
    <div className="space-y-6">
      
      {/* Health Score do Negócio */}
      <div className="bg-page border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="shrink-0 flex items-center justify-center w-24 h-24 rounded-full border-4 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <span className="text-3xl font-bold text-emerald-400">{healthScore}</span>
            <span className="text-xs text-fg-tertiary mb-4">%</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-fg flex items-center gap-2">🩺 Saúde do Negócio</h3>
            <p className="text-xs text-fg-secondary mt-1 leading-relaxed">
              Baseado no seu Caixa, Fluxo de Vendas (Cajado) e cumprimento dos OKRs Tri/Semanas, seu negócio está <strong>muito saudável</strong>. As métricas indicam crescimento projetado forte para os próximos 30 dias.
            </p>
          </div>
          <button className="btn-secondary text-xs shrink-0 flex items-center gap-2">
            📊 Gerar Análise Profunda
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Relatório Semanal */}
        <div className="bg-page border border-border-subtle rounded-xl p-6 shadow-sm">
          <div className="mb-5 border-b border-border-subtle/60 pb-3 flex justify-between items-center">
             <div>
               <h3 className="text-sm font-bold text-fg">📱 Relatório Direto Diretor (WhatsApp)</h3>
               <p className="text-[10px] text-fg-tertiary mt-1">Configure Edge Functions para enviar resumos.</p>
             </div>
             <span className="text-2xl">🤖</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="label">Frequência de Envio</label>
              <select className="input mt-1" value={frequencia} onChange={e => setFrequencia(e.target.value)}>
                <option value="diario">Diário (Fechamento do Dia)</option>
                <option value="semanal">Semanal (Resumo Semanal)</option>
                <option value="mensal">Mensal (Fechamento Geral)</option>
              </select>
            </div>
            
            {frequencia === 'semanal' && (
              <div>
                <label className="label">Dia do envio</label>
                <select className="input mt-1" value={diaEnvio} onChange={e => setDiaEnvio(e.target.value)}>
                  <option value="sexta">Sexta-feira 18:00</option>
                  <option value="segunda">Segunda-feira 08:00</option>
                </select>
              </div>
            )}
            
            <div>
               <label className="label">WhatsApp Chefe/Diretor</label>
               <input className="input mt-1" placeholder="+55 11 99999-9999" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </div>

            <button className="btn-primary w-full text-xs font-bold shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-500 to-teal-500 border-none text-zinc-950 mt-4 py-2.5">
              Salvar Automação de Edge
            </button>
          </div>
        </div>

        {/* Alertas Estratégicos */}
        <div className="bg-page border border-border-subtle rounded-xl p-6 shadow-sm">
          <div className="mb-5 border-b border-border-subtle/60 pb-3 flex justify-between items-center">
             <div>
               <h3 className="text-sm font-bold text-fg">⚡ Alertas Estratégicos (Triggers)</h3>
               <p className="text-[10px] text-fg-tertiary mt-1">Avisos proativos de desvios no sistema.</p>
             </div>
             <span className="text-2xl">🚨</span>
          </div>

          <div className="space-y-3">
            {alertas.map(alerta => (
              <div key={alerta.id} onClick={() => toggleAlerta(alerta.id)} className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${alerta.ativo ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-subtle bg-page/50'}`}>
                <div>
                  <h4 className={`text-xs font-bold ${alerta.ativo ? 'text-amber-400' : 'text-fg-tertiary'}`}>{alerta.nome}</h4>
                  <p className="text-[10px] text-fg-disabled mt-0.5">{alerta.desc}</p>
                </div>
                <div className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-all ${alerta.ativo ? 'bg-amber-500 justify-end' : 'bg-surface-hover justify-start'}`}>
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
            ))}
            <button className="w-full text-xs font-semibold py-2 rounded-lg border border-dashed border-border-subtle text-fg-tertiary hover:text-fg-secondary hover:border-zinc-500 transition-colors mt-2">
              + Criar nova regra
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
