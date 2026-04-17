'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, BarChart3, ShieldCheck, Mail, Users, CheckCircle2, LayoutDashboard, ChevronRight } from 'lucide-react'

// Cores da Marca Baseadas no Logo Cajado:
// Verde: #0f6733
// Azul/Teal: #006775
// Amarelo: #d8df15

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050914] text-zinc-100 font-sans selection:bg-[#006775] selection:text-white overflow-hidden">
      
      {/* BACKGROUND GLOW EFFECTS */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#0f6733]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#006775]/20 blur-[120px] pointer-events-none" />

      {/* HEADER / NAVBAR */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#050914]/80 backdrop-blur-md border-b border-white/5">
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
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#solucoes" className="hover:text-white transition-colors">Soluções</a>
            <a href="#contato" className="hover:text-white transition-colors">Contato</a>
          </nav>
          <div className="flex items-center gap-4">
            {/* O Link para acesso ao sistema usa URL completa para garantir a troca do subdomínio em produção */}
            <a 
              href="https://sistema.cajadosolucoes.com.br/login" 
              className="text-sm font-bold text-white bg-[#0f6733] hover:bg-[#006775] px-6 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(15,103,51,0.4)] hover:shadow-[0_0_25px_rgba(0,103,117,0.6)] flex items-center gap-2"
            >
              Acessar Sistema <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="pt-40 pb-20 px-6 relative z-10">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-[#d8df15]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d8df15] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d8df15]"></span>
              </span>
              Lançamento Oficial 2026
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
              A Gestão <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f6733] via-[#d8df15] to-[#006775]">Inteligente</span> do Seu Negócio.
            </h1>
            <p className="text-lg md:text-xl text-[#8b98b8] max-w-xl leading-relaxed">
              O ecossistema Cajado integra Financeiro, CRM, Caixa e Indicadores em um único painel premium, projetado para impulsionar o seu crescimento exponencial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a 
                href="https://sistema.cajadosolucoes.com.br/login"
                className="bg-white text-zinc-950 font-bold px-8 py-4 rounded-full text-center hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                Entrar no Painel <ChevronRight size={20} />
              </a>
              <button className="px-8 py-4 rounded-full text-center font-bold text-white border border-white/10 hover:bg-white/5 transition-colors">
                Agendar Demonstração
              </button>
            </div>
          </div>

          {/* MOCKUP DO DASHBOARD (Visual Graphic) */}
          <div className="relative w-full aspect-square md:aspect-video lg:aspect-square bg-[#0d1120] border border-white/10 rounded-3xl shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0f6733]/10 to-transparent" />
            
            {/* Top Bar Mock */}
            <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            
            {/* Interface Mock */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col justify-between group-hover:-translate-y-1 transition-transform duration-500">
                <BarChart3 className="text-[#006775] mb-2" size={32} />
                <div>
                  <div className="text-sm text-zinc-400">Receitas Recebidas</div>
                  <div className="text-2xl font-bold text-white">R$ 48.900,00</div>
                </div>
                <div className="w-full h-8 bg-[#006775]/20 rounded mt-4 overflow-hidden">
                  <div className="w-[70%] h-full bg-[#006775]" />
                </div>
              </div>
              
              <div className="bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col justify-between group-hover:-translate-y-2 transition-transform duration-500 delay-100">
                <LayoutDashboard className="text-[#d8df15] mb-2" size={32} />
                <div>
                  <div className="text-sm text-zinc-400">Leads Convertidos</div>
                  <div className="text-2xl font-bold text-white">24 Win Rate</div>
                </div>
                <div className="flex gap-1 mt-4">
                  {[1,2,3,4,5].map(i => <div key={i} className="flex-1 h-8 bg-white/10 rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />)}
                </div>
              </div>
              
              <div className="md:col-span-2 bg-[#0f6733]/10 rounded-2xl border border-[#0f6733]/20 p-4 group-hover:scale-[1.02] transition-transform duration-500">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-[#0f6733]">Visão Global</span>
                  <span className="text-xs px-2 py-1 bg-[#0f6733]/20 rounded-full text-[#0f6733]">Atualizado agora</span>
                </div>
                <div className="relative h-24 w-full flex items-end gap-2">
                  {[30, 45, 25, 60, 80, 50, 90, 100, 75, 40].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-[#0f6733] to-[#d8df15] rounded-t-sm transition-all duration-1000 ease-out" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="recursos" className="py-24 bg-[#080d1e] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold text-white">Engenharia de <span className="text-[#006775]">Excelência</span></h2>
            <p className="text-[#8b98b8] max-w-2xl mx-auto">Tudo que uma operação conectada precisa para não errar e lucrar mais, disponível simultaneamente para toda a equipe.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<BarChart3 className="text-[#d8df15]" size={32} />}
              title="Financeiro 360"
              desc="Controle total sobre o patrimônio líquido, despesas, balanço dinâmico anual e fluxo de caixa."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-[#0f6733]" size={32} />}
              title="RBAC Dinâmico"
              desc="Segurança em nível militar com Rule-Based Access. Controle exatamente o que cada funcionário pode ver."
            />
            <FeatureCard 
              icon={<Users className="text-[#006775]" size={32} />}
              title="CRM Integrado"
              desc="Acompanhe leads, monitore o win rate e integre as vendas diretamente com o caixa e faturamento."
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#050914] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4 col-span-2">
            <div className="flex items-center gap-2">
              <span className="font-['Syne'] font-extrabold text-xl text-white flex gap-2">CAJADO <span className="text-[#0f6733]">SOLUÇÕES</span></span>
            </div>
            <p className="text-[#8b98b8] text-sm max-w-sm">Elevando padrões de governança com tecnologia de elite para gestores focados no futuro.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Produto</h4>
            <ul className="space-y-2 text-sm text-[#8b98b8]">
              <li><a href="#" className="hover:text-[#d8df15]">Painel de Gestão</a></li>
              <li><a href="#" className="hover:text-[#d8df15]">Módulo Inbox</a></li>
              <li><a href="#" className="hover:text-[#d8df15]">Segurança RLS</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-[#8b98b8]">
              <li><a href="#" className="hover:text-[#006775]">Sobre nós</a></li>
              <li><a href="#" className="hover:text-[#006775]">Contato</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/5 text-center flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[#8b98b8]">
            © {new Date().getFullYear()} Cajado Soluções. Todos os direitos reservados.
          </span>
          <a 
            href="https://sistema.cajadosolucoes.com.br/login"
            className="text-xs font-bold text-white hover:text-[#0f6733] flex items-center gap-1"
          >
            Acessar o Painel de Gestão <ArrowRight size={12} />
          </a>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-[#8b98b8] leading-relaxed text-sm">{desc}</p>
    </div>
  )
}
