const express = require("express");
const router = express.Router();
const axios = require("axios");

const { supabase } = require("../config/database");
const { EVOLUTION_URL, EVOLUTION_KEY } = require("../config/env");
const { authMiddleware } = require("../middlewares/auth");
const { canaisMemoria } = require("../config/memory");
const { configurarAntiBan } = require("../services/evolution.service");

const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "https://visiopro-unified01-production.up.railway.app";

// Helper: aguarda N ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: chamada ao Evolution com timeout
const evo = (method, path, data = null) => {
  const config = {
    method,
    url: `${EVOLUTION_URL}${path}`,
    headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" },
    timeout: 15000,
  };
  if (data) config.data = data;
  return axios(config);
};

// ─── CRIAR INSTÂNCIA AUTO ─────────────────────────────────────────────────────
router.post("/criar-instancia", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Apenas admins" });
  const { nome, numero_telefone } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome do canal é obrigatório" });

  const empresaSlug = req.user.empresa_id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const ts = Date.now().toString().slice(-6);
  const instanceName = `vp_${empresaSlug}_${ts}`;
  const webhookUrl = `${RAILWAY_URL}/webhook/evolution`;

  try {
    // 1. Cria a instância
    const criacao = await evo("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });

    console.log(`[CANAIS] Instância ${instanceName} criada, aguardando inicialização...`);
    await sleep(2000);

    // 2. Configura webhook (com retry)
    let webhookOk = false;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await evo("POST", `/webhook/set/${instanceName}`, {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          }
        });
        webhookOk = true;
        break;
      } catch (e) {
        console.warn(`[CANAIS] Tentativa ${tentativa}/3 de webhook falhou:`, e.message);
        if (tentativa < 3) await sleep(1500);
      }
    }

    // 3. Aplica anti-ban
    await configurarAntiBan(instanceName);

    // 4. Busca QR code (com retry)
    let qrcode = null;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await sleep(1000 * tentativa);
        const qrRes = await evo("GET", `/instance/connect/${instanceName}`);
        qrcode = qrRes.data?.base64 || qrRes.data?.qrcode?.base64 || null;
        if (qrcode) break;
      } catch (e) {
        console.warn(`[CANAIS] Tentativa ${tentativa}/3 de buscar QR falhou:`, e.message);
      }
    }

    // 5. Salva no banco
    const novoCanal = {
      empresa_id: req.user.empresa_id,
      nome,
      tipo: "evolution",
      status: "pendente",
      dados_conexao: {
        instance_name: instanceName,
        numero_telefone: numero_telefone || null,
        webhook_url: webhookUrl,
        webhook_ok: webhookOk,
        ativo: false,
      }
    };

    let canalId = null;
    if (supabase) {
      const { data } = await supabase.from("canais").insert(novoCanal).select().single();
      canalId = data?.id;
    }
    canaisMemoria.set(instanceName, req.user.empresa_id);

    return res.json({ ok: true, instanceName, canalId, qrcode, webhookOk });
  } catch (err) {
    console.error("Erro criar instância:", err?.response?.data || err.message);
    return res.status(500).json({ erro: err?.response?.data?.message || "Erro ao criar instância no Evolution API" });
  }
});

// ─── VINCULAR INSTÂNCIA EXISTENTE (ANTI-BAN) ──────────────────────────────────
// Fluxo seguro: o admin cria a instância MANUALMENTE no Evolution Manager
// e cola apenas o instanceName aqui. O sistema configura o webhook e verifica
// o estado real — sem criar sessão zerada automaticamente (evita banimento).
router.post("/vincular-instancia", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Apenas admins" });

  const { instanceName, nome } = req.body;
  if (!instanceName) return res.status(400).json({ erro: "Nome da instância é obrigatório" });

  const webhookUrl = `${RAILWAY_URL}/webhook/evolution`;

  try {
    // 1. Configura o webhook na instância existente (com retry)
    let webhookOk = false;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await evo("POST", `/webhook/set/${instanceName}`, {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          }
        });
        webhookOk = true;
        console.log(`[CANAIS] Webhook configurado para instância manual ${instanceName}`);
        break;
      } catch (e) {
        console.warn(`[CANAIS] Tentativa ${tentativa}/3 de webhook em instância manual falhou:`, e.message);
        if (tentativa < 3) await sleep(1500);
      }
    }

    // 2. Verifica o estado REAL da instância antes de salvar
    let isConnected = false;
    try {
      const stateRes = await evo("GET", `/instance/connectionState/${instanceName}`);
      const state = stateRes.data?.instance?.state || stateRes.data?.state || "unknown";
      isConnected = state === "open";
      console.log(`[CANAIS] Estado real de ${instanceName}: ${state} (conectado=${isConnected})`);
    } catch (e) {
      console.warn(`[CANAIS] Não foi possível verificar estado de ${instanceName}:`, e.message);
    }

    // 3. Salva com status real
    const novoCanal = {
      empresa_id: req.user.empresa_id,
      nome: nome || instanceName,
      tipo: "evolution",
      status: isConnected ? "conectado" : "pendente",
      dados_conexao: {
        instance_name: instanceName,
        webhook_url: webhookUrl,
        webhook_ok: webhookOk,
        ativo: isConnected,
      }
    };

    let canalId = null;
    if (supabase) {
      const { data, error } = await supabase.from("canais").insert(novoCanal).select().single();
      if (error) console.warn("[CANAIS] Erro ao salvar canal manual no banco:", error.message);
      else canalId = data?.id;
    }

    // 4. Registra na memória
    canaisMemoria.set(instanceName, req.user.empresa_id);

    // 5. Monta link de conexão (caso ainda precise escanear QR)
    const linkConexao = canalId ? `${RAILWAY_URL}/conectar/${canalId}` : null;
    console.log(`[CANAIS] Instância ${instanceName} vinculada — conectado=${isConnected}, link=${linkConexao}`);

    return res.json({ ok: true, instanceName, canalId, webhookOk, isConnected, linkConexao });

  } catch (err) {
    console.error("[CANAIS] Erro ao vincular instância:", err.message);
    return res.status(500).json({ erro: "Erro ao vincular instância manual" });
  }
});

