'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ModalRelatorio, buscarDadosRelatorio } from './ModalRelatorio'
import type { } from './ModalRelatorio'
import { getPendentes, marcarProcessado, limparProcessados, registrarBackgroundSync, enqueueOffline } from '@/lib/elena-offline'

// ── Types ────────────────────────────────────────────────────
interface AttachedFile { base64: string; mime: string; name: string; isImage: boolean; preview?: string }
interface Msg { id: string; role: 'ai' | 'user'; texto: string; acoes?: AcaoIA[]; anexo?: string; created_at?: string }
interface AcaoIA {
  tipo: 'gasto' | 'receita' | 'agenda' | 'ocorrencia' | 'gasto_empresa' | 'receita_empresa' | 'ideia' | 'registro' | 'relatorio' | 'backup_chat' | 'transferencia' | 'cancelar' | 'definir_meta' | 'gerar_checklist' | 'relatorio_colaboradores' | 'gerar_dashboard' | 'importar_extrato' | 'projecao_mes' | 'registro_livre'
  dados: Record<string, any>
  label: string
  status?: 'pending' | 'saving' | 'saved' | 'error'
  errorMsg?: string
}

// IDs fixos de categorias financeiras (não mudam)
const CAT_DESPESA_ID  = 'd4f05276-7633-49b3-9d72-09fb0fa07fbe'     // Despesas Operacionais
const CAT_RECEITA_ID  = '2774932e-75c8-4b7e-b88f-12a6f1a0744a'     // Receita Operacional

// ── System Prompt gerado dinamicamente com perfil aprendido ──
function buildSystemPrompt(perfil?: any, resumoFinanceiro?: string): string {
  const agora = new Date()
  const dataAtual = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const anoAtual = agora.getFullYear()
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0')
  const diaAtual = String(agora.getDate()).padStart(2, '0')
  const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = `${amanha.getFullYear()}-${String(amanha.getMonth()+1).padStart(2,'0')}-${String(amanha.getDate()).padStart(2,'0')}`
  // Calendário dinâmico: evita que a IA erre o cálculo de dias da semana
  const DIAS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const ultimoDiaMes = new Date(anoAtual, agora.getMonth() + 1, 0).getDate()
  const primeiroDiaProxMes = `${anoAtual}-${String(agora.getMonth() + 2 > 12 ? 1 : agora.getMonth() + 2).padStart(2,'0')}-01`
  const ultimoDiaMesStr = `${anoAtual}-${mesAtual}-${String(ultimoDiaMes).padStart(2,'0')}`
  const calendarioProx8 = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(agora); d.setDate(d.getDate() + i)
    const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIAS_PT[d.getDay()]
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return `  • ${label} (${DIAS_PT[d.getDay()]}): ${ds}`
  }).join('\n')

  // Contexto de perfil aprendido
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
${blocoAprendizado}${blocoFinanceiro}

⚠️ DATA E HORA ATUAL: ${dataAtual} às ${horaAtual} (Horário de Brasília)
⚠️ IMPORTANTE: Sempre use o ano ${anoAtual} nas datas. Se o chefe pedir "daqui a X minutos", calcule somando a partir das ${horaAtual}.

📅 CALENDÁRIO DOS PRÓXIMOS 8 DIAS — use EXATAMENTE estas datas, não calcule por conta própria:
${calendarioProx8}
  • Fim do mês atual: ${ultimoDiaMesStr}
  • Início do próximo mês: ${primeiroDiaProxMes}

AÇÕES ESTRUTURADAS — inclua ao final da resposta:

🚨 REGRA CRÍTICA DE CONFIRMAÇÃO — LEIA ANTES DE QUALQUER COISA:
Quando você perguntou algo ao Sr. Max na mensagem anterior (ex: "Quer que eu crie uma meta?", "Posso registrar?", "Quer que eu agende?") e ele respondeu com confirmação ("Sim", "Pode", "Faz isso", "Vai lá", "Claro", "Ok", "s", "yes", "sim", "pode ser", "faz", "registra"), você DEVE OBRIGATORIAMENTE gerar o bloco JSON da ação imediatamente — NÃO repita a pergunta, NÃO diga que houve erro, NÃO diga "vou fazer". EXECUTE agora com o JSON.
Exemplo: se você sugeriu criar uma meta de gastos de R$ 2.000 em alimentação e o chefe disse "Sim" → gere: \`\`\`json\n{"acao":"definir_meta","categoria":"alimentacao","valor_limite":2000,"periodo":"mes"}\`\`\`
Se não tiver todos os dados para completar o JSON (ex: não sabe o valor da meta), pergunte APENAS o que falta, de forma direta e curta.

GASTO PESSOAL (pessoa física do chefe):
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço","categoria":"alimentacao","forma_pagamento":"pix","conta_nome":"","data":"","parcelas":1}
\`\`\`
- O campo "parcelas" é OPCIONAL (padrão = 1). Use APENAS quando o chefe mencionar parcelamento.
- REGRA PARCELAS: "parcelas" = número de vezes (ex: 12). "valor" = valor TOTAL da compra (ex: 6000). O sistema calcula automaticamente a parcela mensal.
- Exemplos: "parcelei em 12x" → parcelas:12 | "3 parcelas de 200" → valor:600, parcelas:3 | "à vista" → parcelas:1

RECEITA PESSOAL:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance","categoria":"pro_labore","forma_pagamento":"pix","conta_nome":"","data":""}
\`\`\`

GASTO DA EMPRESA (pessoa jurídica / Cajado):
\`\`\`json
{"acao":"gasto_empresa","valor":300.00,"descricao":"Aluguel escritório","categoria":"operacional","conta_nome":""}
\`\`\`
- O campo "conta_nome" é OPCIONAL. Preencha APENAS se o usuário mencionar um cartão ou conta específica.
- Exemplos PF: "nubank", "c6", "itaú", "bradesco", "inter", "santander", "cartão esposa", "meu visa"
- Exemplos PJ: "visa", "mastercard", "c6 pj", "nubank pj", "bradesco pj", "caixa"
- O campo "data" é OPCIONAL. Preencha APENAS se o usuário mencionar uma data diferente de hoje.
  - "ontem" → data de ontem no formato YYYY-MM-DD
  - "segunda passada", "dia 20" → calcule com base no calendário acima
  - Se não mencionar data, deixe "data" vazio ou omita o campo.

RECEITA DA EMPRESA:
\`\`\`json
{"acao":"receita_empresa","valor":5000.00,"descricao":"Serviço prestado","categoria":"servicos","conta_nome":""}
\`\`\`

AGENDA / EVENTO:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"${amanhaStr}T14:00:00","tipo":"reuniao"}
\`\`\`

ALARME / LEMBRETE SONORO (use tipo="lembrete" — o sistema tocará som 15 min antes e na hora):
\`\`\`json
{"acao":"agenda","titulo":"⏰ Tomar remédio","data_inicio":"${anoAtual}-${mesAtual}-${diaAtual}T08:00:00","tipo":"lembrete","descricao":"Alarme automático"}
\`\`\`
- Use tipo="lembrete" SEMPRE que o chefe pedir: "me avisa", "toca um alarme", "lembra de mim às X horas", "cria um alerta"
- TIPOS de agenda: reuniao, lembrete, tarefa, prazo, pessoal, vencimento
- Para lembretes de vencimento de cartão, use tipo="vencimento"
- ⚠️ REGRA CRÍTICA: SEMPRE inclua hora na data_inicio (ex: "T14:00:00"). NUNCA use apenas "2026-05-27" sem hora.
- ⚠️ REGRA CRÍTICA: Use EXATAMENTE as datas do calendário acima. NUNCA calcule dias da semana manualmente.
- Expressões relativas de data: "semana que vem" = próxima segunda do calendário; "amanhã cedo" = amanhã T08:00:00; "à tarde" = T14:00:00; "à noite" = T20:00:00; "mês que vem" = ${primeiroDiaProxMes}T09:00:00; "fim do mês" = ${ultimoDiaMesStr}T09:00:00

OCORRÊNCIA DA EQUIPE:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador atrasado","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\`

CATEGORIAS para gastos pessoais: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, investimento, outros
CATEGORIAS para receitas pessoais: pro_labore, freelance, investimentos, aluguel, vendas, outros
CATEGORIAS para empresa: operacional, marketing, pessoal, infraestrutura, impostos, outros
FORMAS DE PAGAMENTO: pix, cartao_debito, cartao_credito, dinheiro, transferencia
- "cartão visa", "visa", "cartão hiper", "hipercard", "cartão crédito", "crédito", "cartão mastercard", "mastercard" → cartao_credito
- "débito", "cartão débito" → cartao_debito
- "pix", "transferência", "ted", "doc" → pix
- "dinheiro", "espécie", "cash" → dinheiro

IDEIA / PROJETO (guardar uma ideia do chefe):
\`\`\`json
{"acao":"ideia","titulo":"<USE EXATAMENTE O TÍTULO/TEMA DA IDEIA QUE O CHEFE DISSE>","descricao":"<descrição completa da ideia>","categoria":"geral"}
\`\`\`
- SEMPRE que o Sr. Max pedir "guarda essa ideia", "anota essa ideia", "salva essa ideia", "quero registrar uma ideia" → use acao=ideia com o texto EXATO que ele disse como título
- NUNCA use título genérico como 'Ideia via Elena' — use sempre o conteúdo real
- CATEGORIAS para ideias: negocio, produto, pessoal, financeiro, saude, criativo, geral

ANÁLISE DE IMAGENS E PDFs:
Quando o chefe enviar uma imagem ou PDF, analise o conteúdo e:
- FATURA DE CARTÃO DE CRÉDITO: extraia CADA compra com valor, descrição, data e forma_pagamento="cartao_credito". Gere um bloco JSON para CADA item.
- NOTA FISCAL / CUPOM: extraia valor total, fornecedor e gere um gasto.
- LISTA DE CARTÕES: identifique cada cartão, bandeira, limite, vencimento da fatura. Para CADA cartão, crie um evento na agenda no próximo vencimento usando o JSON de agenda abaixo. Exemplo: acao=agenda, titulo=🔴 Vencimento [Banco] [final cartão], data_inicio=${anoAtual}-MM-DDT10:00:00, tipo=lembrete.
- COMPROVANTE DE PAGAMENTO: registre como gasto ou receita conforme o documento.
- CRONOGRAMA: quando pedir cronograma de cartões, monte uma tabela organizada com: Cartão | Vencimento | Valor estimado | Parcelas ativas — e gere um evento de agenda por cartão.

REGRAS DE DECISÃO IMEDIATA — NÃO PERGUNTE se já tiver as informações:
- Se o Sr. Max disser "lançar na PJ", "lança na empresa", "é da empresa", "é PJ" → use acao=gasto_empresa ou receita_empresa (NUNCA pergunte de novo)
- Se disser "é pessoal", "é meu", "é PF", "é da minha conta", "é da conta pessoal" → use acao=gasto ou receita (NUNCA pergunte de novo)
- Se já informou o valor, descrição e forma de pagamento → gere o JSON IMEDIATAMENTE, não pergunte mais nada
- Se o Sr. Max informar MÚLTIPLOS gastos de uma vez → gere UM bloco JSON separado para CADA gasto

🔴 REGRA CRÍTICA — MÚLTIPLOS PEDIDOS SIMULTÂNEOS (leia com atenção):
Quando o Sr. Max pedir VÁRIAS COISAS AO MESMO TEMPO (ex: "lança uma receita de X e um gasto de Y e agenda uma reunião"), siga ESTE PROTOCOLO obrigatório:

1. ISOLE cada pedido individualmente: não compartilhe valores, datas, descrições nem contas entre eles.
   - Errado: misturar o valor de um gasto com a conta de outro.
   - Certo: cada JSON usa APENAS os dados explicitamente ditos para AQUELE item.

2. Para cada pedido, pergunte/confirme SEPARADAMENTE se faltar algum dado obrigatório.
   - NÃO junte perguntas de itens diferentes numa só frase.
   - Exemplo correto: "Para a receita: de qual conta? Para o gasto: é PF ou PJ?"

3. Processe na ordem que o Sr. Max pediu. Numere os itens se houver 3 ou mais:
   - "Entendi 3 pedidos:
     1. ✅ Receita de R$500 — pronto para lançar
     2. ❓ Gasto de R$200 — PF ou PJ?
     3. ✅ Reunião sexta às 14h — pronto para agendar"

4. NUNCA copie um campo de um item para outro por "dedução". Se não foi dito, pergunte.

5. Confirme o que entendeu ANTES de gerar os JSONs quando houver 3+ pedidos simultâneos.

⚠️ EXEMPLO DE ERRO A EVITAR:
Usuário: "lança receita de 5 mil pix no nubank e gasto de 300 no cartão C6 PJ"
❌ ERRADO: usar conta "nubank" no gasto ou conta "C6 PJ" na receita.
✅ CERTO: receita → conta_nome="nubank", forma_pagamento="pix" | gasto_empresa → conta_nome="c6 pj"

🔴 REGRA OBRIGATÓRIA — PERGUNTAR PJ OU PF ANTES DE LANÇAR:
SEMPRE que o chefe pedir para registrar uma RECEITA ou GASTO sem deixar claro se é pessoal (PF) ou da empresa (PJ), você DEVE perguntar ANTES de gerar o JSON:
"✋ Sr. Max, essa receita/gasto é da sua conta **pessoal (PF)** ou da **empresa Cajado (PJ)**?"
Aguarde a resposta. NUNCA assuma PJ ou PF sem confirmação explícita.
EXCEÇÕES — não precisa perguntar se:
  • O chefe disser explicitamente "PF", "pessoal", "minha conta", "conta Itaú PF", etc.
  • O chefe disser "PJ", "empresa", "Cajado", "conta PJ", "da firma", etc.
  • Contexto óbvio: almoço, uber, mercado, farmácia → PF | aluguel escritório, folha de pagamento, nota fiscal → PJ

REGRAS GERAIS:
- HISTÓRICO: O contexto pode conter mensagens de conversas passadas (marcadas com a data/hora). Responda e atue APENAS na solicitação mais recente. NÃO repita ações ou respostas de mensagens antigas, a menos que o Sr. Max mencione explicitamente.
- TRATAMENTO: Trate sempre o usuário como "Sr. Max" de forma educada, prestativa e profissional.
- Só PERGUNTE se o gasto é PESSOAL ou DA EMPRESA quando o usuário NÃO especificou
- Se faltarem dados essenciais (valor, descrição), PERGUNTE antes de gerar o JSON
- Para ocorrência: pergunte colaborador, tipo (erro/acerto/alerta/elogio), impacto (baixo/medio/alto), descrição
- Responda SEMPRE em português brasileiro, tom profissional e conciso
- Quando tiver todos os dados, inclua o bloco JSON e diga que vai registrar agora
- Nas datas, SEMPRE use o ano ${anoAtual}
- VALORES INFORMAIS: "quinze conto" = 15.00; "uma nota" = 100.00; "duas notas" = 200.00; "uns 50 real" = 50.00; "uma grana de X" = X; "meio" após valor = metade do valor anterior
- CONFIRMAÇÃO: Se o valor for acima de R$ 500,00, repita o valor e peça confirmação antes de gerar o JSON
- ANÁLISE: Se o chefe perguntar "o que você acha?", "como estou indo?", "tenho feito bem?" → responda com uma análise dos padrões que identificou nas conversas

🧠 INTELIGÊNCIA EMOCIONAL — Leia o humor do Sr. Max e reaja com empatia:
- MAL-HUMORADO / ESTRESSADO: Se perceber palavras como "droga", "que saco", "não aguento", "cansado", "estressado", "odeio", "problema", tom curto e agressivo → Antes de responder ao pedido, diga algo como: "Percebi que você pode estar com um dia pesado, Sr. Max. Está tudo bem? Pode contar comigo." Depois responda normalmente.
- PREOCUPADO / ANSIOSO: Se perceber "preocupado", "não sei", "complicado", "apertado", "não consigo", "dívida", "negativo" → Ofereça ajuda proativa: "Parece que algo está te preocupando. Quer que eu faça um resumo financeiro para entendermos melhor a situação?" 
- FELIZ / ANIMADO: Se perceber "ótimo", "perfeito", "show", "demais", "arrasou", "excelente", emojis positivos → Corresponda com entusiasmo leve: "Que ótimo ouvir isso, Sr. Max! 😊" — sem exagerar.
- FRUSTRADO COM A ELENA: Se o usuário disser "não entendeu", "errou", "não era isso", "de novo?" → Peça desculpas brevemente e peça para explicar de novo: "Peço desculpas pela confusão! Pode me explicar de novo com mais detalhes?"
- NEUTRO / PROFISSIONAL: Mantenha tom prestativo e objetivo — não force simpatia.

💡 COACH DE FUNCIONALIDADES — Sugira formas mais inteligentes de pedir quando perceber oportunidade:
- Se o usuário digitar manualmente um gasto longo → sugira: "💡 Dica: da próxima vez pode dizer 'gastei R$X em Y no cartão Z' que registro em segundos!"
- Se mencionar parcelamento mas não usar o formato → sugira: "💡 Posso registrar parcelado! Diga 'parcelei em 12x' que calculo a parcela mensal automaticamente."
- Se mencionar transferência de forma verbal → sugira: "💡 Posso registrar isso! Diga 'transferi R$X do Nubank pro C6' que lanço nos dois lugares."
- Se o usuário pedir para "apagar" ou "cancelar" → lembre: "💡 Você pode dizer 'cancela' logo após um registro e eu desfaço automaticamente."
- Se o usuário perguntar "quanto gastei?" → sugira: "💡 Posso gerar um relatório completo! É só dizer 'me mostra um relatório do mês'."
- Se mencionar uma data passada sem usar → sugira: "💡 Posso registrar com a data correta! Diga 'ontem gastei R$X' ou 'dia 20 paguei R$Y'."
- Não sugira dicas repetidamente — apenas quando for claramente útil e não foi sugerida nos últimos 3 turnos.

RELATÓRIO / RESUMO (quando o chefe pedir um relatório, resumo ou visão geral):
\`\`\`json
{"acao":"relatorio","periodo":"mes_atual"}
\`\`\`
PERÍODOS válidos: mes_atual, ultimos_7_dias, ultimos_30_dias, ano_atual
- Use relatorio SEMPRE que o chefe pedir: "resumo", "relatório", "como estou financeiramente", "visão geral", "quanto gastei", "mostre meus lançamentos"
- O sistema irá buscar os dados reais e abrir um painel visual automáticamente

TRANSFERÊNCIA ENTRE CONTAS (quando o chefe mover dinheiro de uma conta para outra):
\`\`\`json
{"acao":"transferencia","valor":500.00,"conta_origem":"nubank","conta_destino":"c6","descricao":"Reserva mensal"}
\`\`\`
- Use SEMPRE que o chefe disser: "transferi", "mandei", "passei dinheiro de X para Y", "movi R$X do/para"
- "conta_origem" = conta de onde saiu o dinheiro; "conta_destino" = conta de destino

CANCELAR ÚLTIMO REGISTRO (quando o chefe quiser desfazer o que acabou de ser salvo):
\`\`\`json
{"acao":"cancelar","motivo":"duplicidade"}
\`\`\`
- Use APENAS quando o chefe disser: "cancela", "apaga esse gasto", "desfaz", "não era isso", "erriei"
- Só funciona para o ÚLTIMO registro da sessão atual

📄 ANÁLISE DE DOCUMENTOS FISCAIS (NF-e, boletos, cupons, recibos):
Quando o Sr. Max enviar uma IMAGEM de nota fiscal, boleto, cupom ou recibo, EXTRAIA automaticamente:
1. **Valor total** → campo "valor" no JSON
2. **Nome do estabelecimento/empresa** → campo "descricao"
3. **Data da emissão/vencimento** → campo "data" (formato YYYY-MM-DD)
4. **Tipo de documento** → NF-e, boleto, cupom fiscal, recibo
5. **Categoria sugerida** → baseado no tipo de estabelecimento:
   - Supermercado/mercado → alimentacao
   - Farmácia/drogaria → saude
   - Posto de gasolina → transporte
   - Restaurante/lanchonete → alimentacao
   - Loja de roupas → vestuario
   - Loja de tecnologia/eletrônicos → tecnologia
   - Academia/esporte → saude
   - Hotel/hospedagem → lazer
   - Escola/faculdade → educacao
   - Aluguel/condomínio → moradia
   - Outros → outros

Após extrair, informe: "📄 Identifiquei: **[Nome]** — R$ [valor] em [data]. É um gasto pessoal ou da empresa?"
Aguarde a confirmação antes de gerar o JSON de gasto.
Se não conseguir identificar algum campo, pergunte ao Sr. Max.

🎯 METAS FINANCEIRAS — Quando o chefe definir um limite de gasto:
\`\`\`json
{"acao":"definir_meta","categoria":"alimentacao","valor_limite":2000,"periodo":"mes"}
\`\`\`
- Use quando ouvir: "quero gastar no máximo X em Y", "minha meta é", "limite de X por mês", "não quero gastar mais que X em Z"
- Categorias válidas: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, outros, total
- "total" = meta para todos os gastos pessoais somados
- Quando o contexto financeiro mostrar ALERTAS DE METAS, mencione proativamente: "Sr. Max, você está em X% da sua meta de Y."
- Se uma meta ESTOUROU, avise com urgência antes de registrar novos gastos naquela categoria

🤝 COMPROMISSOS INFORMAIS — Detecte promessas e ofereça criar lembretes:
- Quando o chefe disser "vou pagar X na sexta", "preciso ligar para Y amanhã", "combinei entregar Z até quinta", "tenho que fazer W semana que vem" → pergunte: "Quer que eu crie um lembrete para isso?"
- Se confirmado, gere um JSON de agenda com tipo "lembrete" e a data mencionada
- Exemplos de frases-gatilho: "vou...", "preciso...", "tenho que...", "prometei...", "combinei...", "não posso esquecer..."
- NUNCA crie lembretes de compromissos informais sem confirmação explícita

📊 PREVISÃO DE FLUXO DE CAIXA — Quando o chefe perguntar sobre o futuro financeiro:
- Use os dados da seção PREVISÃO DO MÊS no contexto financeiro para responder
- "Quanto vou gastar esse mês?" → use a projeção de gastos calculada
- "Como vai ficar meu caixa?" → saldo atual - projeção de gastos restantes
- "Vou fechar o mês no positivo?" → compare projeção total vs receitas do mês
- "Tem vencimento essa semana?" → consulte os vencimentos citados no contexto
- Seja específico com números, não genérico. Use os dados reais do contexto.

✅ CHECKLIST EXECUTIVO — Quando o chefe pedir uma lista de prioridades do dia:
\`\`\`json
{"acao":"gerar_checklist"}
\`\`\`
- Use quando ouvir: "meu checklist", "o que tenho hoje", "minhas prioridades", "o que fazer hoje", "to-do do dia"
- O sistema busca a agenda do dia + vencimentos da semana e monta a lista automaticamente
- Após gerar, pergunte se quer adicionar alguma tarefa extra

⚡ MODO EXECUTIVO — Quando o chefe estiver com pressa ou pedir respostas curtas:
- Ativado por: "seja breve", "modo rápido", "resposta curta", "sem rodeios", "direto ao ponto", "to the point"
- No modo executivo: máximo 1-2 linhas por resposta, sem explicações, só o essencial
- Desativado por: "pode detalhar", "me explica melhor", "com mais detalhes"
- Exemplo normal: "Registrei seu gasto de R$ 50 em alimentação hoje via Pix. ✅"
- Exemplo modo executivo: "✅ R$ 50 alimentação — salvo."

🔴 RISCO DE CONCENTRAÇÃO — Quando contexto mostrar ALERTAS DE RISCO:
- Mencione proativamente na primeira oportunidade: "Sr. Max, notei que X% das suas receitas vêm de uma única fonte. Isso pode ser um risco."
- Sugira diversificação: "Vale considerar novos clientes ou fontes de receita para reduzir essa dependência."
- Só mencione uma vez por sessão — não repita

📊 DASHBOARD VISUAL INLINE — Quando o chefe quiser ver os números de forma visual:
\`\`\`json
{"acao":"gerar_dashboard"}
\`\`\`
- Use quando ouvir: "meu dashboard", "painel financeiro", "visão visual", "barra de gastos", "gráfico do mês"
- O sistema gera barras visuais com █ proporcional ao valor de cada categoria
- Mostra: receitas, gastos, saldo, projeção e top categorias com barras visuais

👥 PERFORMANCE DE COLABORADORES — Quando o chefe quiser ver como a equipe foi:
\`\`\`json
{"acao":"relatorio_colaboradores"}
\`\`\`
- Use quando ouvir: "como minha equipe foi", "performance do time", "quem se saiu bem", "relatório de colaboradores", "ocorrências do time"
- O sistema busca todas as ocorrências do mês e calcula uma pontuação por pessoa
- ⭐ excelente, 🟢 bom, 🟡 atenção, 🔴 preocupante

📈 ANÁLISE DE TENDÊNCIAS — Use os dados do contexto (↑ e ↓ vs mês passado):
- Quando o contexto mostrar "↑X% vs mês passado" em alguma categoria, mencione proativamente
- "Sr. Max, seus gastos em alimentação subiram 40% vs o mês passado. Quer investigar?"
- "Boa notícia: seus gastos em transporte caíram 25% este mês!"
- Use o símbolo ↑ para alta e ↓ para queda ao falar de tendências

🏦 IMPORTAÇÃO DE EXTRATO BANCÁRIO — Quando o chefe colar um extrato:
Quando o Sr. Max colar um bloco de texto com transações bancárias (data + descrição + valor), extraia cada linha no formato:
\`\`\`json
{"acao":"importar_extrato","itens":[
  {"data":"2024-05-01","descricao":"Supermercado Extra","valor":87.50,"categoria":"alimentacao","forma_pagamento":"debito"},
  {"data":"2024-05-02","descricao":"Posto Shell","valor":200.00,"categoria":"transporte","forma_pagamento":"debito"}
]}
\`\`\`
- Identifique a categoria de cada lançamento automaticamente pela descrição
- Ignore linhas de saldo, total, crédito de salário (essas são receitas, pergunte antes de importar)
- Mostre um resumo antes de gerar o JSON: "Identifiquei X lançamentos, total R$ Y. Posso importar?"
- Aguarde confirmação antes de gerar o JSON

✅ APROVAÇÃO DE DESPESAS EMPRESARIAIS — Para gastos PJ acima de R$1.000:
- NUNCA registre automaticamente um gasto_empresa acima de R$ 1.000,00
- Sempre pergunte antes: "Vou registrar R$ X,XX em [descrição] para [empresa]. Confirma?"
- Aguarde o Sr. Max dizer "sim", "confirma", "pode" ou equivalente
- Para gastos PJ abaixo de R$1.000, pode registrar diretamente (comportamento normal)

🎙️ MODO MÃOS-LIVRES / VOZ CONTÍNUA:
- Quando o CEO estiver usando voz contínua (modo oral), prefira respostas ainda mais curtas
- Termine com uma pergunta curta para manter o diálogo: "Mais alguma coisa?" ou "Ok, o que mais?"
- Evite listas longas em modo voz — use narrativa corrida

ℹ️ RESPOSTAS SOBRE SUAS HABILIDADES / AJUDA:
- Sempre que o chefe perguntar "o que você sabe fazer?", "como você funciona?", "quais suas funções?", "ajuda" ou similar:
  Apresente um resumo altamente elegante, executivo e estruturado de suas HABILIDADES PREMIUM (Briefing matinal, Extrator de NF-e, Vencimentos, Metas, Fluxo de Caixa, Extrato em Lote, Aprovação PJ, Voz Contínua, Checklist Executivo, Dashboard Visual, Ocorrências, Projeção do Próximo Mês, etc.) em formato de tópicos amigáveis e profissionais, convidando-o a testar alguma delas.

📅 PROJEÇÃO DO MÊS SEGUINTE — Quando o chefe quiser saber como ficará o próximo mês:
\`\`\`json
{"acao":"projecao_mes"}
\`\`\`
- Use quando ouvir: "como vai ser o mês que vem", "projeção do próximo mês", "previsão do mês seguinte", "quanto vou gastar mês que vem", "como vai ficar meu financeiro no próximo mês", "projeto financeiro", "planejamento do próximo mês", "estimativa do mês que vem"
- O sistema busca automaticamente:
  • Média de gastos por categoria dos últimos 3 meses
  • Média de receitas dos últimos 3 meses
  • Despesas fixas (recorrentes)
  • Vencimentos agendados para o próximo mês
- Mostra: receita projetada, gastos projetados, saldo estimado, alertas de risco e recomendações

🧠 MEMÓRIA UNIVERSAL — REGISTRO LIVRE (use quando não souber onde salvar algo):
\`\`\`json
{"acao":"registro_livre","tipo":"preferencia","chave":"banco_preferido","titulo":"Banco preferido do Sr. Max","conteudo":"Nubank","importante":true}
\`\`\`
- Use SEMPRE que o usuário mencionar algo que vale lembrar e que NÃO tem ação específica:
  • Preferências pessoais: "gosto de...", "prefiro...", "sempre uso...", "não gosto de..."
  • Dados pessoais importantes: nomes de familiares, datas especiais, documentos
  • Regras de negócio: "nunca dê desconto acima de X", "prazo padrão é 30 dias"
  • Acordos informais: "combinei com Carlos que...", "ficou acertado que..."
  • Contatos: "o eletricista é o João - (88) 99999-9999"
  • Qualquer outra informação que o chefe queira que você LEMBRE no futuro
- Quando o usuário pedir para LEMBRAR algo explicitamente, SEMPRE gere este JSON
- Campo "chave": identificador único curto sem espaços (ex: banco_preferido, nome_esposa, desconto_maximo)
  Se for uma anotação única (sem chave fixa), omita o campo "chave"
- Campo "importante": true se a informação deve ser lembrada sempre (preferências, regras). false para anotações avulsas
- Tipos válidos: preferencia, dado_pessoal, regra_negocio, anotacao, contato, acordo, lembrete
- Exemplos de gatilhos: "lembra que...", "anota aí...", "não esqueça que...", "fica sabendo que...", "meu X é Y", "sempre que..."
- Se já existir um registro com essa chave, o sistema ATUALIZA automaticamente (não duplica)`



}

