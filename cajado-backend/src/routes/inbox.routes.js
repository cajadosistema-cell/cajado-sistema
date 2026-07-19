const express = require("express");
const router = express.Router();
const axios = require("axios");

const { supabase } = require("../config/database");
const { EVOLUTION_URL, EVOLUTION_KEY, ADMIN_EMAIL } = require("../config/env");
const { conversas, botPausado, canaisMemoria, ADMIN_DEFAULT, chaveConversa } = require("../config/memory");
const { registrarNaConversa } = require("../services/conversation.service");
const { enviarWhatsApp } = require("../services/evolution.service");
const { authMiddleware } = require("../middlewares/auth");

function isAdminSuper(req) {
  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  return req.user?.email?.toLowerCase() === adminEmail || req.user?.empresa_id === ADMIN_DEFAULT.empresa_id;
}

/**
 * Localiza uma conversa em memória de forma segura por tenant.
 * Usuário normal: só pode enxergar a chave da PRÓPRIA empresa.
 * Super admin: pode indicar ?empresa_id= explicitamente, ou (fallback)
 * varre a memória por número — uso administrativo, não client-facing.
 */
function localizarConversa(numero, req) {
  const superAdmin = isAdminSuper(req);
  if (!superAdmin) {
    const chave = chaveConversa(req.user.empresa_id, numero);
    return { chave, conv: conversas.get(chave), isSuperAdmin: false };
  }
  const empresaExplicita = req.query?.empresa_id || req.body?.empresa_id;
  if (empresaExplicita) {
    const chave = chaveConversa(empresaExplicita, numero);
    return { chave, conv: conversas.get(chave), isSuperAdmin: true };
  }
  for (const [chave, conv] of conversas.entries()) {
    if (conv.numero === numero) return { chave, conv, isSuperAdmin: true };
  }
  return { chave: chaveConversa(ADMIN_DEFAULT.empresa_id, numero), conv: undefined, isSuperAdmin: true };
}

// DESATIVADA: duplicava a lógica do canal Evolution já tratada em
// src/routes/webhook.routes.js (POST /webhook/evolution), que é pra onde
// a Evolution de fato aponta. Esta aqui não resolvia empresa_id nenhum
// (tudo caía no empresa_id padrão), então era só superfície de risco sem
// função real. Se algo inesperado ainda apontar pra cá, vai começar a
// responder 410 em vez de processar mensagens.
router.post("/inbox/webhook", (req, res) => {
  res.status(410).json({ erro: "Rota desativada — use /webhook/evolution." });
});

// Antes sem autenticação: qualquer um podia injetar mensagem em qualquer
// conversa. Agora exige login e só mexe na conversa da própria empresa.
router.post("/inbox/mensagem", authMiddleware, async (req, res) => {
  const { numero, texto, tipo, nome, setor } = req.body;
  if (!numero || !texto) return res.status(400).json({ erro: "numero e texto obrigatórios" });

  const { conv: convExistente } = localizarConversa(numero, req);
  if (convExistente && !isAdminSuper(req) && convExistente.empresa_id !== req.user.empresa_id) {
    return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
  }

  const empresaAlvo = convExistente?.empresa_id || req.user.empresa_id;
  const mensagem = { id: Date.now().toString(), tipo: tipo || "bot", texto, numero, timestamp: new Date().toISOString() };
  await registrarNaConversa(numero, mensagem, nome, setor, empresaAlvo);
  console.log(`[BOT→INBOX] ${nome || numero}: ${texto.substring(0, 60)}`);
  res.json({ ok: true });
});

