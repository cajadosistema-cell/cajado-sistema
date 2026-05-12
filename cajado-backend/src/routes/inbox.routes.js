const express = require("express");
const router = express.Router();
const axios = require("axios");

const { supabase } = require("../config/database");
const { EVOLUTION_URL, EVOLUTION_KEY, ADMIN_EMAIL } = require("../config/env");
const { conversas, botPausado, canaisMemoria, ADMIN_DEFAULT } = require("../config/memory");
const { registrarNaConversa } = require("../services/conversation.service");
const { enviarWhatsApp } = require("../services/evolution.service");
const { authMiddleware } = require("../middlewares/auth");

// Verifica token secreto do Evolution API (simples, sem JWT)
const webhookSecret = (req, res, next) => {
  const secret = req.headers["x-webhook-secret"] || req.headers["apikey"];
  if (secret && secret === EVOLUTION_KEY) return next();
  // Aceita também sem token (Evolution API nem sempre envia), mas loga aviso
  console.warn("[INBOX-WEBHOOK] Requisição sem secret recebida de:", req.ip);
  next();
};

// ── Mapa de status "digitando" por número (expira em 8s) ────────
const typingStatus = new Map(); // numero -> timestamp

router.post("/inbox/webhook", webhookSecret, async (req, res) => {
  res.sendStatus(200);
  const data = req.body;
  const event = data?.event?.toLowerCase();

  // ── Evento: digitando (presence.update) ──────────────────────
  if (event === 'presence.update' || event === 'presence') {
    const presences = data?.data?.presences || {};
    for (const jid of Object.keys(presences)) {
      const numero = jid.split('@')[0];
      const presence = presences[jid]?.lastKnownPresence;
      if (presence === 'composing' || presence === 'recording') {
        typingStatus.set(numero, Date.now());
        // Auto-limpa após 8s (caso o webhook de parar não chegue)
        setTimeout(() => {
          if (typingStatus.get(numero) && Date.now() - typingStatus.get(numero) >= 7500) {
            typingStatus.delete(numero);
          }
        }, 8000);
      } else {
        typingStatus.delete(numero);
      }
    }
    return;
  }

  if (event !== 'messages.upsert') return;
  const msg = data?.data;
  if (!msg?.key || msg.key.fromMe) return;
  const numero = msg.key.remoteJid?.split("@")[0];
  if (!numero || msg.key.remoteJid?.includes("@g.us")) return;

  const texto = msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption || "";

  const nome = msg.pushName || numero;
  const mensagem = { id: msg.key.id, tipo: "recebida", texto, numero, timestamp: new Date().toISOString() };

  // Verifica se é mídia
  const hasMedia = msg.message?.imageMessage || msg.message?.audioMessage || msg.message?.videoMessage || msg.message?.documentMessage || msg.message?.documentWithCaptionMessage;
  if (hasMedia) {
    try {
      const instanceName = data?.instance || "botwhatsapp01";
      const resp = await axios.post(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, { message: msg }, { headers: { apikey: EVOLUTION_KEY } });
      const base64Str = resp.data?.base64;
      if (base64Str) {
        const matches = base64Str.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimetype = matches[1];
          const base64Data = matches[2];
          const ext = mimetype.split('/')[1]?.split(';')[0]?.replace('x-matroska', 'mkv') || "bin";
          const buffer = Buffer.from(base64Data, "base64");
          const filePath = `${numero}/${Date.now()}_received.${ext}`;
          
          if (supabase) {
             const { error } = await supabase.storage.from('inbox-media').upload(filePath, buffer, { contentType: mimetype });
             if (!error) {
               const { data: publicUrlData } = supabase.storage.from('inbox-media').getPublicUrl(filePath);
               mensagem.mediaUrl = publicUrlData.publicUrl;
               mensagem.mediaType = mimetype.startsWith("image/") ? "image" : mimetype.startsWith("audio/") ? "audio" : mimetype.startsWith("video/") ? "video" : "document";
               mensagem.mimetype = mimetype;
               if (!mensagem.texto) mensagem.texto = `📎 ${mensagem.mediaType}`;
             }
          }
        }
      }
    } catch (e) {
      console.warn("[WEBHOOK] Erro ao baixar/upar mídia:", e.message);
    }
  }

  // ── Resolve empresa_id pela instância (isolamento multi-tenant) ──────────
  const instanceRecebida = data?.instance || data?.sender || "botwhatsapp01";

  // 1ª prioridade: canaisMemoria (instance_name → empresa_id) — mais confiável
  const canalInfo = canaisMemoria.get(instanceRecebida);
  let empresaIdCanal = (typeof canalInfo === "object" ? canalInfo?.empresa_id : canalInfo) || null;

  // 2ª prioridade: banco de dados (canais)
  if (!empresaIdCanal && supabase) {
    try {
      const { data: canalDb } = await supabase
        .from("canais")
        .select("empresa_id, dados_conexao")
        .eq("dados_conexao->>instance_name", instanceRecebida)
        .single();
      if (canalDb?.empresa_id) {
        empresaIdCanal = canalDb.empresa_id;
        // Atualiza memória para próximas mensagens
        canaisMemoria.set(instanceRecebida, { empresa_id: empresaIdCanal, ...canalDb.dados_conexao });
        console.log(`[INBOX-WH] ✅ Instância ${instanceRecebida} recuperada do banco → empresa ${empresaIdCanal}`);
      }
    } catch {}
  }

  // Se ainda sem empresa_id, DESCARTA (não usa ADMIN_DEFAULT para não contaminar)
  if (!empresaIdCanal) {
    console.warn(`[INBOX-WH] ⚠️ Instância "${instanceRecebida}" sem empresa mapeada. Mensagem descartada.`);
    return;
  }

  const conv = await registrarNaConversa(numero, mensagem, nome, null, empresaIdCanal, instanceRecebida);
  conv.unread = (conv.unread || 0) + 1;
  conv.lastInboundAt = new Date().toISOString();
  console.log(`[INBOX] ${nome} [tenant:${empresaIdCanal?.slice(0, 8)}] [inst:${instanceRecebida}]: ${texto || 'Mídia recebida'}`);
});


