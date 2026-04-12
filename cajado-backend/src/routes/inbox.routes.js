const express = require("express");
const router = express.Router();
const axios = require("axios");

const { supabase } = require("../config/database");
const { EVOLUTION_URL, EVOLUTION_KEY, ADMIN_EMAIL } = require("../config/env");
const { conversas, botPausado, canaisMemoria, ADMIN_DEFAULT } = require("../config/memory");
const { registrarNaConversa } = require("../services/conversation.service");
const { enviarWhatsApp } = require("../services/evolution.service");
const { authMiddleware } = require("../middlewares/auth");

router.post("/inbox/webhook", async (req, res) => {
  res.sendStatus(200);
  const data = req.body;
  if (data?.event?.toLowerCase() !== "messages.upsert") return;
  const msg = data?.data;
  if (!msg?.key || msg.key.fromMe) return;
  const numero = msg.key.remoteJid?.split("@")[0];
  if (!numero || msg.key.remoteJid?.includes("@g.us")) return;

  const texto = msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption || "";

  const nome = msg.pushName || numero;
  const mensagem = { id: msg.key.id, tipo: "recebida", texto, numero, timestamp: new Date().toISOString() };
  const conv = await registrarNaConversa(numero, mensagem, nome, null);
  conv.unread = (conv.unread || 0) + 1;
  console.log(`[INBOX] ${nome}: ${texto}`);
});

router.post("/inbox/mensagem", async (req, res) => {
  const { numero, texto, tipo, nome, setor } = req.body;
  if (!numero || !texto) return res.status(400).json({ erro: "numero e texto obrigatórios" });
  const mensagem = { id: Date.now().toString(), tipo: tipo || "bot", texto, numero, timestamp: new Date().toISOString() };
  await registrarNaConversa(numero, mensagem, nome, setor);
  console.log(`[BOT→INBOX] ${nome || numero}: ${texto.substring(0, 60)}`);
  res.json({ ok: true });
});

