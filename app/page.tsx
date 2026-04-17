'use client'

import React, { useState } from 'react'

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0d0f0d] text-white font-sans selection:bg-[#2d6a2d] selection:text-white">
      {/* NAV */}
      <nav className="flex items-center justify-between py-4 px-5 md:px-10 bg-[#0d0f0d]/95 border-b border-[#1e221e] sticky top-0 z-50 backdrop-blur-sm">
        <a href="#" className="flex items-center gap-2.5 no-underline">
          <svg width="34" height="34" viewBox="0 0 200 200">
            <polygon points="100,18 142,82 58,82" fill="#d4e600"/>
            <polygon points="28,135 78,78 78,135" fill="#2a7a9a"/>
            <polygon points="172,135 122,78 122,135" fill="#2d6a2d"/>
            <circle cx="100" cy="112" r="27" fill="#2d6a2d"/>
            <path d="M89,124 Q100,96 111,124" fill="#0d0f0d"/>
          </svg>
          <div className="flex flex-col">
            <span className="text-white font-bold text-base tracking-[2px]">CAJADO</span>
            <span className="text-[#666] text-[10px] tracking-[3px]">SOLUÇÕES</span>
          </div>
        </a>

        <ul className={`md:flex gap-7 list-none \${menuOpen ? 'flex flex-col absolute top-[70px] right-5 bg-[#141814] border border-[#2a2e2a] rounded-lg p-4' : 'hidden md:flex'}`}>
          <li><a href="#cursos" className="text-[#aaa] text-sm hover:text-white transition-colors" onClick={() => setMenuOpen(false)}>Serviços</a></li>
          <li><a href="#diferenciais" className="text-[#aaa] text-sm hover:text-white transition-colors" onClick={() => setMenuOpen(false)}>Nosso Diferencial</a></li>
          <li><a href="#contato" className="text-[#aaa] text-sm hover:text-white transition-colors" onClick={() => setMenuOpen(false)}>Fale Conosco</a></li>
          {/* Link para o sistema também integrado para clientes antigos */}
          <li><a href="https://sistema.cajadosolucoes.com.br/login" className="text-[#8bc34a] text-sm hover:text-white transition-colors border-l border-[#2a2e2a] pl-4 md:ml-2" onClick={() => setMenuOpen(false)}>Área Restrita</a></li>
        </ul>

        <a href="https://wa.me/5577991150728" className="hidden md:inline-flex items-center gap-2 bg-[#2d6a2d] hover:bg-[#3a7a3a] text-white px-5 py-2.5 rounded-lg text-[13px] font-medium transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20.52 3.48A11.9 11.9 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.24-1.44l-.38-.22-3.9 1.02 1.04-3.8-.25-.4A10 10 0 0 1 2 12C2 6.48 6.48 2 12 2a9.96 9.96 0 0 1 7.07 2.93A9.96 9.96 0 0 1 22 12c0 5.52-4.48 10-10 10zm5.44-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07a8.16 8.16 0 0 1-2.4-1.48 9.03 9.03 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51H7.6c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.11.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.34z" fill="white"/></svg>
          Falar conosco
        </a>

        <div className="md:hidden flex flex-col gap-1.5 cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="w-5 h-0.5 bg-[#aaa] rounded-full"></span>
          <span className="w-5 h-0.5 bg-[#aaa] rounded-full"></span>
          <span className="w-5 h-0.5 bg-[#aaa] rounded-full"></span>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-[radial-gradient(ellipse_at_60%_40%,#0e1e0e_0%,#0d0f0d_70%)] pt-24 pb-20 px-6 text-center border-b border-[#1e221e]">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#1a2e1a] border border-[#2a4a2a] rounded-full px-4 py-1.5 mb-6 text-xs text-[#8bc34a] font-medium">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Especialistas em Motoristas Profissionais · Homologada SENATRAN
          </div>
          <h1 className="text-[34px] md:text-[52px] font-extrabold leading-[1.12] text-white mb-5">
            Cursos e Certificações<br/>Para <span className="text-[#8bc34a]">Vencer no Trânsito.</span>
          </h1>
          <p className="text-base md:text-lg text-[#888] leading-[1.7] max-w-xl mx-auto mb-9">
            A Cajado Soluções oferece cursos homologados pelo SENATRAN para motoristas profissionais que precisam regularizar, renovar ou ampliar suas habilitações em Vitória da Conquista, BA.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="https://wa.me/5577991150728" className="inline-flex items-center gap-2.5 bg-[#2d6a2d] hover:bg-[#3a7a3a] text-white px-8 py-[15px] rounded-lg text-[15px] font-semibold transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.52 3.48A11.9 11.9 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.24-1.44l-.38-.22-3.9 1.02 1.04-3.8-.25-.4A10 10 0 0 1 2 12C2 6.48 6.48 2 12 2a9.96 9.96 0 0 1 7.07 2.93A9.96 9.96 0 0 1 22 12c0 5.52-4.48 10-10 10zm5.44-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07a8.16 8.16 0 0 1-2.4-1.48 9.03 9.03 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51H7.6c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.11.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.34z" fill="white"/></svg>
              Falar com um Especialista
            </a>
            <a href="#cursos" className="inline-flex items-center gap-2 bg-transparent border border-[#333] hover:border-[#555] text-[#ccc] hover:text-white px-6 py-[14px] rounded-lg text-sm font-medium transition-colors">
              Ver cursos disponíveis →
            </a>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="max-w-[860px] mx-auto py-9 px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#141814] border border-[#2a2e2a] rounded-[10px] p-5 text-center">
            <div className="text-[22px] font-bold text-[#8bc34a]">SENATRAN</div>
            <div className="text-xs text-[#555] mt-1">Homologada</div>
          </div>
          <div className="bg-[#141814] border border-[#2a2e2a] rounded-[10px] p-5 text-center">
            <div className="text-[22px] font-bold text-[#8bc34a]">CNH C·D·E</div>
            <div className="text-xs text-[#555] mt-1">Categorias atendidas</div>
          </div>
          <div className="bg-[#141814] border border-[#2a2e2a] rounded-[10px] p-5 text-center">
            <div className="text-[22px] font-bold text-[#8bc34a]">100%</div>
            <div className="text-xs text-[#555] mt-1">Regularizado</div>
          </div>
          <div className="bg-[#141814] border border-[#2a2e2a] rounded-[10px] p-5 text-center">
            <div className="text-[22px] font-bold text-[#8bc34a]">VCA · BA</div>
            <div className="text-xs text-[#555] mt-1">Vitória da Conquista</div>
          </div>
        </div>
      </div>

      <hr className="border-t border-[#1e221e] border-0" />

      {/* CURSOS */}
      <section className="max-w-[860px] mx-auto py-16 px-6" id="cursos">
        <div className="text-center mb-11">
          <span className="inline-block bg-[#1a2e1a] text-[#8bc34a] text-xs font-medium px-3.5 py-1 rounded-full mb-3.5">Nossos Serviços</span>
          <h2 className="text-[26px] md:text-[32px] font-bold text-white mb-2.5">Escolha seu curso</h2>
          <p className="text-[15px] text-[#666] max-w-[460px] mx-auto leading-[1.7]">Certificados com validade nacional, reconhecidos pelo SENATRAN e aceitos em todo o Brasil.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

          <div className="bg-[#141814] border border-[#2a2e2a] hover:border-[#8bc34a] rounded-xl p-6 transition-colors flex flex-col">
            <div><span className="inline-block text-[11px] font-semibold px-3 py-0.5 rounded-full mb-3 bg-[#1a2e1a] text-[#8bc34a]">Obrigatório</span></div>
            <h3 className="text-base font-semibold text-white mb-2">Curso de Reciclagem</h3>
            <p className="text-[13px] text-[#777] leading-[1.65] flex-1">Renovação da CNH para motoristas com pontos na carteira ou prazo vencido. Exigido pelo DETRAN para manter a habilitação ativa.</p>
            <div className="border-t border-[#222] pt-3.5 mt-4">
              <a href="https://wa.me/5577991150728?text=Olá! Tenho interesse no Curso de Reciclagem." className="block w-full text-center rounded-md py-2 text-xs font-semibold border transition-opacity hover:opacity-80 bg-[#1a2e1a] text-[#8bc34a] border-[#2a4a2a]">Quero me inscrever →</a>
            </div>
          </div>

          <div className="bg-[#141814] border border-[#2a2e2a] hover:border-[#8bc34a] rounded-xl p-6 transition-colors flex flex-col">
            <div><span className="inline-block text-[11px] font-semibold px-3 py-0.5 rounded-full mb-3 bg-[#0e1e2e] text-[#5b9bd5]">Especialização</span></div>
            <h3 className="text-base font-semibold text-white mb-2">Curso MOPP</h3>
            <p className="text-[13px] text-[#777] leading-[1.65] flex-1">Movimentação Operacional de Produtos Perigosos. Obrigatório para transportar cargas perigosas em rodovias federais. Validade de 5 anos.</p>
            <div className="border-t border-[#222] pt-3.5 mt-4">
              <a href="https://wa.me/5577991150728?text=Olá! Tenho interesse no Curso MOPP." className="block w-full text-center rounded-md py-2 text-xs font-semibold border transition-opacity hover:opacity-80 bg-[#0e1e2e] text-[#5b9bd5] border-[#1a3050]">Quero me inscrever →</a>
            </div>
          </div>

          <div className="bg-[#141814] border border-[#2a2e2a] hover:border-[#8bc34a] rounded-xl p-6 transition-colors flex flex-col">
            <div><span className="inline-block text-[11px] font-semibold px-3 py-0.5 rounded-full mb-3 bg-[#2a1e0a] text-[#e0a030]">Habilitação</span></div>
            <h3 className="text-base font-semibold text-white mb-2">Transporte Escolar</h3>
            <p className="text-[13px] text-[#777] leading-[1.65] flex-1">Capacitação obrigatória para condutores que realizam transporte de estudantes. Conformidade legal e segurança garantida.</p>
            <div className="border-t border-[#222] pt-3.5 mt-4">
              <a href="https://wa.me/5577991150728?text=Olá! Tenho interesse no Curso de Transporte Escolar." className="block w-full text-center rounded-md py-2 text-xs font-semibold border transition-opacity hover:opacity-80 bg-[#2a1e0a] text-[#e0a030] border-[#4a3010]">Quero me inscrever →</a>
            </div>
          </div>

          <div className="bg-[#141814] border border-[#2a2e2a] hover:border-[#8bc34a] rounded-xl p-6 transition-colors flex flex-col">
            <div><span className="inline-block text-[11px] font-semibold px-3 py-0.5 rounded-full mb-3 bg-[#1a2e1a] text-[#8bc34a]">Profissional</span></div>
            <h3 className="text-base font-semibold text-white mb-2">Capacitação CTP</h3>
            <p className="text-[13px] text-[#777] leading-[1.65] flex-1">Curso de Transporte de Passageiros. Exigido para motoristas de ônibus, vans e táxi fretado em âmbito federal.</p>
            <div className="border-t border-[#222] pt-3.5 mt-4">
              <a href="https://wa.me/5577991150728?text=Olá! Tenho interesse no Curso CTP." className="block w-full text-center rounded-md py-2 text-xs font-semibold border transition-opacity hover:opacity-80 bg-[#1a2e1a] text-[#8bc34a] border-[#2a4a2a]">Quero me inscrever →</a>
            </div>
          </div>

          <div className="bg-[#141814] border border-[#2a2e2a] hover:border-[#8bc34a] rounded-xl p-6 transition-colors flex flex-col">
            <div><span className="inline-block text-[11px] font-semibold px-3 py-0.5 rounded-full mb-3 bg-[#0e1e2e] text-[#5b9bd5]">Atualização</span></div>
            <h3 className="text-base font-semibold text-white mb-2">Renovação de Certificados</h3>
            <p className="text-[13px] text-[#777] leading-[1.65] flex-1">Renovação de cursos com validade vencida ou a vencer. Evite multas e mantenha sua documentação sempre em dia.</p>
            <div className="border-t border-[#222] pt-3.5 mt-4">
              <a href="https://wa.me/5577991150728?text=Olá! Preciso renovar meu certificado." className="block w-full text-center rounded-md py-2 text-xs font-semibold border transition-opacity hover:opacity-80 bg-[#0e1e2e] text-[#5b9bd5] border-[#1a3050]">Quero me inscrever →</a>
            </div>
          </div>

          <div className="bg-[#141814] border border-dashed border-[#2a2e2a] rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
            <p className="text-[13px] text-[#555] mb-4 leading-[1.6]">Não encontrou o curso que precisa?<br/>Entre em contato e consulte nossa grade completa.</p>
            <a href="https://wa.me/5577991150728?text=Olá! Gostaria de saber sobre os cursos disponíveis." className="bg-[#2d6a2d] hover:bg-[#3a7a3a] text-white rounded-lg text-[13px] font-semibold px-5 py-2.5 transition-colors">Consultar outros cursos →</a>
          </div>

        </div>
      </section>

      <hr className="border-t border-[#1e221e] border-0" />

      {/* DIFERENCIAIS */}
      <div className="bg-[#0e100e] py-16 px-6" id="diferenciais">
        <div className="max-w-[700px] mx-auto">
          <div className="text-center mb-11">
            <span className="inline-block bg-[#1a2e1a] text-[#8bc34a] text-xs font-medium px-3.5 py-1 rounded-full mb-3.5">Nosso Diferencial</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-white mb-2.5">Por que escolher a Cajado?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex gap-3 items-start mb-4.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1a2e1a] flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div><span className="block text-sm font-semibold text-white mb-0.5">Homologada pelo SENATRAN</span><span className="text-[13px] text-[#666] leading-[1.55]">Certificados com validade nacional e reconhecimento legal em todo o território.</span></div>
              </div>
              <div className="flex gap-3 items-start mb-4.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1a2e1a] flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div><span className="block text-sm font-semibold text-white mb-0.5">Instrutores qualificados</span><span className="text-[13px] text-[#666] leading-[1.55]">Profissionais experientes e credenciados, especializados em cada modalidade.</span></div>
              </div>
              <div className="flex gap-3 items-start mb-4.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1a2e1a] flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div><span className="block text-sm font-semibold text-white mb-0.5">Atendimento ágil pelo WhatsApp</span><span className="text-[13px] text-[#666] leading-[1.55]">Inscrição, dúvidas e certificado com facilidade e rapidez pelo celular.</span></div>
              </div>
            </div>
            <div>
              <div className="flex gap-3 items-start mb-4.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1a2e1a] flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div><span className="block text-sm font-semibold text-white mb-0.5">Turmas regulares</span><span className="text-[13px] text-[#666] leading-[1.55]">Novas turmas abertas com frequência. Não fique sem vaga na sua área.</span></div>
              </div>
              <div className="flex gap-3 items-start mb-4.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1a2e1a] flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div><span className="block text-sm font-semibold text-white mb-0.5">Localizada em VCA</span><span className="text-[13px] text-[#666] leading-[1.55]">Polo do sudoeste baiano, de fácil acesso para toda a região.</span></div>
              </div>
              <div className="flex gap-3 items-start mb-4.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1a2e1a] flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#8bc34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div><span className="block text-sm font-semibold text-white mb-0.5">Empresa regularizada</span><span className="text-[13px] text-[#666] leading-[1.55]">CNPJ ativo, Simples Nacional. Segurança e seriedade em cada contrato.</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t border-[#1e221e] border-0" />

      {/* CTA */}
      <section className="bg-[radial-gradient(ellipse_at_50%_0%,#0e2e0e_0%,#0d0f0d_60%)] py-20 px-6 text-center" id="contato">
        <div className="max-w-[520px] mx-auto">
          <p className="text-xs text-[#8bc34a] font-semibold tracking-[2px] uppercase mb-3">Garanta sua vaga</p>
          <h2 className="text-[26px] md:text-[32px] font-bold text-white mb-3">Regularize sua situação hoje mesmo</h2>
          <p className="text-[15px] text-[#777] leading-[1.7] mb-8">Evite multas, suspensão da CNH e perda de oportunidades. Entre em contato e garanta sua vaga na próxima turma.</p>
          <a href="https://wa.me/5577991150728?text=Olá! Quero saber sobre os cursos da Cajado Soluções." className="inline-flex items-center justify-center gap-2.5 bg-[#2d6a2d] hover:bg-[#3a7a3a] text-white px-10 py-4 rounded-lg text-base font-bold transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20.52 3.48A11.9 11.9 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.52zM12 22c-1.85 0-3.66-.5-5.24-1.44l-.38-.22-3.9 1.02 1.04-3.8-.25-.4A10 10 0 0 1 2 12C2 6.48 6.48 2 12 2a9.96 9.96 0 0 1 7.07 2.93A9.96 9.96 0 0 1 22 12c0 5.52-4.48 10-10 10zm5.44-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07a8.16 8.16 0 0 1-2.4-1.48 9.03 9.03 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51H7.6c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.11.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.34z" fill="white"/></svg>
            (77) 99115-0728
          </a>
          <a href="mailto:consultoria.cajado@gmail.com" className="block mt-4 text-[13px] text-[#444] hover:text-[#666] transition-colors">consultoria.cajado@gmail.com</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-5 px-6 border-t border-[#1e221e] bg-[#0d0f0d]">
        <p className="text-xs text-[#333]">© 2026 Cajado Soluções Ltda · CNPJ 28.595.810/0001-57 · Vitória da Conquista, BA · Homologada SENATRAN</p>
      </footer>
    </div>
  )
}
