# 📖 Manual Completo do Sistema Cajado — v2.0
**Atualizado em Abril/2026**

> Este documento descreve **como cada módulo funciona na prática**, passo a passo, com o que acontece no banco de dados, o que é automático e o que é manual.

---

## 🗺️ Mapa Geral do Sistema

```
OPERAÇÃO COMERCIAL
  🎯 CRM Cajado   →  Pipeline de leads e conversão
  📦 Vendas / OS  →  Ordens de serviço e faturamento
  🤝 Parceiros    →  Comissões automáticas
  🔄 Pós-venda    →  Automações pós-fechamento

FINANCEIRO & PATRIMÔNIO
  💰 Financeiro   →  Fluxo de caixa e lançamentos
  🏠 Patrimônio   →  Bens e ativos da empresa
  📈 Investimentos →  Carteira e rendimentos
  📉 Trader       →  Operações e diário de trades

GESTÃO DE PESSOAS & OPERAÇÃO
  👥 Equipe       →  Ponto, tarefas, ocorrências
  📱 Segurança WA →  Números e proteção WhatsApp
  💬 Inbox        →  Atendimento unificado

ESTRATÉGIA & INTELIGÊNCIA
  📓 Diário       →  Decisões e memória da empresa
  🧠 Inteligência →  Análise de mercado e tendências
  🏗️  Organização  →  Projetos e ideias
  ⚙️  Configurações →  Usuários, empresa, integrações
```

---

## 📊 1. INÍCIO — Dashboard Principal

A tela que o usuário vê ao fazer login. Consolida **dados reais do banco** em um único painel.

| Bloco | Dado | Fonte |
|-------|------|-------|
| Financeiro | Saldo total das contas | `contas.saldo_atual` |
| Financeiro | Receitas e despesas do mês | `lancamentos` |
| CRM | Leads ativos / Clientes / Pipeline | `leads` |
| Trader | P&L total e Win Rate | `operacoes` |
| Investimentos | Total investido e rentabilidade | `ativos` |
| Patrimônio | Bens e valorização | `projetos_patrimonio` |
| WhatsApp | Números ativos e enviados hoje | `numeros_whatsapp` |
| Inteligência | Tendências monitoradas | `tendencias` |

Cada card é **clicável** e leva ao módulo correspondente. Se o banco estiver vazio, todos os valores aparecem como 0.

---

## 🎯 2. CRM CAJADO — Pipeline de Vendas

### As 4 colunas do Kanban

```
[ 🔵 NOVO ] → [ 🟡 PROPOSTA ] → [ 🟣 RETOMAR ] → [ 🟢 CLIENTE ATIVO ]
                                                          ↓
                                                     [ ⚫ PERDIDO ]
```

### Fluxo passo a passo

**PASSO 1 — Cadastrar o lead** (botão "+ Lead")
- Campos: Nome*, Telefone*, E-mail, Origem, Serviço de interesse, Valor estimado, **Parceiro Indicador**, Próximo follow-up, Notas
- 🔁 **Automático:** Cai na coluna "Novo"
- 🔁 **Automático:** Se tem parceiro → `parceiros.total_indicacoes + 1`

**PASSO 2 — Trabalhar o lead** (clicar no card → Drawer lateral)
- Ver valor estimado, atendente, follow-up, notas
- Clicar em **"+ Atividade"** para registrar ligações, reuniões, propostas

**PASSO 3 — Mover no pipeline**
- **Arrastar o card** entre colunas, ou
- **Clicar nos botões de status** no topo do Drawer
- 🔁 **Automático:** Atualiza `leads.status` no banco

**PASSO 4 — Lead vira Cliente Ativo** ← ponto mais importante
- 🔁 **Automático:** `parceiros.total_convertidas + 1`
- 🔁 **Automático:** `parceiros.total_comissao + (valor × % / 100)`

**PASSO 5 — Lead perdido**
- Mova para "Perdido" (não é deletado, fica para análise)

### Abas do CRM

| Aba | Função |
|-----|--------|
| Kanban | Colunas para arrastar leads |
| Lista | Tabela com filtros por busca e atendente |
| Parceiros | Cadastro e performance dos parceiros |
| Relatório Diário | Leads atrasados, sem resposta, para retomar |

### Métricas calculadas

| Métrica | Cálculo |
|---------|---------|
| Leads ativos | status ≠ `perdido` |
| Clientes ativos | status = `cliente_ativo` |
| Pipeline total | Soma de `valor_estimado` dos leads não perdidos |
| Follow-ups atrasados | `proximo_followup < agora` e status ≠ `perdido` |

---

## 📦 3. VENDAS / OS — Ordens de Serviço

Ao fechar um lead no CRM, cria-se aqui o documento formal da venda.

| Tipo | Quando usar |
|------|-------------|
| Venda | Produto/serviço vendido diretamente |
| Ordem de Serviço | Prestação com prazo de execução |
| Orçamento | Proposta formal antes de fechar |
| Pedido | Compra com prazo de entrega |

**Status:** Rascunho → Aberta → Em andamento → Concluída → (Cancelada)
**Pagamento:** Pendente → Parcial → Pago

O módulo mostra: lista de vendas/OS, cobranças em atraso, resumo do mês, catálogo de produtos, top clientes e formas de pagamento.

---

## 🤝 4. PARCEIROS E COMISSÕES

### Ciclo automático

```
Lead criado com parceiro → parceiros.total_indicacoes + 1
Lead → "Cliente Ativo"   → parceiros.total_convertidas + 1
                         → parceiros.total_comissao + (valor × %)
```

**Exemplo:** Parceiro com 10% + lead de R$ 4.500 → R$ 450 registrado automaticamente.