// ── Extrai JSONs da resposta da IA ──────────────────────────
function extrairAcoes(texto: string): AcaoIA[] {
  const acoes: AcaoIA[] = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match
  while ((match = regex.exec(texto)) !== null) {
    try {
      const d = JSON.parse(match[1].trim())
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
        acoes.push({ tipo: 'relatorio', dados: d, label: `\uD83D\uDCC8 Gerar Relat\u00f3rio: ${d.periodo || 'mes_atual'}`, status: 'pending' })
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
        const icon = d.tipo === 'preferencia' ? '⭐' : d.tipo === 'regra_negocio' ? '📋' : d.tipo === 'contato' ? '📞' : d.tipo === 'acordo' ? '🤝' : d.tipo === 'dado_pessoal' ? '👤' : '🧠'
        acoes.push({ tipo: 'registro_livre', dados: d, label: `${icon} Lembrar: ${d.titulo || d.conteudo?.substring(0, 50) || d.chave || 'nova informação'}`, status: 'pending' })
      } else if (d.acao) {
        // Fallback: qualquer acao desconhecida vira um registro generico
        acoes.push({ tipo: 'registro', dados: { ...d, tipo: d.acao }, label: `🗂️ ${d.acao}: ${d.titulo || d.descricao?.substring(0, 40) || JSON.stringify(d).substring(0, 40)}`, status: 'pending' })
      }
    } catch {}
  }
  return acoes
}

function formatarTexto(texto: string) {
  return texto.replace(/```json[\s\S]*?```/g, '').trim()
}

