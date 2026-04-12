const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { supabase, supabaseAdmin } = require("../config/database");
const { authMiddleware, superAdminMiddleware } = require("../middlewares/auth");
const { conversas, configMemoria, usuariosMemoria, ADMIN_DEFAULT } = require("../config/memory");

// We need constants for billing
const IP_HANDLE = process.env.INFINITYPAY_HANDLE || "visiopro";
const IP_CHECKOUT_URL = "https://api.infinitepay.io/invoices/public/checkout/links";
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "https://visiopro-unified01-production.up.railway.app";
const APP_BASE_URL = process.env.APP_URL || RAILWAY_URL;
const API_BASE_URL = RAILWAY_URL;

// ─── CRIAR CLIENTE (Super Admin) ───────────────────────────────────────────
router.post(["/empresas", "/criar-cliente"], authMiddleware, superAdminMiddleware, async (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ erro: "Banco não configurado" });

  let { empresaNome, responsavel, email, senha, documento, cnpj, telefone, cep, endereco, cidade, estado } = req.body;
  if (email) email = email.trim().toLowerCase();
  if (!empresaNome || !email || !senha) return res.status(400).json({ erro: "Dados obrigatórios ausentes" });

  const docLimpo = (documento || cnpj)?.replace(/\D/g, "") || null;
  const cepLimpo = cep?.replace(/\D/g, "") || null;
  const headers = { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "return=representation" };

  // Helper: POST com fetch + AbortController de 8s
  const sbPost = async (path, body) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
      const json = await r.json();
      clearTimeout(timer);
      return { ok: r.ok, status: r.status, data: Array.isArray(json) ? json[0] : json };
    } catch (e) { clearTimeout(timer); return { ok: false, data: null, error: e.message }; }
  };

  const sbDel = async (path, filter) => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}?${filter}`, { method: "DELETE", headers: { ...headers, Prefer: "" }, signal: ctrl.signal });
      return { ok: r.ok };
    } catch (e) { return { ok: false, error: e.message }; }
  };

  const sbGet = async (path, filter) => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}?${filter}&limit=1`, { method: "GET", headers: { ...headers, Prefer: "return=representation" }, signal: ctrl.signal });
      const json = await r.json();
      return { ok: r.ok, data: Array.isArray(json) ? json[0] : json };
    } catch (e) { return { ok: false, data: null, error: e.message }; }
  };

  try {
    // Verifica email duplicado
    const checkEmail = await sbGet("usuarios", `email=eq.${encodeURIComponent(email)}&select=id,empresa_id`);
    if (checkEmail.data?.id) {
      const checkEmp = await sbGet("empresas", `id=eq.${checkEmail.data.empresa_id}&select=id`);
      if (checkEmp.data?.id) return res.status(400).json({ erro: "E-mail já cadastrado em outra empresa ativa" });
      console.log(`[ADMIN] ♻️ Removendo órfão: ${email}`);
      await sbDel("usuarios", `id=eq.${checkEmail.data.id}`);
    }

    // Criar empresa
    console.log(`[ADMIN] 📦 Criando empresa: ${empresaNome}`);
    const empRes = await sbPost("empresas", {
      nome: empresaNome, responsavel, documento: docLimpo, telefone,
      cep: cepLimpo, endereco, cidade, estado,
      email_admin: email, status: "ativo", plano_tipo: "bot_mensal"
    });
    if (!empRes.ok || !empRes.data?.id) {
      console.error("[ADMIN] ❌ Empresa:", empRes);
      return res.status(400).json({ erro: "Erro ao criar empresa: " + (empRes.data?.message || empRes.error || "desconhecido") });
    }
    const empresaId = empRes.data.id;
    console.log(`[ADMIN] ✅ Empresa: ${empresaId}`);

    // Criar usuário admin
    const hash = await bcrypt.hash(senha, 10);
    const userId = crypto.randomUUID();
    const usrRes = await sbPost("usuarios", {
      id: userId, nome: responsavel || email, email, senha: hash,
      role: "admin", setor: "todos", ativo: true, empresa_id: empresaId
    });
    if (!usrRes.ok) {
      console.error("[ADMIN] ❌ Usuário:", usrRes);
      await sbDel("empresas", `id=eq.${empresaId}`);
      return res.status(400).json({ erro: "Erro ao criar usuário: " + (usrRes.data?.message || usrRes.error || "desconhecido") });
    }
    console.log(`[ADMIN] ✅ Usuário: ${email}`);

    // Times padrão (background, não bloqueia)
    const times = [
      { id: crypto.randomUUID(), nome: "Vendas",     setor: "vendas",     cor: "#10b981", emoji: "💰", ativo: true, empresa_id: empresaId },
      { id: crypto.randomUUID(), nome: "Suporte",    setor: "suporte",    cor: "#3b82f6", emoji: "🛠️", ativo: true, empresa_id: empresaId },
      { id: crypto.randomUUID(), nome: "Financeiro", setor: "financeiro", cor: "#f59e0b", emoji: "💳", ativo: true, empresa_id: empresaId },
    ];
    sbPost("times", times).catch(e => console.warn("[ADMIN] Times:", e.message));

    // ✅ Grava imediatamente na memória para login instantâneo
    const novoUsuario = {
      id: userId, nome: responsavel || email, email, senha: hash,
      role: "admin", setor: "todos", ativo: true, empresa_id: empresaId
    };
    usuariosMemoria.set(email, novoUsuario);
    console.log(`[ADMIN] ✅ Usuário ${email} adicionado à memória para login imediato`);

    // Tenta sync completo em background (não bloqueia resposta)
    try {
      const { carregarUsuariosMemoria } = require("../boot");
      if (typeof carregarUsuariosMemoria === 'function') {
        carregarUsuariosMemoria().catch(e => console.warn("[ADMIN] Sync background:", e.message));
      }
    } catch {}

    console.log(`[ADMIN] ✅ Cliente criado: ${empresaNome} | ${email}`);
    res.json({ ok: true, empresa: empRes.data, acesso: { email, url: RAILWAY_URL } });

  } catch (e) {
    console.error(`[ADMIN] 💥 ERRO:`, e.message);
    res.status(500).json({ erro: "Erro interno: " + e.message });
  }
}); // fim criar-cliente


