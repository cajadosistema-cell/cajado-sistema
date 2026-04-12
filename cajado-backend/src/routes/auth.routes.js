const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { JWT_SECRET, ADMIN_EMAIL, RAILWAY_URL } = require("../config/env");
const { ADMIN_DEFAULT, usuariosMemoria } = require("../config/memory");
const { authMiddleware } = require("../middlewares/auth");

// Helper: fetch com AbortController de 8s para o Supabase
const SB_URL = () => process.env.SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const sbHeaders = () => ({
  "Content-Type": "application/json",
  apikey: SB_KEY(),
  Authorization: `Bearer ${SB_KEY()}`,
  Prefer: "return=representation"
});

const sbGet = async (table, filter) => {
  if (!SB_URL() || !SB_KEY()) return { ok: false, data: null };
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}&limit=1`, { headers: {...sbHeaders(), Prefer: ""}, signal: ctrl.signal });
    const json = await r.json();
    return { ok: r.ok, data: Array.isArray(json) ? json[0] : (r.ok ? json : null) };
  } catch { return { ok: false, data: null }; }
};

const sbPost = async (table, body) => {
  if (!SB_URL() || !SB_KEY()) return { ok: false, data: null };
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL()}/rest/v1/${table}`, { method: "POST", headers: sbHeaders(), body: JSON.stringify(body), signal: ctrl.signal });
    const json = await r.json();
    return { ok: r.ok, data: Array.isArray(json) ? json[0] : json };
  } catch { return { ok: false, data: null }; }
};

const sbPatch = async (table, filter, body) => {
  if (!SB_URL() || !SB_KEY()) return { ok: false };
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}`, { method: "PATCH", headers: sbHeaders(), body: JSON.stringify(body), signal: ctrl.signal });
    return { ok: r.ok };
  } catch { return { ok: false }; }
};

const sbDel = async (table, filter) => {
  if (!SB_URL() || !SB_KEY()) return { ok: false };
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: {...sbHeaders(), Prefer: ""}, signal: ctrl.signal });
    return { ok: r.ok };
  } catch { return { ok: false }; }
};

const sbGetAll = async (table, filter) => {
  if (!SB_URL() || !SB_KEY()) return { ok: false, data: [] };
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}`, { headers: {...sbHeaders(), Prefer: ""}, signal: ctrl.signal });
    const json = await r.json();
    return { ok: r.ok, data: Array.isArray(json) ? json : [] };
  } catch { return { ok: false, data: [] }; }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  let { email, senha } = req.body;
  if (email) email = email.trim().toLowerCase();
  if (!email || !senha) return res.status(400).json({ erro: "Email e senha obrigatórios" });

  // 1. Busca PRIMEIRO na memória (carregada no boot — resposta instantânea)
  let usuario = usuariosMemoria.get(email);

  // 2. Fallback: vai ao Supabase (para usuários criados após o boot sem sync ainda)
  if (!usuario) {
    console.log(`[LOGIN] Usuário ${email} não encontrado na memória, buscando no Supabase...`);
    const { ok, data } = await sbGet("usuarios", `email=eq.${encodeURIComponent(email)}&select=*`);
    if (data?.id) {
      usuariosMemoria.set(email, data); // cacheia para próximas tentativas
      usuario = data;
      console.log(`[LOGIN] ✅ Usuário ${email} encontrado no Supabase e cacheado`);
    } else {
      console.log(`[LOGIN] ❌ Usuário ${email} NÃO encontrado no Supabase (ok=${ok})`);
    }
  }

  if (!usuario) return res.status(401).json({ erro: "Usuário não encontrado" });
  if (!usuario.ativo) return res.status(401).json({ erro: "Usuário desativado" });

  const ok = await bcrypt.compare(senha, usuario.senha);
  if (!ok) return res.status(401).json({ erro: "Senha incorreta" });

  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuper = email === adminEmail;
  if (!isSuper && usuario.empresa_id) {
    const { data: emp } = await sbGet("empresas", `id=eq.${usuario.empresa_id}&select=status,nome,link_pagamento`);
    if (emp?.status === "suspenso" || emp?.status === "cancelado") {
      return res.status(403).json({ erro: `Conta ${emp.status}. Entre em contato com o suporte.` });
    }
    if (emp?.status === "suspenso_pagamento") {
      return res.status(402).json({ erro: "Pagamento pendente.", link_pagamento: emp.link_pagamento || null, status: "suspenso_pagamento" });
    }
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role, setor: usuario.setor, empresa_id: usuario.empresa_id || "vazia" },
    JWT_SECRET, { expiresIn: "7d" }
  );
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role, setor: usuario.setor, empresa_id: usuario.empresa_id } });
});