// ─── LISTAR CANAIS ─────────────────────────────────────────────────────────────
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

// ─── CRIAR CANAL GENÉRICO ─────────────────────────────────────────────────────
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

// ─── CONFIGURAR API OFICIAL META (Cloud API) ──────────────────────────────────
router.post("/configurar-oficial", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Apenas admins" });

  const { phoneNumberId, accessToken, webhookVerifyToken, businessAccountId } = req.body;
  if (!phoneNumberId || !accessToken || !webhookVerifyToken) {
    return res.status(400).json({ erro: "phoneNumberId, accessToken e webhookVerifyToken são obrigatórios" });
  }

  try {
    const verifyRes = await axios.get(
      `https://graph.facebook.com/v19.0/${phoneNumberId}`,
      { params: { access_token: accessToken } }
    );
    const metaDados = verifyRes.data;

    const novoCanal = {
      empresa_id: req.user.empresa_id,
      nome: metaDados?.display_phone_number || `WhatsApp Oficial (${phoneNumberId})`,
      tipo: "cloud_api",
      status: "conectado",
      dados_conexao: {
        phone_number_id: phoneNumberId,
        access_token: accessToken,
        webhook_verify_token: webhookVerifyToken,
        business_account_id: businessAccountId || null,
        display_phone_number: metaDados?.display_phone_number || null,
        verified_name: metaDados?.verified_name || null,
        ativo: true,
      }
    };

    if (supabase) {
      await supabase.from("canais").delete().eq("empresa_id", req.user.empresa_id).eq("tipo", "cloud_api");
      const { error } = await supabase.from("canais").insert([novoCanal]);
      if (error) throw new Error(error.message);
    }

    canaisMemoria.set(phoneNumberId, req.user.empresa_id);

    return res.json({
      ok: true,
      numero: metaDados?.display_phone_number || phoneNumberId,
      nome_verificado: metaDados?.verified_name || null,
      mensagem: "API Oficial Meta configurada com sucesso!"
    });

  } catch (err) {
    const metaError = err?.response?.data?.error;
    if (metaError) {
      return res.status(400).json({ erro: `Token inválido: ${metaError.message}`, codigo: metaError.code });
    }
    return res.status(500).json({ erro: "Erro ao validar credenciais com a Meta" });
  }
});

// ─── DELETAR CANAL ────────────────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!supabase) return res.json({ ok: true });
  const { data: canal } = await supabase.from("canais").select("id, tipo, dados_conexao").eq("id", id).eq("empresa_id", req.user.empresa_id).single();
  if (!canal) return res.status(404).json({ erro: "Canal não encontrado" });

  if (canal.tipo === "evolution" && canal.dados_conexao?.instance_name) {
    await evo("DELETE", `/instance/delete/${canal.dados_conexao.instance_name}`).catch(() => {});
    canaisMemoria.delete(canal.dados_conexao.instance_name);
  }

  const { error } = await supabase.from("canais").delete().eq("id", id).eq("empresa_id", req.user.empresa_id);
  if (error) return res.status(400).json({ erro: error.message });
  return res.json({ ok: true });
});

// ─── QR CODE ──────────────────────────────────────────────────────────────────
router.get("/:instanceName/qrcode", authMiddleware, async (req, res) => {
  const { instanceName } = req.params;
  try {
    const r = await evo("GET", `/instance/connect/${instanceName}`);
    const qrcode = r.data?.base64 || r.data?.qrcode?.base64 || null;
    const state = r.data?.instance?.state || r.data?.state || null;
    if (state === "open") return res.json({ ok: true, qrcode: null, connected: true, state });
    return res.json({ ok: true, qrcode, connected: false, state });
  } catch (err) {
    if (err?.response?.status === 404) return res.json({ ok: false, qrcode: null, connected: false, state: "initializing" });
    return res.status(500).json({ ok: false, erro: "Não foi possível obter o QR code" });
  }
});

// ─── STATUS ───────────────────────────────────────────────────────────────────
router.get("/:instanceName/status", authMiddleware, async (req, res) => {
  const { instanceName } = req.params;
  try {
    const r = await evo("GET", `/instance/connectionState/${instanceName}`);
    const state = r.data?.instance?.state || r.data?.state || "unknown";
    const connected = state === "open";

    if (connected && supabase) {
      // Busca o canal e atualiza o campo `ativo` dentro do JSONB
      const { data: canal } = await supabase.from("canais")
        .select("id, dados_conexao")
        .eq("empresa_id", req.user.empresa_id)
        .eq("dados_conexao->>instance_name", instanceName)
        .single();

      if (canal) {
        await supabase.from("canais")
          .update({ status: "conectado", dados_conexao: { ...canal.dados_conexao, ativo: true } })
          .eq("id", canal.id);
      }
    }

    return res.json({ ok: true, state, connected });
  } catch (err) {
    if (err?.response?.status === 404) return res.json({ ok: false, state: "not_found", connected: false });
    return res.status(500).json({ ok: false, estado: "unknown", connected: false });
  }
});

module.exports = router;
