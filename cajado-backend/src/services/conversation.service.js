const { supabase } = require("../config/database");
const { botPausado, conversas, ADMIN_DEFAULT, chaveConversa } = require("../config/memory");

/**
 * Registra uma mensagem na conversa em memória e persiste no Supabase.
 * Serve como ponto central de escrita — NUNCA faça upsert diretamente
 * fora desta função para evitar dados inconsistentes.
 *
 * IMPORTANTE (isolamento multi-tenant): a chave usada no Map `conversas`
 * é composta por empresa_id + numero (via chaveConversa). Isso evita que
 * o mesmo número de telefone, ao falar com empresas diferentes cadastradas
 * na plataforma, tenha suas mensagens misturadas num único registro.
 * Por isso, sempre que possível, passe o `empresa_id` correto — quando
 * omitido, o registro cai no "balde" empresa_id padrão, então rotas que
 * manipulam uma conversa já existente devem sempre repassar o mesmo
 * empresa_id usado na criação (normalmente vindo de req.user.empresa_id
 * ou do canal/instância que originou a mensagem).
 *
 * @param {string} numero - Número do WhatsApp (sem @s.whatsapp.net)
 * @param {object|null} mensagem - Objeto da mensagem ou null (para forçar upsert sem nova msg)
 * @param {string|null} nome - Nome do contato
 * @param {string|null} setor - Setor atribuído
 * @param {string|null} empresa_id - UUID da empresa
 * @param {string|null} instanceName - Nome da instância Evolution
 */
async function registrarNaConversa(numero, mensagem, nome, setor, empresa_id, instanceName) {
  const empresaIdResolvido = empresa_id || ADMIN_DEFAULT.empresa_id || "empresa-padrao";
  const key = chaveConversa(empresaIdResolvido, numero);

  if (!conversas.has(key)) {
    conversas.set(key, {
      numero,
      nome: nome || numero,
      mensagens: [],
      etiqueta: "novo",
      botOn: !botPausado.has(key),
      unread: 0,
      setor: setor || null,
      empresa_id: empresaIdResolvido,
      instanceName: instanceName || null
    });
  }

  const conv = conversas.get(key);
  if (nome && conv.nome === conv.numero) conv.nome = nome;
  if (setor) conv.setor = setor.toLowerCase().trim();
  if (instanceName) conv.instanceName = instanceName;
  // NOTA: não sobrescrevemos mais conv.empresa_id aqui — a empresa de uma
  // conversa é definida na criação e fixada pela própria chave composta.
  // Garante que botOn reflete o estado atual do botPausado
  conv.botOn = !botPausado.has(key);

  if (mensagem) {
    conv.mensagens.push(mensagem);
    // Limita histórico a 300 mensagens para evitar blob gigante
    if (conv.mensagens.length > 300) conv.mensagens = conv.mensagens.slice(-300);
    conv.ultimaMensagem = mensagem.texto;
    conv.ultimoHorario = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // PERSISTÊNCIA NO SUPABASE — só salva quando temos UUID real de empresa
  const empresaIdFinal = conv.empresa_id === "empresa-padrao" ? ADMIN_DEFAULT.empresa_id : conv.empresa_id;
  const isRealUuid = empresaIdFinal && empresaIdFinal !== "empresa-padrao" && empresaIdFinal !== "vazia";
  if (supabase && isRealUuid) {
    const dadosParaSalvar = {
      numero,
      empresa_id: empresaIdFinal,
      dados: conv,
    };
    const { error } = await supabase.from("whatsapp_conversas").upsert(dadosParaSalvar);
    if (error && error.code !== "42P01" && !error.message?.includes("atualizado")) {
      console.error("[DB] Erro salvando conversa:", error.message);
    }
  }

  return conv;
}

/**
 * Carrega todas as conversas do Supabase para memória no boot.
 */
/**
 * Busca nativa com timeout — MESMO padrão usado em boot.js pra todas as
 * outras tabelas (usuarios, configuracoes, canais, times). O cliente
 * supabase-js pode travar durante o boot; essa função nunca trava mais
 * que o timeout, então o boot sempre segue em frente mesmo se o Supabase
 * demorar ou falhar.
 */
async function sbFetchConversas(params = "") {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/whatsapp_conversas?${params}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ctrl.signal,
    });
    const json = await r.json();
    return Array.isArray(json) ? json : [];
  } catch (e) {
    console.warn(`[Conversas] sbFetch falhou:`, e.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function loadConversasDb() {
  if (!supabase) return;
  const data = await sbFetchConversas("select=*");
  if (data.length > 0) {
    data.forEach(row => {
      if (row.dados) {
        row.dados.empresa_id = row.empresa_id;
        const key = chaveConversa(row.empresa_id, row.numero);
        conversas.set(key, row.dados);
        if (row.dados.botOn === false) {
          botPausado.set(key, true);
        }
      }
    });
    console.log(`📦 Carregamos ${data.length} conversas restabelecidas do Supabase!`);
  } else {
    console.log(`📦 Nenhuma conversa restabelecida do Supabase (tabela vazia ou busca falhou — veja aviso acima, se houver).`);
  }
}

/**
 * Sincroniza todas as conversas em memória com o Supabase.
 * Chamado pelo intervalo periódico de 5 minutos.
 */
async function syncConversasDb() {
  if (!supabase) return;
  let saved = 0;
  for (const conv of conversas.values()) {
    const eid = conv.empresa_id === "empresa-padrao" ? ADMIN_DEFAULT.empresa_id : conv.empresa_id;
    const isReal = eid && eid !== "empresa-padrao" && eid !== "vazia";
    if (!isReal) continue;
    conv.empresa_id = eid;
    if (conv.mensagens.length > 300) conv.mensagens = conv.mensagens.slice(-300);
    const { error } = await supabase.from("whatsapp_conversas").upsert({ numero: conv.numero, empresa_id: eid, dados: conv });
    if (!error) saved++;
  }
  if (saved > 0) console.log(`[Sync] ${saved} conversa(s) sincronizadas com Supabase`);
}

module.exports = { registrarNaConversa, loadConversasDb, syncConversasDb };
