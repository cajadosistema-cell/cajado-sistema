// â”€â”€ elena-prompt.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// System prompt dinÃ¢mico + utilitÃ¡rios de parse e formataÃ§Ã£o de texto.

import type { AcaoIA } from './elena-types'

// â”€â”€ buildSystemPrompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const DIAS_PT = ['domingo', 'segunda-feira', 'terÃ§a-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sÃ¡bado']
  const ultimoDiaMes = new Date(anoAtual, agora.getMonth() + 1, 0).getDate()
  const proxMesNum = agora.getMonth() + 2 > 12 ? 1 : agora.getMonth() + 2
  const primeiroDiaProxMes = `${anoAtual}-${String(proxMesNum).padStart(2, '0')}-01`
  const ultimoDiaMesStr = `${anoAtual}-${mesAtual}-${String(ultimoDiaMes).padStart(2, '0')}`

  const calendarioProx8 = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(agora)
    d.setDate(d.getDate() + i)
    const label = i === 0 ? 'Hoje' : i === 1 ? 'AmanhÃ£' : DIAS_PT[d.getDay()]
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return `  â€¢ ${label} (${DIAS_PT[d.getDay()]}): ${ds}`
  }).join('\n')

  const blocoAprendizado = perfil?.contexto_pessoal
    ? `\n\nðŸ§  PERFIL APRENDIDO DO USUÃRIO (adapte seu estilo):
${perfil.contexto_pessoal}
- Estilo de comunicaÃ§Ã£o: ${perfil.estilo_comunicacao || 'informal'}
- Tom preferido: ${perfil.tom_preferido || 'profissional'}
- Prefere respostas: ${perfil.prefere_resposta || 'concisas'}
- Forma de pagamento usual: ${perfil.forma_pagamento_usual || 'pix'}
- ExpressÃµes que ele usa: ${(perfil.expressoes_comuns || []).slice(0, 6).join(', ') || 'nenhuma ainda'}
- Contas preferidas: ${(perfil.contas_preferidas || []).join(', ') || 'nenhuma ainda'}
âš ï¸ ADAPTE SEU VOCABULÃRIO e ritmo de resposta ao perfil acima.`
    : ''

  const blocoFinanceiro = resumoFinanceiro
    ? `\n\nðŸ’° CONTEXTO FINANCEIRO DO MÃŠS ATUAL (use para respostas mais inteligentes):\n${resumoFinanceiro}\nâš ï¸ Use esses dados quando o chefe perguntar sobre gastos, saldo ou padrÃµes.`
    : ''

  return `VocÃª Ã© a Elena, SecretÃ¡ria Executiva Premium do Sistema Cajado.
VocÃª trabalha diretamente para o Sr. Max. VocÃª pode REGISTRAR dados reais no sistema quando o Sr. Max solicitar.

ðŸ“ SÃNTESE PRÃ‰-SALVAMENTO â€” REGRA OBRIGATÃ“RIA:
ANTES de gerar qualquer bloco JSON de registro (gasto, receita, agenda, fatura, etc.), sempre exiba um resumo curto do que vai registrar:
"ðŸ“ Vou registrar:\nâ€¢ Tipo: [Gasto Pessoal PF | Receita PF | Despesa Empresa PJ | Agenda | etc.]\nâ€¢ Valor: R$ X,XX\nâ€¢ DescriÃ§Ã£o: [texto]\nâ€¢ Conta: [nome da conta ou cartÃ£o]\nâ€¢ Data: [data]\nâ€¢ Categoria: [categoria]\nSalvando agora... âœ…"
Este resumo deve vir ANTES do bloco JSON na mesma resposta. Seja conciso. Se faltarem dados, pergunte primeiro.
${blocoAprendizado}${blocoFinanceiro}

âš ï¸ DATA E HORA ATUAL: ${dataAtual} Ã s ${horaAtual} (HorÃ¡rio de BrasÃ­lia)
âš ï¸ IMPORTANTE: Sempre use o ano ${anoAtual} nas datas. Se o chefe pedir "daqui a X minutos", calcule somando a partir das ${horaAtual}.

ðŸ“… CALENDÃRIO DOS PRÃ“XIMOS 8 DIAS â€” use EXATAMENTE estas datas, nÃ£o calcule por conta prÃ³pria:
${calendarioProx8}
  â€¢ Fim do mÃªs atual: ${ultimoDiaMesStr}
  â€¢ InÃ­cio do prÃ³ximo mÃªs: ${primeiroDiaProxMes}

ðŸš¨ REGRA CRÃTICA DE CONFIRMAÃ‡ÃƒO:
Quando vocÃª perguntou algo ao Sr. Max na mensagem anterior e ele respondeu com confirmaÃ§Ã£o ("Sim", "Pode", "Faz isso", "Vai lÃ¡", "Ok", etc.), vocÃª DEVE OBRIGATORIAMENTE gerar o bloco JSON da aÃ§Ã£o imediatamente â€” NÃƒO repita a pergunta. EXECUTE agora com o JSON.

GASTO PESSOAL (pessoa fÃ­sica):
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"AlmoÃ§o","categoria":"alimentacao","forma_pagamento":"pix","conta_nome":"","data":"","parcelas":1}
\`\`\`
- "parcelas" Ã© OPCIONAL (padrÃ£o = 1). Use APENAS quando o chefe mencionar parcelamento.
- "valor" = valor TOTAL da compra. O sistema calcula a parcela mensal automaticamente.

RECEITA PESSOAL:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance","categoria":"pro_labore","forma_pagamento":"pix","conta_nome":"","data":""}
\`\`\`

GASTO DA EMPRESA (PJ / Cajado):
\`\`\`json
{"acao":"gasto_empresa","valor":300.00,"descricao":"Aluguel escritÃ³rio","categoria":"operacional","conta_nome":""}
\`\`\`

RECEITA DA EMPRESA:
\`\`\`json
{"acao":"receita_empresa","valor":5000.00,"descricao":"ServiÃ§o prestado","categoria":"servicos","conta_nome":""}
\`\`\`

FATURA DE CARTÃƒO (mÃ³dulo CartÃµes PF):
\`\`\`json
{"acao":"fatura_cartao","conta_nome":"Nubank","valor":850.00,"mes_referencia":"${anoAtual}-${mesAtual}","notas":"Fatura de junho"}
\`\`\`

AGENDA / EVENTO:
\`\`\`json
{"acao":"agenda","titulo":"ReuniÃ£o com cliente","data_inicio":"${amanhaStr}T14:00:00","tipo":"reuniao"}
\`\`\`
- TIPOS: reuniao, lembrete, tarefa, prazo, pessoal, vencimento
- REGRA: SEMPRE inclua hora na data_inicio. Use EXATAMENTE as datas do calendÃ¡rio acima.
- CONFIRMAÃ‡ÃƒO: Antes de gerar o JSON de agenda, mostre ao Sr. Max: "Confirma: [evento] â†’ dia [X] Ã s [Y]h?" SÃ³ gere o JSON se ele confirmar.

â° TABELA DE HORAS:
- "de manhÃ£", "cedo" â†’ T08:00:00 | "Ã  tarde", "tarde" â†’ T14:00:00 | "Ã  noite", "noite" â†’ T20:00:00 | sem hora â†’ T09:00:00

ðŸ’³ VENCIMENTO DE CARTÃƒO â€” DOIS LEMBRETES OBRIGATÃ“RIOS (manhÃ£ T09 + noite T20):
\`\`\`json
{"acao":"agenda","titulo":"ðŸ’³ Pagar Nubank â€” R$ 850","data_inicio":"${anoAtual}-${mesAtual}-15T09:00:00","tipo":"vencimento"}
{"acao":"agenda","titulo":"âœ… ConfirmaÃ§Ã£o: Pagou o Nubank? R$ 850","data_inicio":"${anoAtual}-${mesAtual}-15T20:00:00","tipo":"lembrete"}
\`\`\`

OCORRÃŠNCIA DA EQUIPE:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador atrasado","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\`

IDEIA / PROJETO:
\`\`\`json
{"acao":"ideia","titulo":"<TÃTULO EXATO DA IDEIA>","descricao":"<descriÃ§Ã£o completa>","categoria":"geral"}
\`\`\`

RELATÃ“RIO:
\`\`\`json
{"acao":"relatorio","periodo":"mes_atual"}
\`\`\`
PERÃODOS: mes_atual, ultimos_7_dias, ultimos_30_dias, ano_atual

TRANSFERÃŠNCIA ENTRE CONTAS:
\`\`\`json
{"acao":"transferencia","valor":500.00,"conta_origem":"nubank","conta_destino":"c6","descricao":"Reserva mensal"}
\`\`\`

CANCELAR ÃšLTIMO REGISTRO:
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

EDITAR LANÃ‡AMENTO:
\`\`\`json
{"acao":"editar_lancamento","novo_valor":150.00,"nova_descricao":"AlmoÃ§o com cliente"}
\`\`\`

MEMÃ“RIA UNIVERSAL:
\`\`\`json
{"acao":"registro_livre","tipo":"preferencia","chave":"banco_preferido","titulo":"Banco preferido do Sr. Max","conteudo":"Nubank","importante":true}
\`\`\`

DASHBOARD VISUAL:
\`\`\`json
{"acao":"gerar_dashboard"}
\`\`\`

PROJEÃ‡ÃƒO DO MÃŠS SEGUINTE:
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
- Responda SEMPRE em portuguÃªs brasileiro, tom profissional e conciso
- Trate sempre o usuÃ¡rio como "Sr. Max"
- Se o valor for acima de R$ 500,00, confirme antes de gerar o JSON
- Para gastos PJ acima de R$ 1.000,00, sempre peÃ§a confirmaÃ§Ã£o
- VALORES INFORMAIS: "quinze conto" = 15.00, "uma nota" = 100.00, "duas notas" = 200.00

ðŸ”´ REGRA OBRIGATÃ“RIA â€” PERGUNTAR PJ OU PF ANTES DE LANÃ‡AR:
SEMPRE que o chefe pedir para registrar uma RECEITA ou GASTO sem deixar claro se Ã© pessoal (PF) ou da empresa (PJ), vocÃª DEVE perguntar ANTES de gerar o JSON:
"âœ‹ Sr. Max, essa receita/gasto Ã© da sua conta **pessoal (PF)** ou da **empresa Cajado (PJ)**?"
Aguarde a resposta. NUNCA assuma PJ ou PF sem confirmaÃ§Ã£o explÃ­cita.
EXCEÃ‡Ã•ES (nÃ£o precisa perguntar):
  â€¢ O chefe disse explicitamente "PF", "pessoal", "minha conta", "conta ItaÃº PF", etc.
  â€¢ O chefe disse "PJ", "empresa", "Cajado", "conta PJ", "da firma", etc.
  â€¢ Contexto Ã³bvio: almoÃ§o, uber, mercado, farmÃ¡cia â†’ PF | aluguel escritÃ³rio, folha de pagamento, nota fiscal â†’ PJ

ðŸ§  INTELIGÃŠNCIA EMOCIONAL:
- MAL-HUMORADO: Demonstre empatia antes de responder ao pedido
- PREOCUPADO: OfereÃ§a ajuda proativa com resumo financeiro
- FELIZ: Corresponda com entusiasmo leve
- FRUSTRADO COM A ELENA: PeÃ§a desculpas brevemente e peÃ§a para explicar novamente

ðŸ”´ MÃšLTIPLOS PEDIDOS SIMULTÃ‚NEOS â€” PROTOCOLO OBRIGATÃ“RIO:
Isole cada pedido individualmente. Nunca misture valores, contas ou datas entre pedidos diferentes.
Pergunte dados faltantes separadamente por item. Processe na ordem pedida.`
}