A tela de Comissões mostra: tabela de comissões geradas por OS, ranking de parceiros, análise de leads perdidos por motivo e conversão por origem de lead.

---

## 🔄 5. PÓS-VENDA — Automações

| Template | Gatilho | Objetivo |
|----------|---------|----------|
| Agradecimento imediato | OS concluída | Fortalecer relacionamento |
| Follow-up 7 dias | 7 dias após OS | Verificar satisfação |
| Pedido de indicação | 15 dias após OS | Gerar novos leads |

Ao concluir uma OS, um **card visual** é gerado e pode ser enviado ao cliente pelo WhatsApp como prova de entrega.

---

## 💰 6. FINANCEIRO — Fluxo de Caixa

**Tipos de lançamento:** Receita · Despesa · Investimento · Transferência
**Regimes:** Caixa (data real do dinheiro) · Competência (data do fato gerador)

Como usar: cadastre contas → lance movimentações → configure recorrências fixas → importe extrato para conciliação → visualize resultado do mês.

---

## 👥 7. EQUIPE — Gestão de Pessoas

| Aba | O que faz |
|-----|-----------|
| 🕐 Ponto | Registra entrada/saída com horário e GPS |
| 📋 Tarefas | Cria e distribui tarefas com prazo e responsável |
| 📝 Ocorrências | Registra acertos (reconhecimento) e erros (problemas) |
| 👥 Equipe | Visão consolidada de desempenho de todos |

**Status das tarefas:** A fazer → Em andamento → Concluída

---

## 📱 8. SEGURANÇA WHATSAPP

| Aba | O que faz |
|-----|-----------|
| Números WA | Monitora uso diário e alerta bloqueios |
| Mensagens Padrão | Biblioteca de mensagens com variáveis `{{nome}}` |
| Check-in | Registro de presença com GPS da equipe de campo |

**Alerta de uso:** 0–50% verde · 50–80% amarelo · 80–100% vermelho (risco de banimento)

---

## 💬 9. INBOX — Atendimento Unificado

Fluxo: cliente manda mensagem → chega no inbox → bot Vivi responde automaticamente → atendente pausa o bot e assume → toda a equipe atende pelo mesmo sistema.

---

## 📓 10. DIÁRIO ESTRATÉGICO

Registro de decisões, reuniões e aprendizados. Consultável pela equipe e pela Vivi IA para responder perguntas internas.

---

## 🧠 11. INTELIGÊNCIA

Tipos de análise: Concorrente · Preço · Oportunidade · Tendência
Impacto: Alto (🔴) · Médio (🟡) · Baixo (⚪)

---

## 🏗️ 12. ORGANIZAÇÃO

- **Projetos:** Responsável, prazo, progresso %, próximos passos
- **Ideias:** Status (Ideia → Análise → Execução → Validada)
- **Decisões:** Contexto, decisão tomada, alternativas, aprendizado

---

## 📈 13. INVESTIMENTOS

Gestão da carteira: CDBs, ações, FIIs, cripto, tesouro. Registra compras/vendas/dividendos e calcula rentabilidade automaticamente.

---

## 📉 14. TRADER

Diário de trades com Win Rate e P&L total. Registra erros e aprendizados de cada operação para evolução contínua.

---

## 🏠 15. PATRIMÔNIO

Inventário de bens físicos: imóveis, veículos, equipamentos. Registra custos e calcula valorização/depreciação.

---

## ⚙️ 16. CONFIGURAÇÕES

Central administrativa (somente admin):
- Usuários e permissões por módulo
- Dados da empresa (nome, CNPJ, logomarca)
- Chaves de API (Evolution, Meta, OpenRouter)
- Conexão de canais WhatsApp (QR Code ou Meta Cloud API)

---

## 🔄 Fluxo Completo de uma Venda

```
1. Lead entra (WhatsApp, Instagram, indicação, parceiro)
   [Auto] → parceiro.total_indicacoes + 1

2. Equipe trabalha o lead (atividades registradas)

3. Lead → "Proposta" → Orçamento enviado

4. Lead → "Cliente Ativo"
   [Auto] → parceiro.total_convertidas + 1
   [Auto] → parceiro.total_comissao + valor calculado

5. OS criada no módulo Vendas

6. Serviço executado → OS "Concluída"
   [Auto] → Card de agradecimento gerado

7. Pagamento → Lançamento no Financeiro

8. [Auto] → Follow-up 7 dias / Indicação 15 dias

9. Cliente indica novo lead → ciclo recomeça
```

---

## 🤖 Treinamento da Vivi (IA) — Cole no prompt

```
Você é a VIVI, Assistente do Sistema Cajado.
Ajude os colaboradores a usar a plataforma corretamente.
Seja direta, profissional e simpática. Explique em etapas numeradas.
Nunca invente telas. Se não souber: "Abra um chamado no suporte."

RESPOSTAS RÁPIDAS:
- Lead novo → CRM Cajado → "+ Lead"
- Fechar lead → arrastar para "Cliente Ativo" no Kanban
- Comissão → automática ao mover para "Cliente Ativo" (precisa de valor estimado + parceiro no lead)
- Registrar despesa → Financeiro → "+ Lançamento" → Despesa
- Ver saldo → Financeiro → Contas
- Número WA bloqueado → Segurança WA → ativar backup
- Responder cliente → Inbox → selecionar conversa
- Pausar bot → Inbox → "Pausar Vivi"
- Bater ponto → Equipe → Ponto → "Registrar Entrada/Saída"
- Criar tarefa → Equipe → Tarefas → "+ Tarefa"
- Cadastrar parceiro → CRM → aba Parceiros → "+ Parceiro"
- Criar OS → Vendas/OS → "+ Nova OS / Venda"
```

---
*Sistema Cajado v2.0 — Abril/2026*


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
