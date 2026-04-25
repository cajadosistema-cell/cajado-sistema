'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ── Seções do Manual ──────────────────────────────────────────
const SECOES = [
  { id: 'inicio',        icon: '🏠', titulo: 'Visão Geral' },
  { id: 'login',         icon: '🔐', titulo: 'Login & Segurança' },
  { id: 'dashboard',     icon: '📊', titulo: 'Dashboard Inicial' },
  { id: 'financeiro',    icon: '💰', titulo: 'Financeiro PJ' },
  { id: 'comissoes',     icon: '🤝', titulo: 'Comissões & Parceiros' },
  { id: 'crm',           icon: '📋', titulo: 'Vendas & CRM' },
  { id: 'inbox',         icon: '💬', titulo: 'Inbox WhatsApp' },
  { id: 'chat',          icon: '🗣️', titulo: 'Chat Interno' },
  { id: 'elena',         icon: '🤖', titulo: 'Assistente Elena (IA)' },
  { id: 'pf',            icon: '👤', titulo: 'Finanças Pessoais' },
  { id: 'agenda',        icon: '📅', titulo: 'Agenda & Tarefas' },
  { id: 'equipe',        icon: '👥', titulo: 'Gestão de Equipe' },
  { id: 'configuracoes', icon: '⚙️', titulo: 'Configurações' },
  { id: 'backup',        icon: '☁️', titulo: 'Backup & Segurança' },
]

