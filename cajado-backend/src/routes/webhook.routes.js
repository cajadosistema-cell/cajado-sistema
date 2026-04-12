const express = require("express");
const router = express.Router();

const { supabase } = require("../config/database");
const { INSTANCE } = require("../config/env");
const {
  botPausado,
  conversas,
  conversationHistory,
  clientesTransferidos,
  processedMessages,
  MAX_HISTORY,
  canaisMemoria,
  ADMIN_DEFAULT
} = require("../config/memory");

const { registrarNaConversa } = require("../services/conversation.service");
const { enviarWhatsApp } = require("../services/evolution.service");
const { chamarOpenRouter } = require("../services/ai.service");
const { getPrompt, listarTimes, SYSTEM_PROMPT, WAITING_PROMPT } = require("../services/config.service");

// ─── CANAL 1: WHATSAPP OFICIAL (WABA META) ────────────────────────────────
router.get("/oficial", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  
  if (mode === "subscribe" && token) {
    console.log("[WABA] Webhook Oficial verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post("/oficial", async (req, res) => {
  res.sendStatus(200);
  try {
    if (req.body.object === "whatsapp_business_account") {
      for (const entry of req.body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "messages") {
            const messageData = change.value.messages?.[0];
            const contato = change.value.contacts?.[0];
            const metadata = change.value.metadata;
            if (!messageData || messageData.type !== "text") continue;
            
            const number = messageData.from;
            const messageText = messageData.text?.body;
            const nomeCliente = contato?.profile?.name || number;
            
            const messageId = messageData.id;
            if (processedMessages.has(messageId)) return;
            
            const convAtual = conversas.get(number);
            if (convAtual && convAtual.mensagens && convAtual.mensagens.some(m => m.id === messageId)) {
              return;
            }

            processedMessages.add(messageId);
            if (processedMessages.size > 1000) {
              const first = processedMessages.values().next().value;
              processedMessages.delete(first);
            }

            if (!conversationHistory.has(number)) {
              let rebuild = [];
              if (convAtual && convAtual.mensagens) {
                convAtual.mensagens.forEach(m => {
                  if (m.tipo !== "interna" && m.id !== messageId) {
                    let role = (m.tipo === "enviada" || m.tipo === "bot") ? "model" : "user";
                    rebuild.push({ role, parts: [{ text: m.texto }] });
                  }
                });
              }
              conversationHistory.set(number, rebuild.slice(-10));
            }
            const history = conversationHistory.get(number);
            
            const empresaId = canaisMemoria.get(metadata?.phone_number_id) || ADMIN_DEFAULT.empresa_id;
            
            console.log(`[WABA Oficial][${empresaId}][${number}]: ${messageText}`);
            
            const msgRecebida = { id: messageData.id, tipo: "recebida", texto: messageText, numero: number, timestamp: new Date().toISOString() };
            const convRec = await registrarNaConversa(number, msgRecebida, nomeCliente, null, empresaId);
            convRec.unread = (convRec.unread || 0) + 1;
            convRec.canal = "oficial";
            convRec.phone_number_id = metadata?.phone_number_id;
          }
        }
      }
    }
  } catch (error) {
    console.error("[WABA] Erro webhook oficial:", error.message);
  }
});