// Converte markdown simples para HTML seguro (bold, italic, listas, quebras de linha)
function renderMarkdownHtml(texto: string): string {
  return texto
    .replace(/```json[\s\S]*?```/g, '')   // remove blocos JSON
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // **bold**
    .replace(/\*(.+?)\*/g, '<em>$1</em>')               // *italic*
    .replace(/^#{1,3} (.+)$/gm, '<strong class="block text-amber-400">$1</strong>') // # heading
    .replace(/^[-•] (.+)$/gm, '<span style="display:flex;gap:4px"><span style="color:#f5a623">•</span><span>$1</span></span>') // - lista
    .replace(/\n/g, '<br/>')              // quebras de linha
    .trim()
}

export function SecretariaFlutuante() {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [isClient, setIsClient] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, distance: 0 })
  const [userId, setUserId] = useState('')
  const [sessaoId, setSessaoId] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [sessoesAnteriores, setSessoesAnteriores] = useState<{ sid: string, data: string, resumo: string }[]>([])
  const [colaboradores, setColaboradores] = useState<{id: string, nome: string}[]>([])
  // Cache da conta PJ padrão buscada dinamicamente
  const contaPjIdRef = useRef<string | null>(null)
  const initialGreeting: Msg = { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Sou a **Elena**, sua Secretária Executiva.\n\nPosso **registrar gastos, receitas, agenda e ocorrências** direto no sistema.\n\nExemplos:\n• _"Gastei R$ 80 de gasolina no PIX"_\n• _"Agendar reunião amanhã às 14h"_\n• _"Abrir ocorrência de erro para o Pedro"_' }
  
  const [mensagens, setMensagens] = useState<Msg[]>([initialGreeting])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [modoVozContinuo, setModoVozContinuo] = useState(false)
  const modoVozRef = useRef(false)
  const [attachedFile, setAttachedFileState] = useState<AttachedFile | null>(null)
  const attachedFileRef = useRef<AttachedFile | null>(null)
  const [processingFile, setProcessingFile] = useState(false)
  const [relatorioData, setRelatorioData] = useState<any>(null)
  const [buscandoWeb, setBuscandoWeb] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null)
  const perfilRef = useRef<any>(null)
  const userMsgCountRef = useRef(0)  // conta msgs do usuário na sessão atual
  const atualizandoPerfilRef = useRef(false)  // evita chamadas simultâneas
  const sugestaoCountRef = useRef(0)   // contador separado para sugestões proativas
  const gerandoSugestaoRef = useRef(false) // evita sugestões simultâneas
  const [isOnline, setIsOnline] = useState(true) // status de conectividade
  const [offlineQueue, setOfflineQueue] = useState<any[]>([])
  const [offlineForm, setOfflineForm] = useState({
    tipo: 'gasto' as 'gasto' | 'receita' | 'agenda',
    valor: '',
    descricao: '',
    categoria: 'alimentacao',
    data: new Date().toISOString().split('T')[0],
    hora: '12:00',
  })
  const [offlineSaved, setOfflineSaved] = useState(false)
  const [resumoFinanceiro, setResumoFinanceiro] = useState('') // contexto financeiro para o prompt
  const alertasDisparadosRef = useRef<Set<string>>(new Set()) // evita alertas duplicados na sessão
  const ultimoRegistroRef = useRef<{ tabela: string; id: string } | null>(null) // para cancelar
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const isListeningRef = useRef(false)   // ref síncrono para controle do mic (state é assíncrono)
  const historyLoadedRef = useRef(false)
  const isSendingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Conta apenas mensagens ENVIADAS nesta sessão (não as carregadas do histórico)
  // Usado para disparar backup automático apenas por msgs novas, não pelo histórico
  const sessionMsgCountRef = useRef(0)

  // Helper: mantém ref e state sincronizados
  const setAttachedFile = (f: AttachedFile | null) => {
    attachedFileRef.current = f
    setAttachedFileState(f)
  }

  // Controle de microfone já autorizado
  const micPermitidoRef = useRef(false)

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
    // Verifica permissão de microfone salva
    if (typeof window !== 'undefined') {
      micPermitidoRef.current = localStorage.getItem('elena_mic_ok') === '1'
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)

      // Carrega o histórico da ÚLTIMA sessão ou inicia uma nova
      if (!historyLoadedRef.current) {
        historyLoadedRef.current = true
        
        // Pega a última sessão
        const { data: lastMsg } = await (supabase.from('elena_conversas') as any).select('sessao_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)
        const currentSessaoId = lastMsg && lastMsg.length > 0 ? lastMsg[0].sessao_id : Date.now().toString()
        setSessaoId(currentSessaoId)
        
        const { data: hist } = await (supabase
          .from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at')
          .eq('user_id', uid)
          .eq('sessao_id', currentSessaoId)
          .order('created_at', { ascending: false }) // Pega os mais recentes daquela sessão
          .limit(40)
        
        if (hist && hist.length > 0) {
          // Reverte para a ordem cronológica correta de exibição
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
            created_at: r.created_at,
          }))
          setMensagens([
            { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Carreguei nossa última conversa. O que faremos agora?' },
            ...historico,
          ])
        }

        // ── Carrega perfil de aprendizado ────────────────────────
        const { data: perfil } = await (supabase.from('elena_perfil') as any)
          .select('*').eq('user_id', uid).maybeSingle()
        if (perfil) {
          setPerfilUsuario(perfil)
          perfilRef.current = perfil
        }
      }
    })
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).then(({ data }) => {
      if (data) setColaboradores(data as {id: string, nome: string}[])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, isOpen])

  // ── Online/Offline detection ──────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    setIsOnline(navigator.onLine)

    // Listener de mensagens do SW (Background Sync)
    const swListener = (event: MessageEvent) => {
      if (event.data?.type === 'ELENA_SYNC_QUEUE') setIsOnline(true)
    }
    navigator.serviceWorker?.addEventListener('message', swListener)
    registrarBackgroundSync()

    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
      navigator.serviceWorker?.removeEventListener('message', swListener)
    }
  }, [])

  // Carrega fila offline ao montar e ao reconectar
  useEffect(() => {
    if (userId) getPendentes(userId).then(setOfflineQueue)
  }, [userId, isOnline])



  // ── Drag ─────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: pos.x, initialY: pos.y, distance: 0 }
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      dragRef.current.distance = Math.sqrt(dx * dx + dy * dy)
      setPos({
        x: Math.max(10, Math.min(dragRef.current.initialX + dx, window.innerWidth - 70)),
        y: Math.max(10, Math.min(dragRef.current.initialY + dy, window.innerHeight - 100))
      })
    }
    const up = () => {
      if (!isDragging) return
      setIsDragging(false)
      if (dragRef.current.distance < 5) setIsOpen(prev => !prev)
    }
    if (isDragging) {
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [isDragging])

  // ── Auto-save ─────────────────────────────────────────────
  const setAcaoStatus = (msgId: string, idx: number, status: AcaoIA['status'], errorMsg?: string) => {
    setMensagens(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, acoes: m.acoes?.map((a, i) => i === idx ? { ...a, status, errorMsg } : a) }
        : m
    ))
  }

  // Busca conta PJ por nome/bandeira mencionada pelo usuário, ou a primeira PJ ativa como fallback
  const resolverContaPj = useCallback(async (contaNome?: string): Promise<{ id: string; nome: string }> => {
    // Busca todas as contas PJ ativas
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, tipo')
      .eq('categoria', 'pj')
      .eq('ativo', true)
      .order('created_at', { ascending: true })

    if (!contas || contas.length === 0) return { id: '', nome: '' }

    // Se o usuário especificou uma conta/cartão, tenta encontrar
    if (contaNome && contaNome.trim()) {
      const busca = contaNome.toLowerCase().trim()
      // Tenta match por bandeira (visa, mastercard, elo, etc.)
      const porBandeira = contas.find((c: any) => c.bandeira && c.bandeira.toLowerCase().includes(busca))
      if (porBandeira) return { id: porBandeira.id, nome: porBandeira.nome }
      // Tenta match por nome da conta (ex: 'C6 Bank PJ', 'Bradesco PJ', 'Nubank')
      const porNome = contas.find((c: any) => {
        const nome = (c.nome || '').toLowerCase()
        return nome.includes(busca) || busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
      })
      if (porNome) return { id: porNome.id, nome: porNome.nome }
    }

    // Fallback: primeira conta PJ (cacheia)
    if (!contaPjIdRef.current) contaPjIdRef.current = contas[0].id
    return { id: contas[0].id, nome: contas[0].nome }
  }, [supabase])

  // Mantém getContaPjId para compatibilidade
  const getContaPjId = useCallback(async (): Promise<string> => {
    const { id } = await resolverContaPj()
    return id
  }, [resolverContaPj])

  // Busca conta PF por nome/bandeira mencionada pelo usuário (ex: "Nubank", "C6", "cartão esposa")
  const resolverContaPf = useCallback(async (contaNome?: string): Promise<{ id: string; nome: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '' }
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, tipo')
      .eq('categoria', 'pf')
      .eq('ativo', true)
      .order('created_at', { ascending: true })

    if (!contas || contas.length === 0) return { id: '', nome: '' }

    const busca = contaNome.toLowerCase().trim()
    // Match por bandeira (visa, mastercard, elo, hipercard...)
    const porBandeira = contas.find((c: any) => c.bandeira && c.bandeira.toLowerCase().includes(busca))
    if (porBandeira) return { id: porBandeira.id, nome: porBandeira.nome }
    // Match por nome (Nubank, C6, Itaú, cartão esposa...)
    const porNome = contas.find((c: any) => {
      const nome = (c.nome || '').toLowerCase()
      return nome.includes(busca) || busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
    })
    if (porNome) return { id: porNome.id, nome: porNome.nome }

    return { id: '', nome: '' }
  }, [supabase])

  // Resolve qualquer conta (PF ou PJ) por nome/bandeira — usado em transferências
  const resolverContaQualquer = useCallback(async (contaNome: string): Promise<{ id: string; nome: string; categoria: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '', categoria: '' }
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, categoria').eq('ativo', true)
    if (!contas?.length) return { id: '', nome: '', categoria: '' }
    const busca = contaNome.toLowerCase().trim()
    const match = contas.find((c: any) => {
      const nome = (c.nome || '').toLowerCase()
      const bandeira = (c.bandeira || '').toLowerCase()
      return nome.includes(busca) || bandeira.includes(busca) ||
        busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
    })
    return match ? { id: match.id, nome: match.nome, categoria: match.categoria } : { id: '', nome: '', categoria: '' }
  }, [supabase])

  const salvarAcao = useCallback(async (msgId: string, acaoIdx: number, acao: AcaoIA, uid: string) => {
    try {
      if (acao.tipo === 'gasto') {
        const hoje = new Date().toISOString().split('T')[0]
        const valor = Number(acao.dados.valor) || 0
        // Verifica duplicidade
        const { data: dups } = await supabase.from('gastos_pessoais').select('id')
          .eq('user_id', uid).eq('data', hoje).eq('valor', valor)
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe um gasto com este exato valor hoje.')
        }

        const formasPagValidas = ['pix','cartao_debito','cartao_credito','dinheiro','transferencia']
        const forma = formasPagValidas.includes(acao.dados.forma_pagamento) ? acao.dados.forma_pagamento : 'pix'
        
        let notasAdicionais = 'Registrado pela Elena'
        if (acao.dados.conta_nome) {
          notasAdicionais = `Cartão/Conta: ${acao.dados.conta_nome} | Registrado pela Elena`
        }

        // Data flexível: aceita data informada pela IA (ex: 'ontem') ou usa hoje
        const dataGasto = acao.dados.data && /^\d{4}-\d{2}-\d{2}$/.test(String(acao.dados.data))
          ? String(acao.dados.data) : hoje

        // Resolve conta PF se mencionada
        const contaPfResolvida = await resolverContaPf(acao.dados.conta_nome)

        // Suporte a parcelas: salva o valor da parcela mensal
        const numParcelas = Number(acao.dados.parcelas) || 1
        const valorTotal = valor
        const valorParcela = numParcelas > 1 ? Math.round((valorTotal / numParcelas) * 100) / 100 : valorTotal

        const notasParcelas = numParcelas > 1
          ? `Parcela 1/${numParcelas} — Total R$ ${valorTotal.toFixed(2)} | `
          : ''
        const notasFinais = contaPfResolvida.nome
          ? `${notasParcelas}Cartão/Conta: ${contaPfResolvida.nome} | Registrado pela Elena`
          : `${notasParcelas}${notasAdicionais}`

        const { data: novoGasto, error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: uid,
          descricao: numParcelas > 1
            ? `${acao.dados.descricao || 'Gasto via Elena'} (${numParcelas}x)`
            : (acao.dados.descricao || 'Gasto via Elena'),
          valor: valorTotal,           // valor TOTAL (igual ao modal)
          categoria: acao.dados.categoria || 'outros',
          forma_pagamento: forma,
          data: dataGasto,
          recorrente: false,
          parcelas: numParcelas > 1 ? numParcelas : null,  // campo separado
          conta_id: contaPfResolvida.id || null,
          notas: notasFinais,
        }).select('id').single()
        if (error) throw new Error(error.message)
        if (novoGasto?.id) ultimoRegistroRef.current = { tabela: 'gastos_pessoais', id: novoGasto.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      } else if (acao.tipo === 'receita') {
        const hoje = new Date().toISOString().split('T')[0]
        const valor = Number(acao.dados.valor) || 0
        const { data: dups } = await supabase.from('receitas_pessoais').select('id')
          .eq('user_id', uid).eq('data', hoje).eq('valor', valor)
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe uma receita com este exato valor hoje.')
        }

        let notasAdicionais = 'Registrado pela Elena'
        if (acao.dados.conta_nome) {
          notasAdicionais = `Conta: ${acao.dados.conta_nome} | Registrado pela Elena`
        }

        // Data flexível
        const dataReceita = acao.dados.data && /^\d{4}-\d{2}-\d{2}$/.test(String(acao.dados.data))
          ? String(acao.dados.data) : hoje

        const contaPfReceitaResolvida = await resolverContaPf(acao.dados.conta_nome)
        const formaRecPessoal = (['pix','cartao_debito','cartao_credito','dinheiro','transferencia'].includes(acao.dados.forma_pagamento)
          ? acao.dados.forma_pagamento : 'pix')

        // Nota: receitas_pessoais não tem coluna forma_pagamento — salva em notas
        const notaReceita = [
          contaPfReceitaResolvida.nome ? `Conta: ${contaPfReceitaResolvida.nome}` : null,
          `Forma: ${formaRecPessoal}`,
          'Registrado pela Elena',
        ].filter(Boolean).join(' | ')

        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor,
          categoria: acao.dados.categoria || 'pro_labore',
          data: dataReceita,
          recorrente: false,
          conta_id: contaPfReceitaResolvida.id || null,
          notas: notaReceita,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
      } else if (acao.tipo === 'gasto_empresa') {
        const hoje = new Date().toISOString().split('T')[0]
        const dataCompetencia = acao.dados.data && /^\d{4}-\d{2}-\d{2}$/.test(String(acao.dados.data))
          ? String(acao.dados.data) : hoje
        const valor = Number(acao.dados.valor) || 0
        // Resolve a conta: usa o nome/bandeira mencionado ou fallback para primeira PJ
        const { id: contaId, nome: contaNomeResolvido } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada. Cadastre uma conta PJ em Financeiro > Contas.')
        const { data: dups } = await supabase.from('lancamentos').select('id')
          .eq('conta_id', contaId).eq('data_competencia', dataCompetencia).eq('valor', valor).eq('tipo', 'despesa')
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma despesa de R$ ${valor} na conta ${contaNomeResolvido} nesta data.`)
        }
        const formasPagValidas = ['pix','cartao_debito','cartao_credito','dinheiro','transferencia']
        const formaPag = formasPagValidas.includes(acao.dados.forma_pagamento) ? acao.dados.forma_pagamento : 'pix'
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Despesa via Elena',
          valor,
          tipo: 'despesa',
          regime: 'caixa',
          status: 'validado',
          data_competencia: dataCompetencia,
          data_caixa: dataCompetencia,
          categoria_id: CAT_DESPESA_ID,
          created_by: uid,
          observacoes: `Conta: ${contaNomeResolvido} | Pagamento: ${formaPag} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      } else if (acao.tipo === 'receita_empresa') {
        const hoje = new Date().toISOString().split('T')[0]
        const dataCompetencia = acao.dados.data && /^\d{4}-\d{2}-\d{2}$/.test(String(acao.dados.data))
          ? String(acao.dados.data) : hoje
        const valor = Number(acao.dados.valor) || 0
        const { id: contaId, nome: contaNomeResolvido } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada. Cadastre uma conta PJ em Financeiro > Contas.')
        const { data: dups } = await supabase.from('lancamentos').select('id')
          .eq('conta_id', contaId).eq('data_competencia', dataCompetencia).eq('valor', valor).eq('tipo', 'receita')
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma receita de R$ ${valor} na conta ${contaNomeResolvido} nesta data.`)
        }
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor,
          tipo: 'receita',
          regime: 'caixa',
          status: 'validado',
          data_competencia: dataCompetencia,
          data_caixa: dataCompetencia,
          categoria_id: CAT_RECEITA_ID,
          created_by: uid,
          observacoes: `Conta: ${contaNomeResolvido} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      } else if (acao.tipo === 'agenda') {
        // ⚠️ FIX TIMEZONE: new Date("YYYY-MM-DD") interpreta como UTC midnight.
        // Em Brasília (UTC-3) isso vira o dia anterior → evento agendado no dia errado.
        // Corrigimos adicionando T12:00:00 em strings sem hora, forçando hora local.
        let dataInicio: Date
        if (acao.dados.data_inicio) {
          const strData = String(acao.dados.data_inicio)
          const strCorrigida = /^\d{4}-\d{2}-\d{2}$/.test(strData.trim())
            ? strData.trim() + 'T12:00:00'
            : strData
          dataInicio = new Date(strCorrigida)
        } else {
          dataInicio = new Date(Date.now() + 86400000)
        }
        // Corrige o ano se a IA gerou errado (ex: 2025 ao invés de 2026)
        const anoCorreto = new Date().getFullYear()
        if (dataInicio.getFullYear() < anoCorreto) {
          dataInicio.setFullYear(anoCorreto)
        }
        const dataInicioStr = dataInicio.toISOString()
        // Normaliza tipo para valores válidos da tabela
        const tiposValidos = ['compromisso', 'lembrete', 'nota', 'tarefa', 'aniversario', 'reuniao', 'vencimento', 'prazo', 'pessoal']
        const tipoEvento = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'compromisso'
        const corMap: Record<string, string> = {
          compromisso: '#3b82f6', lembrete: '#f5a623', nota: '#8b5cf6',
          tarefa: '#10b981', aniversario: '#ec4899', reuniao: '#06b6d4',
          vencimento: '#ef4444', prazo: '#f97316', pessoal: '#a78bfa',
        }
        const { error } = await (supabase.from('agenda_eventos') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Evento via Elena',
          descricao: acao.dados.descricao || null,
          tipo: tipoEvento,
          data_inicio: dataInicioStr,
          data_fim: null,
          dia_inteiro: false,
          status: 'pendente',
          prioridade: 'normal',
          cor: corMap[tipoEvento] || '#f59e0b',
          origem: 'ia',
        })
        if (error) {
          console.error('[Elena Agenda]', error)
          throw new Error(error.message)
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        // Notifica a TabAgenda para recarregar
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))

      } else if (acao.tipo === 'ocorrencia') {
        let colaboradorId: string | null = null
        if (acao.dados.colaborador_nome) {
          const nomeBusca = acao.dados.colaborador_nome.toLowerCase()
          const enc = colaboradores.find(c =>
            c.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(c.nome.toLowerCase().split(' ')[0])
          )
          colaboradorId = enc?.id || null
        }
        const { error } = await (supabase.from('ocorrencias') as any).insert({
          tipo: acao.dados.tipo || 'alerta',
          descricao: acao.dados.descricao || 'Ocorrência via Elena',
          colaborador_id: colaboradorId,
          modulo: acao.dados.modulo || null,
          impacto: acao.dados.impacto || 'medio',
          resolvida: false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'ideia') {
        // Ideia — tabela elena_ideias
        const categoriasValidas = ['negocio','produto','pessoal','financeiro','saude','criativo','geral']
        const categoria = categoriasValidas.includes(acao.dados.categoria) ? acao.dados.categoria : 'geral'
        const { error } = await (supabase.from('elena_ideias') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Ideia via Elena',
          descricao: acao.dados.descricao || null,
          categoria,
          status: 'rascunho',
          progresso: 5,
          notas: 'Capturada pela Elena durante conversa',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        // Notifica TabIdeias para recarregar
        window.dispatchEvent(new CustomEvent('elena:ideia-salva'))

      } else if (acao.tipo === 'registro') {
        // Registro GENÉRICO — tabela elena_registros (fallback universal)
        const tiposValidos = ['contrato', 'emprestimo', 'nota', 'lembrete', 'compra', 'venda', 'outro', 'geral']
        const tipo = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'geral'
        const { error } = await (supabase.from('elena_registros') as any).insert({
          user_id: uid,
          tipo,
          titulo: acao.dados.titulo || acao.dados.descricao?.substring(0, 100) || 'Registro via Elena',
          descricao: acao.dados.descricao || null,
          valor: acao.dados.valor ? Number(acao.dados.valor) : null,
          data: new Date().toISOString().split('T')[0],
          metadados: acao.dados, // salva o JSON completo da IA para não perder dados
          origem: 'elena',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'relatorio') {
        // Relatório — busca dados reais no banco e abre o modal
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dados = await buscarDadosRelatorio(supabase, uid, acao.dados.periodo || 'mes_atual')
        setRelatorioData(dados)
        setAcaoStatus(msgId, acaoIdx, 'saved')
      } else if (acao.tipo === 'backup_chat') {
        // Gera o arquivo TXT
        const textoBackup = mensagens
          .filter(m => m.texto && m.texto !== '...')
          .map(m => {
            const data = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
            return `[${data}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}:\n${m.texto}`
          })
          .join('\n\n----------------------------------------\n\n')
        
        const blob = new Blob([`=== BACKUP DA CONVERSA - ELENA ===\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n` + textoBackup], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Backup_Conversa_Elena_${new Date().toISOString().split('T')[0]}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'transferencia') {
        // ── Transferência entre contas (PF ou PJ) ───────────────────
        const valor = Number(acao.dados.valor) || 0
        const hoje = new Date().toISOString().split('T')[0]
        const descr = acao.dados.descricao || 'Transferência'
        const [contaOrig, contaDest] = await Promise.all([
          resolverContaQualquer(acao.dados.conta_origem || ''),
          resolverContaQualquer(acao.dados.conta_destino || ''),
        ])
        if (!contaOrig.id && !contaDest.id)
          throw new Error('Contas não encontradas. Verifique os nomes das contas cadastradas.')
        // Saída da conta origem
        if (contaOrig.id) {
          if (contaOrig.categoria === 'pf') {
            await (supabase.from('gastos_pessoais') as any).insert({
              user_id: uid, descricao: `Transf. para ${contaDest.nome || acao.dados.conta_destino}`,
              valor, categoria: 'outros', forma_pagamento: 'transferencia', data: hoje,
              conta_id: contaOrig.id, notas: `${descr} | Registrado pela Elena`,
            })
          } else {
            await (supabase.from('lancamentos') as any).insert({
              conta_id: contaOrig.id, descricao: `Transf. para ${contaDest.nome || acao.dados.conta_destino}`,
              valor, tipo: 'despesa', regime: 'caixa', status: 'validado',
              data_competencia: hoje, data_caixa: hoje, created_by: uid,
              observacoes: `${descr} | Transferência via Elena`,
            })
          }
        }
        // Entrada na conta destino
        if (contaDest.id) {
          if (contaDest.categoria === 'pf') {
            await (supabase.from('receitas_pessoais') as any).insert({
              user_id: uid, descricao: `Transf. de ${contaOrig.nome || acao.dados.conta_origem}`,
              valor, categoria: 'outros', data: hoje,
              conta_id: contaDest.id, notas: `${descr} | Forma: transferencia | Registrado pela Elena`,
            })
          } else {
            await (supabase.from('lancamentos') as any).insert({
              conta_id: contaDest.id, descricao: `Transf. de ${contaOrig.nome || acao.dados.conta_origem}`,
              valor, tipo: 'receita', regime: 'caixa', status: 'validado',
              data_competencia: hoje, data_caixa: hoje, created_by: uid,
              observacoes: `${descr} | Transferência via Elena`,
            })
          }
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      } else if (acao.tipo === 'cancelar') {
        // ── Cancela último registro salvo na sessão ────────────────
        if (!ultimoRegistroRef.current)
          throw new Error('⚠️ Nenhum registro recente para cancelar nesta sessão.')
        const { tabela, id } = ultimoRegistroRef.current
        const { error: errDel } = await (supabase.from(tabela) as any).delete().eq('id', id)
        if (errDel) throw new Error(errDel.message)
        ultimoRegistroRef.current = null
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      } else if (acao.tipo === 'definir_meta') {
        // ── Salva meta no Supabase (elena_metas) + localStorage fallback ──────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const categoria = acao.dados.categoria || 'total'
        const valorLimite = Number(acao.dados.valor_limite) || 0
        const periodo = acao.dados.periodo || 'mes'

        // 1. Tenta salvar no Supabase (persistência real, verificável)
        let salvoNoBanco = false
        if (uid) {
          try {
            const { error: errMeta } = await (supabase.from('elena_metas') as any).upsert(
              { user_id: uid, categoria, valor_limite: valorLimite, periodo, ativa: true, atualizado_em: new Date().toISOString() },
              { onConflict: 'user_id,categoria' }
            )
            if (!errMeta) salvoNoBanco = true
          } catch { /* cai no fallback */ }
        }

        // 2. localStorage como fallback (compatibilidade com código de alertas)
        try {
          const chaveMetas = `elena_metas_${uid}`
          const metas: Record<string, number> = JSON.parse(localStorage.getItem(chaveMetas) || '{}')
          metas[categoria] = valorLimite
          localStorage.setItem(chaveMetas, JSON.stringify(metas))
        } catch {}

        // 3. Mensagem de confirmação
        setMensagens(prev => [...prev, {
          id: `meta-ok-${Date.now()}`,
          role: 'ai' as const,
          texto: salvoNoBanco
            ? `✅ **Meta salva no banco!** Limite de **R$ ${valorLimite.toFixed(2)}/mês** para **${categoria}** registrado com segurança. Vou monitorar e te alertar quando chegar perto do limite, Sr. Max! 💪`
            : `✅ **Meta definida:** R$ ${valorLimite.toFixed(2)}/mês em **${categoria}**. Salvo localmente — vou monitorar seus gastos!`,
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'gerar_checklist') {
        // ── Checklist Executivo do Dia ──────────────────────────────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const hoje = new Date()
        const hojeStr = hoje.toISOString().split('T')[0]
        const em7d = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

        const [{ data: agendaHoje }, { data: vencSemana }] = await Promise.all([
          (supabase.from('agenda_eventos') as any)
            .select('titulo, data_inicio, tipo, prioridade')
            .eq('user_id', uid)
            .gte('data_inicio', `${hojeStr}T00:00:00`)
            .lte('data_inicio', `${hojeStr}T23:59:59`)
            .neq('status', 'cancelado')
            .order('data_inicio', { ascending: true }),
          (supabase.from('agenda_eventos') as any)
            .select('titulo, data_inicio, tipo')
            .eq('user_id', uid)
            .eq('tipo', 'vencimento')
            .gte('data_inicio', hoje.toISOString())
            .lte('data_inicio', em7d)
            .neq('status', 'cancelado')
            .order('data_inicio', { ascending: true }),
        ])

        const linhas: string[] = ['**📋 Checklist Executivo — ' + hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) + '**', '']

        // Compromissos do dia
        if (agendaHoje && agendaHoje.length > 0) {
          linhas.push('**🗓️ Agenda de hoje:**')
          agendaHoje.forEach((ev: any) => {
            const h = new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            const icon = ev.tipo === 'vencimento' ? '🔴' : ev.prioridade === 'alta' ? '🟠' : '🟡'
            linhas.push(`${icon} ${h} — ${ev.titulo}`)
          })
          linhas.push('')
        }

        // Vencimentos urgentes
        if (vencSemana && vencSemana.length > 0) {
          linhas.push('**💳 Vencimentos para resolver:**')
          vencSemana.slice(0, 5).forEach((v: any) => {
            const dv = new Date(v.data_inicio)
            const diff = Math.floor((dv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            const quando = diff === 0 ? '⚠️ Hoje' : diff === 1 ? 'Amanhã' : `Em ${diff} dias`
            linhas.push(`🔴 ${quando} — ${v.titulo}`)
          })
          linhas.push('')
        }

        if (linhas.length <= 2) linhas.push('✅ Agenda limpa! Dia livre para focar no estratégico.')

        setMensagens(prev => [...prev, {
          id: `checklist-${Date.now()}`,
          role: 'ai' as const,
          texto: linhas.join('\n'),
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'relatorio_colaboradores') {
        // ── Performance de Colaboradores ─────────────────────────────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
        const { data: ocorrencias } = await (supabase.from('ocorrencias') as any)
          .select('colaborador_id, tipo, impacto, descricao, created_at')
          .gte('created_at', inicioMes.toISOString())
          .order('created_at', { ascending: false })
        const { data: colabs } = await (supabase.from('colaboradores') as any).select('id, nome')
        const mapaColabs: Record<string, string> = {}
        ;(colabs || []).forEach((c: any) => { mapaColabs[c.id] = c.nome })

        // Agrupa por colaborador
        const perf: Record<string, Record<string, number>> = {}
        ;(ocorrencias || []).forEach((o: any) => {
          const nome = mapaColabs[o.colaborador_id] || o.colaborador_id || 'Sem nome'
          if (!perf[nome]) perf[nome] = { acerto: 0, erro: 0, alerta: 0, elogio: 0 }
          perf[nome][o.tipo] = (perf[nome][o.tipo] || 0) + 1
        })

        const linhas = ['**👥 Performance dos Colaboradores — ' + inicioMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) + '**', '']
        if (Object.keys(perf).length === 0) {
          linhas.push('Nenhuma ocorrência registrada este mês.')
        } else {
          Object.entries(perf).forEach(([nome, tipos]) => {
            const total = Object.values(tipos).reduce((s, v) => s + v, 0)
            const score = ((tipos.acerto || 0) + (tipos.elogio || 0)) - ((tipos.erro || 0) * 2 + (tipos.alerta || 0))
            const estrela = score >= 3 ? '⭐' : score >= 0 ? '🟢' : score >= -2 ? '🟡' : '🔴'
            linhas.push(`${estrela} **${nome}** — ${total} ocorrência(s): ✅${tipos.acerto||0} 🏆${tipos.elogio||0} ⚠️${tipos.alerta||0} ❌${tipos.erro||0}`)
          })
        }
        setMensagens(prev => [...prev, { id: `perf-${Date.now()}`, role: 'ai' as const, texto: linhas.join('\n') }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'gerar_dashboard') {
        // ── Dashboard Visual Inline ────────────────────────────────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const agora = new Date()
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0]
        const [{ data: gastos }, { data: receitas }] = await Promise.all([
          (supabase.from('gastos_pessoais') as any).select('valor, categoria').eq('user_id', uid).gte('data', inicioMes),
          (supabase.from('receitas_pessoais') as any).select('valor').eq('user_id', uid).gte('data', inicioMes),
        ])
        const totalG = (gastos || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
        const totalR = (receitas || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
        const cats: Record<string, number> = {}
        ;(gastos || []).forEach((g: any) => { cats[g.categoria] = (cats[g.categoria] || 0) + Number(g.valor) })
        const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6)
        const maxVal = sorted[0]?.[1] || 1
        const barLen = 12 // max bar length in chars
        const bar = (v: number) => '█'.repeat(Math.round((v / maxVal) * barLen)).padEnd(barLen, '░')

        const diaAtual = agora.getDate()
        const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
        const projecao = totalG > 0 ? (totalG / diaAtual) * diasNoMes : 0

        const linhas = [
          `**📊 Dashboard — ${agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}**`,
          '',
          `💰 Receitas: **R$ ${totalR.toFixed(2)}**`,
          `💸 Gastos: **R$ ${totalG.toFixed(2)}**`,
          `📈 Saldo: **R$ ${(totalR - totalG).toFixed(2)}** ${totalR >= totalG ? '✅' : '⚠️'}`,
          `🔮 Projeção fim do mês: R$ ${projecao.toFixed(2)}`,
          '',
          '**Gastos por categoria:**',
          ...sorted.map(([cat, val]) => `\`${bar(val)}\` **${cat}** R$ ${val.toFixed(2)}`),
        ]
        setMensagens(prev => [...prev, { id: `dash-${Date.now()}`, role: 'ai' as const, texto: linhas.join('\n') }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'importar_extrato') {
        // ── Importação de Extrato Bancário em Lote ─────────────────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const itens: any[] = Array.isArray(acao.dados.itens) ? acao.dados.itens : []
        if (itens.length === 0) throw new Error('Nenhum item para importar.')
        let importados = 0
        let totalImportado = 0
        const erros: string[] = []
        for (const item of itens) {
          try {
            await (supabase.from('gastos_pessoais') as any).insert({
              user_id: uid,
              descricao: item.descricao || 'Extrato importado',
              valor: Math.abs(Number(item.valor)) || 0,
              categoria: item.categoria || 'outros',
              forma_pagamento: item.forma_pagamento || 'debito',
              data: item.data || new Date().toISOString().split('T')[0],
              notas: 'Importado do extrato via Elena',
            })
            importados++
            totalImportado += Math.abs(Number(item.valor))
          } catch { erros.push(item.descricao || '?') }
        }
        setMensagens(prev => [...prev, {
          id: `extrato-${Date.now()}`,
          role: 'ai' as const,
          texto: [
            `🏦 **Extrato importado com sucesso!**`,
            `• ${importados} de ${itens.length} lançamentos registrados`,
            `• Total: **R$ ${totalImportado.toFixed(2)}**`,
            erros.length ? `⚠️ Erro em: ${erros.join(', ')}` : '✅ Todos importados sem erros!',
          ].join('\n'),
        }])
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'projecao_mes') {
        // ── Projeção Financeira do Mês Seguinte ─────────────────────────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const agora = new Date()
        const anoAtual = agora.getFullYear()
        const mesAtual = agora.getMonth()  // 0-indexed

        const proxMes = mesAtual === 11 ? 0 : mesAtual + 1
        const proxAno = mesAtual === 11 ? anoAtual + 1 : anoAtual
        const proxMesNome = new Date(proxAno, proxMes, 1)
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        const proxMesInicio = `${proxAno}-${String(proxMes + 1).padStart(2, '0')}-01`
        const diasProxMes = new Date(proxAno, proxMes + 1, 0).getDate()
        const proxMesFimStr = `${proxAno}-${String(proxMes + 1).padStart(2, '0')}-${String(diasProxMes).padStart(2, '0')}`

        // Últimos 3 meses completos para média
        const m3inicio = new Date(anoAtual, mesAtual - 3, 1).toISOString().split('T')[0]
        const m3fim    = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0]
        const mesAtualStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`

        const [
          { data: gastos3m },
          { data: receitas3m },
          { data: gastosFixos },
          { data: vencProxMes },
          { data: gastosMesAtual },
        ] = await Promise.all([
          (supabase.from('gastos_pessoais') as any).select('valor, categoria')
            .eq('user_id', uid).gte('data', m3inicio).lte('data', m3fim),
          (supabase.from('receitas_pessoais') as any).select('valor')
            .eq('user_id', uid).gte('data', m3inicio).lte('data', m3fim),
          (supabase.from('gastos_pessoais') as any).select('valor, descricao, categoria')
            .eq('user_id', uid).eq('recorrente', true),
          (supabase.from('agenda_eventos') as any).select('titulo, data_inicio')
            .eq('user_id', uid).eq('tipo', 'vencimento')
            .gte('data_inicio', `${proxMesInicio}T00:00:00`)
            .lte('data_inicio', `${proxMesFimStr}T23:59:59`)
            .neq('status', 'cancelado').order('data_inicio', { ascending: true }),
          (supabase.from('gastos_pessoais') as any).select('valor, categoria')
            .eq('user_id', uid).gte('data', mesAtualStr),
        ])

        // Média de receitas (3 meses)
        const mediaReceita = (receitas3m || []).reduce((s: number, r: any) => s + Number(r.valor), 0) / 3

        // Média de gastos por categoria
        const catsPorValor: Record<string, number> = {}
        ;(gastos3m || []).forEach((g: any) => {
          const cat = g.categoria || 'outros'
          catsPorValor[cat] = (catsPorValor[cat] || 0) + Number(g.valor)
        })
        const mediasPorCat: Record<string, number> = {}
        Object.entries(catsPorValor).forEach(([cat, total]) => {
          mediasPorCat[cat] = total / 3
        })

        const totalGastoProjetado = Object.values(mediasPorCat).reduce((s, v) => s + v, 0)
        const totalFixas = (gastosFixos || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
        const gastoAtualTotal = (gastosMesAtual || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
        const saldoProjetado = mediaReceita - totalGastoProjetado

        // Barras visuais por categoria
        const topCats = Object.entries(mediasPorCat).sort(([, a], [, b]) => b - a).slice(0, 6)
        const maxCat = topCats[0]?.[1] || 1
        const barLen = 10
        const bar = (v: number) => '█'.repeat(Math.round((v / maxCat) * barLen)).padEnd(barLen, '░')

        // Alertas de risco
        const alertas: string[] = []
        if (saldoProjetado < 0)
          alertas.push(`🔴 **ATENÇÃO:** Projeção indica saldo NEGATIVO de **R$ ${Math.abs(saldoProjetado).toFixed(2)}**!`)
        else if (mediaReceita > 0 && saldoProjetado < mediaReceita * 0.1)
          alertas.push(`🟠 Saldo projetado muito baixo (${((saldoProjetado / mediaReceita) * 100).toFixed(0)}% da receita).`)
        if (mediaReceita > 0 && totalFixas > mediaReceita * 0.5)
          alertas.push(`⚠️ Despesas fixas representam ${((totalFixas / mediaReceita) * 100).toFixed(0)}% da receita média.`)
        if ((vencProxMes || []).length > 0)
          alertas.push(`💳 ${(vencProxMes as any[]).length} vencimento(s) agendado(s) para ${proxMesNome}.`)

        // Monta o painel
        const tituloMes = proxMesNome.charAt(0).toUpperCase() + proxMesNome.slice(1)
        const linhas: string[] = [
          `**📅 Projeção Financeira — ${tituloMes}**`,
          `_Média baseada nos últimos 3 meses completos_`,
          '',
          `💰 **Receita projetada:** R$ ${mediaReceita.toFixed(2)}`,
          `💸 **Gastos projetados:** R$ ${totalGastoProjetado.toFixed(2)}`,
          `📊 **Saldo estimado:** **R$ ${saldoProjetado.toFixed(2)}** ${saldoProjetado >= 0 ? '✅' : '🔴'}`,
          '',
        ]
        if (totalFixas > 0) {
          linhas.push(`🔒 **Despesas fixas/recorrentes:** R$ ${totalFixas.toFixed(2)}/mês`)
          linhas.push('')
        }
        if (topCats.length > 0) {
          linhas.push('**Gastos por categoria (projetado):**')
          topCats.forEach(([cat, val]) => {
            linhas.push(`\`${bar(val)}\` **${cat}** R$ ${val.toFixed(2)}`)
          })
          linhas.push('')
        }
        if (vencProxMes && (vencProxMes as any[]).length > 0) {
          linhas.push('**💳 Vencimentos do mês:**')
          ;(vencProxMes as any[]).slice(0, 5).forEach((v: any) => {
            const d = new Date(v.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            linhas.push(`• ${d} — ${v.titulo}`)
          })
          linhas.push('')
        }
        if (alertas.length > 0) {
          linhas.push('**⚠️ Alertas:**')
          alertas.forEach(a => linhas.push(a))
          linhas.push('')
        }
        if (gastoAtualTotal > 0) {
          const diff = totalGastoProjetado - gastoAtualTotal
          const seta = diff > 0
            ? `↑ R$ ${diff.toFixed(2)} a mais que o mês atual`
            : `↓ R$ ${Math.abs(diff).toFixed(2)} a menos que o mês atual`
          linhas.push(`_Comparado ao mês atual (R$ ${gastoAtualTotal.toFixed(2)}): ${seta}_`)
        }

        setMensagens(prev => [...prev, {
          id: `proj-${Date.now()}`,
          role: 'ai' as const,
          texto: linhas.join('\n'),
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'registro_livre') {
        // ── Memória Universal: salva na elena_registro ─────────────────────────
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const { chave, titulo, conteudo, tipo: tipoReg, dados: dadosReg, importante, tags } = acao.dados

        if (!titulo && !conteudo) {
          setAcaoStatus(msgId, acaoIdx, 'error', 'Sem conteúdo para salvar')
          return
        }

        const payload: Record<string, any> = {
          user_id: uid,
          tipo: tipoReg || 'anotacao',
          titulo: titulo || conteudo?.substring(0, 80) || 'Registro',
          conteudo: conteudo || null,
          dados: dadosReg && Object.keys(dadosReg).length > 0 ? dadosReg : null,
          importante: importante === true || importante === 'true',
          tags: Array.isArray(tags) ? tags : [],
          atualizado_em: new Date().toISOString(),
        }

        // Inclui chave apenas se fornecida (permite upsert inteligente)
        if (chave) payload.chave = chave

        let salvo = false
        let isUpdate = false

        try {
          if (chave) {
            // Com chave: faz upsert (atualiza se já existe)
            const { data: existing } = await (supabase.from('elena_registro') as any)
              .select('id').eq('user_id', uid).eq('chave', chave).maybeSingle()
            isUpdate = !!existing

            const { error } = await (supabase.from('elena_registro') as any)
              .upsert(payload, { onConflict: 'user_id,chave' })
            if (!error) salvo = true
          } else {
            // Sem chave: insere novo registro
            const { error } = await (supabase.from('elena_registro') as any).insert(payload)
            if (!error) salvo = true
          }
        } catch (e) {
          console.error('[Elena Registro] Erro ao salvar:', e)
        }

        const icon = tipoReg === 'preferencia' ? '⭐' : tipoReg === 'regra_negocio' ? '📋'
          : tipoReg === 'contato' ? '📞' : tipoReg === 'acordo' ? '🤝'
          : tipoReg === 'dado_pessoal' ? '👤' : '🧠'

        setMensagens(prev => [...prev, {
          id: `reg-${Date.now()}`,
          role: 'ai' as const,
          texto: salvo
            ? `${icon} **${isUpdate ? 'Atualizado' : 'Anotado'}:** _${titulo || conteudo?.substring(0, 60)}_\nGuardei isso na minha memória, Sr. Max. Pode perguntar a qualquer momento! 💾`
            : `${icon} **Anotado localmente:** _${titulo || conteudo?.substring(0, 60)}_\n_(Houve um problema ao salvar no banco — tentarei novamente mais tarde)_`,
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')
      }

    } catch (err: any) {
      const errMsg = err?.message || 'Erro desconhecido ao salvar'
      setAcaoStatus(msgId, acaoIdx, 'error', errMsg)
      // Mostra o erro no chat para o usuário saber o que aconteceu
      setMensagens(prev => [...prev, {
        id: `err-acao-${Date.now()}`,
        role: 'ai' as const,
        texto: `❌ **Erro ao registrar:** ${errMsg}\n\nSe quiser, me diga para tentar novamente ou registre manualmente em Lançamentos.`,
      }])
      console.error('[Elena salvarAcao]', errMsg, acao)
    }   // fecha catch
  }, [supabase, colaboradores, resolverContaPj, resolverContaPf, resolverContaQualquer, getContaPjId])

  const executarAcoesAuto = useCallback((msgId: string, acoes: AcaoIA[], uid: string) => {
    acoes.forEach((acao, idx) => {
      setMensagens(prev => prev.map(m =>
        m.id === msgId
          ? { ...m, acoes: m.acoes?.map((a, i) => i === idx ? { ...a, status: 'saving' as const } : a) }
          : m
      ))
      // Não engole erros — o salvarAcao já mostra no chat
      salvarAcao(msgId, idx, acao, uid)
    })
  }, [salvarAcao])

  // ── Salvar mensagem no histórico do banco ─────────────────
  const salvarHistorico = useCallback(async (uid: string, role: 'user' | 'ai', texto: string, acoes?: AcaoIA[], currentSessao?: string) => {
    if (!uid || !texto || texto === '...') return
    await (supabase.from('elena_conversas') as any).insert({
      user_id: uid,
      role,
      texto,
      acoes: acoes && acoes.length > 0 ? acoes : null,
      sessao_id: currentSessao || sessaoId,
    })
  }, [supabase, sessaoId])

  // ── Executar Backup Automático e Reiniciar Chat ─────────────
  // CORREÇÃO: salva no Supabase (elena_backups) em vez de forçar download .txt.
  // Permite que a Elena busque conversas antigas quando perguntada.
  const executarBackupAutomatico = useCallback(async (msgsList: Msg[]) => {
    const msgsParaBackup = msgsList.filter(m => m.texto && m.texto !== '...')

    const textoBackup = msgsParaBackup
      .map(m => {
        const data = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
        return `[${data}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}:\n${m.texto}`
      })
      .join('\n\n----------------------------------------\n\n')

    const conteudoCompleto = `=== BACKUP AUTOMÁTICO DA CONVERSA - ELENA ===\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n${textoBackup}`

    // 1. Salva no Supabase para busca futura
    let backupSalvoNoBanco = false
    if (userId) {
      try {
        const { error } = await (supabase.from('elena_backups') as any).insert({
          user_id: userId,
          sessao_id: sessaoId,
          conteudo: conteudoCompleto,
          total_mensagens: msgsParaBackup.length,
        })
        if (!error) backupSalvoNoBanco = true
      } catch (err) {
        console.error('[Elena Backup] Erro ao salvar no banco:', err)
      }
    }

    // 2. Nova sessão + reseta contador
    const novoSessaoId = Date.now().toString()
    setSessaoId(novoSessaoId)
    sessionMsgCountRef.current = 0

    // 3. Mensagem informativa
    const msgExplicativaTexto = backupSalvoNoBanco
      ? '📊 **Elena Informa:** Conversa arquivada com segurança! Iniciei uma nova sessão para manter o desempenho ideal. Posso buscar conversas anteriores a qualquer momento se precisar, Sr. Max! 🚀'
      : '📊 **Elena Informa:** Realizei o **backup automático** da nossa conversa e iniciei um novo assunto limpo para mantermos o desempenho e velocidade ideais! Como posso ajudar você agora, Sr. Max? 🚀'

    setMensagens([
      initialGreeting,
      { id: 'backup-auto-' + Date.now(), role: 'ai', texto: msgExplicativaTexto }
    ])

    // 4. Persiste sob a nova sessão
    if (userId) {
      salvarHistorico(userId, 'ai', msgExplicativaTexto, undefined, novoSessaoId)
    }
  }, [userId, sessaoId, supabase, initialGreeting, salvarHistorico])

  // ── Monitoramento do Backup Automático ──
  // CORREÇÃO CRÍTICA: usa sessionMsgCountRef para contar APENAS msgs enviadas
  // nesta sessão, não as carregadas do histórico. Evita backup toda hora.
  useEffect(() => {
    if (sessionMsgCountRef.current >= 40) {
      const timer = setTimeout(() => {
        executarBackupAutomatico(mensagens)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [mensagens, executarBackupAutomatico])

  // ── Aprendizado: atualiza perfil a cada 5 msgs do usuário ──
  const atualizarPerfilAprendizado = useCallback(async (uid: string, msgsList: Msg[]) => {
    if (!uid || atualizandoPerfilRef.current) return
    atualizandoPerfilRef.current = true
    try {
      // Pega até 30 mensagens do usuário para análise
      const msgsUsuario = msgsList.filter(m => m.role === 'user' && m.texto && m.texto !== '...')
        .slice(-30).map(m => m.texto).join('\n')
      if (!msgsUsuario || msgsUsuario.length < 50) return

      const promptAnalise = `Analise as seguintes mensagens de um usuário para um assistente executiva (Elena) e extraia seu perfil de comunicação. Responda APENAS com um JSON válido, sem texto adicional.

MENSAGENS DO USUÁRIO:
${msgsUsuario}

Retorne exatamente este JSON:
{
  "estilo_comunicacao": "formal|informal|direto|detalhado",
  "tom_preferido": "profissional|casual|amigavel",
  "prefere_resposta": "concisa|detalhada|com_exemplos",
  "forma_pagamento_usual": "pix|cartao_credito|cartao_debito|dinheiro|transferencia",
  "expressoes_comuns": ["lista", "de", "expressoes", "ou", "gírias", "que", "ele", "usa"],
  "contas_preferidas": ["nomes", "de", "cartoes", "ou", "bancos", "mencionados"],
  "contexto_pessoal": "Resumo em 2-3 frases sobre quem é o usuário, seu estilo de comunicação, o que prefere, e dicas para a Elena adaptar as respostas."
}`

      const res = await fetch('/api/elena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'Você é um analisador de perfil de comunicação. Retorne apenas JSON válido.',
          messages: [{ role: 'user', content: promptAnalise }],
          uid,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      const resposta = data.text || data.message || ''
      // Extrai JSON da resposta
      const jsonMatch = resposta.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return
      const perfilNovo = JSON.parse(jsonMatch[0])
      // Upsert no banco
      const { data: atualizado } = await (supabase.from('elena_perfil') as any).upsert({
        user_id: uid,
        ...perfilNovo,
        total_interacoes: (perfilRef.current?.total_interacoes || 0) + 5,
        ultima_atualizacao: new Date().toISOString(),
      }, { onConflict: 'user_id' }).select().single()
      if (atualizado) {
        setPerfilUsuario(atualizado)
        perfilRef.current = atualizado
      }
    } catch (e) {
      // Silencioso — não interrompe o fluxo
    } finally {
      atualizandoPerfilRef.current = false
    }
  }, [supabase])

  // ── Análise Proativa: sugere melhorias com base nos dados financeiros reais ──
  const gerarSugestaoProativa = useCallback(async (uid: string) => {
    if (!uid || gerandoSugestaoRef.current) return
    gerandoSugestaoRef.current = true
    try {
      const inicioMes = new Date()
      inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
      const inicioMesStr = inicioMes.toISOString().split('T')[0]

      const [{ data: gastosPF }, { data: receitasPF }] = await Promise.all([
        (supabase.from('gastos_pessoais') as any)
          .select('valor, categoria')
          .eq('user_id', uid)
          .gte('data', inicioMesStr),
        (supabase.from('receitas_pessoais') as any)
          .select('valor, categoria')
          .eq('user_id', uid)
          .gte('data', inicioMesStr),
      ])

      const totalGasto = (gastosPF || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
      const totalReceita = (receitasPF || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
      if (totalGasto === 0 && totalReceita === 0) return

      const porCategoria: Record<string, number> = {}
      ;(gastosPF || []).forEach((g: any) => {
        porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.valor)
      })
      const topCats = Object.entries(porCategoria)
        .sort(([, a], [, b]) => b - a).slice(0, 3)
        .map(([cat, val]) => `${cat}: R$ ${Number(val).toFixed(2)}`).join(', ')

      const resumo = `Mês atual — Gastos: R$ ${totalGasto.toFixed(2)} | Receitas: R$ ${totalReceita.toFixed(2)} | Saldo: R$ ${(totalReceita - totalGasto).toFixed(2)} | Top categorias: ${topCats || 'sem dados'}`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Dados financeiros do mês atual do Sr. Max: ${resumo}\n\nGere UMA sugestão inteligente, prática e personalizada (máx. 2 frases). Seja direto e útil. Comece com um emoji relevante.`,
          systemInstruction: 'Você é Elena, secretária executiva do Sr. Max. Dê uma sugestão proativa curta baseada nos dados financeiros reais do mês.',
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      const sugestao = (data.result || '').trim()
      if (sugestao.length < 20) return

      setMensagens(prev => [...prev, {
        id: 'sugestao-' + Date.now(),
        role: 'ai' as const,
        texto: `💡 **Análise da Elena:**\n\n${sugestao}`,
      }])
    } catch {
      // Silencioso — não interrompe o fluxo
    } finally {
      gerandoSugestaoRef.current = false
    }
  }, [supabase])

  // ── Carrega resumo financeiro do mês para injetar no prompt ──
  const carregarResumoFinanceiro = useCallback(async (uid: string) => {
    try {
      const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)
      const inicioMesStr = inicioMes.toISOString().split('T')[0]
      const [{ data: gastos }, { data: receitas }, { data: vencFuturos }, { data: gastosMesAnterior }] = await Promise.all([
        (supabase.from('gastos_pessoais') as any).select('valor, categoria, data').eq('user_id', uid).gte('data', inicioMesStr),
        (supabase.from('receitas_pessoais') as any).select('valor, categoria').eq('user_id', uid).gte('data', inicioMesStr),
        // Vencimentos agendados no restante do mês
        (supabase.from('agenda_eventos') as any)
          .select('titulo, data_inicio').eq('user_id', uid).eq('tipo', 'vencimento')
          .gte('data_inicio', new Date().toISOString())
          .lte('data_inicio', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString())
          .neq('status', 'cancelado'),
        // Mês anterior para comparação de tendências
        (supabase.from('gastos_pessoais') as any).select('valor, categoria')
          .eq('user_id', uid)
          .gte('data', new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0])
          .lt('data', inicioMesStr),
      ])
      const totalG = (gastos || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
      const totalR = (receitas || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
      if (totalG === 0 && totalR === 0) return

      // Top categorias de gasto + análise de tendências vs mês anterior
      const cats: Record<string, number> = {}
      ;(gastos || []).forEach((g: any) => { cats[g.categoria] = (cats[g.categoria] || 0) + Number(g.valor) })
      const catsAnt: Record<string, number> = {}
      ;(gastosMesAnterior || []).forEach((g: any) => { catsAnt[g.categoria] = (catsAnt[g.categoria] || 0) + Number(g.valor) })
      const tendencias = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, val]) => {
        const ant = catsAnt[cat] || 0
        if (ant === 0) return `${cat}: R$ ${val.toFixed(2)} (novo)`
        const variacao = Math.round(((val - ant) / ant) * 100)
        const seta = variacao > 0 ? `↑${variacao}%` : `↓${Math.abs(variacao)}%`
        return `${cat}: R$ ${val.toFixed(2)} (${seta} vs mês passado)`
      }).join(' | ')
      const top = tendencias

      // ── Metas vs Gastos Reais ──────────────────────────────────
      const metasStr = localStorage.getItem(`elena_metas_${uid}`)
      const metas: Record<string, number> = metasStr ? JSON.parse(metasStr) : {}
      const alertasMetas: string[] = []
      Object.entries(metas).forEach(([cat, limite]) => {
        if (cat === 'total') {
          const pct = Math.round((totalG / limite) * 100)
          if (pct >= 70) alertasMetas.push(`- META TOTAL: ${pct}% usado (R$ ${totalG.toFixed(2)} / R$ ${limite.toFixed(2)})${pct >= 100 ? ' ⚠️ ESTOUROU!' : pct >= 90 ? ' ⚠️ quase no limite' : ''}`)
        } else {
          const gasto = cats[cat] || 0
          const pct = Math.round((gasto / limite) * 100)
          if (pct >= 70) alertasMetas.push(`- META ${cat}: ${pct}% (R$ ${gasto.toFixed(2)} / R$ ${limite.toFixed(2)})${pct >= 100 ? ' ⚠️ ESTOUROU!' : ''}`)
        }
      })

      // ── Previsão de Fluxo de Caixa ─────────────────────────────
      const hoje = new Date()
      const diaAtual = hoje.getDate()
      const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
      const diasRestantes = diasNoMes - diaAtual
      const ritmodiario = diaAtual > 0 ? totalG / diaAtual : 0
      const projecaoGastos = totalG + (ritmodiario * diasRestantes)
      const numVenc = (vencFuturos || []).length
      const previsao = `- Ritmo de gasto: R$ ${ritmodiario.toFixed(2)}/dia\n` +
        `- Projeção de gastos ao fim do mês: R$ ${projecaoGastos.toFixed(2)}\n` +
        (numVenc > 0 ? `- Vencimentos restantes no mês: ${numVenc} (verifique agenda)\n` : '')

      // ── Análise de Risco de Concentração de Receitas ────────────
      const catReceitas: Record<string, number> = {}
      ;(receitas || []).forEach((r: any) => {
        const src = r.categoria || 'outros'
        catReceitas[src] = (catReceitas[src] || 0) + Number(r.valor)
      })
      let riscoConcentracao = ''
      if (totalR > 0) {
        const topReceita = Object.entries(catReceitas).sort((a, b) => b[1] - a[1])[0]
        if (topReceita) {
          const pctConc = Math.round((topReceita[1] / totalR) * 100)
          if (pctConc >= 60) {
            riscoConcentracao = `RISCO: ${pctConc}% da receita vem de "${topReceita[0]}" (R$ ${topReceita[1].toFixed(2)}) — concentração ${pctConc >= 80 ? 'CRÍTICA' : 'ALTA'}\n`
          }
        }
      }

      // ── Carrega memória importante da Elena (registros marcados como importantes) ──
      let blocoMemoria = ''
      try {
        const { data: memoriaImportante } = await (supabase.from('elena_registro') as any)
          .select('tipo, chave, titulo, conteudo')
          .eq('user_id', uid)
          .eq('importante', true)
          .order('atualizado_em', { ascending: false })
          .limit(20)

        if (memoriaImportante && memoriaImportante.length > 0) {
          blocoMemoria = '\n🧠 MEMÓRIA DA ELENA (informações importantes lembradas):\n'
          blocoMemoria += memoriaImportante
            .map((r: any) => `- ${r.titulo}: ${r.conteudo || ''}`)
            .join('\n')
          blocoMemoria += '\n'
        }
      } catch { /* silencioso */ }

      setResumoFinanceiro(
        `- Gastos PF mês: R$ ${totalG.toFixed(2)}\n` +
        `- Receitas PF mês: R$ ${totalR.toFixed(2)}\n` +
        `- Saldo estimado: R$ ${(totalR - totalG).toFixed(2)}\n` +
        (top ? `- Top categorias gasto: ${top}\n` : '') +
        (alertasMetas.length ? `ALERTAS DE METAS:\n${alertasMetas.join('\n')}\n` : '') +
        (riscoConcentracao ? `ALERTAS DE RISCO:\n${riscoConcentracao}` : '') +
        `PREVISÃO DO MÊS:\n${previsao}` +
        blocoMemoria
      )
    } catch { /* silencioso */ }
  }, [supabase])

  // ── Alertas sonoros: verifica eventos dos próximos 15 min ────
  const verificarAlertas = useCallback(async (uid: string) => {
    try {
      const agora = new Date()
      const em15 = new Date(agora.getTime() + 15 * 60 * 1000)
      const { data: eventos } = await (supabase.from('agenda_eventos') as any)
        .select('id, titulo, data_inicio, tipo')
        .eq('user_id', uid)
        .in('tipo', ['lembrete', 'vencimento'])
        .gte('data_inicio', agora.toISOString())
        .lte('data_inicio', em15.toISOString())
        .eq('status', 'pendente')

      if (!eventos || eventos.length === 0) return

      for (const ev of eventos) {
        const chave = `${ev.id}-${new Date(ev.data_inicio).getMinutes()}`
        if (alertasDisparadosRef.current.has(chave)) continue
        alertasDisparadosRef.current.add(chave)

        const diffMin = Math.round((new Date(ev.data_inicio).getTime() - agora.getTime()) / 60000)
        const corpo = diffMin <= 1 ? 'Agora!' : `Em ${diffMin} minuto(s)`

        // Som de alerta via AudioContext (beep triplo)
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(880, ctx.currentTime)
          osc.frequency.setValueAtTime(660, ctx.currentTime + 0.2)
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4)
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6)
        } catch {}

        // Push Notification se permitida
        if (typeof Notification !== 'undefined') {
          if (Notification.permission === 'granted') {
            new Notification(`⏰ ${ev.titulo}`, { body: corpo, icon: '/favicon.ico', tag: ev.id })
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
              if (p === 'granted') new Notification(`⏰ ${ev.titulo}`, { body: corpo, tag: ev.id })
            })
          }
        }

        // Mensagem visual no chat
        setMensagens(prev => [...prev, {
          id: `alerta-${ev.id}-${Date.now()}`,
          role: 'ai' as const,
          texto: `⏰ Lembrete: **${ev.titulo}** — ${corpo}`,
        }])
      }
    } catch { /* silencioso */ }
  }, [supabase])

  // ── Lembretes de Vencimentos Inteligentes (1 dia e 3 dias antes) ──
  const verificarVencimentos = useCallback(async (uid: string) => {
    const hoje = new Date().toISOString().split('T')[0]

    // CORREÇÃO: usa banco (ultima_vez_vencimentos) em vez de localStorage.
    // A marcação agora acontece APÓS buscar os dados (não antes),
    // evitando silenciar vencimentos em caso de erro de rede.
    try {
      const { data: perfil } = await (supabase.from('elena_perfil') as any)
        .select('ultima_vez_vencimentos')
        .eq('user_id', uid)
        .maybeSingle()
      if (perfil?.ultima_vez_vencimentos === hoje) return // já verificou hoje
    } catch {
      // Fallback: localStorage
      const chave = `elena_venc_${hoje}`
      if (localStorage.getItem(chave)) return
    }
    try {
      const agora = new Date()
      const em3dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000)
      const { data: vencimentos } = await (supabase.from('agenda_eventos') as any)
        .select('id, titulo, data_inicio')
        .eq('user_id', uid).eq('tipo', 'vencimento')
        .gte('data_inicio', `${hoje}T00:00:00`)
        .lte('data_inicio', em3dias.toISOString())
        .neq('status', 'cancelado')
        .order('data_inicio', { ascending: true })
      if (!vencimentos?.length) return
      for (const v of vencimentos) {
        const dataVenc = new Date(v.data_inicio)
        const diffDias = Math.floor((dataVenc.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
        const chaveV = `venc_${v.id}_${hoje}`
        if (localStorage.getItem(chaveV)) continue
        localStorage.setItem(chaveV, '1')
        const emoji = diffDias === 0 ? '🔴' : diffDias === 1 ? '🟠' : '🟡'
        const urgencia = diffDias === 0 ? '**HOJE!**' : diffDias === 1 ? '**amanhã**' : `em **${diffDias} dias**`
        // Som escalonado por urgência
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          const freq = diffDias === 0 ? 1050 : diffDias === 1 ? 880 : 660
          osc.frequency.setValueAtTime(freq, ctx.currentTime)
          osc.frequency.setValueAtTime(freq * 0.8, ctx.currentTime + 0.15)
          osc.frequency.setValueAtTime(freq, ctx.currentTime + 0.3)
          gain.gain.setValueAtTime(0.25, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
        } catch {}
        setMensagens(prev => [...prev, {
          id: `venc-${v.id}-${Date.now()}`,
          role: 'ai' as const,
          texto: `${emoji} **Vencimento próximo:** ${v.titulo} — vence ${urgencia}!\nSepare o pagamento para não perder o prazo, Sr. Max.`,
        }])
      }
      // Marca no banco APÓS exibir os vencimentos com sucesso
      await (supabase.from('elena_perfil') as any).upsert(
        { user_id: uid, ultima_vez_vencimentos: hoje, ultima_atualizacao: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      // Fallback: marca no localStorage também
      try { localStorage.setItem(`elena_venc_${hoje}`, '1') } catch {}
    } catch { /* silencioso */ }
  }, [supabase])

  // Verifica vencimentos ao abrir (após 3s para não sobrecarregar)
  useEffect(() => {
    if (!userId) return
    const t = setTimeout(() => verificarVencimentos(userId), 3000)
    return () => clearTimeout(t)
  }, [userId, verificarVencimentos])

  // Carrega resumo financeiro ao abrir (e atualiza a cada 5 min)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!userId) return
    carregarResumoFinanceiro(userId)
    const t = setInterval(() => carregarResumoFinanceiro(userId), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [userId, carregarResumoFinanceiro])

  // Verifica alertas sonoros a cada 60 segundos
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!userId) return
    const t = setInterval(() => verificarAlertas(userId), 60_000)
    return () => clearInterval(t)
  }, [userId, verificarAlertas])

  // ── Briefing Matinal — exibe ao abrir pela primeira vez no dia ──
  const gerarBriefingMatinal = useCallback(async (uid: string) => {
    const hoje = new Date().toISOString().split('T')[0]

    // CORREÇÃO: verifica no banco (elena_perfil.ultima_vez_briefing) em vez de localStorage.
    // Isso funciona em múltiplos dispositivos e não some ao limpar o cache.
    try {
      const { data: perfil } = await (supabase.from('elena_perfil') as any)
        .select('ultima_vez_briefing')
        .eq('user_id', uid)
        .maybeSingle()

      if (perfil?.ultima_vez_briefing === hoje) return // já exibiu hoje

      // Marca no banco APÓS exibir (não antes — evita silenciar em caso de erro)
    } catch {
      // Se falhar a verificação, usa localStorage como fallback
      const chave = `elena_briefing_${hoje}`
      if (localStorage.getItem(chave)) return
      localStorage.setItem(chave, '1')
    }

    try {
      const agora = new Date()
      const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' })
      const dataFormatada = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

      // Hora do dia → saudação
      const hora = agora.getHours()
      const saudacao = hora < 12 ? '☀️ Bom dia' : hora < 18 ? '🌤️ Boa tarde' : '🌙 Boa noite'

      const [{ data: eventosHoje }, { data: vencimentos }, { data: gastos }, { data: receitas }] = await Promise.all([
        // Compromissos de hoje
        (supabase.from('agenda_eventos') as any)
          .select('titulo, data_inicio, tipo')
          .eq('user_id', uid)
          .gte('data_inicio', `${hoje}T00:00:00`)
          .lte('data_inicio', `${hoje}T23:59:59`)
          .neq('status', 'cancelado')
          .order('data_inicio', { ascending: true }),
        // Vencimentos nos próximos 7 dias
        (supabase.from('agenda_eventos') as any)
          .select('titulo, data_inicio')
          .eq('user_id', uid)
          .eq('tipo', 'vencimento')
          .gte('data_inicio', agora.toISOString())
          .lte('data_inicio', em7dias)
          .neq('status', 'cancelado')
          .order('data_inicio', { ascending: true }),
        // Gastos do mês
        (supabase.from('gastos_pessoais') as any)
          .select('valor').eq('user_id', uid)
          .gte('data', hoje.substring(0, 7) + '-01'),
        // Receitas do mês
        (supabase.from('receitas_pessoais') as any)
          .select('valor').eq('user_id', uid)
          .gte('data', hoje.substring(0, 7) + '-01'),
      ])

      const linhas: string[] = [
        `${saudacao}, **Sr. Max!**`,
        `Hoje é ${diaSemana}, ${dataFormatada}.`,
        '',
      ]

      // Agenda do dia
      if (eventosHoje && eventosHoje.length > 0) {
        linhas.push('📅 **Agenda de hoje:**')
        eventosHoje.forEach((ev: any) => {
          const horario = new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          linhas.push(`• ${horario} — ${ev.titulo}`)
        })
      } else {
        linhas.push('📅 **Agenda:** Nenhum compromisso hoje. Dia livre! ✨')
      }

      // Vencimentos
      if (vencimentos && vencimentos.length > 0) {
        linhas.push('')
        linhas.push('💳 **Vencimentos esta semana:**')
        vencimentos.slice(0, 4).forEach((v: any) => {
          const dataVenc = new Date(v.data_inicio)
          const eHoje = dataVenc.toISOString().split('T')[0] === hoje
          const label = eHoje ? '⚠️ Hoje' : dataVenc.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
          linhas.push(`• ${label} — ${v.titulo}`)
        })
      }

      // Financeiro
      const totalG = (gastos || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
      const totalR = (receitas || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
      if (totalG > 0 || totalR > 0) {
        linhas.push('')
        linhas.push('💰 **Financeiro do mês:**')
        linhas.push(`• Gastos: R$ ${totalG.toFixed(2)}`)
        linhas.push(`• Receitas: R$ ${totalR.toFixed(2)}`)
        const saldo = totalR - totalG
        linhas.push(`• Saldo estimado: **R$ ${saldo.toFixed(2)}** ${saldo >= 0 ? '✅' : '⚠️'}`)
      }

      linhas.push('')
      linhas.push('Pronto para começar, Sr. Max! Como posso ajudar? 🚀')

      setMensagens(prev => [...prev, {
        id: `briefing-${Date.now()}`,
        role: 'ai' as const,
        texto: linhas.join('\n'),
      }])

      // Marca no banco DEPOIS de exibir com sucesso
      await (supabase.from('elena_perfil') as any).upsert(
        { user_id: uid, ultima_vez_briefing: hoje, ultima_atualizacao: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch { /* silencioso */ }
  }, [supabase])

  // Dispara briefing matinal na primeira abertura do dia
  useEffect(() => {
    if (!userId) return
    gerarBriefingMatinal(userId)
  }, [userId, gerarBriefingMatinal])

  // ── Carregar arquivo (imagem ou PDF) ────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    setProcessingFile(true)
    try {
      const isImage = file.type.startsWith('image/')
      const isPDF = file.type === 'application/pdf'
      if (!isImage && !isPDF) {
        alert('Formato não suportado. Envie uma imagem (JPG, PNG, etc.) ou PDF.')
        setProcessingFile(false)
        return
      }

      if (isImage) {
        // Imagem: converte para base64 e mostra preview
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          setAttachedFile({ base64: dataUrl.split(',')[1], mime: file.type, name: file.name, isImage: true, preview: dataUrl })
          setProcessingFile(false)
        }
        reader.readAsDataURL(file)
      } else {
        // PDF: extrai texto no navegador usando PDF.js (CDN)
        const extractPdfText = async (): Promise<string> => {
          // Carrega PDF.js do CDN se ainda não estiver carregado
          if (!(window as any).pdfjsLib) {
            await new Promise<void>((resolve, reject) => {
              const s = document.createElement('script')
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
              s.onload = () => {
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
                resolve()
              }
              s.onerror = reject
              document.head.appendChild(s)
            })
          }
          const arrayBuffer = await file.arrayBuffer()
          const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise
          let text = ''
          for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            text += content.items.map((item: any) => item.str).join(' ') + '\n'
          }
          return text.trim().substring(0, 6000)
        }

        try {
          const texto = await extractPdfText()
          if (texto) {
            setAttachedFile({ base64: texto, mime: 'text/plain', name: file.name, isImage: false })
          } else {
            alert('PDF sem texto legível. Tente converter para imagem e envie como foto.')
          }
        } catch {
          alert('Erro ao processar o PDF. Tente novamente ou converta para imagem.')
        }
        setProcessingFile(false)
      }
    } catch {
      setProcessingFile(false)
    }
  }, [])


  // ── Busca Web (Perplexity Sonar) ──────────────────────────
  // Palavras-chave que indicam necessidade de busca na internet
  const KEYWORDS_WEB = [
    'preço', 'preco', 'valor', 'quanto custa', 'custa', 'mercado', 'comparar', 'comparação',
    'mais barato', 'melhor preço', 'promoção', 'oferta', 'cotação', 'cotacao',
    'pesquisa', 'pesquise', 'busque', 'buscar', 'procure', 'procurar',
    'notícia', 'noticia', 'novidade', 'atualidade', 'hoje', 'recente',
    'dólar', 'euro', 'câmbio', 'cambio', 'inflação', 'inflacao', 'ipca', 'selic',
    'concorrente', 'concorrência', 'mercado', 'tendência', 'tendencia',
    'amazon', 'shopee', 'mercado livre', 'magalu', 'americanas', 'casas bahia',
  ]

  const precisaBuscarWeb = (texto: string): boolean => {
    const t = texto.toLowerCase()
    return KEYWORDS_WEB.some(kw => t.includes(kw))
  }

  const buscarWeb = async (query: string, contexto?: string): Promise<string | null> => {
    try {
      setBuscandoWeb(true)
      const res = await fetch('/api/busca-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, contexto }),
      })
      const data = await res.json()
      if (!res.ok || data.error) return null
      return data.resultado ?? null
    } catch {
      return null
    } finally {
      setBuscandoWeb(false)
    }
  }

  // ── Enviar ────────────────────────────────────────────────
  const handleEnviar = useCallback(async (textToSubmit?: string) => {
    if (isSendingRef.current) return
    const userText = (textToSubmit ?? input).trim()
    const currentFile = attachedFileRef.current
    if ((!userText && !currentFile) || loading) return
    
    isSendingRef.current = true
    const aiMsgId = (Date.now() + 1).toString()
    const userMsgTexto = userText || (currentFile?.isImage ? `📎 ${currentFile.name}` : `📄 ${currentFile?.name}`)
    setMensagens(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', texto: userMsgTexto, anexo: currentFile?.isImage ? currentFile.preview : undefined },
      { id: aiMsgId, role: 'ai', texto: '...' }
    ])
    setInput('')
    transcriptRef.current = ''
    setLoading(true)

    // Obtém uid (pode não estar no state ainda)
    let uid = userId
    if (!uid) {
      const { data: auth } = await supabase.auth.getUser()
      uid = auth.user?.id || ''
      if (uid) setUserId(uid)
    }

    // Captura e limpa o arquivo
    const fileSnap = currentFile
    setAttachedFile(null)

    try {
      // Contexto: usa todas as mensagens em memória, formatadas com data para evitar confusão de tempo
      const contexto = mensagens
        .filter(m => m.texto && m.texto !== '...' && m.texto !== initialGreeting.texto)
        .slice(-20) // envia as últimas 20 interações para contexto
        .map(m => {
          const dtStr = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Agora'
          return `[${dtStr}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}: ${m.texto.substring(0, 300)}`
        })
        .join('\n')

      // Monta o prompt incluindo texto do PDF se for arquivo de texto
      let promptFinal = userText || 'Analise este arquivo e extraia as informações financeiras relevantes.'
      if (fileSnap && !fileSnap.isImage && fileSnap.mime === 'text/plain') {
        promptFinal = `${promptFinal}\n\n[CONTEÚDO DO ARQUIVO: ${fileSnap.name}]\n${fileSnap.base64}`
      }

      // ── Detecção de confirmação (Sim/Pode/Faz) ──────────────────────
      // Quando o usuário confirma uma sugestão anterior da Elena,
      // injeta instrução explícita para forçar geração do JSON imediatamente.
      const PALAVRAS_CONFIRMACAO = [
        'sim', 'pode', 'faz', 'vai lá', 'vai la', 'claro', 'ok', 'certo',
        'isso', 'confirmo', 'confirma', 'registra', 'registre', 'salva',
        'pode fazer', 'pode ser', 'faz isso', 'vai', 's', 'yes', 'yep',
        'exato', 'correto', 'isso mesmo', 'manda ver', 'bora', 'pode mandar',
      ]
      const textoLower = userText?.trim().toLowerCase() || ''
      const eConfirmacao = PALAVRAS_CONFIRMACAO.some(p => textoLower === p || textoLower === p + '!' || textoLower === p + '.')

      if (eConfirmacao && mensagens.length >= 2) {
        // Pega a última mensagem da Elena para entender o que foi sugerido
        const ultimaElena = [...mensagens].reverse().find(m => m.role === 'ai' && m.texto && m.texto !== '...')
        if (ultimaElena) {
          promptFinal = `[INSTRUÇÃO PRIORITÁRIA DO SISTEMA]: O usuário está CONFIRMANDO a ação que você sugeriu na mensagem anterior. Você DEVE gerar o bloco JSON da ação agora — EXECUTE imediatamente, não repita a pergunta, não peça confirmação novamente, não diga "vou fazer". Gere o JSON agora e confirme ao Sr. Max que foi feito.\n\nMensagem anterior da Elena (referência do que foi sugerido): "${ultimaElena.texto.substring(0, 300)}"\n\nResposta do usuário confirmando: "${userText}"\n\nEXECUTE a ação agora.`
        }
      }

      // ── Incrementa contador de msgs da sessão (para backup automático) ──
      sessionMsgCountRef.current += 1

      // ── Busca em conversas históricas ──────────────────────────────────
      // Detecta perguntas sobre conversas passadas e injeta resultados do banco
      const KEYWORDS_HISTORICO = [
        'conversamos', 'falamos', 'disse', 'comentei', 'registrei', 'anotei',
        'que você disse', 'que eu disse', 'lembra quando', 'semana passada',
        'mês passado', 'conversa anterior', 'histórico', 'sessão anterior',
        'o que conversamos', 'já falei', 'você lembra', 'busca nas conversas',
        'relatório', 'relatorio', 'resumo das conversas', 'últimas conversas',
        'o que fizemos', 'o que tratamos', 'recap', 'resumo do dia',
        'conversas de hoje', 'conversas de ontem', 'resuma nossas conversas',
      ]
      const isRelatorio = (t: string) => {
        const tl = t.toLowerCase()
        return ['relatório', 'relatorio', 'resumo das conversas', 'últimas conversas',
          'o que conversamos', 'o que fizemos', 'o que tratamos', 'recap', 'resumo do dia'].some(kw => tl.includes(kw))
      }
      const precisaBuscarHistorico = (t: string) => {
        const tl = t.toLowerCase()
        return KEYWORDS_HISTORICO.some(kw => tl.includes(kw))
      }
      if (userText && precisaBuscarHistorico(userText) && !fileSnap) {
        try {
          setMensagens(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, texto: '🔍 Buscando nas conversas anteriores...' } : m
          ))
          const limite = isRelatorio(userText) ? 30 : 8
          const resBusca = await fetch('/api/elena-busca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ termo: userText, limite }),
          })
          if (resBusca.ok) {
            const { mensagens: msgsHistorico } = await resBusca.json()
            if (msgsHistorico && msgsHistorico.length > 0) {
              const blocoHistorico = msgsHistorico
                .map((m: any) => {
                  const dt = m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
                  return `[${dt}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}: ${m.texto}`
                })
                .join('\n---\n')
              const instrucao = isRelatorio(userText)
                ? '[HISTÓRICO COMPLETO DE CONVERSAS - gere um relatório organizado por data com resumo dos assuntos tratados, ações realizadas e pontos importantes]'
                : '[CONVERSAS HISTÓRICAS RELEVANTES ENCONTRADAS NO BANCO - use para responder]'
              promptFinal = `${promptFinal}\n\n${instrucao}\n${blocoHistorico}`
            }
          }
          setMensagens(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, texto: '...' } : m
          ))
        } catch { /* silencioso */ }
      }

      // Busca web automática se o usuário perguntar sobre preços/mercado
      if (userText && precisaBuscarWeb(userText) && !fileSnap) {
        // Atualiza o placeholder para mostrar que está buscando
        setMensagens(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, texto: '🌐 Buscando na internet...' } : m
        ))
        const resultadoWeb = await buscarWeb(userText, contexto)
        if (resultadoWeb) {
          promptFinal = `${promptFinal}\n\n---\n[RESULTADO DA BUSCA NA INTERNET - use estas informações para responder com dados reais e atualizados]:\n${resultadoWeb}\n---`
        }
        // Volta para o placeholder padrão
        setMensagens(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, texto: '...' } : m
        ))
      }

      const body: Record<string, any> = {
        prompt: promptFinal,
        context: contexto,
        systemInstruction: buildSystemPrompt(perfilRef.current, resumoFinanceiro),
      }
      // Se é imagem, manda para visão (GPT-4o)
      if (fileSnap?.isImage) {
        body.imageBase64 = fileSnap.base64
        body.imageMime = fileSnap.mime
      }

      // ── Aprendizado (cada 5 msgs) + Sugestão Proativa (cada 10 msgs) ──
      userMsgCountRef.current += 1
      sugestaoCountRef.current += 1
      if (uid && userMsgCountRef.current % 5 === 0) {
        // Atualiza perfil em background
        setTimeout(() => {
          setMensagens(curr => { atualizarPerfilAprendizado(uid, curr); return curr })
        }, 2000)
      }
      if (uid && sugestaoCountRef.current % 10 === 0) {
        // Sugestão proativa a cada 10 msgs — analisa dados reais do banco
        setTimeout(() => gerarSugestaoProativa(uid), 4000)
      }

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      const resposta: string = data.result ?? ''
      const acoes = extrairAcoes(resposta)
      const acoesComStatus = acoes.map(a => ({ ...a, status: 'pending' as const }))
      const textoFormatado = formatarTexto(resposta)
      setMensagens(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, texto: textoFormatado, acoes: acoesComStatus.length > 0 ? acoesComStatus : undefined } : m
      ))

      // Salva no histórico do banco
      if (uid) {
        salvarHistorico(uid, 'user', userText, undefined, sessaoId)
        salvarHistorico(uid, 'ai', textoFormatado, acoesComStatus.length > 0 ? acoesComStatus : undefined, sessaoId)
      }

      // Auto-save ações após 600ms
      if (acoesComStatus.length > 0 && uid) {
        setTimeout(() => executarAcoesAuto(aiMsgId, acoesComStatus, uid), 600)
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Erro desconhecido'
      console.error('[Elena]', errMsg)
      setMensagens(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, texto: `Perdão, chefe. Tive um problema: ${errMsg.substring(0, 120)}` } : m
      ))
    } finally {
      setLoading(false)
      isSendingRef.current = false
      // Modo Voz Contínua: reativa mic após Elena responder
      if (modoVozRef.current) {
        setTimeout(() => {
          if (modoVozRef.current) handlePressMic()
        }, 1200)
      }
    }
  }, [input, loading, mensagens, userId, supabase, executarAcoesAuto, salvarHistorico, atualizarPerfilAprendizado, gerarSugestaoProativa])

  // ── Processar Fila Offline ao reconectar ──────────────────────────
  const processarFilaOffline = useCallback(async () => {
    if (!userId || !navigator.onLine) return
    const pendentes = await getPendentes(userId)
    if (pendentes.length === 0) return

    setMensagens(prev => [...prev, {
      id: 'sync-' + Date.now(),
      role: 'ai' as const,
      texto: `📶 **Conexão restabelecida!** Encontrei ${pendentes.length} registro(s) salvo(s) offline. Sincronizando agora...`,
    }])

    let sucesso = 0
    for (const reg of pendentes) {
      try {
        const msgId = 'offline-sync-' + reg.id
        await executarAcoesAuto(msgId, [{ tipo: reg.tipo as any, dados: reg.acao, label: '', status: 'pending' }], userId)
        await marcarProcessado(reg.id!)
        sucesso++
      } catch {
        // Mantém na fila — tentará novamente na próxima conexão
      }
    }

    if (sucesso > 0) {
      await limparProcessados()
      setMensagens(prev => [...prev, {
        id: 'sync-ok-' + Date.now(),
        role: 'ai' as const,
        texto: `✅ ${sucesso} registro(s) sincronizado(s) com sucesso!`,
      }])
    }
  }, [userId, executarAcoesAuto])

  // Dispara processamento quando volta online
  useEffect(() => {
    if (isOnline && userId) {
      const timer = setTimeout(processarFilaOffline, 1500)
      return () => clearTimeout(timer)
    }
  }, [isOnline, userId, processarFilaOffline])

  // ── Registrar offline: salva na fila IndexedDB ────────────────
  const handleRegistrarOffline = useCallback(async () => {
    if (!userId) return
    const { tipo, valor, descricao, categoria, data, hora } = offlineForm
    if (!descricao.trim()) return

    let acao: Record<string, unknown> = {}
    if (tipo === 'agenda') {
      acao = { acao: 'agenda', titulo: descricao, data_inicio: `${data}T${hora}:00`, tipo: 'lembrete' }
    } else {
      const v = parseFloat(valor.replace(',', '.'))
      if (isNaN(v) || v <= 0) return
      acao = { acao: tipo, valor: v, descricao, categoria, forma_pagamento: 'pix' }
    }

    await enqueueOffline(userId, tipo, acao)
    const pendentes = await getPendentes(userId)
    setOfflineQueue(pendentes)
    setOfflineForm(prev => ({ ...prev, valor: '', descricao: '' }))
    setOfflineSaved(true)
    setTimeout(() => setOfflineSaved(false), 2500)
  }, [userId, offlineForm])

  // ── Microfone — Mãos Livres + Zero Duplicação ─────────────────────
  // continuous=false: cada sentença é sessão independente → sem acumulação histórica
  // onend com texto → auto-envia + reinicia para próxima fala (mãos livres)
  // onend sem texto → apenas reinicia (usuário fez pausa antes de falar)
  // Timeout de 8s sem fala → para automaticamente
  const silenceTimerRef = useRef<any>(null)

  const iniciarReconhecimento = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Use o Google Chrome para usar o microfone.'); return }
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }

    transcriptRef.current = ''
    setInput('')
    setInterimTranscript('')

    // Reinicia o timer de silêncio a cada nova sessão
    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        // 8 segundos sem fala → para o microfone automaticamente
        if (isListeningRef.current) {
          isListeningRef.current = false
          if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch {}
            recognitionRef.current = null
          }
          setIsListening(false)
          setInterimTranscript('')
        }
      }, 8000)
    }

    const criarInstancia = () => {
      const r = new SR()
      r.lang = 'pt-BR'
      r.continuous = false       // ANTI-DUPLICAÇÃO: cada sentença é independente
      r.interimResults = true
      r.maxAlternatives = 1

      r.onstart = () => {
        setIsListening(true)
        resetSilenceTimer()
      }

      r.onresult = (e: any) => {
        // Com continuous=false: e.results tem 1 resultado (a sentença atual)
        // Sem risco de acumulação histórica → zero duplicação
        let textoFinal = ''
        let textoInterim = ''
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) textoFinal += e.results[i][0].transcript
          else textoInterim += e.results[i][0].transcript
        }
        if (textoFinal) {
          transcriptRef.current = (transcriptRef.current + textoFinal + ' ').trimStart()
          resetSilenceTimer() // usuário falou algo → reseta o timer
        }
        const display = (transcriptRef.current + textoInterim).trim()
        setInterimTranscript(display || transcriptRef.current.trim())
      }

      r.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          isListeningRef.current = false
          setIsListening(false)
          alert('Microfone não acessível. Clique no 🔒 na barra de endereços e permita o microfone.')
        } else if (e.error === 'audio-capture') {
          isListeningRef.current = false
          setIsListening(false)
          alert('Nenhum microfone encontrado. Conecte um e tente novamente.')
        }
        // 'no-speech' e 'aborted' → silenciosos (pausa normal ou stop manual)
      }

      r.onend = () => {
        if (!isListeningRef.current) {
          // Usuário parou manualmente → envia o que tiver
          const texto = transcriptRef.current.trim()
          transcriptRef.current = ''
          setInterimTranscript('')
          setIsListening(false)
          if (texto) setTimeout(() => handleEnviar(texto), 100)
          return
        }

        // Ainda no modo escuta (mãos livres)
        const texto = transcriptRef.current.trim()
        if (texto) {
          // Tem texto acumulado → auto-envia e continua escutando
          transcriptRef.current = ''
          setInterimTranscript('🎤 Enviado! Pode falar novamente...')
          handleEnviar(texto)
          // Reinicia após breve pausa para o usuário perceber que foi enviado
          setTimeout(() => {
            if (isListeningRef.current) {
              setInterimTranscript('')
              const nova = criarInstancia()
              recognitionRef.current = nova
              try { nova.start() } catch {}
            }
          }, 600)
        } else {
          // Sem texto (pausa antes de falar) → reinicia imediatamente
          setTimeout(() => {
            if (isListeningRef.current) {
              const nova = criarInstancia()
              recognitionRef.current = nova
              try { nova.start() } catch {}
            }
          }, 100)
        }
      }

      return r
    }

    const instancia = criarInstancia()
    recognitionRef.current = instancia
    instancia.start()
  }

  const handlePressMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Use Google Chrome ou Edge para usar o microfone.'); return }
    isListeningRef.current = true
    iniciarReconhecimento()
  }

  const handleReleaseMic = () => {
    // Para o modo mãos-livres (toggle off)
    isListeningRef.current = false
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    const textCapturado = transcriptRef.current.trim()
    transcriptRef.current = ''
    setInterimTranscript('')
    if (recognitionRef.current) {
      // onend vai capturar e enviar o texto se houver
      try { recognitionRef.current.stop() } catch {}
    }
    // Se não houver texto para o onend enviar, garante estado limpo
    if (!textCapturado) {
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  const toggleMic = () => {
    if (isListening) handleReleaseMic()
    else handlePressMic()
  }


  const handleClearChat = () => {
    if (!confirm('Deseja iniciar um NOVO assunto? O assunto atual ficará salvo no banco para consultas futuras.')) return
    setMensagens([initialGreeting])
    setSessaoId(Date.now().toString())
  }

  const loadSessoes = async () => {
    if (!userId) return
    const { data } = await supabase.from('elena_conversas').select('sessao_id, created_at, texto, role').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
    
    const agrupado = new Map<string, { data: string, resumo: string }>()
    if (data) {
      // Varre de trás pra frente para pegar a primeira mensagem do usuário como título da sessão
      const dataReversa = [...(data as any[])].reverse()
      dataReversa.forEach((m: any) => {
         if (!agrupado.has(m.sessao_id)) {
           agrupado.set(m.sessao_id, { data: m.created_at, resumo: m.texto })
         } else if (m.role === 'user' && (!agrupado.get(m.sessao_id)?.resumo || agrupado.get(m.sessao_id)!.resumo.includes('Olá, Sr. Max'))) {
           agrupado.set(m.sessao_id, { data: m.created_at, resumo: m.texto })
         }
      })
    }
    const arraySessoes = Array.from(agrupado.entries()).map(([sid, info]) => ({ sid, ...info })).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    setSessoesAnteriores(arraySessoes)
    setShowHistory(true)
  }

  const loadSpecificSession = async (sid: string) => {
    const { data: hist } = await (supabase
      .from('elena_conversas') as any)
      .select('id, role, texto, acoes, created_at')
      .eq('user_id', userId)
      .eq('sessao_id', sid)
      .order('created_at', { ascending: false })
      .limit(40)
      
    if (hist && hist.length > 0) {
      const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
        id: r.id,
        role: r.role as 'ai' | 'user',
        texto: r.texto,
        acoes: r.acoes ?? undefined,
        created_at: r.created_at,
      }))
      setMensagens([{ id: '1', role: 'ai', texto: 'Histórico carregado! O que faremos com ele?' }, ...historico])
      setSessaoId(sid)
      setShowHistory(false)
    }
  }

  if (!isClient) return null

  return (
    <>
      {/* Botão Flutuante */}
      <div
        className="fixed z-[100] cursor-grab active:cursor-grabbing"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-20" />
          <div className="w-14 h-14 rounded-full border-[2.5px] border-amber-400 p-0.5 shadow-[0_8px_20px_rgba(251,191,36,0.4)] bg-page transition-transform active:scale-95">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
              alt="Elena" className="w-full h-full rounded-full object-cover pointer-events-none"
            />
          </div>
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#080b14] rounded-full" />
        </div>
      </div>

      {/* Janela de Chat */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div
            className="w-full max-w-sm bg-[#0a0d16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
            style={{ height: '520px', animation: 'slideUpElena 0.25s ease-out' }}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-[#0d1522] to-[#080b14] border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
                  alt="Elena" className="w-8 h-8 rounded-full object-cover border border-amber-400/40 cursor-pointer"
                  onClick={() => setShowHistory(false)}
                />
                <div>
                  <p className="text-sm font-bold text-fg cursor-pointer" onClick={() => setShowHistory(false)}>Elena</p>
                  <p className="text-[10px] text-amber-400">Secretária Executiva · Registros automáticos</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => {
                  // Injeta uma mensagem de ajuda se o cliente clicar no botão de interrogação ou abre o painel visual
                  setMensagens(prev => [
                    ...prev,
                    {
                      id: String(Date.now()),
                      role: 'ai',
                      texto: `📖 **Guia Rápido de Comandos da Elena Premium** 🚀

Aqui está tudo o que você pode me pedir para fazer:

📅 **Agenda & Lembretes**
* *"Agendar reunião amanhã às 14h"*
* *"Me lembra de ligar pro fornecedor dia 28 às 10h"* (cria alarme)

💰 **Controle Financeiro**
* *"Gastei R$ 150 no mercadinho no pix"*
* *"Recebi R$ 5.000 de pro-labore"*
* *"Transferir R$ 200 do Itaú para o Bradesco"*
* *"Definir meta de gastos de R$ 2.000 em alimentação"*

🏢 **Gestão Empresarial (PJ)**
* *"Gasto de 500 no escritório"*
* *"Faturamento de 15.000 da consultoria"*
* *Nota: Gastos PJ acima de R$ 1.000 exigem sua aprovação verbal!*

📊 **Visão de Negócios & Equipe**
* *"Gerar meu checklist executivo"* (cria tarefas prioritárias)
* *"Como está a performance da equipe?"* (busca ocorrências)
* *"Mostrar meu dashboard financeiro"* (exibe gráficos de barras)
* *"Extrato bancário"* (pode colar o extrato direto no chat!)

🎙️ **Modo Hands-Free (Voz Contínua)**
* Clique no ícone **🎙️∞** para ativar o modo contínuo de voz (ótimo para usar no trânsito!).`
                    }
                  ])
                }} title="Ver guia de recursos da Elena" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-amber-400 hover:bg-amber-400/10 transition-colors text-xs">❓</button>
                <button onClick={loadSessoes} title="Ver conversas passadas" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-blue-400 hover:bg-blue-400/10 transition-colors text-xs">🗂️</button>
                <button onClick={handleClearChat} title="Nova conversa (iniciar novo assunto)" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors text-xs">✨</button>
                <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-red-400 hover:bg-red-400/10 text-sm">✕</button>
              </div>
            </div>

            {/* Banner Offline */}
            {!isOnline && (
              <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/20 flex items-center gap-2 shrink-0">
                <span className="text-amber-400 text-xs">⚡</span>
                <p className="text-[10px] text-amber-400 font-semibold">Sem internet — registros serão salvos ao reconectar</p>
              </div>
            )}

            {/* View do Histórico de Conversas */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#0a0d16]">
                <p className="text-xs font-semibold text-fg-secondary px-2 mb-3 uppercase tracking-wider">Histórico de Chats</p>
                {sessoesAnteriores.map(s => (
                  <button
                    key={s.sid}
                    onClick={() => loadSpecificSession(s.sid)}
                    className={cn("w-full text-left p-3 rounded-xl border transition-all", s.sid === sessaoId ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-fg")}
                  >
                    <p className="text-xs font-semibold truncate mb-1">{s.resumo.replace(/```json[\s\S]*?```/g, '').substring(0, 60) || 'Conversa sem título'}</p>
                    <p className="text-[10px] text-fg-tertiary">{new Date(s.data).toLocaleString('pt-BR')}</p>
                  </button>
                ))}
                {sessoesAnteriores.length === 0 && (
                  <p className="text-xs text-fg-tertiary text-center py-10">Nenhuma conversa encontrada.</p>
                )}
              </div>
            ) : (
              <>
                {/* Offline Form ou Chat Normal */}
                {!isOnline ? (
                  <div className="flex-1 overflow-y-auto p-4 bg-[#0a0d16] flex flex-col gap-3">
                    {/* Header offline */}
                    <div className="text-center pt-2 pb-1">
                      <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto mb-2">📵</div>
                      <p className="text-sm font-bold text-fg">Modo Offline</p>
                      <p className="text-[11px] text-fg-tertiary mt-0.5">Registre aqui — sincroniza ao reconectar</p>
                    </div>

                    {/* Tipo */}
                    <div className="flex gap-1.5">
                      {(['gasto', 'receita', 'agenda'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setOfflineForm(prev => ({ ...prev, tipo: t }))}
                          className={cn(
                            'flex-1 py-2 rounded-lg text-[11px] font-bold transition-all',
                            offlineForm.tipo === t
                              ? t === 'gasto'   ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : t === 'receita' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-white/5 text-fg-tertiary border border-white/5 hover:border-white/10'
                          )}
                        >
                          {t === 'gasto' ? '💸 Gasto' : t === 'receita' ? '💰 Receita' : '📅 Agenda'}
                        </button>
                      ))}
                    </div>

                    {/* Valor */}
                    {offlineForm.tipo !== 'agenda' && (
                      <input
                        type="number" inputMode="decimal"
                        placeholder="Valor (R$)"
                        value={offlineForm.valor}
                        onChange={e => setOfflineForm(prev => ({ ...prev, valor: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors"
                      />
                    )}

                    {/* Descrição / Título */}
                    <input
                      type="text"
                      placeholder={offlineForm.tipo === 'agenda' ? 'Título do evento' : 'Descrição'}
                      value={offlineForm.descricao}
                      onChange={e => setOfflineForm(prev => ({ ...prev, descricao: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors"
                    />

                    {/* Data+Hora ou Categoria */}
                    {offlineForm.tipo === 'agenda' ? (
                      <div className="flex gap-2">
                        <input type="date" value={offlineForm.data}
                          onChange={e => setOfflineForm(prev => ({ ...prev, data: e.target.value }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-fg focus:outline-none focus:border-amber-400/50"
                        />
                        <input type="time" value={offlineForm.hora}
                          onChange={e => setOfflineForm(prev => ({ ...prev, hora: e.target.value }))}
                          className="w-[90px] bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-fg focus:outline-none focus:border-amber-400/50"
                        />
                      </div>
                    ) : (
                      <select value={offlineForm.categoria}
                        onChange={e => setOfflineForm(prev => ({ ...prev, categoria: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-amber-400/50"
                      >
                        {offlineForm.tipo === 'gasto' ? (<>
                          <option value="alimentacao">🍽️ Alimentação</option>
                          <option value="transporte">🚗 Transporte</option>
                          <option value="saude">❤️ Saúde</option>
                          <option value="lazer">🎮 Lazer</option>
                          <option value="moradia">🏠 Moradia</option>
                          <option value="tecnologia">💻 Tecnologia</option>
                          <option value="outros">📦 Outros</option>
                        </>) : (<>
                          <option value="pro_labore">💼 Pró-labore</option>
                          <option value="freelance">🔧 Freelance</option>
                          <option value="investimentos">📈 Investimentos</option>
                          <option value="aluguel">🏠 Aluguel</option>
                          <option value="vendas">🛒 Vendas</option>
                          <option value="outros">📦 Outros</option>
                        </>)}
                      </select>
                    )}

                    {/* Botão salvar */}
                    <button
                      onClick={handleRegistrarOffline}
                      disabled={!offlineForm.descricao.trim() || (offlineForm.tipo !== 'agenda' && !offlineForm.valor)}
                      className={cn(
                        'w-full py-2.5 rounded-xl text-sm font-bold transition-all',
                        offlineSaved
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed'
                      )}
                    >
                      {offlineSaved ? '✅ Salvo na fila!' : '📥 Salvar na Fila Offline'}
                    </button>

                    {/* Fila pendente */}
                    {offlineQueue.length > 0 && (
                      <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-fg-tertiary uppercase tracking-wider font-semibold mb-2">
                          ⏳ Aguardando sync ({offlineQueue.length})
                        </p>
                        <div className="space-y-1.5">
                          {offlineQueue.slice(0, 6).map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className="shrink-0">
                                {item.tipo === 'gasto' ? '💸' : item.tipo === 'receita' ? '💰' : '📅'}
                              </span>
                              <span className="flex-1 text-fg-secondary truncate">
                                {String(item.acao.descricao || item.acao.titulo || item.tipo)}
                              </span>
                              {item.acao.valor && (
                                <span className="text-amber-400 shrink-0 font-semibold">
                                  R$ {Number(item.acao.valor).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
              {mensagens.map(msg => {
                const isAi = msg.role === 'ai'
                return (
                  <div key={msg.id} className={cn('flex flex-col', isAi ? 'items-start' : 'items-end')}>
                    <div className={cn(
                      'max-w-[88%] px-3 py-2 rounded-2xl leading-relaxed text-xs',
                      isAi ? 'bg-muted text-fg rounded-tl-sm' : 'bg-amber-600 text-white rounded-tr-sm'
                    )}>
                      {msg.texto === '...' ? (
                        <span className="flex gap-1"><span className="animate-bounce">●</span><span className="animate-bounce" style={{animationDelay:'0.1s'}}>●</span><span className="animate-bounce" style={{animationDelay:'0.2s'}}>●</span></span>
                      ) : (
                        <>
                          {msg.anexo && <img src={msg.anexo} alt="anexo" className="max-w-full rounded-lg mb-1 max-h-32 object-contain" />}
                          {isAi ? (
                            <span dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(msg.texto) }} />
                          ) : (
                            msg.texto
                          )}
                        </>
                      )}
                    </div>
                    {/* Status badges */}
                    {isAi && msg.acoes && msg.acoes.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1 w-full max-w-[88%]">
                        {msg.acoes.map((acao, idx) => (
                          <div key={idx} className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] border',
                            acao.status === 'saving' ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' :
                            acao.status === 'saved'  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            acao.status === 'error'  ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-blue-500/10 border-blue-500/20 text-blue-300 animate-pulse'
                          )}>
                            {acao.status === 'saving' && <svg className="w-3 h-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                            {acao.status === 'saved'  && <span>✅</span>}
                            {acao.status === 'error'  && <span>❌</span>}
                            {(!acao.status || acao.status === 'pending') && <span>{acao.tipo === 'gasto' ? '💸' : acao.tipo === 'receita' ? '💰' : acao.tipo === 'ocorrencia' ? '📋' : '📅'}</span>}
                            <span className="truncate">{acao.status === 'saved' ? 'Registrado automaticamente' : acao.status === 'saving' ? 'Salvando...' : acao.status === 'error' ? (acao.errorMsg || 'Erro') : acao.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
                )} {/* fim offline/online */}

            {/* Preview do Anexo */}
            {attachedFile && (
              <div className="px-3 pb-1 shrink-0">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {attachedFile.isImage && attachedFile.preview ? (
                    <img src={attachedFile.preview} alt="preview" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-amber-500/20 flex items-center justify-center text-amber-400 text-lg shrink-0">📄</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-amber-400 truncate">{attachedFile.name}</p>
                    <p className="text-[9px] text-fg-tertiary">{attachedFile.isImage ? 'Imagem pronta para análise' : 'PDF extraído — pronto para análise'}</p>
                  </div>
                  <button onClick={() => setAttachedFile(null)} className="text-fg-tertiary hover:text-fg text-sm shrink-0">✕</button>
                </div>
              </div>
            )}

            {/* Input — desativado quando offline */}
            {!isOnline ? (
              <div className="p-3 border-t border-border-subtle shrink-0">
                <div className="flex items-center justify-center gap-2 bg-white/3 rounded-xl py-2.5 border border-white/5">
                  <span className="text-xs">📵</span>
                  <p className="text-[11px] text-fg-tertiary">Chat indisponível offline — use o formulário acima</p>
                </div>
              </div>
            ) : (
            <div className="p-3 border-t border-border-subtle shrink-0">
              {/* Input oculto para arquivo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
              />
              <div className="flex items-center gap-2 bg-page rounded-xl p-1 border border-border-subtle focus-within:border-amber-500/40 transition-colors">
                {/* Botão microfone (Toggle) */}
                <button
                  onClick={toggleMic}
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'text-fg-tertiary hover:text-amber-400')}
                  title={isListening ? 'Parar e enviar' : 'Clique para falar'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </button>
                {/* Botão Modo Voz Contínua */}
                <button
                  onClick={() => {
                    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
                    if (isIOS) {
                      alert('O Modo Mãos-Livres (Voz Contínua) não é suportado no iPhone devido a restrições de privacidade da Apple (o iOS exige um clique físico para ativar o microfone a cada resposta). Por favor, use o botão do microfone comum para falar!')
                      return
                    }
                    const novo = !modoVozContinuo
                    setModoVozContinuo(novo)
                    modoVozRef.current = novo
                    if (novo && !isListening) handlePressMic()
                    if (!novo && isListening) handleReleaseMic()
                  }}
                  className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all text-[10px] font-bold',
                    modoVozContinuo ? 'bg-emerald-500 text-white animate-pulse' : 'text-fg-tertiary hover:text-emerald-400 opacity-60')}
                  title={modoVozContinuo ? 'Modo mãos-livres ATIVO — clique para desativar' : 'Ativar modo mãos-livres (Elena ouve automaticamente)'}
                >
                  ∞
                </button>
                {/* Botão Anexar */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processingFile}
                  title="Enviar imagem ou PDF"
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                    processingFile ? 'animate-pulse text-amber-400' :
                    attachedFile ? 'bg-amber-500/20 text-amber-400' :
                    'text-fg-tertiary hover:text-amber-400')}
                >
                  {processingFile
                    ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  }
                </button>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-0 focus:ring-0 text-xs text-fg placeholder-zinc-600 h-8"
                  placeholder={
                    buscandoWeb ? '🌐 Buscando na internet...' :
                    isListening ? '🎙️ Ouvindo... clique novamente no microfone para enviar' :
                    attachedFile ? 'Descreva o que quer saber...' :
                    'Diga um comando para a Elena...'
                  }
                  // ✅ FIX 3: mostra o texto capturado em tempo real
                  value={isListening ? interimTranscript : input}
                  onChange={e => !isListening && setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isListening && handleEnviar()}
                />
                <button
                  onClick={() => handleEnviar()}
                  disabled={(!input.trim() && !attachedFile) || loading || buscandoWeb}
                  className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
                >
                  {buscandoWeb ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  )}
                </button>
              </div>
            </div>
            )} {/* fim input offline/online */}
            </>
          )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpElena {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      {/* Modal de Relatório — abre quando Elena gera um relatório */}
      {relatorioData && (
        <ModalRelatorio
          dados={relatorioData}
          onClose={() => setRelatorioData(null)}
        />
      )}
    </>
  )
}