// ── Conteúdo ──────────────────────────────────────────────────
const CONTEUDO: Record<string, { descricao: string; topicos: { t: string; d: string }[] }> = {
  inicio: {
    descricao: 'O Cajado Sistema v2.0 é uma plataforma de gestão empresarial completa, projetada para centralizar o controle financeiro, comercial e operacional da sua empresa em um único lugar.',
    topicos: [
      { t: 'Acesso', d: 'Acesse em sistema.cajadosolucoes.com.br pelo navegador ou instale como app no celular (PWA).' },
      { t: 'Navegação', d: 'Use o menu lateral (sidebar) para navegar entre os módulos. Em dispositivos móveis, o menu fica na parte inferior da tela.' },
      { t: 'Tema', d: 'Alterne entre tema escuro e claro pelo botão no menu lateral (ícone de lua/sol). A preferência é salva automaticamente.' },
      { t: 'Responsivo', d: 'O sistema funciona em computador, tablet e celular. Todas as telas se adaptam automaticamente.' },
    ],
  },
  login: {
    descricao: 'O acesso ao sistema é protegido por e-mail e senha, gerenciado pelo Supabase Auth com criptografia de nível bancário.',
    topicos: [
      { t: 'Primeiro Acesso', d: 'O administrador (CEO) cria as contas dos funcionários em Configurações → Equipe e Restrições. O funcionário recebe o e-mail e senha de acesso.' },
      { t: 'Alterar Senha', d: 'Acesse Configurações → 🔑 Minha Conta para redefinir sua senha. Use uma senha forte (mínimo 8 caracteres, com letras e números).' },
      { t: 'Sessão', d: 'A sessão permanece ativa mesmo após fechar o navegador. Para sair, clique no seu nome no menu lateral e selecione "Sair".' },
      { t: 'Permissões', d: 'Cada funcionário só vê os módulos que o administrador liberou. O CEO tem acesso irrestrito a tudo.' },
    ],
  },
  dashboard: {
    descricao: 'A tela inicial exibe um resumo executivo da saúde financeira e comercial da empresa em tempo real.',
    topicos: [
      { t: 'Cards de Métricas', d: 'Clique em qualquer card (Patrimônio Líquido, Receitas, Despesas, Leads) para abrir um painel lateral com detalhes e histórico.' },
      { t: 'Patrimônio Líquido', d: 'Soma de todos os saldos das contas cadastradas. Atualizado automaticamente com cada lançamento.' },
      { t: 'Receitas do Mês', d: 'Total de entradas validadas no mês atual, filtrado pela data de competência.' },
      { t: 'Despesas do Mês', d: 'Total de saídas validadas no mês atual. Inclui despesas operacionais, pessoal e outras categorias.' },
      { t: 'Leads Ativos', d: 'Quantidade de negociações em andamento no CRM. Clique para ver detalhes por etapa do funil.' },
    ],
  },
  financeiro: {
    descricao: 'Módulo completo de gestão financeira empresarial com lançamentos, contas bancárias, categorias e análise de fluxo de caixa.',
    topicos: [
      { t: 'Lançamentos', d: 'Registre receitas e despesas com descrição, valor, categoria, forma de pagamento e status (pendente/validado). Suporta regime de competência e caixa.' },
      { t: 'Contas Bancárias', d: 'Cadastre suas contas (corrente, poupança, investimento). O saldo é calculado automaticamente com base nos lançamentos validados.' },
      { t: 'Categorias', d: 'Organize seus lançamentos por categorias personalizáveis (Receita Operacional, Despesas com Pessoal, Marketing, etc.).' },
      { t: 'Relatórios', d: 'Visualize gráficos de evolução mensal, distribuição por categoria e comparativo de receitas x despesas no painel analítico.' },
      { t: 'Exportar', d: 'Exporte os dados financeiros para planilha CSV ou PDF via o botão de export em cada seção.' },
    ],
  },
  comissoes: {
    descricao: 'Controle de comissões pagas a parceiros e representantes comerciais, com histórico e cálculo automático.',
    topicos: [
      { t: 'Parceiros', d: 'Cadastre seus parceiros comerciais com nome, CPF/CNPJ, dados bancários e percentual de comissão padrão.' },
      { t: 'Registro de Comissão', d: 'Ao fechar uma venda, informe o parceiro responsável. O sistema calcula automaticamente o valor da comissão.' },
      { t: 'Histórico', d: 'Acompanhe o histórico de comissões pagas e pendentes por parceiro, com filtros de período.' },
      { t: 'Status', d: 'Marque comissões como Pendente, Aprovada ou Paga. O saldo a pagar é atualizado em tempo real.' },
    ],
  },
  crm: {
    descricao: 'Funil de negociações e gestão completa do ciclo de vendas, do primeiro contato ao fechamento.',
    topicos: [
      { t: 'Funil de Leads', d: 'Arraste os leads entre as etapas: Prospecção → Qualificação → Proposta → Negociação → Fechado/Perdido.' },
      { t: 'Cadastro de Lead', d: 'Preencha nome, contato, empresa, origem, valor estimado e responsável pelo atendimento.' },
      { t: 'Fechamentos & OS', d: 'Converta um lead fechado em uma Ordem de Serviço com todos os dados do contrato.' },
      { t: 'Pós-venda', d: 'Agende follow-ups automáticos e registre o histórico de atendimento pós-fechamento.' },
      { t: 'Relatórios CRM', d: 'Veja taxa de conversão, tempo médio de fechamento e receita por responsável no painel analítico.' },
    ],
  },
  inbox: {
    descricao: 'Central de atendimento ao cliente via WhatsApp integrada à Evolution API, com bot de IA para respostas automáticas.',
    topicos: [
      { t: 'Conexão WhatsApp', d: 'Conecte sua linha WhatsApp Business escaneando o QR Code em Configurações → Anti-Ban WA.' },
      { t: 'Atendimentos', d: 'Todos os chats são listados no painel. Clique para ver o histórico completo e responder manualmente.' },
      { t: 'Bot de IA', d: 'O assistente de IA responde automaticamente às mensagens com base no contexto. Configure em IA & Automações.' },
      { t: 'Anti-Ban', d: 'Sistema de proteção contra banimento com delays aleatórios, limitação de mensagens por minuto e rotação automática.' },
      { t: 'Transferência', d: 'Transfira um atendimento para outro membro da equipe pelo botão "Transferir" dentro do chat.' },
    ],
  },
  chat: {
    descricao: 'Chat interno da equipe com mensagens em tempo real, suporte a áudio e indicadores de presença online.',
    topicos: [
      { t: 'Canal Geral', d: 'Todas as mensagens enviadas para "Geral da Equipe" são visíveis por todos os membros online.' },
      { t: 'Mensagem Direta', d: 'Clique no nome de um membro na lista lateral para iniciar uma conversa privada.' },
      { t: 'Indicador Online', d: 'O ponto verde ao lado do nome indica que o membro está ativo no sistema no momento.' },
      { t: 'Mensagem de Voz', d: 'Segure o ícone de microfone 🎤 para gravar e solte para enviar um áudio.' },
      { t: 'Histórico', d: 'O histórico de mensagens é persistido no banco de dados e carregado ao abrir o chat.' },
    ],
  },
  elena: {
    descricao: 'Elena é a assistente executiva com IA integrada que registra gastos, agenda eventos e gerencia ocorrências via conversa natural.',
    topicos: [
      { t: 'Como Acessar', d: 'Clique no avatar da Elena (foto no canto inferior direito da tela) para abrir o chat.' },
      { t: 'Registrar Gasto', d: 'Diga: "Gastei R$ 80 de gasolina no cartão de crédito". A Elena pergunta se é pessoal ou da empresa e registra.' },
      { t: 'Registrar Receita', d: 'Diga: "Recebi R$ 5.000 de serviço prestado". A Elena identifica e registra como receita.' },
      { t: 'Agendar Evento', d: 'Diga: "Agendar reunião amanhã às 14h com o cliente João". A Elena cria o evento na agenda.' },
      { t: 'Registrar Ocorrência', d: 'Diga: "Registrar ocorrência de atraso para o Pedro, impacto médio". A Elena solicita os detalhes e registra.' },
      { t: 'Salvar Ideia', d: 'Diga: "Salvar ideia: criar um app de rastreamento de clientes". A Elena guarda na aba de Ideias.' },
      { t: 'Microfone', d: 'Use o ícone de microfone para falar com a Elena por voz. Segure, fale e solte para enviar.' },
    ],
  },
  pf: {
    descricao: 'Módulo de finanças pessoais do CEO/proprietário, separado das finanças da empresa.',
    topicos: [
      { t: 'Gastos Pessoais', d: 'Registre suas despesas pessoais por categoria (Alimentação, Transporte, Saúde, Lazer, etc.).' },
      { t: 'Receitas Pessoais', d: 'Registre pró-labore, dividendos, freelances e outras receitas pessoais.' },
      { t: 'Patrimônio', d: 'Acompanhe seus ativos (imóveis, veículos, investimentos) e o patrimônio líquido pessoal.' },
      { t: 'Investimentos', d: 'Cadastre e monitore sua carteira de investimentos com rentabilidade e evolução.' },
      { t: 'Day Trader', d: 'Registre operações de day trade com entrada, saída, resultado e cálculo automático de IR.' },
    ],
  },
  agenda: {
    descricao: 'Agenda corporativa para compromissos, reuniões, lembretes e tarefas com visão mensal e semanal.',
    topicos: [
      { t: 'Criar Evento', d: 'Clique em uma data no calendário ou no botão "+ Evento" para criar um novo compromisso.' },
      { t: 'Tipos de Evento', d: 'Compromisso, Reunião, Lembrete, Tarefa, Aniversário — cada tipo tem uma cor diferente.' },
      { t: 'Elena na Agenda', d: 'A Elena pode criar eventos automaticamente ao detectar pedidos em linguagem natural.' },
      { t: 'Notificações', d: 'Eventos com data próxima geram alertas no painel inicial e notificações no sistema.' },
    ],
  },
  equipe: {
    descricao: 'Gerencie os membros da equipe, suas permissões de acesso e registre ocorrências de desempenho.',
    topicos: [
      { t: 'Cadastrar Funcionário', d: 'Em Configurações → Equipe, clique em "+ Novo Funcionário". Preencha nome, e-mail, senha e cargo.' },
      { t: 'Permissões', d: 'Marque quais módulos cada funcionário pode acessar. As restrições entram em vigor no próximo login.' },
      { t: 'Ocorrências', d: 'Registre elogios, erros, alertas e conquistas de cada membro. Use a Elena para registrar via conversa.' },
      { t: 'Excluir Acesso', d: 'Clique em "Excluir" no card do funcionário para revogar o acesso imediatamente.' },
    ],
  },
  configuracoes: {
    descricao: 'Central de configuração do sistema: dados da empresa, equipe, permissões, senha e preferências.',
    topicos: [
      { t: 'Dados da Empresa', d: 'Atualize razão social, CNPJ, endereço e logomarca em Configurações → Visão Geral.' },
      { t: 'Minha Conta', d: 'Altere sua senha em Configurações → 🔑 Minha Conta. A senha deve ter mínimo 6 caracteres.' },
      { t: 'Limpeza de Dados', d: 'Em Configurações → 🧹 Limpeza, defina uma data de corte para remover dados fictícios de demonstração sem apagar seus dados reais.' },
      { t: 'Backup', d: 'Em Configurações → ☁️ Backup, conecte o Google Drive e configure a frequência de backup automático.' },
    ],
  },
  backup: {
    descricao: 'O sistema oferece backup completo de todos os dados, local ou integrado ao Google Drive.',
    topicos: [
      { t: 'Backup Manual', d: 'Em Configurações → Backup, clique em "Baixar Backup (JSON)" para salvar todos os dados no seu computador.' },
      { t: 'Google Drive', d: 'Conecte sua conta Google e clique em "Enviar para o Google Drive". O arquivo fica na raiz do seu Drive.' },
      { t: 'Frequência Automática', d: 'Configure o backup para acontecer automaticamente: Diário, Semanal ou Mensal.' },
      { t: 'Limpeza de Dados Demo', d: 'Use a função de limpeza para remover dados fictícios da fase de demonstração. Escolha a data de corte e confirme digitando LIMPAR.' },
      { t: 'Segurança', d: 'Altere sua senha regularmente em Configurações → Minha Conta. Use senhas fortes e únicas.' },
    ],
  },
}

