const express = require("express");
const router = express.Router();
const axios = require("axios");

const { supabase } = require("../config/database");
const { EVOLUTION_URL, EVOLUTION_KEY } = require("../config/env");
const { authMiddleware } = require("../middlewares/auth");
const { canaisMemoria } = require("../config/memory");

// RRAILWAY_URL is needed for webhooks
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "https://visiopro-unified01-production.up.railway.app";

// ─── CRIAR INSTÂNCIA AUTO ─────────────────────────
router.post("/criar-instancia", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Apenas admins" });
  const { nome, numero_telefone } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome do canal é obrigatório" });

  const empresaSlug = req.user.empresa_id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const ts = Date.now().toString().slice(-6);
  const instanceName = `vp_${empresaSlug}_${ts}`;
  const webhookUrl = `${RAILWAY_URL}/webhook/evolution`;

  try {
    const criacao = await axios.post(`${EVOLUTION_URL}/instance/create`, {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }, { headers: { apikey: EVOLUTION_KEY } });

    await axios.post(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      }
    }, { headers: { apikey: EVOLUTION_KEY } }).catch(() => {});

    const novoCanal = {
      empresa_id: req.user.empresa_id,
      nome,
      tipo: "evolution",
      status: "pendente",
      dados_conexao: { 
        instance_name: instanceName,
        numero_telefone: numero_telefone || null,
        ativo: false
      }
    };

    let canalId = null;
    if (supabase) {
      const { data } = await supabase.from("canais").insert(novoCanal).select().single();
      canalId = data?.id;
    }
    canaisMemoria.set(instanceName, req.user.empresa_id);

    return res.json({ ok: true, instanceName, canalId, qrcode: criacao.data?.qrcode?.base64 || null });
  } catch (err) {
    console.error("Erro criar instância:", err?.response?.data || err.message);
    return res.status(500).json({ erro: err?.response?.data?.message || "Erro ao criar instância no Evolution API" });
  }
});

// ─── LISTAR CANAIS ─────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  const { data } = await supabase.from("canais").select("*").eq("empresa_id", req.user.empresa_id);
  const resp = (data || []).map(c => ({
    ...c,
    numero_telefone: c.dados_conexao?.numero_telefone || null,
    ativo: c.dados_conexao?.ativo || c.status === "conectado"
  }));
  res.json(resp);
});

// ─── CRIAR CANAL GENÉRICO ───────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  const { nome, tipo, numero_telefone, dados_conexao } = req.body;
  if (!nome || !tipo) return res.status(400).json({ erro: "Nome e tipo obrigatórios" });
  
  const novoCanal = {
    empresa_id: req.user.empresa_id,
    nome, tipo,
    status: tipo === "cloud_api" ? "conectado" : "pendente",
    dados_conexao: {
      ...(dados_conexao || {}),
      numero_telefone: numero_telefone || null,
      ativo: true
    }
  };

  if (supabase) {
    const { error } = await supabase.from("canais").insert([novoCanal]);
    if (error) return res.status(400).json({ erro: error.message });
  }

  if (tipo === "cloud_api" && dados_conexao?.phone_number_id) {
    canaisMemoria.set(dados_conexao.phone_number_id, req.user.empresa_id);
  }
  return res.json({ ok: true });
});

// ─── DELETAR CANAL ─────────────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!supabase) return res.json({ ok: true });
  const { data: canal } = await supabase.from("canais").select("id, tipo, dados_conexao").eq("id", id).eq("empresa_id", req.user.empresa_id).single();
  if (!canal) return res.status(404).json({ erro: "Canal não encontrado" });

  if (canal.tipo === "evolution" && canal.dados_conexao?.instance_name) {
    await axios.delete(`${EVOLUTION_URL}/instance/delete/${canal.dados_conexao.instance_name}`, {
      headers: { apikey: EVOLUTION_KEY }
    }).catch(() => {});
    canaisMemoria.delete(canal.dados_conexao.instance_name);
  }

  const { error } = await supabase.from("canais").delete().eq("id", id).eq("empresa_id", req.user.empresa_id);
  if (error) return res.status(400).json({ erro: error.message });
  return res.json({ ok: true });
});

// ─── QR CODE ──────────────────────────────────────────────────
router.get("/:instanceName/qrcode", authMiddleware, async (req, res) => {
  const { instanceName } = req.params;
  try {
    const r = await axios.get(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY }
    });
    const base64 = r.data?.base64 || r.data?.qrcode?.base64 || null;
    return res.json({ ok: true, qrcode: base64 });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: "Não foi possível obter o QR code" });
  }
});

// ─── STATUS ───────────────────────────────────────────────────
router.get("/:instanceName/status", authMiddleware, async (req, res) => {
  const { instanceName } = req.params;
  try {
    const r = await axios.get(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY }
    });
    const state = r.data?.instance?.state || r.data?.state || "unknown";
    const connected = state === "open";

    if (connected && supabase) {
      await supabase.from("canais")
        .update({ status: "conectado" })
        .eq("empresa_id", req.user.empresa_id)
        .eq("dados_conexao->>instance_name", instanceName);
    }

    return res.json({ ok: true, state, connected });
  } catch (err) {
    return res.status(500).json({ ok: false, estado: "unknown", connected: false });
  }
});

module.exports = router;
