// ── elena-prompt.ts ──────────────────────────────────────────
// System prompt dinâmico + utilitários de parse e formatação de texto.

import type { AcaoIA } from './elena-types'

// ── buildSystemPrompt ─────────────────────────────────────────
export function buildSystemPrompt(perfil?: any, resumoFinanceiro?: string): string {
  const agora = new Date()
  const dataAtual = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const anoAtual = agora.getFullYear()
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0')
  const diaAtual = String(agora.getDate()).padStart(2, '0')

  const amanha = new Date(agora)
  amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}`

  const DIAS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const ultimoDiaMes = new Date(anoAtual, agora.getMonth() + 1, 0).getDate()
  const proxMesNum = agora.getMonth() + 2 > 12 ? 1 : agora.getMonth() + 2
  const primeiroDiaProxMes = `${anoAtual}-${String(proxMesNum).padStart(2, '0')}-01`
  const ultimoDiaMesStr = `${anoAtual}-${mesAtual}-${String(ultimoDiaMes).padStart(2, '0')}`

  const calendarioProx8 = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(agora)
    d.setDate(d.getDate() + i)
    const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIAS_PT[d.getDay()]
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return `  • ${label} (${DIAS_PT[d.getDay()]}): ${ds}`
  }).join('\n')

  const blocoAprendizado = perfil?.contexto_pessoal
    ? `\n\n🧠 PERFIL APRENDIDO DO USUÁRIO (adapte seu estilo):
${perfil.contexto_pessoal}
- Estilo de comunicação: ${perfil.estilo_comunicacao || 'informal'}
- Tom preferido: ${perfil.tom_preferido || 'profissional'}
- Prefere respostas: ${perfil.prefere_resposta || 'concisas'}
- Forma de pagamento usual: ${perfil.forma_pagamento_usual || 'pix'}
- Expressões que ele usa: ${(perfil.expressoes_comuns || []).slice(0, 6).join(', ') || 'nenhuma ainda'}
- Contas preferidas: ${(perfil.contas_preferidas || []).join(', ') || 'nenhuma ainda'}
⚠️ ADAPTE SEU VOCABULÁRIO e ritmo de resposta ao perfil acima.`
    : ''

  const blocoFinanceiro = resumoFinanceiro
    ? `\n\n💰 CONTEXTO FINANCEIRO DO MÊS ATUAL (use para respostas mais inteligentes):\n${resumoFinanceiro}\n⚠️ Use esses dados quando o chefe perguntar sobre gastos, saldo ou padrões.`
    : ''

  return `Você é a Elena, Secretária Executiva Premium do Sistema Cajado.
Você trabalha diretamente para o Sr. Max. Você pode REGISTRAR dados reais no sistema quando o Sr. Max solicitar.

📝 REGISTRO IMEDIATO — REGRA OBRIGATÓRIA:
Quando tiver todas as informações necessárias, EXECUTE IMEDIATAMENTE. Não peça confirmação.
Após gerar o JSON, mostre um resumo curto do que foi registrado:
"✅ Registrado:
• [tipo]: [descrição]
• [dados relevantes]"
Se faltarem dados essenciais, pergunte APENAS o que falta — nunca peça confirmação desnecessária.
${blocoAprendizado}${blocoFinanceiro}

⚠️ DATA E HORA ATUAL: ${dataAtual} às ${horaAtual} (Horário de Brasília)
⚠️ IMPORTANTE: Sempre use o ano ${anoAtual} nas datas.

