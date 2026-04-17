'use client'

import React from 'react'
import { ArrowRight, Briefcase, TrendingUp, ShieldCheck, ChevronRight, Calculator, PieChart } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050914] text-zinc-100 font-sans selection:bg-[#0f6733] selection:text-white overflow-hidden">
      
      {/* BACKGROUND GLOW EFFECTS */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#0f6733]/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#006775]/15 blur-[120px] pointer-events-none" />

      {/* HEADER / NAVBAR */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#050914]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Cajado Simplificado */}
            <div className="relative w-10 h-10 flex flex-col items-center justify-center">
              <div className="absolute top-0 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-[#d8df15]" />
              <div className="absolute bottom-1 w-full flex justify-between px-0.5">
                <div className="w-0 h-0 border-r-[16px] border-r-transparent border-b-[24px] border-b-[#006775]" />
                <div className="w-0 h-0 border-l-[16px] border-l-transparent border-b-[24px] border-b-[#0f6733]" />
              </div>
            </div>
            <span className="font-['Syne'] font-extrabold text-2xl tracking-tight text-white flex flex-col leading-none">
              CAJADO
              <span className="text-[#8b98b8] text-[0.45em] font-medium tracking-[0.2em] uppercase">SOLUÇÕES</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
            <a href="#servicos" className="hover:text-[#d8df15] transition-colors">Serviços</a>
            <a href="#diferencial" className="hover:text-[#d8df15] transition-colors">Nosso Diferencial</a>
            <a href="#contato" className="hover:text-[#d8df15] transition-colors">Fale Conosco</a>
          </nav>
          <div className="flex items-center gap-4">
            <a 
              href="https://sistema.cajadosolucoes.com.br/login" 
              className="text-sm font-bold text-white border border-white/20 hover:bg-white/10 px-5 py-2 rounded-full transition-all flex items-center gap-2"
            >
              Acesso Restrito <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="pt-40 pb-24 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#0f6733]/10 border border-[#0f6733]/30 text-sm font-bold text-[#d8df15] mx-auto">
            <ShieldCheck size={16} /> Especialistas em Resultados
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Inteligência e Gestão <br/>
            Para Vencer o <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f6733] via-[#d8df15] to-[#006775]">Mercado.</span>
          </h1>
          <p className="text-lg md:text-xl text-[#8b98b8] max-w-2xl mx-auto leading-relaxed">
            A Cajado Soluções oferece consultoria, gestão financeira e planejamento estratégico de alto impacto para empresas que desejam crescer com segurança e previsibilidade.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <a 
              href="#contato"
              className="bg-[#0f6733] text-white font-bold px-8 py-4 rounded-full text-center hover:bg-[#0a4f26] transition-colors shadow-[0_0_20px_rgba(15,103,51,0.3)] flex items-center justify-center gap-2"
            >
              Falar com um Especialista <ChevronRight size={20} />
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="servicos" className="py-24 bg-[#080d1e] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold text-white">Nossos Serviços</h2>
            <p className="text-[#8b98b8] max-w-2xl mx-auto">Conheça o portfólio de soluções que desenvolvemos para colocar o seu negócio sempre um passo à frente da concorrência.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ServiceCard 
              icon={<TrendingUp className="text-[#d8df15]" size={36} />}
              title="Planejamento Estratégico"
              desc="Mapeamos o cenário atual da sua empresa, identificamos gargalos e desenhamos um plano de ação robusto voltado à expansão sustentável."
            />
            <ServiceCard 
              icon={<Calculator className="text-[#0f6733]" size={36} />}
              title="Gestão e BPO Financeiro"
              desc="Terceirize o controle do seu setor financeiro com nosso time de especialistas. Tenha visibilidade clara de caixa, contas e lucros."
            />
            <ServiceCard 
              icon={<PieChart className="text-[#006775]" size={36} />}
              title="Análise de Indicadores"
              desc="Acompanhamos métricas essenciais e transformamos dados operacionais brutos em relatórios claros para tomada de decisão gerencial."
            />
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section id="contato" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f6733]/5 to-[#006775]/10 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white">Pronto para a transformação?</h2>
          <p className="text-xl text-[#8b98b8]">Nossa equipe está preparada para entender a necessidade do seu negócio e construir uma solução sob medida.</p>
          <a 
            href="#"
            className="inline-flex bg-white text-zinc-950 font-bold px-10 py-5 rounded-full hover:scale-105 transition-transform items-center gap-2"
          >
            Entrar em Contato Agora
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#050914] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-['Syne'] font-extrabold text-xl text-white flex gap-2">CAJADO <span className="text-[#0f6733]">SOLUÇÕES</span></span>
            </div>
            <p className="text-[#8b98b8] text-sm max-w-sm">Apoiando empresas na profissionalização dos resultados usando metodologia e estratégia de ponta.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Acesso Rápido</h4>
            <ul className="space-y-2 text-sm text-[#8b98b8]">
              <li><a href="#servicos" className="hover:text-[#d8df15]">Nossos Serviços</a></li>
              <li><a href="#contato" className="hover:text-[#d8df15]">Orçamento e Consultoria</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Área do Cliente</h4>
            <ul className="space-y-2 text-sm text-[#8b98b8]">
              <li>
                <a href="https://sistema.cajadosolucoes.com.br/login" className="hover:text-[#0f6733] font-medium flex items-center gap-2">
                  <Briefcase size={14} /> Painel Administrativo
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/5 text-center flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[#8b98b8]">
            © {new Date().getFullYear()} Cajado Soluções. Todos os direitos reservados.
          </span>
        </div>
      </footer>
    </div>
  )
}

function ServiceCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-4">{title}</h3>
      <p className="text-[#8b98b8] leading-relaxed text-sm">{desc}</p>
    </div>
  )
}
