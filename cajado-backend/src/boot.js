const { supabase } = require("./config/database");
const { ADMIN_DEFAULT, conversas, configMemoria, canaisMemoria, timesMemoria, usuariosMemoria } = require("./config/memory");
const { loadConversasDb, syncConversasDb } = require("./services/conversation.service");

// Helper fetch nativo para boot (evita travamento do supabase-js client)
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const sbFetch = async (table, params = "") => {
  if (!SB_URL || !SB_KEY) return [];
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ctrl.signal
    });
    const json = await r.json();
    return Array.isArray(json) ? json : [];
  } catch (e) { console.warn(`[Boot] sbFetch ${table}:`, e.message); return []; }
};

// Carrega todos os usuários do banco para memória (login instantâneo)
async function carregarUsuariosMemoria() {
  const usuarios = await sbFetch("usuarios", "select=id,nome,email,senha,role,setor,ativo,empresa_id");
  let count = 0;
  for (const u of usuarios) {
    if (u.email && u.email !== ADMIN_DEFAULT.email) {
      usuariosMemoria.set(u.email.toLowerCase(), u);
      count++;
    }
  }
  console.log(`[Boot] ${count} usuários carregados na memória para login rápido.`);
  return count;
}

/**
 * Inicializa todos os dados em memória a partir do Supabase.
 * Deve ser chamado uma única vez no boot do servidor.
 */
async function bootstrap() {
  if (!SB_URL || !SB_KEY) {
    console.log("[Boot] Supabase não configurado — operando em modo memória.");
    return;
  }

  // 1. Vincula admin master à empresa do email de administrador (evitando vazamento para a 1ª empresa do db)
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const admins = await sbFetch("usuarios", `email=eq.${adminEmail}&select=empresa_id`);
  const adminMaster = admins[0];
  if (adminMaster && adminMaster.empresa_id) {
    ADMIN_DEFAULT.empresa_id = adminMaster.empresa_id;
    usuariosMemoria.set(ADMIN_DEFAULT.email, ADMIN_DEFAULT);
    console.log(`[Boot] Master Admin vinculado à empresa ${adminMaster.empresa_id}`);
  } else {
      // Fallback extremo
      const empresas = await sbFetch("empresas", "select=id&limit=1");
      if(empresas[0]) {
        ADMIN_DEFAULT.empresa_id = empresas[0].id;
        usuariosMemoria.set(ADMIN_DEFAULT.email, ADMIN_DEFAULT);
        console.log(`[Boot] Master Admin vinculado à primeira empresa (fallback): ${empresas[0].id}`);
      }
  }

  // 2. Carrega TODOS os usuários para memória (login rápido sem IR ao banco)
  await carregarUsuariosMemoria();

  // Sync periódico de usuários a cada 2 min (para pegar novos cadastros)
  setInterval(carregarUsuariosMemoria, 2 * 60 * 1000);

  // 2. Carrega conversas
  await loadConversasDb();

  // 3. Carrega configurações (prompts customizados por empresa) — via fetch nativo
  const configs = await sbFetch("configuracoes", "select=*");
  if (configs.length > 0) {
    configs.forEach(c => configMemoria.set(`${c.empresa_id}_${c.id}`, c.valor));
    console.log(`[Boot] ${configs.length} configurações carregadas.`);
  }

  // 4. Carrega canais (mapeamento instance_name → empresa_id) — via fetch nativo
  const canais = await sbFetch("canais", "select=*");
  if (canais.length > 0) {
    canais.forEach(c => {
      const idx = c.tipo === "evolution" ? c.dados_conexao?.instance_name : c.dados_conexao?.phone_number_id;
      if (idx) canaisMemoria.set(idx, c.empresa_id);
    });
    console.log(`[Boot] ${canais.length} canais carregados.`);
  }

  // 5. Carrega times padrão da memória (já populados em memory.js com os defaults)

  console.log("[Boot] ✅ Bootstrap completo.");
}

/**
 * Inicia o sync periódico a cada 5 minutos.
 */
function iniciarSyncPeriodico() {
  setInterval(syncConversasDb, 5 * 60 * 1000);
  console.log("[Boot] Sync periódico iniciado (5 min).");
}

// carregarUsuariosMemoria exportado no final junto com os demais

/**
 * Agenda o cron diário de verificação de vencimentos.
 */
function agendarCronDiario() {
  if (!supabase) return;

  const agora = new Date();
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 5, 0, 0); // 00:05 do dia seguinte
  const msAteAmanha = amanha - agora;

  setTimeout(async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const { data: vencidas } = await supabase.from("empresas")
      .select("id, nome").eq("status", "ativo")
      .not("plano_tipo", "in", '("suporte_avulso","bot_avista")')
      .not("proximo_vencimento", "is", null)
      .lt("proximo_vencimento", hoje);

    let bloqueadas = 0;
    for (const emp of (vencidas || [])) {
      await supabase.from("empresas").update({ status: "suspenso_pagamento" }).eq("id", emp.id);
      console.log(`[CRON-BILLING] 🔒 Empresa "${emp.nome}" SUSPENSA por vencimento em ${hoje}`);
      bloqueadas++;
    }

    if (bloqueadas > 0) console.log(`[CRON-BILLING] ${bloqueadas} empresa(s) suspensa(s) hoje.`);
    else console.log(`[CRON-BILLING] Nenhuma empresa vencida em ${hoje}.`);

    agendarCronDiario(); // reagenda para o próximo dia
  }, msAteAmanha);

  const horas = Math.round((msAteAmanha / 3600000) * 10) / 10;
  console.log(`[Boot] Cron billing: próxima verificação em ${horas}h`);
}

module.exports = { bootstrap, iniciarSyncPeriodico, agendarCronDiario, carregarUsuariosMemoria };