// ─── CANAL 2: EVOLUTION API (QR CODE PADRÃO) ──────────────────────────────
router.post(["/evolution", "/"], async (req, res) => {
  res.status(200).send("ok");

  const data = req.body;
  if (data?.event?.toLowerCase() !== "messages.upsert") return;
  const messageData = data?.data;
  if (!messageData?.key) return;

  const messageId = messageData.key.id;
  if (processedMessages.has(messageId)) return;
  
  const remoteJid = messageData.key.remoteJid;
  if (!remoteJid) return;
  const number = remoteJid.split("@")[0];

  const messageText = messageData.message?.conversation ||
    messageData.message?.extendedTextMessage?.text ||
    messageData.message?.imageMessage?.caption;

  const convAtual = conversas.get(number);
  if (convAtual && convAtual.mensagens && convAtual.mensagens.some(m => m.id === messageId)) {
    return;
  }

  processedMessages.add(messageId);
  if (processedMessages.size > 1000) {
    const first = processedMessages.values().next().value;
    if (first !== undefined) processedMessages.delete(first);
  }

  const nomeCliente = messageData.pushName || number;
  const instanceName = data.instance || INSTANCE;
  const empresa_id = canaisMemoria.get(instanceName) || ADMIN_DEFAULT.empresa_id;

  if (messageData.key.fromMe) {
    if (!messageText) return;
    if (remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) return;

    const targetConv = conversas.get(number);
    if (targetConv && targetConv.mensagens && targetConv.mensagens.length > 0) {
       const isEcho = targetConv.mensagens.slice(-5).some(m => (m.tipo === "bot" || m.tipo === "enviada") && m.texto === messageText);
       if (isEcho) return;
    }
    
    const msgEnviada = { id: messageData.key.id, tipo: "enviada", texto: messageText, numero: number, timestamp: new Date().toISOString() };
    await registrarNaConversa(number, msgEnviada, nomeCliente, null, empresa_id, instanceName);
    
    botPausado.set(number, true);
    if (conversas.has(number)) {
       const c = conversas.get(number);
       c.botOn = false;
       c.assumido_nome = "Atendente (App WhatsApp)";
       if (supabase && c.empresa_id && c.empresa_id !== "empresa-padrao" && c.empresa_id !== "vazia") {
         supabase.from("whatsapp_conversas").upsert({ numero, empresa_id: c.empresa_id, dados: c }).then(()=>{});
       }
    }
    console.log(`[HUMANO APP] Assumiu pelo celular ${number} e enviou: ${messageText}`);
    return;
  }
  if (messageData.message?.extendedTextMessage?.contextInfo?.participant) return;
  if (!messageText) return;
  if (remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) return;

  console.log(`[Evolution][${empresa_id}][${number}]: ${messageText}`);

  let convRec;
  try {
    const msgRecebida = { id: messageData.key.id, tipo: "recebida", texto: messageText, numero: number, timestamp: new Date().toISOString() };
    convRec = await registrarNaConversa(number, msgRecebida, nomeCliente, null, empresa_id, instanceName);
    convRec.unread = (convRec.unread || 0) + 1;
  } catch(errReg) {
    console.error("[Webhook] Erro ao registrar mensagem recebida:", errReg.message);
    return;
  }

  if (supabase) {
    supabase.from("vivi_leads").select("id").eq("whatsapp", number).eq("empresa_id", empresa_id).then(({ data }) => {
      if (!data || data.length === 0) {
        supabase.from("vivi_leads").insert([{ nome: nomeCliente || number, whatsapp: number, canal: "whatsapp", status: "novo", empresa_id }]).then(()=>{});
      }
    }).catch(()=>{});
  }

  if (!conversationHistory.has(number)) {
    let rebuild = [];
    const convDb = conversas.get(number);
    if (convDb && convDb.mensagens) {
      convDb.mensagens.forEach(m => {
        if (m.tipo !== "interna" && m.id !== messageData.key.id) {
          let role = (m.tipo === "enviada" || m.tipo === "bot") ? "model" : "user";
          rebuild.push({ role, parts: [{ text: m.texto }] });
        }
      });
    }
    conversationHistory.set(number, rebuild.slice(-10));
  }
  const history = conversationHistory.get(number);

  try {
    let envioAoCliente;
    let nomeParaInbox = nomeCliente;
    let setorParaInbox = null;

    // 1. Se o bot está pausado manualmente ou por atendimento humano ativo
    if (botPausado.has(number) || (convRec && convRec.botOn === false)) {
       console.log(`[${number}] Bot pausado — enviando apenas aviso de espera.`);
       const promptEspera = getPrompt(empresa_id, "prompt_espera", WAITING_PROMPT);
       const ctx = `O bot está pausado para este cliente (${nomeParaInbox}) que aguarda atendimento humano. Ele enviou: ${messageText}`;
       envioAoCliente = await chamarOpenRouter([], ctx, promptEspera);
       
       await enviarWhatsApp(number, envioAoCliente, instanceName);
       const msgBotErr = { id: `bot-${Date.now()}`, tipo: "bot", texto: envioAoCliente, numero: number, timestamp: new Date().toISOString() };
       await registrarNaConversa(number, msgBotErr, nomeParaInbox, null, empresa_id, instanceName);
       return;
    }

    // 2. Se o cliente já foi marcado como transferido para um setor
    if (clientesTransferidos.has(number)) {
      const info = clientesTransferidos.get(number);
      nomeParaInbox = info.nome || nomeCliente;
      setorParaInbox = info.setor;

      // Se já era um humano falando e marcou como respondido, aí sim ficamos em silêncio absoluto nessa etapa
      if (info.respondidoPorHumano) return;

      const ctx = `Cliente ${info.nome} transferido para ${info.setor}. Pedido: ${info.pedido}. Mensagem: ${messageText}`;
      const promptEspera = getPrompt(empresa_id, "prompt_espera", WAITING_PROMPT);
      envioAoCliente = await chamarOpenRouter([], ctx, promptEspera);

    } else {
      const timesDb = await listarTimes();
      const timesAtivos = timesDb.filter(t => t.ativo !== false && (t.empresa_id === empresa_id || !t.empresa_id));
      const nomesTimes = timesAtivos.map(t => t.nome).join(" | ");
      const descricaoTimes = timesAtivos.map(t => `- ${t.nome}: ${t.descricao} (relacionado a: ${t.palavras_chave})`).join("\n");
      
      const customSystem = getPrompt(empresa_id, "prompt_sistema", SYSTEM_PROMPT);
      const PROMPT_DINAMICO = customSystem
        .replace("[TIMES_DISPONIVEIS]", descricaoTimes)
        .replace("[NOMES_TIMES]", nomesTimes);

      const resposta = await chamarOpenRouter(history, messageText, PROMPT_DINAMICO);

      if (resposta.includes("#TRANSFERIR")) {
        const resumo = resposta.replace("#TRANSFERIR", "").trim();
        const setor  = resumo.match(/Setor:\s*([^\n]+)/i)?.[1]?.trim() || "geral";
        const nome   = resumo.match(/Nome:\s*([^\n]+)/i)?.[1]?.trim() || nomeCliente;
        const pedido = resumo.match(/Pedido:\s*([^\n]+)/i)?.[1]?.trim() || "";
        nomeParaInbox = nome;
        setorParaInbox = setor;

        clientesTransferidos.set(number, { setor, nome, pedido, timestamp: Date.now(), respondidoPorHumano: false });

        const hour = new Date().getHours();
        const saudacao = hour < 12 ? "bom dia" : hour < 18 ? "boa tarde" : "boa noite";
        const pedidoLimpo = resumo.replace(/Setor:[^\n]+\n?/i, "").replace(/Nome:[^\n]+\n?/i, "").trim();
        envioAoCliente = `Tudo certo, ${nome}. Já anotei essas informações.\n\nResumo: ${pedidoLimpo}\n\nUm especialista do time de ${setor} vai assumir o atendimento por aqui em breve. Tenha um ótimo ${saudacao}.`;

        const timeDetectado = timesAtivos.find(t => t.nome.toLowerCase() === setor.toLowerCase());
        setorParaInbox = timeDetectado ? timeDetectado.nome.toLowerCase() : setor.toLowerCase();

        conversationHistory.set(number, []);

      } else {
        envioAoCliente = resposta;
        history.push({ role: "user", parts: [{ text: messageText }] });
        history.push({ role: "model", parts: [{ text: resposta }] });
        if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
      }
    }

    await enviarWhatsApp(number, envioAoCliente, instanceName);
    console.log(`[Bot → ${number}]: ${envioAoCliente}`);

    const msgBot = { id: `bot-${Date.now()}`, tipo: "bot", texto: envioAoCliente, numero: number, timestamp: new Date().toISOString() };
    await registrarNaConversa(number, msgBot, nomeParaInbox, setorParaInbox, empresa_id, instanceName);

  } catch (error) {
    console.error(`[Bot Erro ${number}]`, error.response?.data || error.message);
  }
});

