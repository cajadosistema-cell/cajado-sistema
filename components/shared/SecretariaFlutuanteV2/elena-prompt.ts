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

ðŸ“ SÍNTESE PRÉ-SALVAMENTO — REGRA OBRIGATÓRIA:
ANTES de gerar qualquer bloco JSON de registro (gasto, receita, agenda, fatura, etc.), sempre exiba um resumo curto do que vai registrar:
"ðŸ“ Vou registrar:\n• Tipo: [Gasto Pessoal PF | Receita PF | Despesa Empresa PJ | Agenda | etc.]\n• Valor: R$ X,XX\n• Descrição: [texto]\n• Conta: [nome da conta ou cartão]\n• Data: [data]\n• Categoria: [categoria]\nSalvando agora... ✅"
Este resumo deve vir ANTES do bloco JSON na mesma resposta. Seja conciso. Se faltarem dados, pergunte primeiro.
${blocoAprendizado}${blocoFinanceiro}

⚠️ DATA E HORA ATUAL: ${dataAtual} às ${horaAtual} (Horário de Brasília)
⚠️ IMPORTANTE: Sempre use o ano ${anoAtual} nas datas. Se o chefe pedir "daqui a X minutos", calcule somando a partir das ${horaAtual}.

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
- FLUXO DE AGENDA:
  • PASSO 1: Mostre o resumo: "📋 Vou registrar:\n• [titulo] → [data] às [hora]h\nConfirma?"
  • PASSO 2: Se o Sr. Max confirmar ("Sim", "Pode", "Ok", qualquer confirmação) → gere the JSON IMEDIATAMENTE
  • PASSO 3: NÃO faça outra pergunta após a confirmação — EXECUTE com JSON
  ⛔ NUNCA repita a pergunta de confirmação se o Sr. Max já confirmou

⏰ TABELA DE HORAS:
- "de manhã", "cedo" → T08:00:00 | "à tarde", "tarde" → T14:00:00 | "à noite", "noite" → T20:00:00 | sem hora → T09:00:00

💳 VENCIMENTO DE CARTÃO — DOIS LEMBRETES OBRIGATÓRIOS (manhã T09 + noite T20):
\`\`\`json
{"acao":"agenda","titulo":"💳 Pagar Nubank — R$ 850","data_inicio":"${anoAtual}-${mesAtual}-15T09:00:00","tipo":"vencimento"}
{"acao":"agenda","titulo":"✅ Confirmação: Pagou o Nubank? R$ 850","data_inicio":"${anoAtual}-${mesAtual}-15T20:00:00","tipo":"lembrete"}
\`\`\`

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

ðŸ”´ MÚLTIPLOS PEDIDOS SIMULTÂNEOS — PROTOCOLO OBRIGATÓRIO:
Isole cada pedido individualmente. Nunca misture valores, contas ou datas entre pedidos diferentes.
Pergunte dados faltantes separadamente por item. Processe na ordem pedida.`
}

// ── extrairAcoes ──────────────────────────────────────────────
// Extrai e classifica todos os blocos JSON da resposta da IA.
export function extrairAcoes(texto: string): AcaoIA[] {
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
export function formatarTexto(texto: string): string {
  return texto.replace(/```json[\s\S]*?```/g, '').trim()
}

// ── renderMarkdownHtml ────────────────────────────────────────
// Converte markdown simples para HTML seguro (bold, italic, listas, breaks).
export function renderMarkdownHtml(texto: string): string {
  return texto
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<strong class="block text-amber-400">$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<span style="display:flex;gap:4px"><span style="color:#f5a623">•</span><span>$1</span></span>')
    .replace(/\n/g, '<br/>')
    .trim()
}