router.get("/debug/evolution", (req, res) => {
  res.json({ url: EVOLUTION_URL, key: EVOLUTION_KEY ? EVOLUTION_KEY.substring(0, 5) + "..." : "MISSING" });
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
          const chave = chaveConversa(row.empresa_id, row.dados.numero);

          // Mesma lógica do endpoint de detalhe: só preenche a partir do banco
          // se ainda não estiver em memória. Memória já populada é sempre a
          // versão mais atual (atualizada de forma síncrona pelo webhook) —
          // sobrescrever com o banco a cada poll é que causava mensagem sumindo.
          if (!conversas.has(chave)) {
            if (row.dados.botOn === false) botPausado.set(chave, true);
            conversas.set(chave, row.dados);
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
      botOn: !botPausado.has(chaveConversa(c.empresa_id, c.numero)),
      unread: c.unread || 0,
      ultimaMensagem: c.ultimaMensagem || "",
      ultimoHorario: c.ultimoHorario || "",
      setor: c.setor || null,
      assumido_nome: c.assumido_nome || null,
      lastInboundAt: c.lastInboundAt || null,
      // ── Campos de identidade visual ──────────────────
      avatarUrl: c.avatarUrl || null,         // Foto de perfil do contato
      instanceName: c.instanceName || null,   // Instância Evolution de origem
      canal: c.canal || null,                 // "oficial" para WABA, null para Evolution
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
  const chave = chaveConversa(req.user.empresa_id, numero);
  const conv = conversas.get(chave);
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
  const numero = req.params.numero;
  const isSuperAdmin = isAdminSuper(req);

  // Resolve a empresa certa pra montar a chave. Usuário normal: sempre a
  // própria empresa (não muda). Super admin: usa ?empresa_id= se veio
  // explícito; senão, procura em memória por esse número em QUALQUER
  // empresa (uma conversa pode pertencer a empresa diferente da que o
  // admin master está vinculado) — só cai na própria empresa do admin
  // como último recurso, se não achar em lugar nenhum.
  let empresaAlvo = isSuperAdmin ? req.query.empresa_id : req.user.empresa_id;
  if (isSuperAdmin && !empresaAlvo) {
    for (const c of conversas.values()) {
      if (c.numero === numero) { empresaAlvo = c.empresa_id; break; }
    }
  }
  const empresaEraDesconhecida = isSuperAdmin && !empresaAlvo;
  if (!empresaAlvo) empresaAlvo = req.user.empresa_id;
  let chave = chaveConversa(empresaAlvo, numero);

  // Só busca no Supabase se a conversa AINDA não está em memória (ex: logo
  // após reiniciar o servidor). Reconsultar o banco a cada poll (o frontend
  // chama essa rota a cada 2.5s) e comparar tamanhos pra decidir se sobrescreve
  // criava uma corrida com o INSERT/UPDATE assíncrono do webhook — podia
  // sobrescrever o estado em memória (sempre o mais atual) com uma versão do
  // banco ainda não totalmente propagada, fazendo mensagem "sumir" no poll
  // seguinte. Em memória já é sempre a fonte mais atual, então não precisa
  // reconsultar o banco toda vez.
  if (supabase && !conversas.has(chave)) {
    let query = supabase.from("whatsapp_conversas").select("dados, empresa_id").eq("numero", numero);
    // Se a empresa ainda é um "chute" (super admin sem ?empresa_id= e não achou
    // em memória), não filtra por empresa — deixa achar em qualquer uma.
    if (!empresaEraDesconhecida) query = query.eq("empresa_id", empresaAlvo);
    const { data } = await query.limit(1).maybeSingle();
    if (data && data.dados) {
      const empresaReal = data.empresa_id || empresaAlvo;
      data.dados.empresa_id = empresaReal;
      chave = chaveConversa(empresaReal, numero);
      conversas.set(chave, data.dados);
    }
  }

  // Se for um session_id do Webchat (contém letras ou hifens)
  if (numero && numero.match(/[a-zA-Z-]/)) {
    if (supabase) {
      let qVivi = supabase.from("vivi_conversas").select("*").eq("session_id", numero).order("created_at", { ascending: true });
      if (!isSuperAdmin) qVivi = qVivi.eq("empresa_id", req.user.empresa_id);
      const { data } = await qVivi;
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

  const conv = conversas.get(chave);
  if (!conv) return res.json({ mensagens: [], botOn: true });

  // Verifica se a conversa pertence à empresa do usuário
  if (!isSuperAdmin && conv.empresa_id && conv.empresa_id !== req.user.empresa_id) {
    return res.status(403).json({ erro: "Acesso negado" });
  }

  if (conv.unread > 0) {
    conv.unread = 0;
    if (supabase && conv.empresa_id && conv.empresa_id !== "empresa-padrao" && conv.empresa_id !== "vazia") {
      supabase.from("whatsapp_conversas").upsert({ numero, empresa_id: conv.empresa_id, dados: conv }).then(()=>{});
    }
  }
  
  res.json({ ...conv, botOn: !botPausado.has(chave) });
});

router.post("/inbox/enviar", authMiddleware, async (req, res) => {
  const { numero, texto, interna, media } = req.body;
  if (!numero || (!texto && !media)) return res.status(400).json({ erro: "numero e texto/media obrigatórios" });

  // ── Verificação de tenant: impede que um cliente envie pelo canal de outro ──
  const { conv: convInfo } = localizarConversa(numero, req);
  if (convInfo && convInfo.empresa_id && !isAdminSuper(req) && convInfo.empresa_id !== req.user.empresa_id) {
    return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
  }
  const empresaAlvo = convInfo?.empresa_id || req.user.empresa_id;

  try {
    if (interna) {
      const mensagem = { id: Date.now().toString(), tipo: "interna", texto, numero, timestamp: new Date().toISOString() };
      await registrarNaConversa(numero, mensagem, null, null, empresaAlvo);
      return res.json({ ok: true, interna: true });
    }
    const instOverride = convInfo ? convInfo.instanceName : null;
    
    // Se for Webchat (session_id)
    if (numero.match(/[a-zA-Z-]/)) {
      if (supabase) {
        await supabase.from("vivi_conversas").insert([{
          session_id: numero,
          mensagem: texto,
          role: "assistant",
          canal: "site",
          empresa_id: req.user.empresa_id || null,
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
    await registrarNaConversa(numero, mensagem, null, null, empresaAlvo, instOverride);
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

  // ── Verificação de tenant ─────────────────────────────────────────────────
  const { conv: convInfo } = localizarConversa(numero, req);
  if (convInfo && convInfo.empresa_id && !isAdminSuper(req) && convInfo.empresa_id !== req.user.empresa_id) {
    return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
  }
  const empresaAlvo = convInfo?.empresa_id || req.user.empresa_id;

  try {
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
    await registrarNaConversa(numero, mensagem, null, null, empresaAlvo, instOverride);
    res.json({ ok: true });
  } catch (e) {
    console.error("[ENVIAR-MIDIA]", e.response?.data || e.message);
    res.status(500).json({ erro: e.message });
  }
});

// As 4 rotas abaixo não exigiam login antes — qualquer um sabendo um número
// podia pausar o bot, mudar etiqueta/setor de conversas de QUALQUER empresa.
// Agora exigem authMiddleware e resolvem/checam a empresa do usuário.
router.post("/inbox/bot/:numero", authMiddleware, async (req, res) => {
  const { numero } = req.params;
  const { pausar } = req.body;
  const { chave, conv } = localizarConversa(numero, req);
  if (conv && !isAdminSuper(req) && conv.empresa_id !== req.user.empresa_id) {
    return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
  }
  if (pausar) {
    botPausado.set(chave, true);
    console.log(`[BOT] Pausado para ${numero}`);
  } else {
    botPausado.delete(chave);
    console.log(`[BOT] Ativado para ${numero}`);
  }
  if (conv) {
    conv.botOn = !pausar;
    await registrarNaConversa(numero, null, null, null, conv.empresa_id);
  }
  res.json({ ok: true, botOn: !pausar });
});

router.get("/inbox/bot/:numero/status", authMiddleware, (req, res) => {
  const { chave } = localizarConversa(req.params.numero, req);
  res.json({ botOn: !botPausado.has(chave) });
});

router.patch("/inbox/conversas/:numero/etiqueta", authMiddleware, async (req, res) => {
  const { numero } = req.params;
  const { conv } = localizarConversa(numero, req);
  if (conv) {
    if (!isAdminSuper(req) && conv.empresa_id !== req.user.empresa_id) {
      return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
    }
    conv.etiqueta = req.body.etiqueta;
    await registrarNaConversa(numero, null, null, null, conv.empresa_id);
  }
  res.json({ ok: true });
});

router.patch("/inbox/conversas/:numero/setor", authMiddleware, async (req, res) => {
  const { numero } = req.params;
  const { conv } = localizarConversa(numero, req);
  if (conv) {
    if (!isAdminSuper(req) && conv.empresa_id !== req.user.empresa_id) {
      return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
    }
    conv.setor = req.body.setor?.toLowerCase().trim() || null;
    await registrarNaConversa(numero, null, null, null, conv.empresa_id);
  }
  res.json({ ok: true });
});

// ─── ROTAS DE BRIDGE — DESATIVADAS ────────────────────────────────────
// Essas rotas não tinham NENHUMA autenticação nem verificação de empresa —
// qualquer um na internet que descobrisse a URL conseguia ler e escrever
// dados de conversa de qualquer empresa cadastrada. Desativadas para
// eliminar a superfície de risco. Se precisar reativar pra algum uso
// futuro, adicione authMiddleware + checagem de empresa antes de usar.
["", "/v1"].forEach(prefix => {
  router.get(`${prefix}/conversas/:id`, (req, res) => {
    res.status(410).json({ erro: "Rota de bridge desativada." });
  });

  router.patch(`${prefix}/conversas/:id`, (req, res) => {
    res.status(410).json({ erro: "Rota de bridge desativada." });
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