router.post("/inbox/mensagem", authMiddleware, async (req, res) => {
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
    isSuperAdmin: req.user.email?.toLowerCase() === (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase() || req.user.email?.toLowerCase() === "admin@visiopro.com",
    conversasMemoria: Array.from(conversas.values()).map(c => ({ numero: c.numero, nome: c.nome, empresa_id: c.empresa_id, msgs: c.mensagens?.length || 0 })),
    conversasSupabase: dbConversas
  });
});

router.get("/inbox/conversas", authMiddleware, async (req, res) => {
  // isSuperAdmin = admin master do sistema (ADMIN_EMAIL env var)
  // Mesmo sendo superAdmin, filtra pela própria empresa (não vê outros tenants)
  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail || req.user.email?.toLowerCase() === "admin@visiopro.com";

  // empresa_id efetivo: usa o do JWT (prioridade) ou ADMIN_DEFAULT se estiver vazio
  const empresaIdEfetivo = req.user.empresa_id && req.user.empresa_id !== "vazia"
    ? req.user.empresa_id
    : ADMIN_DEFAULT.empresa_id;

  if (supabase) {
    let query = supabase.from("whatsapp_conversas").select("dados, empresa_id");
    // Sempre filtra pela empresa — admin usa empresaIdEfetivo (ADMIN_DEFAULT), outros usam JWT
    query = query.eq("empresa_id", empresaIdEfetivo);
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
      // Filtra sempre por empresa — sem exceção para nenhum nível de admin
      return c.empresa_id === empresaIdEfetivo ||
             (c.empresa_id === "empresa-padrao" && isSuperAdmin);
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
      lastInboundAt: c.lastInboundAt || null,
  }));
  // Adiciona as conversas do Webchat (Vivi site)
  let listaVivi = [];
  if (supabase) {
    // Webchat: filtra por empresa_id (ambos admin e usuários normais)
    let qVivi = supabase.from("vivi_conversas").select("*")
      .eq("empresa_id", empresaIdEfetivo)
      .order("created_at", { ascending: false });
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

// ── Cache de fotos de perfil (evita bater na API repetidamente) ──
const fotosCache = new Map(); // numero -> { url, ts }
const FOTO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

router.get("/inbox/contact-photo/:numero", authMiddleware, async (req, res) => {
  const { numero } = req.params;

  // Verifica cache
  const cached = fotosCache.get(numero);
  if (cached && (Date.now() - cached.ts) < FOTO_CACHE_TTL) {
    return res.json({ url: cached.url });
  }

  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    return res.json({ url: null });
  }

  // Detecta qual instância está usando este número
  const conv = conversas.get(numero);
  const instanceName = conv?.instanceName || "botwhatsapp01";
  const jid = numero.includes("@") ? numero : `${numero}@s.whatsapp.net`;

  try {
    const resp = await axios.post(
      `${EVOLUTION_URL}/chat/fetchProfile/${instanceName}`,
      { number: jid },
      { headers: { apikey: EVOLUTION_KEY }, timeout: 5000 }
    );
    const url = resp.data?.profilePictureUrl || resp.data?.picture || null;
    fotosCache.set(numero, { url, ts: Date.now() });
    return res.json({ url });
  } catch {
    fotosCache.set(numero, { url: null, ts: Date.now() });
    return res.json({ url: null });
  }
});