// ─── RESET SENHA DO ADMIN DE UMA EMPRESA ─────────────────────────────────
router.post("/empresas/:id/reset-senha", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: "Banco não disponível" });
  const { nova_senha } = req.body;
  if (!nova_senha) return res.status(400).json({ erro: "Nova senha obrigatória" });
  const hash = await bcrypt.hash(nova_senha, 10);
  const { error } = await supabaseAdmin.from("usuarios").update({ senha: hash }).eq("empresa_id", req.params.id).eq("role", "admin");
  if (error) return res.status(400).json({ erro: error.message });
  res.json({ ok: true });
});

// ─── LISTAR TODOS OS CLIENTES ─────────────────────────────────────────────
router.get("/empresas", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  const { data: empresas, error } = await supabase.from("empresas").select("*");
  if (error || !empresas) return res.json([]);

  const result = await Promise.all(empresas.map(async (emp) => {
    const { data: users } = await supabase.from("usuarios")
      .select("id, nome, email, role, ativo")
      .eq("empresa_id", emp.id)
      .eq("role", "admin")
      .limit(1);
    const { data: canais } = await supabase.from("canais").select("id, nome, ativo").eq("empresa_id", emp.id);
    const { count: totalUsuarios } = await supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("empresa_id", emp.id);
    const { data: config } = await supabase.from("configuracoes").select("valor").eq("id", "metadata_saas").eq("empresa_id", emp.id).single();

    return {
      ...emp,
      admin: users?.[0] || null,
      canais: canais || [],
      total_usuarios: totalUsuarios || 0,
      observacao: config ? config.valor : null
    };
  }));

  res.json(result);
});

// ─── ATUALIZAR STATUS DA EMPRESA ──────────────────────────────────────────
router.patch("/empresas/:id", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Banco não disponível" });
  const { id } = req.params;
  const { status, plano_tipo, data_vencimento } = req.body;

  const updates = {};
  if (status) updates.status = status;
  if (plano_tipo) updates.plano_tipo = plano_tipo;
  if (data_vencimento !== undefined) updates.proximo_vencimento = data_vencimento;

  const { error } = await supabase.from("empresas").update(updates).eq("id", id);
  if (error) return res.status(400).json({ erro: error.message });

  res.json({ ok: true });
});

// ─── EXCLUIR EMPRESA + TODOS OS DADOS VINCULADOS ──────────────────────────
router.delete("/empresas/:id", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: "Banco não disponível" });
  const { id } = req.params;
  if (!id) return res.status(400).json({ erro: "ID obrigatório" });

  try {
    await Promise.all([
      supabaseAdmin.from("whatsapp_conversas").delete().eq("empresa_id", id),
      supabaseAdmin.from("vivi_leads").delete().eq("empresa_id", id),
      supabaseAdmin.from("vivi_conversas").delete().eq("empresa_id", id),
      supabaseAdmin.from("vivi_agendamentos").delete().eq("empresa_id", id),
      supabaseAdmin.from("canais").delete().eq("empresa_id", id),
      supabaseAdmin.from("configuracoes").delete().eq("empresa_id", id),
      supabaseAdmin.from("times").delete().eq("empresa_id", id),
    ]);
    await supabaseAdmin.from("usuarios").delete().eq("empresa_id", id);
    const { error } = await supabaseAdmin.from("empresas").delete().eq("id", id);
    if (error) return res.status(400).json({ erro: error.message });

    for (const [num, conv] of conversas.entries()) {
      if (conv.empresa_id === id) conversas.delete(num);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ─── ESTATÍSTICAS GERAIS ──────────────────────────
router.get("/stats", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.json({});
  const [emps, users, convs] = await Promise.all([
    supabase.from("empresas").select("status", { count: "exact" }),
    supabase.from("usuarios").select("id", { count: "exact", head: true }),
    supabase.from("whatsapp_conversas").select("id", { count: "exact", head: true }),
  ]);
  const statusCount = {};
  (emps.data || []).forEach(e => { statusCount[e.status || 'ativo'] = (statusCount[e.status || 'ativo'] || 0) + 1; });
  res.json({
    total_empresas: emps.count || 0,
    total_usuarios: users.count || 0,
    total_conversas: convs.count || 0,
    por_status: statusCount
  });
});

// ─── COBRANÇAS ─────────────────────────────────────────────────────────────
router.get("/empresas/:id/cobrancas", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  const { data } = await supabase.from("vp_cobrancas")
    .select("*").eq("empresa_id", req.params.id)
    .order("criado_em", { ascending: false });
  res.json(data || []);
});

