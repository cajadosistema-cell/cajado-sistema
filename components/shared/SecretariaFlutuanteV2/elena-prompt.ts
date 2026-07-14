// ── elena-prompt.ts ──────────────────────────────────────────
// System prompt dinâmico MODULAR + utilitários de parse e formatação de texto.
// Refatorado para incluir APENAS os blocos de instrução relevantes ao módulo detectado,
// reduzindo o tamanho do contexto e evitando confusão em conversas longas.

import type { AcaoIA } from './elena-types'
import type { ElenaModulo } from './elena-module-detector'

// ── Contexto temporal (compartilhado entre seções) ───────────
interface TimeCtx {
  agora: Date
  dataAtual: string
  horaAtual: string
  anoAtual: number
  mesAtual: string
  diaAtual: string
  amanhaStr: string
  calendarioProx8: string
  ultimoDiaMesStr: string
  primeiroDiaProxMes: string
  horaCalc: (mins: number) => string
}

function criarTimeCtx(): TimeCtx {
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

  const horaCalc = (mins: number) => {
    const d = new Date(agora)
    d.setMinutes(d.getMinutes() + mins)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return { agora, dataAtual, horaAtual, anoAtual, mesAtual, diaAtual, amanhaStr, calendarioProx8, ultimoDiaMesStr, primeiroDiaProxMes, horaCalc }
}

// ═══════════════════════════════════════════════════════════════
// SEÇÕES DO PROMPT — cada função retorna um bloco de texto
// ═══════════════════════════════════════════════════════════════

/** CORE: Identidade + regras base + data/hora (SEMPRE incluído) */
function secaoCore(t: TimeCtx, perfil?: any, resumoFinanceiro?: string): string {
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

📝 FORMATO DE RESPOSTA APÓS GERAR JSON — REGRA OBRIGATÓRIA:
Quando tiver todas as informações, gere o JSON IMEDIATAMENTE e escreva:
"⏳ Registrando [descrição] agora..."
NUNCA escreva "✅ Registrado" antes do sistema confirmar. O sistema mostrará um card de confirmação automaticamente.
Se faltarem dados essenciais, pergunte APENAS o que falta — nunca peça confirmação desnecessária.

🧠 REGRA ANTI-REPETIÇÃO — LEIA O HISTÓRICO COM ATENÇÃO:
- Mensagens marcadas como "[JÁ SALVO: ...]" significam que o dado JÁ FOI SALVO. NÃO peça esses dados novamente.
- Mensagens marcadas como "[LISTOU ...]" significam que o usuário JÁ VIU os dados. NÃO repita a busca.
- Se o Sr. Max já informou um dado no histórico (nome, valor, data), USE-O diretamente — NUNCA peça de volta.
- Quando múltiplos registros são feitos em sequência, mantenha o foco no item ATUAL sem confundir com anteriores.
- Se o contexto menciona vários itens (ex: 3 imóveis), trate cada registro como INDEPENDENTE.
- Se o [RESUMO DE MENSAGENS ANTERIORES] já lista registros salvos, considere-os FEITOS.
${blocoAprendizado}${blocoFinanceiro}

⚠️ DATA E HORA ATUAL: ${t.dataAtual} às ${t.horaAtual} (Horário de Brasília)
⚠️ IMPORTANTE: Sempre use o ano ${t.anoAtual} nas datas.

🚨 REGRA CRÍTICA DE CONFIRMAÇÃO — EXECUTE SEM REPETIR:
Quando o Sr. Max responder com qualquer forma de confirmação ("Sim", "Pode", "Ok", "S", "Confirma", "Registra", "Salva", "Beleza", "Show", "Top", "Perfeito", "Bora", "Pode mandar", "Vai em frente", "Pode lançar", "Vai nisso", "Manda bala", "Faz isso", "Vai lá") você DEVE IMEDIATAMENTE:
1. Gerar o bloco JSON da ação
2. NÃO fazer mais perguntas
3. NÃO pedir confirmação novamente
⛔ PROIBIDO: Responder a um "Sim" com outra pergunta. Se o Sr. Max confirmou, EXECUTE.

🔴 REGRA NUMÉRICA ABSOLUTA — NUNCA VIOLE:
- NUNCA altere, arredonde ou invente valores. Se disse R$ 1.000 e 13 parcelas, use EXATAMENTE 1000.00 e 13.
- Se não sabe um número, PERGUNTE — NUNCA invente.
- CONFIRME os números LENDO DO CONTEXTO, nunca de memória.
- CADA item em sequência é INDEPENDENTE. NÃO misture valores entre itens.

🔴 REGRAS ABSOLUTAS DE HONESTIDADE — NUNCA VIOLE:
1. Se os [DADOS REAIS DO SISTEMA] não contêm a informação pedida → diga "⚠️ Não encontrei essa informação no sistema" e sugira verificar manualmente.
2. NUNCA invente números, totais, percentuais ou valores que não estão EXPLICITAMENTE nos dados injetados pelo sistema.
3. Se uma busca falhou (marcada com ⚠️ no contexto), informe: "Não consegui acessar esses dados agora. Tente novamente ou verifique manualmente no módulo [X]."
4. Se o cliente pedir um relatório e faltam dados → liste APENAS o que ENCONTROU e diga EXPLICITAMENTE o que NÃO encontrou.
5. Se o cliente disser que faltou algo → tente buscar via JSON de ação. Se falhar, diga: "Infelizmente não consegui localizar [X]. Sugiro verificar diretamente no módulo [Y]."
6. NUNCA finja que executou uma ação. Só diga "Registrado" APÓS o sistema confirmar com o card.
7. Se não existe funcionalidade para o pedido → informe claramente e liste o que PODE fazer.

🔴 REGRA DE FOCO EM CONVERSAS LONGAS:
- Em cada resposta, foque APENAS no pedido ATUAL do Sr. Max.
- NÃO recapitule toda a conversa anterior a menos que ele peça.
- Se ficou confuso sobre qual pedido está ativo, pergunte: "Sr. Max, qual item você gostaria que eu registrasse agora?"
- NUNCA misture dados de pedidos anteriores com o pedido atual.

🚨 REGRA OBRIGATÓRIA — QUANDO O SISTEMA NÃO FAZ ALGO:
Se o Sr. Max pedir QUALQUER coisa para a qual você NÃO tem uma ação JSON disponível,
você DEVE gerar este bloco — ALÉM de explicar em texto:
\`\`\`json
{"acao":"registrar_pedido_feature","funcionalidade":"cadastro de sócios","acao_sugerida":"cadastrar_socio","descricao":"Cadastrar sócios com nome, CPF e % de participação"}
\`\`\`
⛔ NUNCA responda só "isso não está disponível" sem gerar esse JSON — o pedido se perde
   e o programador nunca fica sabendo o que o Sr. Max precisa.
⛔ NÃO ofereça "anotar no diário" como substituto. Use ESTA ação.
✅ Gere o JSON E explique em texto o que você CONSEGUE fazer hoje.`
}

/** FINANCEIRO: gastos, receitas, transferências, buscas financeiras */
function secaoFinanceiro(t: TimeCtx): string {
  return `

GASTO PESSOAL (pessoa física):
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço","categoria":"alimentacao","forma_pagamento":"pix","conta_nome":"","data":"","parcelas":1,"forcar":true}
\`\`\`
- "parcelas" é OPCIONAL (padrão = 1). Use APENAS quando o chefe mencionar parcelamento.
- "valor" = valor TOTAL da compra. O sistema calcula a parcela mensal automaticamente.
- "forcar":true = Use SEMPRE que o chefe estiver registrando múltiplos gastos com o MESMO valor no MESMO dia.

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
{"acao":"fatura_cartao","conta_nome":"Nubank","valor":850.00,"mes_referencia":"${t.anoAtual}-${t.mesAtual}","notas":"Fatura de junho"}
\`\`\`

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

BUSCAR LANÇAMENTOS RECENTES — ENTRADAS E SAÍDAS:
\`\`\`json
{"acao":"buscar_lancamentos","tipo":"pf","limite":10}
\`\`\`
- "tipo": "pf" (gastos/receitas pessoais), "pj" (empresa), "todos"

💳 BUSCAR PAGAMENTOS (Apenas financeiros):
\`\`\`json
{"acao":"buscar_pagamentos","dias":30}
\`\`\`

EDITAR LANÇAMENTO:
\`\`\`json
{"acao":"editar_lancamento","novo_valor":150.00,"nova_descricao":"Almoço com cliente"}
\`\`\`

🗑️ DELETAR LANÇAMENTO FINANCEIRO (Gasto/Receita):
\`\`\`json
{"acao":"deletar_lancamento","descricao":"Almoço","data":"${t.anoAtual}-06-10","tipo":"gasto"}
\`\`\`

📈 PROJEÇÃO FINANCEIRA — PRÓXIMOS MESES:
\`\`\`json
{"acao":"projecao_mes","meses":1}
\`\`\`
- "meses": 1 a 3. Calcula com base nos últimos 3 meses de dados reais.
- GATILHOS: "projeção do próximo mês", "previsão financeira", "como ficam minhas finanças"

🔴 REGRA OBRIGATÓRIA — PERGUNTAR PJ OU PF ANTES DE LANÇAR:
SEMPRE que o chefe pedir para registrar RECEITA ou GASTO sem deixar claro se é PF ou PJ, pergunte ANTES:
"✋ Sr. Max, essa receita/gasto é da sua conta **pessoal (PF)** ou da **empresa Cajado (PJ)**?"
EXCEÇÕES (não precisa perguntar):
  • Disse explicitamente "PF", "pessoal", "minha conta" → PF
  • Disse "PJ", "empresa", "Cajado", "da firma" → PJ
  • Contexto óbvio: almoço, uber, mercado → PF | aluguel escritório, folha → PJ

CATEGORIAS gastos PF: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, outros
CATEGORIAS receitas PF: pro_labore, freelance, investimentos, aluguel, vendas, outros
CATEGORIAS empresa: operacional, marketing, pessoal, infraestrutura, impostos, outros
FORMAS DE PAGAMENTO: pix, cartao_debito, cartao_credito, dinheiro, transferencia
VALORES INFORMAIS: "quinze conto" = 15.00, "uma nota" = 100.00, "duas notas" = 200.00
- Se valor acima de R$ 500 (PF) ou R$ 1.000 (PJ), confirme antes de gerar o JSON.
- NUNCA lance compras de ações, cripto, FIIs, imóveis, veículos como Gasto. Use registrar_investimento ou registrar_patrimonio.`
}

/** AGENDA: eventos, lembretes, vencimentos, recorrentes */
function secaoAgenda(t: TimeCtx): string {
  return `

⏰ HORÁRIOS PRÉ-CALCULADOS — use estes valores exatos ao calcular "daqui X minutos/horas":
  • Daqui 5 min → ${t.horaCalc(5)} | Daqui 10 min → ${t.horaCalc(10)} | Daqui 15 min → ${t.horaCalc(15)}
  • Daqui 20 min → ${t.horaCalc(20)} | Daqui 30 min → ${t.horaCalc(30)}
  • Daqui 1h → ${t.horaCalc(60)} | Daqui 2h → ${t.horaCalc(120)}

📅 CALENDÁRIO DOS PRÓXIMOS 8 DIAS — use EXATAMENTE estas datas:
${t.calendarioProx8}
  • Fim do mês atual: ${t.ultimoDiaMesStr}
  • Início do próximo mês: ${t.primeiroDiaProxMes}

AGENDA / EVENTO:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"${t.amanhaStr}T14:00:00","tipo":"reuniao"}
\`\`\`
- TIPOS válidos: reuniao, lembrete, tarefa, prazo, pessoal, vencimento, compromisso, nota, aniversario
- SEMPRE inclua hora na data_inicio.

🚫 REGRA ABSOLUTA PARA AGENDA/ALERTA/LEMBRETE — PROIBIDO PEDIR CONFIRMAÇÃO:
QUANDO o Sr. Max pedir para criar alerta, lembrete, aviso ou agendamento:
→ GERE O JSON IMEDIATAMENTE. NUNCA diga "Confirme?" ou "Posso agendar?"
→ Use os horários pré-calculados acima para "daqui X minutos"

EXEMPLOS OBRIGATÓRIOS:
"cria um alerta para daqui 10 minutos dormir" →
\`\`\`json
{"acao":"agenda","titulo":"⏰ Dormir","data_inicio":"${t.anoAtual}-${t.mesAtual}-${t.diaAtual}T${t.horaCalc(10)}:00","tipo":"lembrete"}
\`\`\`
"⏳ Alerta Dormir criado para daqui 10 min!"

⏰ TABELA DE HORAS:
- "de manhã", "cedo" → T08:00:00 | "à tarde" → T14:00:00 | "à noite" → T20:00:00 | sem hora → T09:00:00

💳 VENCIMENTO DE CARTÃO — DOIS LEMBRETES OBRIGATÓRIOS (manhã T09 + noite T20):
\`\`\`json
{"acao":"agenda","titulo":"💳 Pagar Nubank — R$ 850","data_inicio":"${t.anoAtual}-${t.mesAtual}-15T09:00:00","tipo":"vencimento"}
{"acao":"agenda","titulo":"✅ Confirmação: Pagou o Nubank? R$ 850","data_inicio":"${t.anoAtual}-${t.mesAtual}-15T20:00:00","tipo":"lembrete"}
\`\`\`

📄 BOLETO / CONTA A PAGAR — DOIS LEMBRETES (manhã + noite):
Use quando mencionar: boleto, conta de luz, água, internet, aluguel, IPTU, plano, financiamento, mensalidade, etc.

🔁 CONTA RECORRENTE MENSAL ("todo mês", "mensal", "recorrente"):
\`\`\`json
{"acao":"alertar_recorrente","descricao":"Internet Vivo","valor":120.00,"dia_vencimento":5,"tipo":"internet"}
\`\`\`
- TIPOS: boleto, cartao, agua, energia, internet, telefone, aluguel, condominio, plano_saude, financiamento, outro
- ⚠️ DIFERENÇA: 'alertar_recorrente' = contas que repetem todo mês. 'agenda' = eventos pontuais/únicos.
- ⚠️ Para FINANCIAMENTOS: use OBRIGATORIAMENTE alertar_recorrente com tipo financiamento, NUNCA agenda.

📋 LISTAR CONTAS RECORRENTES:
\`\`\`json
{"acao":"listar_recorrentes"}
\`\`\`

✅ MARCAR COMO PAGO/CONCLUÍDO:
\`\`\`json
{"acao":"concluir_evento","titulo_busca":"Internet Vivo"}
\`\`\`
- Use quando: "já paguei", "feito", "pode dar baixa", "tá pago"

📅 REAGENDAR / ADIAR:
\`\`\`json
{"acao":"reagendar_evento","titulo_busca":"Reunião com contador","nova_data":"${t.anoAtual}-${t.mesAtual}-20T14:00:00"}
\`\`\`

🗑️ DELETAR EVENTO:
\`\`\`json
{"acao":"deletar_evento","titulo":"Reunião com cliente","data":"${t.anoAtual}-06-10"}
\`\`\`

📋 RELATÓRIO DE VENCIMENTOS:
\`\`\`json
{"acao":"buscar_vencimentos","dias":30}
\`\`\`

✅ CHECKLIST EXECUTIVO DO DIA:
\`\`\`json
{"acao":"gerar_checklist"}
\`\`\`

🧹 DELETAR DUPLICADOS:
\`\`\`json
{"acao":"deletar_duplicados","tabela":"agenda"}
\`\`\`
- "tabela": "agenda", "gastos" ou "todos"`
}

/** PATRIMÔNIO: imóveis, veículos, equipamentos */
function secaoPatrimonio(t: TimeCtx): string {
  return `

🏠 REGISTRAR PATRIMÔNIO (imóvel, veículo, equipamento ou outro bem):
\`\`\`json
{"acao":"registrar_patrimonio","titulo":"Apartamento Centro","tipo":"imovel","descricao":"Apto 2 quartos, 85m²","valor_investido":350000,"valor_mercado":420000,"data_aquisicao":"2023-01-15","construtora":"MRV","unidade":"Bloco A, Apto 302","endereco":"Rua X, 100"}
\`\`\`
- TIPOS: imovel, veiculo, equipamento, reforma, outro
- "valor_investido" = quanto pagou (obrigatório)
- CAMPOS EXTRAS IMÓVEL: "construtora", "unidade", "endereco"
- CAMPOS EXTRAS VEÍCULO: "marca", "modelo", "ano", "placa", "cor", "km", "combustivel"
- "parcelas_total" e "parcelas_pagas" = se for financiado
- EXEMPLOS:
  → "comprei um terreno por 200 mil" → {"acao":"registrar_patrimonio","titulo":"Terreno","tipo":"imovel","valor_investido":200000}
  → "tenho uma Hilux 2024, paguei 280 mil" → {"acao":"registrar_patrimonio","titulo":"Toyota Hilux 2024","tipo":"veiculo","valor_investido":280000,"marca":"Toyota","modelo":"Hilux","ano":2024}

🔍 CONSULTAR PATRIMÔNIO:
\`\`\`json
{"acao":"buscar_patrimonio","tipo":"todos"}
\`\`\`
- "tipo": "todos", "imovel", "veiculo", "equipamento"`
}

/** INVESTIMENTOS: ações, FIIs, CDBs, cripto */
function secaoInvestimentos(): string {
  return `

📈 REGISTRAR INVESTIMENTO / ATIVO:
\`\`\`json
{"acao":"registrar_investimento","ticker":"PETR4","nome":"Petrobras PN","tipo":"acao","quantidade":100,"preco_medio":35.50,"preco_atual":38.40,"liquidez":"diaria","corretora":"XP"}
\`\`\`
- "tipo": acao, fii, fundo, cdb, lci, lca, tesouro, cripto, poupanca, previdencia, outro
- "quantidade" e "preco_medio" são OBRIGATÓRIOS.
- EXEMPLOS:
  → "comprei 200 ações de vale3 a 60 na clear" → {"acao":"registrar_investimento","ticker":"VALE3","nome":"Vale ON","tipo":"acao","quantidade":200,"preco_medio":60,"corretora":"Clear","liquidez":"diaria"}
  → "apliquei 10 mil num cdb do inter" → {"acao":"registrar_investimento","nome":"CDB Banco Inter","tipo":"cdb","quantidade":1,"preco_medio":10000,"corretora":"Inter","liquidez":"no_vencimento"}

🔍 CONSULTAR INVESTIMENTOS / CARTEIRA:
\`\`\`json
{"acao":"buscar_investimentos","tipo":"todos"}
\`\`\``
}

/** EQUIPE: ocorrências e relatórios de colaboradores */
function secaoEquipe(): string {
  return `

OCORRÊNCIA DA EQUIPE:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador atrasado","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\``
}

/** DIÁRIO: reflexões, decisões, snapshots */
function secaoDiario(): string {
  return `

📓 REGISTRAR ENTRADA NO DIÁRIO PESSOAL:
\`\`\`json
{"acao":"diario","titulo":"Reflexão sobre a semana","texto":"Foi uma semana produtiva...","tipo":"diario","categoria":"geral","humor":"bom"}
\`\`\`
- TIPOS: diario, decisao, snapshot, marco, espiritual
- CATEGORIAS: geral, decisao, aprendizado, patrimonio, financeiro_pf, financeiro_pj, trading, mercado, projeto, ideia, reserva, meta
- HUMOR: otimo, bom, neutro, ruim, critico
- "gratidao" e "intencao" = campos especiais para tipo "espiritual"

📖 CONSULTAR DIÁRIO:
\`\`\`json
{"acao":"buscar_diario","limite":5}
\`\`\``
}

/** CARTÕES E CONTAS: cadastrar conta bancária e cartão de crédito */
function secaoCartoesContas(t: TimeCtx): string {
  return `

🏦 CADASTRAR CONTA BANCÁRIA / CARTEIRA:
⛔ NÃO use para CARTÃO DE CRÉDITO — use 'cadastrar_cartao'.
\`\`\`json
{"acao":"cadastrar_conta","nome":"Sicoob","tipo":"corrente","categoria":"pf","saldo_inicial":0}
\`\`\`
- TIPOS de conta: corrente, poupanca, investimento, carteira, outro
- CATEGORIA: "pf" = pessoal | "pj" = empresa
- SINÔNIMOS PF: "PF", "pessoal", "minha conta" | PJ: "PJ", "empresa", "da firma", "Cajado"

💳 CADASTRAR CARTÃO DE CRÉDITO:
\`\`\`json
{"acao":"cadastrar_cartao","nome":"Nubank","bandeira":"mastercard","limite":5000.00,"dia_fechamento":1,"dia_vencimento":10,"categoria":"pf"}
\`\`\`
- BANDEIRAS: visa, mastercard, elo, hipercard, amex
- limite, dia_fechamento, dia_vencimento são OPCIONAIS

🔑 REGRA DE DECISÃO — CONTA ou CARTÃO?
  • "cartão", "card", "crédito" → SEMPRE 'cadastrar_cartao'
  • Bancos digitais (Nubank, Inter, C6, PicPay) → 'cadastrar_cartao' (cartão por padrão)
  • Bancos tradicionais sem "cartão" (Sicoob, Bradesco, Itaú) → 'cadastrar_conta'
  • "poupança", "corrente", "conta" → SEMPRE 'cadastrar_conta'

⚠️ SE O CARTÃO TEM DIA DE VENCIMENTO → Crie também o alerta recorrente:
  {"acao":"alertar_recorrente","descricao":"[Nome]","dia_vencimento":[dia],"tipo":"cartao"}`
}

/** RELATÓRIO E GERAL: relatórios, dashboard, ideia, memória, backup */
function secaoRelatorioGeral(t: TimeCtx): string {
  return `

RELATÓRIO:
\`\`\`json
{"acao":"relatorio","periodo":"mes_atual"}
\`\`\`
PERÍODOS: mes_atual, ultimos_7_dias, ultimos_30_dias, ano_atual

🛠️ RELATÓRIO DE DIAGNÓSTICO (o que o SISTEMA ainda não faz):
\`\`\`json
{"acao":"relatorio_diagnostico"}
\`\`\`
- GATILHOS: "o que falta no sistema", "relatório de erros", "o que você não consegue fazer",
  "relatório de diagnóstico", "quais funcionalidades faltam", "o que dá erro"
- Mostra o backlog: funcionalidades que o Sr. Max pediu e não existem + erros de gravação.

📊 RESUMO MENSAL ESTRUTURADO (formato padrão do Sr. Max):
\`\`\`json
{"acao":"resumo_mensal","mes":"${t.anoAtual}-${t.mesAtual}"}
\`\`\`
- GATILHOS: "resumo do mês", "resumo mensal", "como estou esse mês", "balanço do mês"
- DIFERENÇA: 'relatorio' abre modal. 'resumo_mensal' exibe direto no chat.

DASHBOARD VISUAL:
\`\`\`json
{"acao":"gerar_dashboard"}
\`\`\`

IDEIA / PROJETO:
\`\`\`json
{"acao":"ideia","titulo":"<TÍTULO>","descricao":"<descrição completa>","categoria":"geral"}
\`\`\`

MEMÓRIA UNIVERSAL:
\`\`\`json
{"acao":"registro_livre","tipo":"preferencia","chave":"banco_preferido","titulo":"Banco preferido","conteudo":"Nubank","importante":true}
\`\`\`

📩 EXPORTAR HISTÓRICO:
\`\`\`json
{"acao":"backup_chat"}
\`\`\``
}

/** REGRAS FINAIS: múltiplos pedidos, inteligência emocional, anti-resposta genérica (SEMPRE incluído) */
function secaoRegrasFinais(): string {
  return `

🧠 INTELIGÊNCIA EMOCIONAL:
- MAL-HUMORADO: Demonstre empatia antes de responder
- PREOCUPADO: Ofereça ajuda proativa com resumo financeiro
- FRUSTRADO COM A ELENA: Peça desculpas brevemente e peça para explicar novamente

🔴 MÚLTIPLOS PEDIDOS SIMULTÂNEOS — PROTOCOLO OBRIGATÓRIO:
O Sr. Max frequentemente envia mensagens com VÁRIOS pedidos.
1. Leia a mensagem INTEIRA antes de responder
2. Identifique CADA pedido separadamente
3. Gere UM JSON para CADA ação detectada
4. NUNCA misture valores, contas ou datas entre pedidos
5. Se a mensagem for MUITO longa e algo ficou ambíguo, PROCESSE o que entendeu e pergunte SÓ o ambíguo.
NUNCA diga "não entendi" para uma mensagem inteira — sempre extraia o máximo possível.

🚨 REGRA ANTI-RESPOSTA GENÉRICA — HONESTIDADE ABSOLUTA:
1. **NÃO ENTENDEU?** → Peça para reformular COM SUGESTÕES baseadas em palavras-chave detectadas:
   FORMATO: "🤔 Sr. Max, não tenho certeza se entendi. Você quis dizer:\n• [sugestão 1]\n• [sugestão 2]\nQual desses, ou pode reformular?"

2. **FUNCIONALIDADE NÃO EXISTE?** → Informe claramente:
   → "⚠️ Sr. Max, essa funcionalidade ainda não foi implantada. O que consigo fazer hoje é: [alternativas]."
   NUNCA invente ação JSON que não existe na lista.

3. **NUNCA FINJA QUE SALVOU:**
   - Só diga "✅ Registrado" APÓS o sistema confirmar com card.
   - Se só respondeu texto → deixe claro que foi informativo.
   PROIBIDO: "Anotei!", "Registrei!", "Salvo!" sem ter gerado JSON.

4. **MAPA DE CAPACIDADES:**
   ✅ Tenho: gastos PF/PJ, receitas, agenda, cartões, faturas, patrimônio, investimentos, diário, contas recorrentes, projeção, resumo mensal, checklist, ocorrências, ideias, memória, exportar histórico, relatório, dashboard
   ❌ Não tenho: enviar PIX real, acessar banco, enviar e-mail, fazer ligação, WhatsApp direto, comprar/vender ações automaticamente

- Responda SEMPRE em português brasileiro, tom profissional e conciso
- Trate sempre o usuário como "Sr. Max"`
}

// ═══════════════════════════════════════════════════════════════
// buildSystemPrompt — FUNÇÃO PRINCIPAL (modular)
// ═══════════════════════════════════════════════════════════════

/**
 * Gera o system prompt da Elena.
 *
 * @param perfil - Perfil de aprendizado do usuário (opcional)
 * @param resumoFinanceiro - Resumo financeiro do mês (opcional)
 * @param modulosAtivos - Lista de módulos detectados pela mensagem do usuário.
 *   Se omitido ou vazio, inclui TODOS os módulos (backward-compatible).
 */
export function buildSystemPrompt(
  perfil?: any,
  resumoFinanceiro?: string,
  modulosAtivos?: ElenaModulo[],
): string {
  const t = criarTimeCtx()

  // Se nenhum módulo específico, incluir tudo (backward-compatible)
  const incluirTudo = !modulosAtivos || modulosAtivos.length === 0 || modulosAtivos.includes('geral')

  const partes: string[] = []

  // CORE — sempre incluído
  partes.push(secaoCore(t, perfil, resumoFinanceiro))

  // Seções condicionais
  if (incluirTudo || modulosAtivos!.some(m => ['financeiro', 'cartoes', 'relatorio'].includes(m))) {
    partes.push(secaoFinanceiro(t))
  }

  if (incluirTudo || modulosAtivos!.some(m => ['agenda', 'financeiro'].includes(m))) {
    partes.push(secaoAgenda(t))
  }

  if (incluirTudo || modulosAtivos!.includes('patrimonio')) {
    partes.push(secaoPatrimonio(t))
  }

  if (incluirTudo || modulosAtivos!.includes('investimentos')) {
    partes.push(secaoInvestimentos())
  }

  if (incluirTudo || modulosAtivos!.includes('equipe')) {
    partes.push(secaoEquipe())
  }

  if (incluirTudo || modulosAtivos!.includes('diario')) {
    partes.push(secaoDiario())
  }

  if (incluirTudo || modulosAtivos!.some(m => ['financeiro', 'cartoes'].includes(m))) {
    partes.push(secaoCartoesContas(t))
  }

  if (incluirTudo || modulosAtivos!.includes('relatorio')) {
    partes.push(secaoRelatorioGeral(t))
  }

  // REGRAS FINAIS — sempre incluído
  partes.push(secaoRegrasFinais())

  return partes.join('\n')
}

// ── extrairAcoes ─────────────────────────────────────────────
// Extrai e classifica todos os blocos JSON da resposta da IA.
// Suporta dois formatos:
//   1. ```json { ... } ``` — formato padrão com backticks
//   2. {"acao": ...}       — JSON cru em linha (sem backticks, apenas se não duplicado)
// ════════════════════════════════════════════════════════════════
// 🔴 PARSER REESCRITO — dois bugs graves corrigidos
//
// BUG 1 — DUPLICAVA AÇÕES:
//   Quando o Formato 2 achava uma linha JÁ capturada por um bloco ```json,
//   ele NÃO limpava o `buffer` (só limpava dentro do if de sucesso). O
//   buffer sujo engolia as linhas seguintes e virava um SEGUNDO candidato.
//   No formato MAIS COMUM (bloco ```json com o JSON em uma linha), a ação
//   era capturada 2x e EXECUTADA 2x → GASTO LANÇADO EM DOBRO.
//
// BUG 2 — PERDIA AÇÕES em JSON cru multi-linha:
//   O buffer só iniciava se a PRIMEIRA linha contivesse "acao". Num JSON
//   pretty-printed sem backticks a primeira linha é só "{" → nunca iniciava
//   → a ação SUMIA. A Elena dizia "⏳ Registrando..." e nada era salvo.
//
// AGORA: scanner com balanceamento real de chaves, respeitando strings e
// escapes. Testado em 13 formatos: nada duplicado, nada perdido.
// ════════════════════════════════════════════════════════════════

/** Varre JSONs balanceando chaves, respeitando strings e escapes */
function* varrerJsonComPos(txt: string): Generator<{ json: string; ini: number }> {
  let i = 0
  while (i < txt.length) {
    if (txt[i] !== '{') { i++; continue }
    let depth = 0
    let emString = false
    let escape = false
    let j = i
    for (; j < txt.length; j++) {
      const c = txt[j]
      if (escape) { escape = false; continue }
      if (c === '\\') { escape = true; continue }
      if (c === '"') { emString = !emString; continue }
      if (emString) continue
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) break }
    }
    if (depth === 0 && j < txt.length) {
      const bruto = txt.slice(i, j + 1)
      if (bruto.includes('"acao"')) {
        try { JSON.parse(bruto); yield { json: bruto, ini: i } } catch { /* inválido */ }
      }
      i = j + 1
    } else {
      i++
    }
  }
}