router.get("/inbox/conversas/:numero", authMiddleware, async (req, res) => {
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase();
  const isSuperAdmin = superAdminEmail && req.user.email?.toLowerCase() === superAdminEmail;
  const numero = req.params.numero;
  if (supabase) {
    let query = supabase.from("whatsapp_conversas").select("dados, empresa_id").eq("numero", numero);
    if (!isSuperAdmin) query = query.eq("empresa_id", req.user.empresa_id);
    const { data, error: dbErr } = await query.single();
    console.log(`[Detalhe] ${numero} | user.empresa_id=${req.user.empresa_id} | dbFound=${!!data} | dbMsgs=${data?.dados?.mensagens?.length ?? 'N/A'} | dbErr=${dbErr?.message || 'none'}`);
    if (data && data.dados) {
      data.dados.empresa_id = data.dados.empresa_id || "empresa-padrao";
      const current = conversas.get(numero);
      if (!current || !current.mensagens || (data.dados.mensagens && data.dados.mensagens.length >= current.mensagens.length)) {
        conversas.set(numero, data.dados);
      }
    } else if (!isSuperAdmin) {
      // Conversa não pertence a esta empresa
      return res.status(403).json({ erro: "Acesso negado a esta conversa" });
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
  // Verificar empresa_id na memória também
  if (!isSuperAdmin && conv.empresa_id && conv.empresa_id !== "empresa-padrao" && conv.empresa_id !== req.user.empresa_id) {
    return res.status(403).json({ erro: "Acesso negado a esta conversa" });
  }
  
  if (conv.unread > 0) {
    conv.unread = 0;
    if (supabase && conv.empresa_id && conv.empresa_id !== "empresa-padrao" && conv.empresa_id !== "vazia") {
      supabase.from("whatsapp_conversas").upsert({ numero, empresa_id: conv.empresa_id, dados: conv }).then(()=>{});
    }
  }

  // Inclui status de digitando na resposta (TTL de 8s)
  const isTyping = typingStatus.has(numero) && (Date.now() - typingStatus.get(numero)) < 8000;

  res.json({ ...conv, botOn: !botPausado.has(numero), isTyping });
});

router.post("/inbox/enviar", authMiddleware, async (req, res) => {
  const { numero, texto, interna, media } = req.body;
  if (!numero || (!texto && !media)) return res.status(400).json({ erro: "numero e texto/media obrigatórios" });
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

    if (media && !numero.match(/[a-zA-Z-]/)) {
      const instance = instOverride || process.env.INSTANCE || "botwhatsapp01";
      const mediaType = media.tipo || (media.mimetype?.startsWith("image/") ? "image" : media.mimetype?.startsWith("video/") ? "video" : media.mimetype?.startsWith("audio/") ? "audio" : "document");
      const url = `${EVOLUTION_URL}/message/sendMedia/${instance}`;
      
      let base64OrUrl = media.url;
      
      if (mediaType === "audio" && media.isVoiceNote) {
        const pttUrl = `${EVOLUTION_URL}/message/sendWhatsAppAudio/${instance}`;
        await axios.post(pttUrl, {
          number: numero,
          audio: base64OrUrl,
          delay: 1500
        }, { headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" } });
      } else {
        await axios.post(url, {
          number: numero,
          mediatype: mediaType,
          mimetype: media.mimetype,
          caption: texto || "",
          media: base64OrUrl,
          fileName: media.fileName || "arquivo"
        }, { headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" } });
      }
    } else {
      await enviarWhatsApp(numero, texto || "📎 Anexo", instOverride);
    }
    
    const mensagem = { id: Date.now().toString(), tipo: "enviada", texto: texto || "", numero, timestamp: new Date().toISOString() };
    if (media) {
      mensagem.mediaType = media.tipo;
      mensagem.mediaUrl = media.url;
      mensagem.mimetype = media.mimetype;
    }
    await registrarNaConversa(numero, mensagem, null, null, null, instOverride);
    res.json({ ok: true });
  } catch (e) {
    console.error("[ENVIAR]", e.response?.data || e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ─── ENVIAR MÍDIA ─────────────────────────────────────────────────────────
router.post("/inbox/enviar-midia", authMiddleware, async (req, res) => {
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

router.post("/inbox/bot/:numero", authMiddleware, async (req, res) => {
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

router.patch("/inbox/conversas/:numero/etiqueta", authMiddleware, async (req, res) => {
  const { numero } = req.params;
  if (conversas.has(numero)) {
    const conv = conversas.get(numero);
    conv.etiqueta = req.body.etiqueta;
    await registrarNaConversa(numero, null, null, null);
  }
  res.json({ ok: true });
});

router.patch("/inbox/conversas/:numero/setor", authMiddleware, async (req, res) => {
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
