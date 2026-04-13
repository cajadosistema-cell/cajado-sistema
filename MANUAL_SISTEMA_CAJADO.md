# 📖 Manual Completo do Sistema Cajado

Bem-vindo ao Sistema Cajado! Este documento serve como **Manual de Utilização de Todos os Módulos** e também contém as instruções base de **Treinamento de Inteligência Artificial** (para treinar seu bot/assistente interno a ajudar seus colaboradores no uso da plataforma).

---

## 1. Visão Geral dos Módulos (Blocos)

Abaixo estão detalhados todos os 15 módulos principais do Sistema Cajado e suas responsabilidades:

### 📊 Início (Dashboards)
O painel central de visão rápida da sua empresa.
- **Utilização:** Acompanhar gráficos de faturamento, volume de atendimentos e tarefas críticas do dia. Serve para o CEO ou gerente bater o olho e saber a saúde do negócio em segundos.

### 💰 Gestão Financeira (Empresa)
Onde o dinheiro entra e sai.
- **Utilização:** Registrar contas a pagar e a receber. Validar o fluxo de caixa mensal, gerar relatórios de DRE e visualizar saldo consolidado.

### 🎯 CRM Cajado
Gestão do relacionamento com o cliente e pipeline.
- **Utilização:** Criar funis de vendas para leads. Arrastar os cards (clientes) de "Novo Contato" até "Fechado Ganho". Agendar retornos e registrar histórico de conversas.

### 📦 Vendas e Ordens de Serviço (OS)
O processamento real do produto/serviço.
- **Utilização:** Assim que o CRM fecha a venda, cria-se o Pedido ou Ordem de Serviço aqui. Define-se prazo, responsável técnico, status de entrega e produtos despachados.

### 🤝 Comissões e Parceiros
Gestão de terceiros que impulsionam o seu negócio.
- **Utilização:** Adicionar vendedores externos, afiliados ou revendedores. O sistema calcula a % de comissão devida sempre que um Pedido associado a um parceiro é pago no Financeiro.

### 🧠 Diário Estratégico e Memória
O diário de bordo do negócio e ata de decisões.
- **Utilização:** Para diretores anotarem insights, decisões tomadas em reuniões semanais, e aprendizados operacionais que a empresa não pode esquecer ("Documento de Cultura/Lições").

### 🔄 Pós-venda e Automações
Garantindo o LTV (Lifetime Value) e o sucesso do cliente.
- **Utilização:** Agendar disparo de mensagens no aniversário da compra, enviar pesquisas de satisfação (NPS) e lembretes de renovação de contratos de forma automática.

### 💬 Inbox / Atendimento WhatsApp
O coração da comunicação unificada via Evolution API.
- **Utilização:** É aqui que a mágica do atendimento acontece. Toda a equipe responde os clientes num único número. O bot automático (Vivi) captura o lead, faz o direcionamento base e transborda para o humano quando necessário.

### ⚙️ Administração SaaS Cajado
Visão de infraestrutura do sistema.
- **Utilização:** Visualizar seu plano de licenciamento de uso do próprio Cajado e extrato de renovações da plataforma.

### 🏃 Gestão Pessoal
Controle de produtividade do colaborador.
- **Utilização:** Agenda individual, blocos de tempo (Timeblocking), metas pessoais de vendas e checklists do que precisa ser entregue hoje.

### 🏢 Patrimônio
O inventário da empresa.
- **Utilização:** Cadastrar computadores, máquinas, móveis, veículos. Controlar com quem está cada ativo e projetar depreciação financeira ao longo do tempo.

### 📈 Investimentos
Gestor de caixa empresarial (Tesouraria).
- **Utilização:** Acompanhar o fundo de reserva da empresa. Ver evolução do CDI, CDBs, ações ou criptomoedas que fazem parte do Tesouro institucional.

### 📉 Trader / Operações
Registro voltado para mesas proprietárias institucionais.
- **Utilização:** Diário de trades executados (Day Trade / Swing Trade), taxa de assertividade e controle de risco (Stop Loss global da empresa).

### 🤖 Inteligência Artificial
Configurações da Inteligência do Bot WhatsApp (Vivi).
- **Utilização:** Alterar o prompt mestre do bot. Definir o tom de voz da IA e treinar quais departamentos estão abertos ou fechados naquele momento do dia.

### 🛠️ Organização Geral (Configurações)
Painel do Administrador Geral e de Cadastros Base.
- **Utilização:** Adicionar ou remover membros/funcionários (restringindo blocos de acesso). Configurar a logo da empresa, alterar credenciais de API, CNPJ etc.

---

## 2. Treinamento Base para a Inteligência Artificial

Caso você queira que a **Vivi** (ou qualquer I.A. da plataforma) atue como MENTORA de uso para novos funcionários, basta copiar o bloco abaixo e colar na configuração de contexto/prompt do seu Agente de I.A.:

```markdown
Você é a VIVI, a Especialista de Onboarding e Treinamento do Sistema Cajado. 
Sua missão é ajudar os funcionários da nossa empresa a usar a plataforma Cajado corretamente.

REGRAS DE CONDUTA:
1. Seja paciente, didática e responda sempre de forma profissional, moderna e acolhedora.
2. Quando um usuário perguntar como fazer algo, explique em poucas etapas e cite os módulos corretos.

BASE DE CONHECIMENTO DO SISTEMA PARA CONSULTA:
- Se perguntarem sobre Lançar Despesas -> Mande para o módulo [Gestão Financeira (Empresa)].
- Se precisarem consultar leads ou histórico de funil de um contato -> Mande para o [CRM Cajado].
- Se perguntarem onde registrar a comissão do Zezinho -> Mande para [Comissões e Parceiros].
- Se a equipe precisar responder os clientes do WhatsApp -> Módulo [Inbox / Atendimento WhatsApp].
- Se um analista perguntar como bloquear o acesso de um estagiário a dados financeiros -> Ensine que ele deve pedir ao Gestor para ir em [Organização Geral] > Funcionários > Restrições.
- Se a pergunta for sobre bens da empresa (como um notebook quebrado) -> Registrar em [Patrimônio].
- Se a dúvida for focar na rotina do funcionário -> Manda planejar o dia em [Gestão Pessoal].

Nunca invente telas ou botões que não existam neste resumo. Caso o usuário faça uma pergunta da qual você não saiba a resposta baseada neste documento, responda: "Ainda não possuo esta resposta no meu treinamento interno. Recomendo abrir um ticket no suporte oficial do Sistema Cajado."
```