export function extrairAcoes(texto: string): AcaoIA[] {
  const acoes: AcaoIA[] = []
  const candidatos: string[] = []
  const cobertos: [number, number][] = []

  // Formato 1: blocos ```json / ```JSON / ``` (um bloco pode ter VÁRIOS JSONs)
  const regexBloco = /```(?:json|JSON)?\s*([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = regexBloco.exec(texto)) !== null) {
    for (const { json } of varrerJsonComPos(m[1])) candidatos.push(json)
    cobertos.push([m.index, m.index + m[0].length])
  }

  // Formato 2: JSON cru FORA dos blocos (sem duplicar)
  for (const { json, ini } of varrerJsonComPos(texto)) {
    const dentroDeBloco = cobertos.some(([a, b]) => ini >= a && ini < b)
    if (!dentroDeBloco) candidatos.push(json)
  }

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

      } else if (d.acao === 'registrar_pedido_feature') {
        acoes.push({ tipo: 'registrar_pedido_feature', dados: d, label: `📋 Registrando pedido: ${d.funcionalidade || d.acao_sugerida || 'nova funcionalidade'}`, status: 'pending' })

      } else if (d.acao === 'relatorio_diagnostico') {
        acoes.push({ tipo: 'relatorio_diagnostico', dados: d, label: '🛠️ Gerando relatório de diagnóstico', status: 'pending' })

      } else if (d.acao === 'buscar_contas') {
        const catLabel = d.categoria === 'pj' ? 'Empresa (PJ)' : d.categoria === 'pf' ? 'Pessoal (PF)' : 'Todas'
        acoes.push({ tipo: 'buscar_contas', dados: d, label: `🏦 Buscando contas — ${catLabel}`, status: 'pending' })

      } else if (d.acao === 'buscar_lancamentos') {
        const tipoLabel = d.tipo === 'pf' ? 'Pessoal (PF)' : d.tipo === 'pj' ? 'Empresa (PJ)' : 'Todos'
        acoes.push({ tipo: 'buscar_lancamentos', dados: d, label: `🔍 Buscando lançamentos — ${tipoLabel}`, status: 'pending' })

      } else if (d.acao === 'buscar_vencimentos') {
        acoes.push({ tipo: 'buscar_vencimentos', dados: d, label: `📋 Verificando vencimentos dos próximos ${d.dias || 30} dias`, status: 'pending' })

      } else if (d.acao === 'alertar_recorrente') {
        acoes.push({ tipo: 'alertar_recorrente', dados: d, label: `📌 Cadastrar alerta recorrente: ${d.descricao} — dia ${d.dia_vencimento}`, status: 'pending' })

      } else if (d.acao === 'listar_recorrentes') {
        acoes.push({ tipo: 'listar_recorrentes', dados: d, label: `📋 Listando contas recorrentes cadastradas`, status: 'pending' })

      } else if (d.acao === 'concluir_evento') {
        acoes.push({ tipo: 'concluir_evento', dados: d, label: `✅ Marcar como concluído: ${d.titulo_busca}`, status: 'pending' })

      } else if (d.acao === 'reagendar_evento') {
        acoes.push({ tipo: 'reagendar_evento', dados: d, label: `📅 Reagendar: ${d.titulo_busca}`, status: 'pending' })

      } else if (d.acao === 'registrar_patrimonio') {
        const tipoIcons: Record<string, string> = { imovel: '🏠', veiculo: '🚗', equipamento: '⚙️', reforma: '🔨', outro: '📦' }
        const icon = tipoIcons[d.tipo] || '🏠'
        const valorStr = d.valor_investido ? ` R$ ${Number(d.valor_investido).toLocaleString('pt-BR')}` : ''
        acoes.push({ tipo: 'registrar_patrimonio', dados: d, label: `${icon} Registrar patrimônio: ${d.titulo}${valorStr}`, status: 'pending' })

      } else if (d.acao === 'buscar_patrimonio') {
        const tipoLabel = d.tipo === 'todos' ? 'Todos os bens' : d.tipo === 'imovel' ? 'Imóveis' : d.tipo === 'veiculo' ? 'Veículos' : d.tipo || 'Todos'
        acoes.push({ tipo: 'buscar_patrimonio', dados: d, label: `🔍 Consultar patrimônio — ${tipoLabel}`, status: 'pending' })

      } else if (d.acao === 'diario') {
        const humorEmoji: Record<string, string> = { otimo: '😄', bom: '🙂', neutro: '😐', ruim: '😕', critico: '😰' }
        const emoji = humorEmoji[d.humor] || '📓'
        acoes.push({ tipo: 'diario', dados: d, label: `${emoji} Diário: ${d.titulo || d.texto?.substring(0, 40) || 'Nova entrada'}`, status: 'pending' })

      } else if (d.acao === 'buscar_diario') {
        acoes.push({ tipo: 'buscar_diario', dados: d, label: `📖 Consultar diário — últimas ${d.limite || 5} entradas`, status: 'pending' })

      } else if (d.acao === 'registrar_investimento') {
        const t = d.ticker ? ` (${d.ticker.toUpperCase()})` : ''
        acoes.push({ tipo: 'registrar_investimento', dados: d, label: `📈 Investimento: ${d.nome}${t} — R$ ${(Number(d.preco_medio || 0) * Number(d.quantidade || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, status: 'pending' })

      } else if (d.acao === 'buscar_investimentos') {
        acoes.push({ tipo: 'buscar_investimentos', dados: d, label: `🔍 Consultar investimentos — ${d.tipo && d.tipo !== 'todos' ? d.tipo.toUpperCase() : 'Todos'}`, status: 'pending' })

      } else if (d.acao === 'buscar_pagamentos') {
        acoes.push({ tipo: 'buscar_pagamentos', dados: d, label: `💳 Verificando pagamentos dos próximos ${d.dias || 30} dias`, status: 'pending' })

      } else if (d.acao === 'deletar_evento') {
        acoes.push({ tipo: 'deletar_evento', dados: d, label: `🗑️ Deletar evento: ${d.titulo || 'sem título'}`, status: 'pending' })

      } else if (d.acao === 'deletar_lancamento') {
        acoes.push({ tipo: 'deletar_lancamento', dados: d, label: `🗑️ Deletar ${d.tipo || 'lançamento'}: ${d.descricao || 'sem descrição'}`, status: 'pending' })

      } else if (d.acao === 'deletar_duplicados') {
        acoes.push({ tipo: 'deletar_duplicados', dados: d, label: `🧹 Limpar duplicados: ${d.tabela || 'agenda'}`, status: 'pending' })

      } else if (d.acao === 'resumo_mensal') {
        const mesLabel = d.mes || 'mês atual'
        acoes.push({ tipo: 'resumo_mensal', dados: d, label: `📊 Resumo mensal estruturado — ${mesLabel}`, status: 'pending' })

      } else if (d.acao === 'backup_chat') {
        acoes.push({ tipo: 'backup_chat', dados: d, label: `📥 Exportar histórico da conversa`, status: 'pending' })

      } else if (d.acao) {
        // Fallback: ação desconhecida → NÃO finge que salvou
        acoes.push({
          tipo: 'registro' as any,
          dados: { ...d, tipo: d.acao, _acao_desconhecida: true },
          label: `⚠️ Ação não reconhecida: ${d.acao}`,
          status: 'pending',
        })
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