router.get("/debug/inbox", authMiddleware, async (req, res) => {
  let dbConversas = [];
  if (supabase) {
    const { data } = await supabase.from("whatsapp_conversas").select("numero, empresa_id");
    dbConversas = data || [];
  }
  res.json({
    user: { email: req.user.email, empresa_id: req.user.empresa_id, role: req.user.role },
    adminEnv: ADMIN_EMAIL,
    adminDefault: ADMIN_DEFAULT.empresa_id,
    isSuperAdmin: req.user.email?.toLowerCase() === (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase(),
    conversasMemoria: Array.from(conversas.values()).map(c => ({ numero: c.numero, nome: c.nome, empresa_id: c.empresa_id, msgs: c.mensagens?.length || 0 })),
    conversasSupabase: dbConversas
  });
});

router.get("/inbox/conversas", authMiddleware, async (req, res) => {
  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail || req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao";
  
  if (supabase) {
    let query = supabase.from("whatsapp_conversas").select("dados, empresa_id");
    if (!isSuperAdmin) {
      query = query.eq("empresa_id", req.user.empresa_id);
    }
    const { data } = await query;
    if (data) {
      data.forEach(row => {
        if(row.dados) {
          row.dados.empresa_id = row.empresa_id;

          const isNew = !conversas.has(row.dados.numero);
          if (isNew) {
            if (row.dados.botOn === false) botPausado.set(row.dados.numero, true);
            else botPausado.delete(row.dados.numero);
          }

          const current = conversas.get(row.dados.numero);
          if (!current || !current.mensagens || (row.dados.mensagens && row.dados.mensagens.length >= current.mensagens.length)) {
            conversas.set(row.dados.numero, row.dados);
          }
        }
      });
    }
  }

  const lista = Array.from(conversas.values())
    .filter(c => {
      if (isSuperAdmin) return true;
      return c.empresa_id === req.user.empresa_id ||
             (c.empresa_id === "empresa-padrao" && req.user.empresa_id === ADMIN_DEFAULT.empresa_id);
    })
    .map(c => ({
      numero: c.numero,
      nome: c.nome,
      etiqueta: c.etiqueta,
      botOn: !botPausado.has(c.numero),
      unread: c.unread || 0,
      ultimaMensagem: c.ultimaMensagem || "",
      ultimoHorario: c.ultimoHorario || "",
      setor: c.setor || null,
      assumido_nome: c.assumido_nome || null,
  }));
  // Adiciona as conversas do Webchat (Vivi site)
  let listaVivi = [];
  if (supabase) {
    let qVivi = supabase.from("vivi_conversas").select("*").order("created_at", { ascending: false });
    if (!isSuperAdmin) {
      qVivi = qVivi.or(`empresa_id.eq.${req.user.empresa_id},empresa_id.is.null`);
    }
    const { data: dataVivi } = await qVivi;
    if (dataVivi) {
      const mapVivi = new Map();
      for (const m of dataVivi) {
        if (!mapVivi.has(m.session_id)) {
          mapVivi.set(m.session_id, {
            numero: m.session_id,
            nome: "Visitante " + (m.session_id ? m.session_id.slice(-4) : ""),
            etiqueta: "site",
            botOn: false, // Site bot logic handles its own state
            unread: 0,
            ultimaMensagem: m.mensagem,
            ultimoHorario: m.created_at || m.criado_em,
            setor: "Webchat",
            assumido_nome: null,
          });
        }
        if (m.visto === false && m.role === "user") {
          mapVivi.get(m.session_id).unread += 1;
        }
      }
      listaVivi = Array.from(mapVivi.values());
    }
  }

  res.json([...lista, ...listaVivi]);
});

router.get("/inbox/conversas/:numero", async (req, res) => {
  const numero = req.params.numero;
  if (supabase) {
    const { data } = await supabase.from("whatsapp_conversas").select("dados").eq("numero", numero).single();
    if (data && data.dados) {
      data.dados.empresa_id = data.dados.empresa_id || "empresa-padrao";
      const current = conversas.get(numero);
      if (!current || !current.mensagens || (data.dados.mensagens && data.dados.mensagens.length >= current.mensagens.length)) {
        conversas.set(numero, data.dados);
      }
    }
  }

  // Se for um session_id do Webchat (contém letras ou hifens)
  if (numero && numero.match(/[a-zA-Z-]/)) {
    if (supabase) {
      const { data } = await supabase.from("vivi_conversas").select("*").eq("session_id", numero).order("created_at", { ascending: true });
      if (data && data.length > 0) {
        // Marca como visto
        await supabase.from("vivi_conversas").update({ visto: true }).eq("session_id", numero).is("visto", false);
        
        const formatadas = data.map(m => ({
          id: m.id.toString(),
          tipo: m.role === "user" ? "recebida" : "enviada",
          texto: m.mensagem,
          numero: m.session_id,
          timestamp: m.created_at || m.criado_em
        }));
        
        return res.json({
          numero,
          nome: "Visitante " + numero.slice(-4),
          mensagens: formatadas,
          botOn: false,
          etiqueta: "site",
          setor: "Webchat"
        });
      }
    }
    return res.json({ mensagens: [], botOn: false });
  }

  const conv = conversas.get(numero);
  if (!conv) return res.json({ mensagens: [], botOn: true });
  
  if (conv.unread > 0) {
    conv.unread = 0;
    if (supabase && conv.empresa_id && conv.empresa_id !== "empresa-padrao" && conv.empresa_id !== "vazia") {
      supabase.from("whatsapp_conversas").upsert({ numero, empresa_id: conv.empresa_id, dados: conv }).then(()=>{});
    }
  }
  
  res.json({ ...conv, botOn: !botPausado.has(numero) });
});

router.post("/inbox/enviar", async (req, res) => {
  const { numero, texto, interna } = req.body;
  if (!numero || !texto) return res.status(400).json({ erro: "numero e texto obrigatórios" });
  try {
    if (interna) {
      const mensagem = { id: Date.now().toString(), tipo: "interna", texto, numero, timestamp: new Date().toISOString() };
      await registrarNaConversa(numero, mensagem, null, null);
      return res.json({ ok: true, interna: true });
    }
    const convInfo = conversas.get(numero);
    const instOverride = convInfo ? convInfo.instanceName : null;
    
    // Se for Webchat (session_id)
    if (numero.match(/[a-zA-Z-]/)) {
      if (supabase) {
        await supabase.from("vivi_conversas").insert([{
          session_id: numero,
          mensagem: texto,
          role: "assistant",
          canal: "site",
          empresa_id: (req.user && req.user.empresa_id) || null,
          visto: true
        }]);
      }
      return res.json({ ok: true });
    }

    await enviarWhatsApp(numero, texto, instOverride);
    const mensagem = { id: Date.now().toString(), tipo: "enviada", texto, numero, timestamp: new Date().toISOString() };
    await registrarNaConversa(numero, mensagem, null, null, null, instOverride);
    res.json({ ok: true });
  } catch (e) {
    console.error("[ENVIAR]", e.response?.data || e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ─── ENVIAR MÍDIA ─────────────────────────────────────────────────────────
router.post("/inbox/enviar-midia", async (req, res) => {
  const { numero, base64, mimetype, filename, tipo } = req.body;
  if (!numero || !base64) return res.status(400).json({ erro: "numero e base64 obrigatórios" });
  try {
    const convInfo = conversas.get(numero);
    const instOverride = convInfo ? convInfo.instanceName : null;
    const instance = instOverride || process.env.INSTANCE || "botwhatsapp01";

    const mediaType = tipo || (mimetype?.startsWith("image/") ? "image" : mimetype?.startsWith("video/") ? "video" : "document");
    const url = `${EVOLUTION_URL}/message/sendMedia/${instance}`;
    await axios.post(url, {
      number: numero,
      mediatype: mediaType,
      mimetype,
      caption: "",
      media: `data:${mimetype};base64,${base64}`,
      fileName: filename || "arquivo"
    }, { headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" } });

    const mensagem = { id: Date.now().toString(), tipo: "enviada", texto: `📎 ${filename || "Arquivo"}`, numero, timestamp: new Date().toISOString() };
    await registrarNaConversa(numero, mensagem, null, null, null, instOverride);
    res.json({ ok: true });
  } catch (e) {
    console.error("[ENVIAR-MIDIA]", e.response?.data || e.message);
    res.status(500).json({ erro: e.message });
  }
});

router.post("/inbox/bot/:numero", async (req, res) => {
  const { numero } = req.params;
  const { pausar } = req.body;
  if (pausar) {
    botPausado.set(numero, true);
    console.log(`[BOT] Pausado para ${numero}`);
  } else {
    botPausado.delete(numero);
    console.log(`[BOT] Ativado para ${numero}`);
  }
  if (conversas.has(numero)) {
    conversas.get(numero).botOn = !pausar;
    await registrarNaConversa(numero, null, null, null);
  }
  res.json({ ok: true, botOn: !pausar });
});

router.get("/inbox/bot/:numero/status", (req, res) => {
  res.json({ botOn: !botPausado.has(req.params.numero) });
});

router.patch("/inbox/conversas/:numero/etiqueta", async (req, res) => {
  const { numero } = req.params;
  if (conversas.has(numero)) {
    const conv = conversas.get(numero);
    conv.etiqueta = req.body.etiqueta;
    await registrarNaConversa(numero, null, null, null);
  }
  res.json({ ok: true });
});

router.patch("/inbox/conversas/:numero/setor", async (req, res) => {
  const { numero } = req.params;
  if (conversas.has(numero)) {
    const conv = conversas.get(numero);
    conv.setor = req.body.setor?.toLowerCase().trim() || null;
    await registrarNaConversa(numero, null, null, null);
  }
  res.json({ ok: true });
});

["", "/v1"].forEach(prefix => {
  router.get(`${prefix}/conversas/:id`, async (req, res) => {
    const { id } = req.params;
    const conv = conversas.get(id);
    if (conv) return res.json(conv);
    if (supabase) {
      const { data } = await supabase.from("whatsapp_conversas")
        .select("*").or(`id.eq.${id},numero.eq.${id}`).limit(1).single();
      if (data) return res.json(data);
    }
    res.status(404).json({ erro: "Conversa não encontrada" });
  });

  router.patch(`${prefix}/conversas/:id`, async (req, res) => {
    const { id } = req.params;
    const updates = req.body || {};
    console.log(`[BRIDGE] PATCH ${prefix}/conversas/${id}`, JSON.stringify(updates));

    const dbUpdate = {};
    if (updates.etiqueta   !== undefined) dbUpdate.etiqueta = updates.etiqueta;
    if (updates.setor      !== undefined) dbUpdate.setor = updates.setor;
    if (updates.status     !== undefined) dbUpdate.status = updates.status;
    if (updates.nome       !== undefined) dbUpdate.nome = updates.nome;
    if (updates.bot_on     !== undefined) dbUpdate.bot_on = updates.bot_on;
    if (updates.atribuido  !== undefined) dbUpdate.atribuido = updates.atribuido;
    if (updates.observacao !== undefined) dbUpdate.observacao = updates.observacao;
    Object.keys(updates).forEach(k => {
      if (!dbUpdate[k] && !["id","empresa_id","created_at"].includes(k)) dbUpdate[k] = updates[k];
    });

    if (conversas.has(id)) {
      const conv = conversas.get(id);
      Object.assign(conv, dbUpdate);
    }

    if (supabase && Object.keys(dbUpdate).length > 0) {
      const { error: e1 } = await supabase.from("whatsapp_conversas")
        .update(dbUpdate).eq("id", id);
      if (e1) {
        await supabase.from("whatsapp_conversas")
          .update(dbUpdate).eq("numero", id);
      }
    }

    res.json({ ok: true, updated: dbUpdate });
  });
});

router.get("/inbox/instancias", async (req, res) => {
  try {
    const resp = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: { apikey: EVOLUTION_KEY } });
    res.json(resp.data);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
