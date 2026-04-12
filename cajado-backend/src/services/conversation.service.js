const { supabase } = require("../config/database");
const { botPausado, conversas, ADMIN_DEFAULT } = require("../config/memory");

/**
 * Registra uma mensagem na conversa em memória e persiste no Supabase.
 * Serve como ponto central de escrita — NUNCA faça upsert diretamente
 * fora desta função para evitar dados inconsistentes.
 *
 * @param {string} numero - Número do WhatsApp (sem @s.whatsapp.net)
 * @param {object|null} mensagem - Objeto da mensagem ou null (para forçar upsert sem nova msg)
 * @param {string|null} nome - Nome do contato
 * @param {string|null} setor - Setor atribuído
 * @param {string|null} empresa_id - UUID da empresa
 * @param {string|null} instanceName - Nome da instância Evolution
 */
async function registrarNaConversa(numero, mensagem, nome, setor, empresa_id, instanceName) {
  if (!conversas.has(numero)) {
    conversas.set(numero, {
      numero,
      nome: nome || numero,
      mensagens: [],
      etiqueta: "novo",
      botOn: !botPausado.has(numero),
      unread: 0,
      setor: setor || null,
      empresa_id: empresa_id || ADMIN_DEFAULT.empresa_id || "empresa-padrao",
      instanceName: instanceName || null
    });
  }

  const conv = conversas.get(numero);
  if (nome && conv.nome === conv.numero) conv.nome = nome;
  if (setor) conv.setor = setor.toLowerCase().trim();
  if (empresa_id) conv.empresa_id = empresa_id;
  if (instanceName) conv.instanceName = instanceName;

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
    const { error } = await supabase.from("whatsapp_conversas").upsert({ numero, empresa_id: empresaIdFinal, dados: conv });
    if (error && error.code !== "42P01") console.error("[DB] Erro salvando conversa:", error.message);
  }

  return conv;
}

/**
 * Carrega todas as conversas do Supabase para memória no boot.
 */
async function loadConversasDb() {
  if (!supabase) return;
  const { data, error } = await supabase.from("whatsapp_conversas").select("*");
  if (!error && data) {
    data.forEach(row => {
      if (row.dados) {
        row.dados.empresa_id = row.empresa_id;
        conversas.set(row.numero, row.dados);
        if (row.dados.botOn === false) {
          botPausado.set(row.numero, true);
        }
      }
    });
    console.log(`📦 Carregamos ${data.length} conversas restabelecidas do Supabase!`);
  }
}

/**
 * Sincroniza todas as conversas em memória com o Supabase.
 * Chamado pelo intervalo periódico de 5 minutos.
 */
async function syncConversasDb() {
  if (!supabase) return;
  let saved = 0;
  for (const [numero, conv] of conversas.entries()) {
    const eid = conv.empresa_id === "empresa-padrao" ? ADMIN_DEFAULT.empresa_id : conv.empresa_id;
    const isReal = eid && eid !== "empresa-padrao" && eid !== "vazia";
    if (!isReal) continue;
    conv.empresa_id = eid;
    if (conv.mensagens.length > 300) conv.mensagens = conv.mensagens.slice(-300);
    const { error } = await supabase.from("whatsapp_conversas").upsert({ numero, empresa_id: eid, dados: conv });
    if (!error) saved++;
  }
  if (saved > 0) console.log(`[Sync] ${saved} conversa(s) sincronizadas com Supabase`);
}

module.exports = { registrarNaConversa, loadConversasDb, syncConversasDb };