router.post("/cobrancas", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Banco não disponível" });
  const { empresa_id, descricao, valor, data_vencimento } = req.body;
  
  const { data: emp } = await supabase.from("empresas").select("nome, responsavel, email_admin, telefone").eq("id", empresa_id).single();
  const orderNsu = crypto.randomUUID();

  const ipPayload = {
    handle: IP_HANDLE,
    redirect_url: `${APP_BASE_URL}?pagamento=confirmado&nsu=${orderNsu}`,
    webhook_url: `${API_BASE_URL}/webhook/infinitypay`,
    order_nsu: orderNsu,
    customer: {
      name: emp?.responsavel || emp?.nome || "Cliente VisioPro",
      email: emp?.email_admin || "",
      phone_number: emp?.telefone ? emp.telefone.replace(/\D/g, "").replace(/^(\d{2})(\d+)/, "+55$1$2") : undefined
    },
    items: [
      {
        quantity: 1,
        price: Math.round(parseFloat(valor) * 100),
        description: descricao
      }
    ]
  };

  let linkPagamento = null;
  try {
    const ipRes = await fetch(IP_CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ipPayload)
    });
    const ipData = await ipRes.json();
    if (ipData.url) linkPagamento = ipData.url;
  } catch (e) {
    console.error("[BILLING] Erro InfinityPay:", e.message);
  }

  const { data: cobranca, error } = await supabase.from("vp_cobrancas").insert({
    empresa_id, descricao, valor: parseFloat(valor), status: "pendente",
    link_pagamento: linkPagamento, ip_order_nsu: orderNsu, data_vencimento: data_vencimento || null
  }).select().single();

  if (error) return res.status(400).json({ erro: error.message });
  if (linkPagamento) await supabase.from("empresas").update({ link_pagamento: linkPagamento }).eq("id", empresa_id);

  res.json({ ok: true, cobranca, link_pagamento: linkPagamento });
});

router.patch("/cobrancas/:id", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Banco não disponível" });
  const { status } = req.body;
  const { data: cobranca } = await supabase.from("vp_cobrancas").select("empresa_id").eq("id", req.params.id).single();

  await supabase.from("vp_cobrancas").update({
    status,
    data_pagamento: status === "pago" ? new Date().toISOString() : null
  }).eq("id", req.params.id);

  if (status === "pago" && cobranca?.empresa_id) {
    const proximoVenc = new Date();
    proximoVenc.setMonth(proximoVenc.getMonth() + 1);
    await supabase.from("empresas").update({
      status: "ativo",
      proximo_vencimento: proximoVenc.toISOString().split("T")[0]
    }).eq("id", cobranca.empresa_id);
  }
  res.json({ ok: true });
});

router.post("/verificar-vencimentos", authMiddleware, superAdminMiddleware, async (req, res) => {
  if (!supabase) return res.json({ bloqueadas: 0 });
  const hoje = new Date().toISOString().split("T")[0];

  const { data: vencidas } = await supabase.from("empresas")
    .select("id, nome")
    .eq("status", "ativo")
    .not("plano_tipo", "in", '("suporte_avulso","bot_avista")')
    .not("proximo_vencimento", "is", null)
    .lt("proximo_vencimento", hoje);

  let bloqueadas = 0;
  for (const emp of (vencidas || [])) {
    await supabase.from("empresas").update({ status: "suspenso_pagamento" }).eq("id", emp.id);
    bloqueadas++;
  }
  res.json({ ok: true, bloqueadas, data: hoje });
});

// ─── MINHA CONTA ──────────────────────────────────────────────────────────
// Note: This matches GET /minha-conta/link-pagamento
router.get("/minha-conta/link-pagamento", authMiddleware, async (req, res) => {
  if (!supabase) return res.json({ link: null });
  const { data: emp } = await supabase.from("empresas")
    .select("status, link_pagamento, proximo_vencimento, plano_tipo, valor_plano, nome")
    .eq("id", req.user.empresa_id).single();
  res.json(emp || {});
});

module.exports = router;