// ─── REGISTER ─────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  let { nome, email, senha, empresaNome } = req.body;
  if (email) email = email.trim().toLowerCase();
  if (!nome || !email || !senha || !empresaNome) return res.status(400).json({ erro: "Preencha os campos obrigatórios" });

  const hash = await bcrypt.hash(senha, 10);
  const userId = crypto.randomUUID();
  let empresaId = "empresa-padrao";

  const { data: uEx } = await sbGet("usuarios", `email=eq.${encodeURIComponent(email)}&select=id`);
  if (uEx?.id) return res.status(400).json({ erro: "E-mail já cadastrado" });

  const empRes = await sbPost("empresas", { nome: empresaNome, status: "ativo", plano_tipo: "bot_mensal" });
  if (!empRes.ok) return res.status(400).json({ erro: "Erro ao criar empresa" });
  empresaId = empRes.data?.id || empresaId;

  const usrRes = await sbPost("usuarios", { id: userId, nome, email, senha: hash, role: "admin", setor: "todos", ativo: true, empresa_id: empresaId });
  if (!usrRes.ok) return res.status(400).json({ erro: "Erro ao criar usuário" });

  // ✅ Grava imediatamente na memória para login instantâneo (sem depender do Supabase)
  const novoUsuario = { id: userId, nome, email, senha: hash, role: "admin", setor: "todos", ativo: true, empresa_id: empresaId };
  usuariosMemoria.set(email, novoUsuario);
  console.log(`[REGISTER] ✅ Usuário ${email} adicionado à memória para login imediato`);

  const token = jwt.sign({ id: userId, nome, email, role: "admin", setor: "todos", empresa_id: empresaId }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, usuario: { id: userId, nome, email, role: "admin", setor: "todos", empresa_id: empresaId } });
});

// ─── LISTAR USUÁRIOS ───────────────────────────────────────────────────────
router.get("/usuarios", authMiddleware, async (req, res) => {
  const { data } = await sbGetAll("usuarios", `empresa_id=eq.${req.user.empresa_id}&select=id,nome,email,role,setor,ativo`);
  if (data.length) return res.json(data);
  res.json(Array.from(usuariosMemoria.values()).map(({ senha: _, ...u }) => u));
});

// ─── CRIAR USUÁRIO ─────────────────────────────────────────────────────────
router.post("/usuarios", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Sem permissão" });
  const { nome, email, senha, role, setor } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Campos obrigatórios" });
  const hash = await bcrypt.hash(senha, 10);
  const id = crypto.randomUUID();
  const novoUsuario = { id, nome, email: email.trim().toLowerCase(), senha: hash, role: role || "atendente", setor: setor || "vendas", ativo: true, empresa_id: req.user.empresa_id };

  const r = await sbPost("usuarios", novoUsuario);
  if (r.ok) return res.json({ ok: true, usuario: r.data });

  usuariosMemoria.set(email, novoUsuario);
  const { senha: _, ...sem } = novoUsuario;
  res.json({ ok: true, usuario: sem });
});

// ─── EDITAR USUÁRIO ────────────────────────────────────────────────────────
router.patch("/usuarios/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== "admin" && req.user.id !== id) return res.status(403).json({ erro: "Sem permissão" });
  const updates = req.body;
  if (updates.senha) updates.senha = await bcrypt.hash(updates.senha, 10);

  const r = await sbPatch("usuarios", `id=eq.${id}&empresa_id=eq.${req.user.empresa_id}`, updates);
  if (r.ok) return res.json({ ok: true });

  for (const [, u] of usuariosMemoria) {
    if (u.id === id) Object.assign(u, updates);
  }
  res.json({ ok: true });
});

// ─── EXCLUIR USUÁRIO ───────────────────────────────────────────────────────
router.delete("/usuarios/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Sem permissão" });
  if (req.user.id === id) return res.status(400).json({ erro: "Você não pode excluir sua própria conta" });

  const r = await sbDel("usuarios", `id=eq.${id}&empresa_id=eq.${req.user.empresa_id}`);
  if (r.ok) return res.json({ ok: true });

  for (const [email, u] of usuariosMemoria) {
    if (u.id === id) { usuariosMemoria.delete(email); break; }
  }
  res.json({ ok: true });
});

// ─── SYNC USER (Integração Cajado → Inbox) ─────────────────────────────────
router.post("/integrations/sync-user", async (req, res) => {
  let { nome, email, senha, role, setor, integration_key } = req.body;
  if (email) email = email.trim().toLowerCase();
  
  // Verifica se a chave corresponde a API_KEY do Railway, ou à chave hardcoded do painel
  const apiKeyDef = process.env.API_KEY || "fe735c00cfb3613832c4e8b7e88a67af7892cdb6d5c94b901e028e3f25d06ebb";
  if (integration_key !== process.env.API_KEY && integration_key !== apiKeyDef) {
      return res.status(401).json({ erro: "Chave de integração inválida" });
  }

  if (!nome || !email || !senha) return res.status(400).json({ erro: "Campos obrigatórios" });

  const hash = await bcrypt.hash(senha, 10);
  const id = crypto.randomUUID();

  const { data: empData } = await sbGet("empresas", "select=id&limit=1");
  const empresa_id = empData?.id || ADMIN_DEFAULT.empresa_id || "empresa-padrao";

  const { data: existente } = await sbGet("usuarios", `email=eq.${encodeURIComponent(email)}&select=id`);
  if (existente?.id) {
    await sbPatch("usuarios", `email=eq.${encodeURIComponent(email)}`, { senha: hash, nome, role: role || "atendente" });
    return res.json({ ok: true, msg: "Usuário atualizado no Inbox" });
  }

  const r = await sbPost("usuarios", { id, nome, email, senha: hash, role: role || "atendente", setor: setor || "todos", ativo: true, empresa_id });
  if (r.ok) return res.json({ ok: true, usuario: { id: r.data?.id, email: r.data?.email } });

  usuariosMemoria.set(email, { id, nome, email, senha: hash, role: role || "atendente", setor: setor || "todos", ativo: true, empresa_id });
  res.json({ ok: true });
});

module.exports = router;