export default function ManualClient() {
  const [secaoAtiva, setSecaoAtiva] = useState('inicio')
  const secao = SECOES.find(s => s.id === secaoAtiva)!
  const conteudo = CONTEUDO[secaoAtiva]

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* Sidebar do Manual */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="card !p-3 sticky top-6">
          <div className="px-3 py-2 mb-2">
            <p className="text-[10px] font-bold text-fg-disabled uppercase tracking-widest">Cajado Sistema v2.0</p>
            <p className="text-base font-bold text-fg mt-0.5">📖 Manual do Sistema</p>
          </div>
          <div className="space-y-0.5">
            {SECOES.map(s => (
              <button
                key={s.id}
                onClick={() => setSecaoAtiva(s.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                  secaoAtiva === s.id
                    ? 'bg-brand-gold-soft text-brand-gold border-l-2 border-brand-gold'
                    : 'text-fg-secondary hover:bg-white/5 hover:text-fg'
                )}
              >
                <span className="text-base w-5 shrink-0">{s.icon}</span>
                {s.titulo}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 px-3">
            <button
              onClick={() => window.print()}
              className="w-full btn-secondary text-xs flex items-center justify-center gap-2"
            >
              🖨️ Imprimir Manual
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="card mb-6">
          {/* Header da seção */}
          <div className="flex items-center gap-4 mb-6 pb-5 border-b border-white/5">
            <div className="w-14 h-14 rounded-2xl bg-brand-gold-soft border border-brand-gold/30 flex items-center justify-center text-3xl shrink-0">
              {secao.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-fg-disabled uppercase tracking-widest mb-1">Seção {SECOES.indexOf(secao) + 1} de {SECOES.length}</p>
              <h1 className="text-2xl font-['Syne'] font-bold text-fg">{secao.titulo}</h1>
            </div>
          </div>

          {/* Descrição */}
          <p className="text-sm text-fg-secondary leading-relaxed mb-8 p-4 rounded-xl bg-page/50 border border-white/5">
            {conteudo.descricao}
          </p>

          {/* Tópicos */}
          <div className="space-y-4">
            {conteudo.topicos.map((topico, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl bg-page/30 border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-brand-gold-soft border border-brand-gold/30 flex items-center justify-center text-xs font-bold text-brand-gold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-fg mb-1">{topico.t}</p>
                  <p className="text-sm text-fg-secondary leading-relaxed">{topico.d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Navegação entre seções */}
          <div className="flex justify-between mt-8 pt-5 border-t border-white/5">
            {SECOES.indexOf(secao) > 0 ? (
              <button
                onClick={() => setSecaoAtiva(SECOES[SECOES.indexOf(secao) - 1].id)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                ← {SECOES[SECOES.indexOf(secao) - 1].titulo}
              </button>
            ) : <div />}
            {SECOES.indexOf(secao) < SECOES.length - 1 ? (
              <button
                onClick={() => setSecaoAtiva(SECOES[SECOES.indexOf(secao) + 1].id)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {SECOES[SECOES.indexOf(secao) + 1].titulo} →
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
                ✅ Manual Completo!
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="card !bg-brand-gold-soft !border-brand-gold/20 text-center py-8">
          <p className="text-brand-gold font-bold text-lg mb-1">Cajado Soluções</p>
          <p className="text-sm text-fg-secondary">Sistema v2.0 · Suporte: contato@cajadosolucoes.com.br</p>
          <p className="text-xs text-fg-disabled mt-2">Documento gerado automaticamente. Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}