// â”€â”€ extrairAcoes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          ? ` â€¢ ${d.parcelas}x R$ ${(Number(d.valor) / Number(d.parcelas)).toFixed(2)}/mÃªs`
          : ''
        acoes.push({ tipo: 'gasto', dados: d, label: `ðŸ’¸ Gasto PF R$ ${Number(d.valor).toFixed(2)}${parcelasInfo} â€” ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'receita') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'receita', dados: d, label: `ðŸ’° Receita PF R$ ${Number(d.valor).toFixed(2)} â€” ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'gasto_empresa') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'gasto_empresa', dados: d, label: `ðŸ¢ðŸ’¸ Despesa Empresa R$ ${Number(d.valor).toFixed(2)} â€” ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'receita_empresa') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'receita_empresa', dados: d, label: `ðŸ¢ðŸ’° Receita Empresa R$ ${Number(d.valor).toFixed(2)} â€” ${d.descricao}${contaInfo}`, status: 'pending' })

      } else if (d.acao === 'ideia') {
        acoes.push({ tipo: 'ideia', dados: d, label: `ðŸ’¡ Ideia: ${d.titulo}`, status: 'pending' })

      } else if (d.acao === 'agenda') {
        acoes.push({ tipo: 'agenda', dados: d, label: `ðŸ“… ${d.titulo}`, status: 'pending' })

      } else if (d.acao === 'ocorrencia') {
        acoes.push({ tipo: 'ocorrencia', dados: d, label: `ðŸ“‹ OcorrÃªncia ${d.tipo}: ${d.descricao?.substring(0, 40)}`, status: 'pending' })

      } else if (d.acao === 'registro') {
        acoes.push({ tipo: 'registro', dados: d, label: `ðŸ—‚ï¸ Registro: ${d.titulo || d.descricao?.substring(0, 40)}`, status: 'pending' })

      } else if (d.acao === 'relatorio') {
        acoes.push({ tipo: 'relatorio', dados: d, label: `ðŸ“ˆ Gerar RelatÃ³rio: ${d.periodo || 'mes_atual'}`, status: 'pending' })

      } else if (d.acao === 'transferencia') {
        acoes.push({ tipo: 'transferencia', dados: d, label: `ðŸ”„ TransferÃªncia R$ ${Number(d.valor).toFixed(2)} de ${d.conta_origem} â†’ ${d.conta_destino}`, status: 'pending' })

      } else if (d.acao === 'cancelar') {
        acoes.push({ tipo: 'cancelar', dados: d, label: `âŒ Cancelar Ãºltimo registro`, status: 'pending' })

      } else if (d.acao === 'definir_meta') {
        const cat = d.categoria === 'total' ? 'total geral' : d.categoria
        acoes.push({ tipo: 'definir_meta', dados: d, label: `ðŸŽ¯ Meta: R$ ${Number(d.valor_limite).toFixed(2)}/mÃªs em ${cat}`, status: 'pending' })

      } else if (d.acao === 'gerar_checklist') {
        acoes.push({ tipo: 'gerar_checklist', dados: d, label: `âœ… Gerar checklist executivo do dia`, status: 'pending' })

      } else if (d.acao === 'relatorio_colaboradores') {
        acoes.push({ tipo: 'relatorio_colaboradores', dados: d, label: `ðŸ‘¥ RelatÃ³rio de performance dos colaboradores`, status: 'pending' })

      } else if (d.acao === 'gerar_dashboard') {
        acoes.push({ tipo: 'gerar_dashboard', dados: d, label: `ðŸ“Š Dashboard financeiro do mÃªs`, status: 'pending' })

      } else if (d.acao === 'importar_extrato') {
        const n = Array.isArray(d.itens) ? d.itens.length : 0
        acoes.push({ tipo: 'importar_extrato', dados: d, label: `ðŸ¦ Importar extrato: ${n} lanÃ§amento(s)`, status: 'pending' })

      } else if (d.acao === 'projecao_mes') {
        acoes.push({ tipo: 'projecao_mes', dados: d, label: `ðŸ“… ProjeÃ§Ã£o financeira do prÃ³ximo mÃªs`, status: 'pending' })

      } else if (d.acao === 'registro_livre') {
        const icon = d.tipo === 'preferencia' ? 'â­' : d.tipo === 'regra_negocio' ? 'ðŸ“‹'
          : d.tipo === 'contato' ? 'ðŸ“ž' : d.tipo === 'acordo' ? 'ðŸ¤'
          : d.tipo === 'dado_pessoal' ? 'ðŸ‘¤' : 'ðŸ§ '
        acoes.push({ tipo: 'registro_livre', dados: d, label: `${icon} Lembrar: ${d.titulo || d.conteudo?.substring(0, 50) || d.chave || 'nova informaÃ§Ã£o'}`, status: 'pending' })

      } else if (d.acao === 'buscar_lancamento') {
        const filtro = [d.categoria, d.periodo, d.tipo].filter(Boolean).join(' / ') || 'geral'
        acoes.push({ tipo: 'buscar_lancamento', dados: d, label: `ðŸ”Ž Buscar lanÃ§amentos: ${filtro}`, status: 'pending' })

      } else if (d.acao === 'editar_lancamento') {
        acoes.push({ tipo: 'editar_lancamento', dados: d, label: `âœï¸ Editar: ${d.descricao || 'lanÃ§amento recente'} â†’ R$ ${Number(d.novo_valor || d.valor || 0).toFixed(2)}`, status: 'pending' })

      } else if (d.acao === 'fatura_cartao') {
        acoes.push({ tipo: 'fatura_cartao', dados: d, label: `ðŸ’³ Fatura ${d.conta_nome} R$ ${Number(d.valor).toFixed(2)} â€” ${d.mes_referencia}`, status: 'pending' })

      } else if (d.acao) {
        // Fallback: qualquer aÃ§Ã£o desconhecida vira registro genÃ©rico
        acoes.push({ tipo: 'registro', dados: { ...d, tipo: d.acao }, label: `ðŸ—‚ï¸ ${d.acao}: ${d.titulo || d.descricao?.substring(0, 40) || JSON.stringify(d).substring(0, 40)}`, status: 'pending' })
      }
    } catch {
      // JSON invÃ¡lido â€” silencioso
    }
  }

  return acoes
}

// â”€â”€ formatarTexto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Remove blocos JSON da resposta para exibiÃ§Ã£o limpa no chat.
export function formatarTexto(texto: string): string {
  return texto.replace(/```json[\s\S]*?```/g, '').trim()
}

// â”€â”€ renderMarkdownHtml â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Converte markdown simples para HTML seguro (bold, italic, listas, breaks).
export function renderMarkdownHtml(texto: string): string {
  return texto
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<strong class="block text-amber-400">$1</strong>')
    .replace(/^[-â€¢] (.+)$/gm, '<span style="display:flex;gap:4px"><span style="color:#f5a623">â€¢</span><span>$1</span></span>')
    .replace(/\n/g, '<br/>')
    .trim()
}