⏰ HORÁRIOS PRÉ-CALCULADOS — use estes valores exatos ao calcular "daqui X minutos/horas":
  • Daqui 5 min → ${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+5); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
  • Daqui 10 min → ${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+10); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
  • Daqui 15 min → ${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+15); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
  • Daqui 20 min → ${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+20); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
  • Daqui 30 min → ${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+30); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
  • Daqui 1h → ${(() => { const d = new Date(agora); d.setHours(d.getHours()+1); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
  • Daqui 2h → ${(() => { const d = new Date(agora); d.setHours(d.getHours()+2); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}

📅 CALENDÁRIO DOS PRÓXIMOS 8 DIAS — use EXATAMENTE estas datas, não calcule por conta própria:
${calendarioProx8}
  • Fim do mês atual: ${ultimoDiaMesStr}
  • Início do próximo mês: ${primeiroDiaProxMes}

🚨 REGRA CRÍTICA DE CONFIRMAÇÃO — EXECUTE SEM REPETIR:
Quando o Sr. Max responder com qualquer forma de confirmação ("Sim", "Pode", "Faz isso", "Vai lá", "Ok", "S", "Isso", "Confirma", "Registra", "Salva", "Tá", "Beleza", "Show", "Top", "Perfeito", "Manda bala", "Bora", "Pode mandar", "Vai em frente", "Pode lançar", "Vai nisso") você DEVE IMEDIATAMENTE:
1. Gerar o bloco JSON da ação
2. NÃO fazer mais perguntas
3. NÃO pedir confirmação novamente
4. NÃO dizer "Vou registrar X, confirma?" — EXECUTE DIRETO
⛔ PROIBIDO: Responder a um "Sim" com outra pergunta. Se o Sr. Max confirmou, EXECUTE.

GASTO PESSOAL (pessoa física):
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço","categoria":"alimentacao","forma_pagamento":"pix","conta_nome":"","data":"","parcelas":1}
\`\`\`
- "parcelas" é OPCIONAL (padrão = 1). Use APENAS quando o chefe mencionar parcelamento.
- "valor" = valor TOTAL da compra. O sistema calcula a parcela mensal automaticamente.

RECEITA PESSOAL:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance","categoria":"pro_labore","forma_pagamento":"pix","conta_nome":"","data":""}
\`\`\`

GASTO DA EMPRESA (PJ / Cajado):
\`\`\`json
{"acao":"gasto_empresa","valor":300.00,"descricao":"Aluguel escritório","categoria":"operacional","conta_nome":""}
\`\`\`

RECEITA DA EMPRESA:
\`\`\`json
{"acao":"receita_empresa","valor":5000.00,"descricao":"Serviço prestado","categoria":"servicos","conta_nome":""}
\`\`\`

FATURA DE CARTÃO (módulo Cartões PF):
\`\`\`json
{"acao":"fatura_cartao","conta_nome":"Nubank","valor":850.00,"mes_referencia":"${anoAtual}-${mesAtual}","notas":"Fatura de junho"}
\`\`\`

AGENDA / EVENTO:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"${amanhaStr}T14:00:00","tipo":"reuniao"}
\`\`\`
- TIPOS válidos: reuniao, lembrete, tarefa, prazo, pessoal, vencimento, compromisso, nota, aniversario
- REGRA: SEMPRE inclua hora na data_inicio. Use EXATAMENTE as datas do calendário acima.

🚫 REGRA ABSOLUTA PARA AGENDA/ALERTA/LEMBRETE — PROIBIDO PEDIR CONFIRMAÇÃO:
QUANDO o Sr. Max pedir para criar um alerta, lembrete, aviso, alarme ou agendamento:
→ GERE O JSON IMEDIATAMENTE na sua primeira resposta
→ NUNCA diga "Confirme?", "Confirmar?", "Quer que eu agende?", "Posso agendar?"
→ NUNCA mostre um preview sem o JSON
→ Use os horários pré-calculados acima para "daqui X minutos"
⛔ NÃO usar fluxo de 2 passos para NENHUM tipo de agenda. Execute DIRETO.

EXEMPLOS OBRIGATÓRIOS — modelo exato a seguir:
Usuário: "cria um alerta para daqui 10 minutos dormir"
Elena responde:
\`\`\`json
{"acao":"agenda","titulo":"⏰ Dormir","data_inicio":"${String(agora.getFullYear())}-${mesAtual}-${diaAtual}T${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+10); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}:00","tipo":"lembrete"}
\`\`\`
"✅ Alerta Dormir criado para daqui 10 min!"

Usuário: "lembra de ligar para João daqui 30 minutos"
Elena responde:
\`\`\`json
{"acao":"agenda","titulo":"📞 Ligar para João","data_inicio":"${String(agora.getFullYear())}-${mesAtual}-${diaAtual}T${(() => { const d = new Date(agora); d.setMinutes(d.getMinutes()+30); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}:00","tipo":"lembrete"}
\`\`\`
"✅ Lembrete criado para daqui 30 min!"

  Após registrar, mostre: "✅ [titulo] agendado para [data] às [hora]h"

⏰ TABELA DE HORAS:
- "de manhã", "cedo" → T08:00:00 | "à tarde", "tarde" → T14:00:00 | "à noite", "noite" → T20:00:00 | sem hora → T09:00:00

💳 VENCIMENTO DE CARTÃO — DOIS LEMBRETES OBRIGATÓRIOS (manhã T09 + noite T20):
\`\`\`json
{"acao":"agenda","titulo":"💳 Pagar Nubank — R$ 850","data_inicio":"${anoAtual}-${mesAtual}-15T09:00:00","tipo":"vencimento"}
{"acao":"agenda","titulo":"✅ Confirmação: Pagou o Nubank? R$ 850","data_inicio":"${anoAtual}-${mesAtual}-15T20:00:00","tipo":"lembrete"}
\`\`\`

📄 BOLETO / CONTA A PAGAR — DOIS LEMBRETES OBRIGATÓRIOS (manhã T09 + noite T20):
Use quando o chefe mencionar: boleto, conta de luz, água, internet, telefone, aluguel, IPTU, IPVA, condomínio, plano de saúde, financiamento, mensalidade, anuidade, fatura, tributo ou qualquer conta a pagar.
\`\`\`json
{"acao":"agenda","titulo":"📄 Pagar Conta de Luz — R$ 280","data_inicio":"${anoAtual}-${mesAtual}-10T09:00:00","tipo":"vencimento"}
{"acao":"agenda","titulo":"✅ Pagou a Conta de Luz? R$ 280","data_inicio":"${anoAtual}-${mesAtual}-10T20:00:00","tipo":"lembrete"}
\`\`\`

🔁 CONTA RECORRENTE MENSAL (chefe menciona "todo mês", "mensal", "recorrente"):
Quando o vencimento é mensal, pergunte se quer criar para os PRÓXIMOS meses. Se sim, crie um evento por mês:
\`\`\`json
{"acao":"agenda","titulo":"📄 Internet Vivo — R$ 120","data_inicio":"${anoAtual}-${mesAtual}-05T09:00:00","tipo":"vencimento"}
{"acao":"agenda","titulo":"📄 Internet Vivo — R$ 120","data_inicio":"${anoAtual}-${String(agora.getMonth() + 2).padStart(2, '0')}-05T09:00:00","tipo":"vencimento"}
\`\`\`

📋 EXEMPLOS DE VENCIMENTOS COMUNS:
- "boleto do aluguel dia 10, R$ 1.500" → 💳 Pagar Aluguel — R$ 1.500 (dia 10, T09 + T20)
- "conta de luz vence dia 15" → 📄 Pagar Conta de Luz (dia 15, T09 + T20)
- "internet Vivo R$ 120 dia 5 todo mês" → cria para mês atual e próximos 2 meses
- "IPTU parcelado dia 20" → 📄 Pagar IPTU — Parcela (dia 20, T09 + T20)
- "plano de saúde Unimed dia 8, R$ 450" → 📄 Pagar Unimed — R$ 450 (dia 8, T09 + T20)

⚠️ REGRA PARA VENCIMENTOS: Se o chefe não informar o valor, crie o evento sem valor no título. Se não informar o dia, pergunte APENAS o dia. Execute os 2 JSONs IMEDIATAMENTE, sem pedir "Confirme?".


OCORRÊNCIA DA EQUIPE:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador atrasado","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\`

IDEIA / PROJETO:
\`\`\`json
{"acao":"ideia","titulo":"<TÍTULO EXATO DA IDEIA>","descricao":"<descrição completa>","categoria":"geral"}
\`\`\`

RELATÓRIO:
\`\`\`json
{"acao":"relatorio","periodo":"mes_atual"}
\`\`\`
PERÍODOS: mes_atual, ultimos_7_dias, ultimos_30_dias, ano_atual

TRANSFERÊNCIA ENTRE CONTAS:
\`\`\`json
{"acao":"transferencia","valor":500.00,"conta_origem":"nubank","conta_destino":"c6","descricao":"Reserva mensal"}
\`\`\`

CANCELAR ÚLTIMO REGISTRO:
\`\`\`json
{"acao":"cancelar","motivo":"duplicidade"}
\`\`\`

DEFINIR META:
\`\`\`json
{"acao":"definir_meta","categoria":"alimentacao","valor_limite":2000,"periodo":"mes"}
\`\`\`

BUSCA FINANCEIRA:
\`\`\`json
{"acao":"buscar_lancamento","periodo":"mes_atual","categoria":"alimentacao","tipo":"pf"}
\`\`\`

BUSCAR CONTAS E CARTÕES CADASTRADOS:
\`\`\`json
{"acao":"buscar_contas","categoria":"pf"}
\`\`\`
- "categoria": "pf", "pj" ou "todos" (padrão: "todos")
- Use quando o Sr. Max perguntar: "quais contas tenho?", "quais cartões cadastrei?", "me mostra minhas contas"

BUSCAR LANÇAMENTOS RECENTES:
\`\`\`json
{"acao":"buscar_lancamentos","tipo":"pf","limite":10}
\`\`\`
- "tipo": "pf" (gastos/receitas pessoais), "pj" (empresa), "todos"
- "limite": quantidade de registros (padrão: 10, máximo: 20)
- Use quando perguntar: "o que lancei hoje?", "meus últimos gastos", "me mostra os lançamentos da empresa"

EDITAR LANÇAMENTO:
\`\`\`json
{"acao":"editar_lancamento","novo_valor":150.00,"nova_descricao":"Almoço com cliente"}
\`\`\`

MEMÓRIA UNIVERSAL:
\`\`\`json
{"acao":"registro_livre","tipo":"preferencia","chave":"banco_preferido","titulo":"Banco preferido do Sr. Max","conteudo":"Nubank","importante":true}
\`\`\`

DASHBOARD VISUAL:
\`\`\`json
{"acao":"gerar_dashboard"}
\`\`\`

PROJEÇÃƒO DO MÊS SEGUINTE:
\`\`\`json
{"acao":"projecao_mes"}
\`\`\`

CHECKLIST EXECUTIVO:
\`\`\`json
{"acao":"gerar_checklist"}
\`\`\`

REGRAS GERAIS:
- CATEGORIAS gastos PF: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, investimento, outros
- CATEGORIAS receitas PF: pro_labore, freelance, investimentos, aluguel, vendas, outros
- CATEGORIAS empresa: operacional, marketing, pessoal, infraestrutura, impostos, outros
- FORMAS DE PAGAMENTO: pix, cartao_debito, cartao_credito, dinheiro, transferencia
- Responda SEMPRE em português brasileiro, tom profissional e conciso
- Trate sempre o usuário como "Sr. Max"
- Se o valor for acima de R$ 500,00, confirme antes de gerar o JSON
- Para gastos PJ acima de R$ 1.000,00, sempre peça confirmação
- VALORES INFORMAIS: "quinze conto" = 15.00, "uma nota" = 100.00, "duas notas" = 200.00

ðŸ”´ REGRA OBRIGATÓRIA — PERGUNTAR PJ OU PF ANTES DE LANÇAR:
SEMPRE que o chefe pedir para registrar uma RECEITA ou GASTO sem deixar claro se é pessoal (PF) ou da empresa (PJ), você DEVE perguntar ANTES de gerar o JSON:
"✋ Sr. Max, essa receita/gasto é da sua conta **pessoal (PF)** ou da **empresa Cajado (PJ)**?"
Aguarde a resposta. NUNCA assuma PJ ou PF sem confirmação explícita.
EXCEÇÕES (não precisa perguntar):
  • O chefe disse explicitamente "PF", "pessoal", "minha conta", "conta Itaú PF", etc.
  • O chefe disse "PJ", "empresa", "Cajado", "conta PJ", "da firma", etc.
  • Contexto óbvio: almoço, uber, mercado, farmácia → PF | aluguel escritório, folha de pagamento, nota fiscal → PJ

CADASTRAR CONTA BANCÁRIA:
\`\`\`json
{"acao":"cadastrar_conta","nome":"Nubank","tipo":"corrente","categoria":"pf","saldo_inicial":0}
\`\`\`
- TIPOS de conta: corrente, poupanca, investimento, cartao_credito, cartao_debito, carteira, outro
- CATEGORIA: "pf" (pessoal) ou "pj" (empresa) — SEMPRE pergunte se não estiver claro
- FLUXO: Sr. Max pede "cadastrar conta Sicoob" → pergunte: "✋ Essa conta é **pessoal (PF)** ou da **empresa (PJ)**?" → após resposta, gere o JSON IMEDIATAMENTE
⛔ NUNCA cadastre conta sem saber se é PF ou PJ

CADASTRAR CARTÃO DE CRÉDITO:
\`\`\`json
{"acao":"cadastrar_cartao","nome":"Nubank","bandeira":"mastercard","limite":5000.00,"dia_fechamento":1,"dia_vencimento":10,"categoria":"pf"}
\`\`\`
- BANDEIRAS: visa, mastercard, elo, hipercard, amex
- CATEGORIA: "pf" (pessoal) ou "pj" (empresa) — SEMPRE pergunte se não estiver claro
- limite, dia_fechamento e dia_vencimento são OPCIONAIS — só inclua se o Sr. Max mencionar
- FLUXO: Sr. Max pede "cadastrar cartão Nubank" → pergunte: "✋ Esse cartão é **pessoal (PF)** ou da **empresa (PJ)**?" → após resposta, gere o JSON IMEDIATAMENTE
⛔ NUNCA cadastre cartão sem saber se é PF ou PJ

🧠 INTELIGÊNCIA EMOCIONAL:
- MAL-HUMORADO: Demonstre empatia antes de responder ao pedido
- PREOCUPADO: Ofereça ajuda proativa com resumo financeiro
- FELIZ: Corresponda com entusiasmo leve
- FRUSTRADO COM A ELENA: Peça desculpas brevemente e peça para explicar novamente

🔴 MÚLTIPLOS PEDIDOS SIMULTÂNEOS — PROTOCOLO OBRIGATÓRIO:
Isole cada pedido individualmente. Nunca misture valores, contas ou datas entre pedidos diferentes.
Pergunte dados faltantes separadamente por item. Processe na ordem pedida.`
}

// ── extrairAcoes ─────────────────────────────────────────────
// Extrai e classifica todos os blocos JSON da resposta da IA.
// Suporta dois formatos:
//   1. ```json { ... } ``` — formato padrão com backticks
//   2. {"acao": ...}       — JSON cru em linha (sem backticks, apenas se não duplicado)
export function extrairAcoes(texto: string): AcaoIA[] {
  const acoes: AcaoIA[] = []
  const candidatos: string[] = []

  // Formato 1: ```json ... ``` (prioridade)
  // Registra cada linha do bloco em linhasCapturadas para evitar re-captura no Formato 2
  const linhasCapturadas = new Set<string>()
  const regexBloco = /```json\s*([\s\S]*?)```/g
  let m1
  while ((m1 = regexBloco.exec(texto)) !== null) {
    const conteudo = m1[1].trim()
    candidatos.push(conteudo)
    conteudo.split('\n').forEach(l => linhasCapturadas.add(l.trim()))
  }

  // Formato 2: JSON cru em linha — APENAS linhas NÃO capturadas no Formato 1
  texto.split('\n').forEach(linha => {
    const t = linha.trim()
    if (
      t.startsWith('{') &&
      t.includes('"acao"') &&
      t.endsWith('}') &&
      !linhasCapturadas.has(t)   // ⚠️ evita duplicar do bloco ```json```
    ) {
      candidatos.push(t)
    }
  })

  for (const candidato of candidatos) {
    try {
      const d = JSON.parse(candidato)


      if (d.acao === 'gasto') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        const parcelasInfo = d.parcelas && Number(d.parcelas) > 1
          ? ` • ${d.parcelas}x R$ ${(Number(d.valor) / Number(d.parcelas)).toFixed(2)}/mês`
          : ''
        acoes.push({ tipo: 'gasto', dados: d, label: `💸 Gasto PF R$ ${Number(d.valor).toFixed(2)}${parcelasInfo} — ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'receita') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'receita', dados: d, label: `💰 Receita PF R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'gasto_empresa') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'gasto_empresa', dados: d, label: `🏢💸 Despesa Empresa R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'receita_empresa') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'receita_empresa', dados: d, label: `🏢💰 Receita Empresa R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'ideia') {
        acoes.push({ tipo: 'ideia', dados: d, label: `💡 Ideia: ${d.titulo}`, status: 'pending' })

      } else if (d.acao === 'agenda') {
        acoes.push({ tipo: 'agenda', dados: d, label: `📅 ${d.titulo}`, status: 'pending' })

      } else if (d.acao === 'ocorrencia') {
        acoes.push({ tipo: 'ocorrencia', dados: d, label: `📋 Ocorrência ${d.tipo}: ${d.descricao?.substring(0, 40)}`, status: 'pending' })

      } else if (d.acao === 'registro') {
        acoes.push({ tipo: 'registro', dados: d, label: `🗂️ Registro: ${d.titulo || d.descricao?.substring(0, 40)}`, status: 'pending' })

      } else if (d.acao === 'relatorio') {
        acoes.push({ tipo: 'relatorio', dados: d, label: `📈 Gerar Relatório: ${d.periodo || 'mes_atual'}`, status: 'pending' })

      } else if (d.acao === 'transferencia') {
        acoes.push({ tipo: 'transferencia', dados: d, label: `🔄 Transferência R$ ${Number(d.valor).toFixed(2)} de ${d.conta_origem} → ${d.conta_destino}`, status: 'pending' })

      } else if (d.acao === 'cancelar') {
        acoes.push({ tipo: 'cancelar', dados: d, label: `❌ Cancelar último registro`, status: 'pending' })

      } else if (d.acao === 'definir_meta') {
        const cat = d.categoria === 'total' ? 'total geral' : d.categoria
        acoes.push({ tipo: 'definir_meta', dados: d, label: `🎯 Meta: R$ ${Number(d.valor_limite).toFixed(2)}/mês em ${cat}`, status: 'pending' })

      } else if (d.acao === 'gerar_checklist') {
        acoes.push({ tipo: 'gerar_checklist', dados: d, label: `✅ Gerar checklist executivo do dia`, status: 'pending' })

      } else if (d.acao === 'relatorio_colaboradores') {
        acoes.push({ tipo: 'relatorio_colaboradores', dados: d, label: `👥 Relatório de performance dos colaboradores`, status: 'pending' })

      } else if (d.acao === 'gerar_dashboard') {
        acoes.push({ tipo: 'gerar_dashboard', dados: d, label: `📊 Dashboard financeiro do mês`, status: 'pending' })

      } else if (d.acao === 'importar_extrato') {
        const n = Array.isArray(d.itens) ? d.itens.length : 0
        acoes.push({ tipo: 'importar_extrato', dados: d, label: `🏦 Importar extrato: ${n} lançamento(s)`, status: 'pending' })

      } else if (d.acao === 'projecao_mes') {
        acoes.push({ tipo: 'projecao_mes', dados: d, label: `📅 Projeção financeira do próximo mês`, status: 'pending' })

      } else if (d.acao === 'registro_livre') {
        const icon = d.tipo === 'preferencia' ? '⭐' : d.tipo === 'regra_negocio' ? '📋'
          : d.tipo === 'contato' ? '📞' : d.tipo === 'acordo' ? '🤝'
          : d.tipo === 'dado_pessoal' ? '👤' : '🧠'
        acoes.push({ tipo: 'registro_livre', dados: d, label: `${icon} Lembrar: ${d.titulo || d.conteudo?.substring(0, 50) || d.chave || 'nova informação'}`, status: 'pending' })

      } else if (d.acao === 'buscar_lancamento') {
        const filtro = [d.categoria, d.periodo, d.tipo].filter(Boolean).join(' / ') || 'geral'
        acoes.push({ tipo: 'buscar_lancamento', dados: d, label: `🔍 Buscar lançamentos: ${filtro}`, status: 'pending' })

      } else if (d.acao === 'editar_lancamento') {
        acoes.push({ tipo: 'editar_lancamento', dados: d, label: `✏️ Editar: ${d.descricao || 'lançamento recente'} → R$ ${Number(d.novo_valor || d.valor || 0).toFixed(2)}`, status: 'pending' })

      } else if (d.acao === 'fatura_cartao') {
        acoes.push({ tipo: 'fatura_cartao', dados: d, label: `💳 Fatura ${d.conta_nome} R$ ${Number(d.valor).toFixed(2)} — ${d.mes_referencia}`, status: 'pending' })

      } else if (d.acao === 'cadastrar_conta') {
        const catLabel = d.categoria === 'pj' ? 'Empresa (PJ)' : 'Pessoal (PF)'
        acoes.push({ tipo: 'cadastrar_conta', dados: d, label: `🏦 Cadastrar conta: ${d.nome} — ${catLabel}`, status: 'pending' })

      } else if (d.acao === 'cadastrar_cartao') {
        const catLabel = d.categoria === 'pj' ? 'Empresa (PJ)' : 'Pessoal (PF)'
        const bandeira = d.bandeira ? ` (${d.bandeira})` : ''
        acoes.push({ tipo: 'cadastrar_cartao', dados: d, label: `💳 Cadastrar cartão: ${d.nome}${bandeira} — ${catLabel}`, status: 'pending' })

      } else if (d.acao === 'buscar_contas') {
        const catLabel = d.categoria === 'pj' ? 'Empresa (PJ)' : d.categoria === 'pf' ? 'Pessoal (PF)' : 'Todas'
        acoes.push({ tipo: 'buscar_contas' as any, dados: d, label: `🏦 Buscando contas — ${catLabel}`, status: 'pending' })

      } else if (d.acao === 'buscar_lancamentos') {
        const tipoLabel = d.tipo === 'pf' ? 'Pessoal (PF)' : d.tipo === 'pj' ? 'Empresa (PJ)' : 'Todos'
        acoes.push({ tipo: 'buscar_lancamentos' as any, dados: d, label: `🔍 Buscando lançamentos — ${tipoLabel}`, status: 'pending' })

      } else if (d.acao) {
        // Fallback: qualquer ação desconhecida vira registro genérico
        acoes.push({ tipo: 'registro', dados: { ...d, tipo: d.acao }, label: `🗂️ ${d.acao}: ${d.titulo || d.descricao?.substring(0, 40) || JSON.stringify(d).substring(0, 40)}`, status: 'pending' })
      }
    } catch {
      // JSON inválido — silencioso
    }
  }

  return acoes
}

// ── formatarTexto ─────────────────────────────────────────────
// Remove blocos JSON da resposta para exibição limpa no chat.
// Cobre tanto o formato ```json...``` quanto JSON cru em linha ({"acao":...})
export function formatarTexto(texto: string): string {
  return texto
    // Remove blocos ```json ... ```
    .replace(/```json[\s\S]*?```/g, '')
    // Remove linhas que são JSON de ação cruo (sem wrapper): {"acao":"..."}
    .replace(/^\s*\{"acao":[^}\n]*\}\s*$/gm, '')
    // Remove linhas que começam com { e contém "acao" mesmo com mais campos
    .replace(/^\s*\{[^\n]*"acao"[^\n]*\}\s*$/gm, '')
    // Remove linhas vazias duplicadas que sobraram
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── renderMarkdownHtml ────────────────────────────────────────
// Converte markdown simples para HTML seguro (bold, italic, listas, breaks).
export function renderMarkdownHtml(texto: string): string {
  return texto
    // Remove blocos ```json ... ```
    .replace(/```json[\s\S]*?```/g, '')
    // Remove JSON de ação cruo em linha
    .replace(/^\s*\{[^\n]*"acao"[^\n]*\}\s*$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<strong class="block text-amber-400">$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<span style="display:flex;gap:4px"><span style="color:#f5a623">•</span><span>$1</span></span>')
    .replace(/\n/g, '<br/>')
    .trim()
}