router.post("/humano-assumiu/:numero", async (req, res) => {
  const { numero } = req.params;
  botPausado.set(numero, true);
  if (conversas.has(numero)) {
    const conv = conversas.get(numero);
    conv.assumido_nome = req.body.nome || "Atendente";
    conv.botOn = false;
    await registrarNaConversa(numero, null, null, null);
  }
  if (clientesTransferidos.has(numero)) {
    clientesTransferidos.get(numero).respondidoPorHumano = true;
  }
  res.json({ ok: true });
});

router.post("/reativar-bot/:numero", async (req, res) => {
  const { numero } = req.params;
  clientesTransferidos.delete(numero);
  conversationHistory.delete(numero);
  botPausado.delete(numero);
  if (conversas.has(numero)) {
    const conv = conversas.get(numero);
    conv.assumido_nome = null;
    conv.botOn = true;
    await registrarNaConversa(numero, null, null, null);
  }
  res.json({ ok: true });
});

router.post("/infinitypay", async (req, res) => {
  try {
    const { order_nsu, paid_amount, capture_method, transaction_nsu, invoice_slug } = req.body;
    console.log(`[WEBHOOK-IP] Pagamento recebido: nsu=${order_nsu} | valor=${paid_amount} | método=${capture_method}`);

    if (!order_nsu) return res.status(400).json({ success: false, message: "order_nsu ausente" });

    const { data: cobranca } = await supabase?.from("vp_cobrancas")
      .select("id, empresa_id, valor")
      .eq("ip_order_nsu", order_nsu)
      .single();

    if (!cobranca) {
      console.warn(`[WEBHOOK-IP] Cobrança não encontrada para nsu: ${order_nsu}`);
      return res.status(400).json({ success: false, message: "Cobrança não encontrada" });
    }

    await supabase.from("vp_cobrancas").update({
      status: "pago",
      ip_transaction: transaction_nsu || invoice_slug,
      data_pagamento: new Date().toISOString()
    }).eq("id", cobranca.id);

    const proximoVenc = new Date();
    proximoVenc.setMonth(proximoVenc.getMonth() + 1);
    await supabase.from("empresas").update({
      status: "ativo",
      proximo_vencimento: proximoVenc.toISOString().split("T")[0],
      link_pagamento: null
    }).eq("id", cobranca.empresa_id);

    console.log(`[WEBHOOK-IP] ✅ Empresa ${cobranca.empresa_id} REATIVADA automaticamente!`);
    res.json({ success: true, message: null });
  } catch (e) {
    console.error("[WEBHOOK-IP] Erro:", e.message);
    res.json({ success: true, message: null });
  }
});

module.exports = router;
