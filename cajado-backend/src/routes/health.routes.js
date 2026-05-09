const express = require("express");
const router = express.Router();

const { supabase } = require("../config/database");
const { authMiddleware } = require("../middlewares/auth");
const { INSTANCE } = require("../config/env");
const { ADMIN_DEFAULT, conversas, clientesTransferidos, botPausado } = require("../config/memory");

const DEPLOY_VERSION = new Date().toISOString();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    versao: DEPLOY_VERSION,
    uptime: Math.floor(process.uptime()) + "s",
    env: process.env.NODE_ENV || "development",
    supabase: !!process.env.SUPABASE_URL,
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    railway: !!process.env.RAILWAY_PUBLIC_DOMAIN,
  });
});

// Diagnóstico do bot — verifica se todas as dependências estão OK
router.get("/debug/bot", authMiddleware, (req, res) => {
  const { canaisMemoria } = require("../config/memory");
  const { EVOLUTION_URL, EVOLUTION_KEY, OPENROUTER_KEY } = require("../config/env");

  const instancias = [];
  canaisMemoria.forEach((val, key) => {
    instancias.push({
      instancia: key,
      empresa_id: typeof val === "object" ? val.empresa_id : val,
      tem_api_key: typeof val === "object" ? !!val.api_key : false,
      tem_evolution_url: typeof val === "object" ? !!val.evolution_url : false,
      evolution_url: typeof val === "object" ? (val.evolution_url || "usa global") : "usa global",
    });
  });

  res.json({
    openrouter: {
      configurado: !!OPENROUTER_KEY,
      chave_inicio: OPENROUTER_KEY ? OPENROUTER_KEY.slice(0, 8) + "..." : "NÃO DEFINIDA ❌",
    },
    evolution: {
      url_global: EVOLUTION_URL,
      tem_chave_global: !!EVOLUTION_KEY,
    },
    admin: {
      empresa_id: ADMIN_DEFAULT.empresa_id,
      empresa_resolvida: ADMIN_DEFAULT.empresa_id !== "empresa-padrao",
    },
    instancias_em_memoria: instancias,
    total_conversas: conversas.size,
  });
});

// Endpoint de diagnóstico de banco — testa insert/delete real para verificar RLS
router.get("/debug/db", async (req, res) => {
  const { supabaseAdmin } = require("../config/database");
  const crypto = require("crypto");
  const testId = crypto.randomUUID();
  const results = {};

  // Testa SELECT em empresas
  try {
    const t0 = Date.now();
    const { data, error } = await Promise.race([
      supabaseAdmin.from("empresas").select("id").limit(1),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 10s")), 10000))
    ]);
    results.select_empresas = error ? { erro: error.message } : { ok: true, ms: Date.now() - t0 };
  } catch (e) { results.select_empresas = { erro: e.message }; }

  // Testa INSERT em empresas
  try {
    const t0 = Date.now();
    const { data, error } = await Promise.race([
      supabaseAdmin.from("empresas").insert({ id: testId, nome: "__debug_test__", status: "teste" }).select().single(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 10s")), 10000))
    ]);
    results.insert_empresa = error ? { erro: error.message } : { ok: true, ms: Date.now() - t0 };

    // Se inseriu, tenta deletar
    if (!error) {
      const { error: delErr } = await supabaseAdmin.from("empresas").delete().eq("id", testId);
      results.delete_empresa = delErr ? { erro: delErr.message } : { ok: true };
    }
  } catch (e) { results.insert_empresa = { erro: e.message }; }

  // Testa INSERT em usuarios
  try {
    const t0 = Date.now();
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("debug123", 4);
    const empRow = results.insert_empresa?.ok ? null : 
      (await supabaseAdmin.from("empresas").select("id").limit(1)).data?.[0];
    const empId = empRow?.id || "00000000-0000-0000-0000-000000000000";
    const uid = crypto.randomUUID();
    const { data, error } = await Promise.race([
      supabaseAdmin.from("usuarios").insert({ id: uid, nome: "__debug__", email: `debug_${uid.substring(0,8)}@test.com`, senha: hash, role: "atendente", ativo: false, empresa_id: empId }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 10s")), 10000))
    ]);
    results.insert_usuario = error ? { erro: error.message } : { ok: true, ms: Date.now() - t0 };
    if (!error) await supabaseAdmin.from("usuarios").delete().eq("id", uid).catch(() => {});
  } catch (e) { results.insert_usuario = { erro: e.message }; }

  res.json({ timestamp: new Date().toISOString(), serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY, results });
});


router.get("/api/status", authMiddleware, (req, res) => {
  const isSuperAdmin = req.user.email?.toLowerCase() === (process.env.ADMIN_EMAIL || "admin@visiopro.com").toLowerCase() || req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao";
  const minhasConversas = Array.from(conversas.values()).filter(c => isSuperAdmin || c.empresa_id === req.user.empresa_id);
  res.json({
    status: "🟢 VisioPro Online",
    instancia: INSTANCE,
    conversas: minhasConversas.length,
    transferidos: clientesTransferidos.size,
    botsPausados: botPausado.size,
    supabase: !!supabase,
  });
});

module.exports = router;
