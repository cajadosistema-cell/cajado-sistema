const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { supabase } = require("../config/database");
const { INSTANCE, ADMIN_EMAIL } = require("../config/env");

// ─── HELPER: Salvar agendamento detectado pelo bot ──────────────────────────
/**
 * Extrai e persiste um agendamento quando o bot emite a tag #AGENDAR.
 * @param {string} resposta - Texto completo retornado pela IA
 * @param {string} numero   - WhatsApp do cliente (sem @s.whatsapp.net)
 * @param {string} empresa_id
 * @returns {{ envio: string, agendou: boolean }}
 *   envio  = mensagem de confirmação a enviar ao cliente
 *   agendou = true se salvou com sucesso
 */
async function processarAgendamento(resposta, numero, empresa_id) {
  const bloco = resposta.split("#AGENDAR")[1]?.trim() || "";

  const nome    = bloco.match(/Nome:\s*([^\n]+)/i)?.[1]?.trim() || numero;
  const data    = bloco.match(/Data:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const hora    = bloco.match(/Hora:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const assunto = bloco.match(/Assunto:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const setor   = bloco.match(/Setor:\s*([^\n]+)/i)?.[1]?.trim() || "vendas";

  // Extrai a mensagem de confirmação (tudo antes do #AGENDAR)
  const envio = resposta.split("#AGENDAR")[0].trim();

  if (supabase && data) {
    try {
      await supabase.from("vivi_agendamentos").insert([{
        nome,
        whatsapp: numero,
        data_agendamento: data,
        hora_agendamento: hora,
        observacao: assunto || setor,
        status: "pendente",
        canal: "whatsapp",
        empresa_id: empresa_id || null
      }]);

      // Garante o lead
      await supabase.from("vivi_leads").upsert([{
        nome, whatsapp: numero,
        canal: "whatsapp", status: "agendado", empresa_id: empresa_id || null
      }], { onConflict: "whatsapp,empresa_id" });

      console.log(`[Bot] 📅 Agendamento salvo: ${nome} | ${data} ${hora} | ${assunto}`);
      return { envio, agendou: true };
    } catch (e) {
      console.error("[Bot] Erro ao salvar agendamento:", e.message);
    }
  }

  return { envio, agendou: false };
}
const {
  botPausado,
  conversas,
  conversationHistory,
  clientesTransferidos,
  processedMessages,
  MAX_HISTORY,
  canaisMemoria,
  ADMIN_DEFAULT,
  chaveConversa
} = require("../config/memory");

const { registrarNaConversa } = require("../services/conversation.service");
const { enviarWhatsApp, buscarFotoPerfil, baixarMidiaBase64, baixarMidiaMeta } = require("../services/evolution.service");
const { chamarOpenRouter } = require("../services/ai.service");
const { getPrompt, listarTimes, SYSTEM_PROMPT, WAITING_PROMPT } = require("../services/config.service");
const { authMiddleware } = require("../middlewares/auth");

// ─── HELPER: Validação HMAC SHA-256 do Webhook Meta (WABA) ─────────────────────
// A Meta assina o payload com HMAC-SHA256 usando o App Secret.
// Sem essa verificação, qualquer um pode forjar POSTs para o webhook.
function verificarAssinaturaWABA(req, res, next) {
  const APP_SECRET = process.env.WABA_APP_SECRET;

  if (!APP_SECRET) {
    // Sem segredo configurado: avisa nos logs mas não bloqueia (modo setup)
    if (!process.env._WABA_SECRET_WARN_SENT) {
      console.warn("[WABA-SEC] ⚠️  WABA_APP_SECRET não configurado — validação HMAC desativada.");
      console.warn("[WABA-SEC]    Configure no Railway: WABA_APP_SECRET = <App Secret do Meta for Developers>");
      process.env._WABA_SECRET_WARN_SENT = "1";
    }
    return next();
  }

  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    console.warn("[WABA-SEC] ❌ Requisição sem x-hub-signature-256 — rejeitada.");
    return res.sendStatus(403);
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expected = "sha256=" + crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("hex");

  if (signature !== expected) {
    console.warn(`[WABA-SEC] ❌ Assinatura inválida. Recebida: ${signature.slice(0, 20)}... Esperada: ${expected.slice(0, 20)}...`);
    return res.sendStatus(403);
  }

  next();
}

// ─── CANAL 1: WHATSAPP OFICIAL (WABA META) ────────────────────────────────
router.get("/oficial", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const VERIFY_TOKEN = process.env.WABA_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "visiopro2025";

  console.log(`[WABA] Verificação webhook: mode=${mode} | recebido="${token}" | esperado="${VERIFY_TOKEN}"`);

  const tokensValidos = new Set([VERIFY_TOKEN, "visiopro2024", "visiopro2025"]);

  if (mode === "subscribe" && tokensValidos.has(token)) {
    console.log("[WABA] ✅ Webhook verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    console.log(`[WABA] ❌ Falha: token="${token}" não está em [${[...tokensValidos].join(", ")}]`);
    res.sendStatus(403);
  }
});

router.post("/oficial", verificarAssinaturaWABA, async (req, res) => {
  res.sendStatus(200); // responde imediatamente à Meta (obrigatório)

  console.log("[WABA-RAW] POST /webhook/oficial recebido");
  console.log("[WABA-RAW] Body:", JSON.stringify(req.body).slice(0, 800));

  try {
    if (req.body.object !== "whatsapp_business_account") {
      console.log("[WABA-RAW] ⚠️ object ignorado:", req.body.object);
      return;
    }

    for (const entry of req.body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== "messages" && change.field !== "smb_message_echoes") continue;

          const isEcho = change.field === "smb_message_echoes";
          const messageList = isEcho ? change.value.message_echoes : change.value.messages;
          const messageData = messageList?.[0];
          const contato    = change.value.contacts?.[0];
          const metadata   = change.value.metadata;

          if (!messageData) continue;
          const TIPOS_MIDIA_SUPORTADOS = ["image", "video", "audio", "document"];
          const isMidiaWaba = TIPOS_MIDIA_SUPORTADOS.includes(messageData.type);
          if (messageData.type !== "text" && !isMidiaWaba) continue;
          if (isEcho && isMidiaWaba) { console.log(`[WABA] ⚠️ Mídia via echo (app do celular) ainda não suportada: ${messageData.type}`); continue; }

          const messageId  = messageData.id;
          const number     = isEcho ? messageData.to : messageData.from;
          const messageText = messageData.text?.body || messageData[messageData.type]?.caption || null;
          const nomeCliente = isEcho ? number : (contato?.profile?.name || number);
          const instanceName = metadata?.phone_number_id || "oficial";
          
          let empresaId = ADMIN_DEFAULT.empresa_id;
          const canalData  = canaisMemoria.get(instanceName);
          if (canalData) {
            empresaId = canalData.empresa_id || canalData;
          } else if (supabase) {
            const { data } = await supabase.from("waba_connections")
              .select("empresa_id").eq("phone_number_id", instanceName).limit(1).single();
            if (data) empresaId = data.empresa_id;
          }

        // Deduplicação — usa continue, não return
        if (processedMessages.has(messageId)) continue;
        const chaveWaba = chaveConversa(empresaId, number);
        const convAtual = conversas.get(chaveWaba);
        if (convAtual?.mensagens?.some(m => m.id === messageId)) continue;

        processedMessages.add(messageId);
        if (processedMessages.size > 1000) {
          processedMessages.delete(processedMessages.values().next().value);
        }

        console.log(`[WABA Oficial][${empresaId}][${number}] ${isEcho ? '(ECHO)' : ''}: ${messageText}`);

        if (isEcho) {
          // O atendente respondeu pelo celular (App WhatsApp Business - CoEx)
          const msgEnviada = { id: messageId, tipo: "enviada", texto: messageText, numero: number, timestamp: new Date().toISOString() };
          await registrarNaConversa(number, msgEnviada, nomeCliente, null, empresaId, instanceName);
          
          botPausado.set(chaveWaba, true);
          if (conversas.has(chaveWaba)) {
             const c = conversas.get(chaveWaba);
             c.botOn = false;
             c.assumido_nome = "Atendente (App WhatsApp)";
             if (supabase && c.empresa_id && c.empresa_id !== "empresa-padrao" && c.empresa_id !== "vazia") {
               supabase.from("whatsapp_conversas").upsert({ numero: number, empresa_id: c.empresa_id, dados: c }).then(()=>{});
             }
          }
          console.log(`[WABA HUMANO APP] Assumiu pelo celular ${number} e enviou: ${messageText}`);
          continue;
        }

        // Registra mensagem recebida
        let midiaTipoWaba = null, midiaBase64Waba = null, midiaMimetypeWaba = null, midiaFilenameWaba = null;
        if (isMidiaWaba) {
          const dadosMidia = messageData[messageData.type] || {};
          midiaTipoWaba = messageData.type === "audio" ? (dadosMidia.voice ? "ptt" : "audio") : messageData.type;
          midiaFilenameWaba = dadosMidia.filename || null;
          const accessTokenWaba = canalData?.access_token;
          if (dadosMidia.id && accessTokenWaba) {
            const resultado = await baixarMidiaMeta(dadosMidia.id, accessTokenWaba);
            midiaBase64Waba = resultado.base64;
            midiaMimetypeWaba = resultado.mimetype || dadosMidia.mime_type || null;
            if (midiaBase64Waba && midiaBase64Waba.length > 4_000_000) {
              console.log(`[Mídia-Meta] Arquivo grande demais (${Math.round(midiaBase64Waba.length / 1024)}KB) — mantendo só a legenda`);
              midiaBase64Waba = null;
            }
          } else {
            console.log(`[Mídia-Meta] Sem mediaId ou access_token pra baixar (canal=${instanceName})`);
          }
        }
        const legendaMidiaWaba = {
          image: "📷 Imagem", video: "🎥 Vídeo", audio: "🎤 Áudio", ptt: "🎤 Áudio",
          document: midiaFilenameWaba ? `📄 ${midiaFilenameWaba}` : "📄 Documento",
        }[midiaTipoWaba] || null;

        const msgRecebida = {
          id: messageId, tipo: "recebida",
          texto: messageText || legendaMidiaWaba || "", numero: number,
          timestamp: new Date().toISOString(),
          ...(midiaTipoWaba ? {
            midia_tipo: midiaTipoWaba,
            midia_base64: midiaBase64Waba,
            midia_mimetype: midiaMimetypeWaba,
            midia_filename: midiaFilenameWaba,
          } : {}),
        };
        let convRec;
        try {
          convRec = await registrarNaConversa(number, msgRecebida, nomeCliente, null, empresaId, instanceName);
          convRec.unread = (convRec.unread || 0) + 1;
          convRec.canal = "oficial";
          convRec.phone_number_id = instanceName;
        } catch (e) {
          console.error("[WABA] Erro ao registrar mensagem:", e.message);
          continue;
        }

        // Busca foto de perfil via instância Evolution como proxy (WABA não fornece foto)
        if (!convRec.avatarUrl) {
          const instanciaProxy = (() => {
            for (const [key, val] of canaisMemoria.entries()) {
              if (val.tipo === "evolution" && val.instance_name) return val.instance_name;
              if (val.tipo === "evolution" && key && !(/^\d{10,}$/.test(key))) return key;
            }
            return process.env.INSTANCE || null;
          })();
          if (instanciaProxy) {
            buscarFotoPerfil(number, "oficial", instanciaProxy).then(url => {
              if (url && conversas.has(chaveWaba)) {
                const c = conversas.get(chaveWaba);
                c.avatarUrl = url;
                console.log(`[Avatar] 🖼️ Foto WABA salva para ${nomeCliente} via proxy Evolution`);
                if (supabase && c.empresa_id && c.empresa_id !== "empresa-padrao") {
                  supabase.from("whatsapp_conversas")
                    .upsert({ numero: number, empresa_id: c.empresa_id, dados: c })
                    .then(() => {}).catch(() => {});
                }
              }
            }).catch(() => {});
          }
        }

        // Reconstrói histórico se ainda não existe
        if (!conversationHistory.has(chaveWaba)) {
          const rebuild = [];
          convAtual?.mensagens?.forEach(m => {
            if (m.tipo !== "interna" && m.id !== messageId) {
              const role = (m.tipo === "enviada" || m.tipo === "bot") ? "model" : "user";
              rebuild.push({ role, parts: [{ text: m.texto }] });
            }
          });
          conversationHistory.set(chaveWaba, rebuild.slice(-10));
        }
        const history = conversationHistory.get(chaveWaba);

        // ── Bot pausado: aviso de espera ──────────────────────────
        if (botPausado.has(chaveWaba) || convRec?.botOn === false) {
          console.log(`[WABA][${number}] Bot pausado – enviando aviso de espera.`);
          const promptEspera = getPrompt(empresaId, "prompt_espera", WAITING_PROMPT);
          const ctx = `O bot está pausado para este cliente (${nomeCliente}) que aguarda atendimento humano. Ele enviou: ${messageText || (isMidiaWaba ? `[mídia: ${messageData.type}]` : "")}`;
          const aviso = await chamarOpenRouter([], ctx, promptEspera);
          await enviarWhatsApp(number, aviso, instanceName);
          const msgAviso = { id: `bot-${Date.now()}`, tipo: "bot", texto: aviso, numero: number, timestamp: new Date().toISOString() };
          await registrarNaConversa(number, msgAviso, nomeCliente, null, empresaId, instanceName);
          continue;
        }

        // ── Já transferido: aviso de espera ──────────────────────────
        let envioAoCliente;
        let nomeParaInbox = nomeCliente;
        let setorParaInbox = null;

        if (clientesTransferidos.has(chaveWaba)) {
          const info = clientesTransferidos.get(chaveWaba);
          nomeParaInbox = info.nome || nomeCliente;
          setorParaInbox = info.setor;
          if (info.respondidoPorHumano) continue;

          const ctx = `Cliente ${info.nome} transferido para ${info.setor}. Pedido: ${info.pedido}. Mensagem: ${messageText || (isMidiaWaba ? `[mídia: ${messageData.type}]` : "")}`;
          const promptEspera = getPrompt(empresaId, "prompt_espera", WAITING_PROMPT);
          envioAoCliente = await chamarOpenRouter([], ctx, promptEspera);

        } else {
          // ── Resposta normal do bot com IA ─────────────────────────
          const timesDb = await listarTimes();
          const timesAtivos = timesDb.filter(t => t.ativo !== false && (t.empresa_id === empresaId || !t.empresa_id));
          const nomesTimes = timesAtivos.map(t => t.nome).join(" | ");
          const descricaoTimes = timesAtivos.map(t => `- ${t.nome}: ${t.descricao} (relacionado a: ${t.palavras_chave})`).join("\n");

          const customSystem = getPrompt(empresaId, "prompt_sistema", SYSTEM_PROMPT);
          const PROMPT_DINAMICO = customSystem
            .replace("[TIMES_DISPONIVEIS]", descricaoTimes)
            .replace("[NOMES_TIMES]", nomesTimes);

          const contextoMidiaWaba = {
            image: "[Cliente enviou uma imagem sem legenda]",
            video: "[Cliente enviou um vídeo sem legenda]",
            audio: "[Cliente enviou um áudio]",
            ptt: "[Cliente enviou um áudio]",
            document: `[Cliente enviou um documento${midiaFilenameWaba ? ": " + midiaFilenameWaba : ""}]`,
          }[midiaTipoWaba] || "";

          const resposta = await chamarOpenRouter(history, messageText || contextoMidiaWaba, PROMPT_DINAMICO);

          if (resposta.includes("#AGENDAR")) {
            const { envio, agendou } = await processarAgendamento(resposta, number, empresaId);
            envioAoCliente = envio || `Perfeito! Agendei sua conversa com nosso especialista. A gente entra em contato no horário combinado 😊`;
            conversationHistory.set(chaveWaba, []);
            console.log(`[WABA] 📅 Agendamento ${agendou ? "salvo" : "falhou"} para ${number}`);

          } else if (resposta.includes("#TRANSFERIR")) {
            const resumo   = resposta.replace("#TRANSFERIR", "").trim();
            const setor    = resumo.match(/Setor:\s*([^\n]+)/i)?.[1]?.trim() || "geral";
            const nome     = resumo.match(/Nome:\s*([^\n]+)/i)?.[1]?.trim() || nomeCliente;
            const pedido   = resumo.match(/Pedido:\s*([^\n]+)/i)?.[1]?.trim() || "";
            nomeParaInbox  = nome;

            clientesTransferidos.set(chaveWaba, { setor, nome, pedido, timestamp: Date.now(), respondidoPorHumano: false });

            const hour     = new Date().getHours();
            const saudacao = hour < 12 ? "bom dia" : hour < 18 ? "boa tarde" : "boa noite";
            const pedidoLimpo = resumo.replace(/Setor:[^\n]+\n?/i, "").replace(/Nome:[^\n]+\n?/i, "").trim();
            envioAoCliente = `Tudo certo, ${nome}. Já anotei essas informações.\n\nResumo: ${pedidoLimpo}\n\nUm especialista do time de ${setor} vai assumir o atendimento em breve. Tenha um ótimo ${saudacao}.`;

            const timeDetectado = timesAtivos.find(t => t.nome.toLowerCase() === setor.toLowerCase());
            setorParaInbox = timeDetectado ? timeDetectado.nome.toLowerCase() : setor.toLowerCase();
            conversationHistory.set(chaveWaba, []);

          } else {
            envioAoCliente = resposta;
            history.push({ role: "user",  parts: [{ text: messageText }] });
            history.push({ role: "model", parts: [{ text: resposta    }] });
            if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
          }
        }

        await enviarWhatsApp(number, envioAoCliente, instanceName);
        console.log(`[Bot WABA → ${number}]: ${envioAoCliente}`);

        const msgBot = { id: `bot-${Date.now()}`, tipo: "bot", texto: envioAoCliente, numero: number, timestamp: new Date().toISOString() };
        await registrarNaConversa(number, msgBot, nomeParaInbox, setorParaInbox, empresaId, instanceName);
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
  console.log("[DEBUG-EVO] Recebido webhook:", JSON.stringify(data).slice(0, 500));
  
  if (data?.event?.toLowerCase() !== "messages.upsert") {
    console.log("[DEBUG-EVO] Ignorado (não é messages.upsert)");
    return;
  }
  const messageData = Array.isArray(data?.data) ? data.data[0] : data?.data;
  if (!messageData?.key) {
    console.log("[DEBUG-EVO] Ignorado (sem key)");
    return;
  }

  const messageId = messageData.key.id;
  if (processedMessages.has(messageId)) {
    console.log("[DEBUG-EVO] Ignorado (mensagem duplicada):", messageId);
    return;
  }
  
  const remoteJid = messageData.key.remoteJid;
  if (!remoteJid) return;

  const number = remoteJid.split("@")[0];

  const messageText = messageData.message?.conversation ||
    messageData.message?.extendedTextMessage?.text ||
    messageData.message?.imageMessage?.caption ||
    messageData.message?.videoMessage?.caption;

  // ── Detecção de mídia (imagem/áudio/vídeo/documento) ────────────────────
  let midiaTipo = null;
  if (messageData.message?.imageMessage) midiaTipo = "image";
  else if (messageData.message?.videoMessage) midiaTipo = "video";
  else if (messageData.message?.audioMessage) midiaTipo = messageData.message.audioMessage.ptt ? "ptt" : "audio";
  else if (messageData.message?.documentMessage || messageData.message?.documentWithCaptionMessage) midiaTipo = "document";

  const nomeArquivo = messageData.message?.documentMessage?.fileName ||
    messageData.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName || null;

  const legendaMidia = {
    image: "📷 Imagem", video: "🎥 Vídeo", audio: "🎤 Áudio", ptt: "🎤 Áudio",
    document: nomeArquivo ? `📄 ${nomeArquivo}` : "📄 Documento",
  }[midiaTipo] || null;

  const nomeCliente = messageData.pushName || number;
  const instanceName = data.instance || INSTANCE;
  const canalData = canaisMemoria.get(instanceName);
  let empresa_id = (canalData?.empresa_id || canalData) || null;
  let instCreds = (canalData && typeof canalData === "object") ? { api_key: canalData.api_key, evolution_url: canalData.evolution_url } : {};

  // ⚠️ SEGURANÇA MULTI-TENANT: Se a instância não está na memória, busca no banco
  if (!empresa_id && supabase) {
    try {
      const { data: canalDb } = await supabase
        .from("canais")
        .select("empresa_id, dados_conexao")
        .eq("dados_conexao->>instance_name", instanceName)
        .single();
      if (canalDb) {
        empresa_id = canalDb.empresa_id;
        instCreds = {
          api_key:       canalDb.dados_conexao?.api_key       || null,
          evolution_url: canalDb.dados_conexao?.evolution_url || null,
        };
        canaisMemoria.set(instanceName, { empresa_id, ...instCreds });
        console.log(`[Webhook] ✅ Instância ${instanceName} recuperada do banco → empresa ${empresa_id}`);
      } else {
        console.warn(`[Webhook] ⚠️ Instância "${instanceName}" não encontrada em nenhuma empresa. Mensagem descartada.`);
        return;
      }
    } catch (dbErr) {
      console.error(`[Webhook] Erro ao buscar instância ${instanceName} no banco:`, dbErr.message);
      return;
    }
  } else if (!empresa_id) {
    console.warn(`[Webhook] ⚠️ Supabase indisponível e instância "${instanceName}" não está em memória. Descartado.`);
    return;
  }

  const chaveEvo = chaveConversa(empresa_id, number);

  const convAtual = conversas.get(chaveEvo);
  if (convAtual && convAtual.mensagens && convAtual.mensagens.some(m => m.id === messageId)) {
    return;
  }

  processedMessages.add(messageId);
  if (processedMessages.size > 1000) {
    const first = processedMessages.values().next().value;
    if (first !== undefined) processedMessages.delete(first);
  }

  if (messageData.key.fromMe) {
    if (!messageText) return;
    if (remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) return;

    const targetConv = conversas.get(chaveEvo);
    if (targetConv && targetConv.mensagens && targetConv.mensagens.length > 0) {
       const isEcho = targetConv.mensagens.slice(-5).some(m => (m.tipo === "bot" || m.tipo === "enviada") && m.texto === messageText);
       if (isEcho) return;
    }
    
    const msgEnviada = { id: messageData.key.id, tipo: "enviada", texto: messageText, numero: number, timestamp: new Date().toISOString() };
    await registrarNaConversa(number, msgEnviada, nomeCliente, null, empresa_id, instanceName);
    
    botPausado.set(chaveEvo, true);
    if (conversas.has(chaveEvo)) {
       const c = conversas.get(chaveEvo);
       c.botOn = false;
       c.assumido_nome = "Atendente (App WhatsApp)";
       if (supabase && c.empresa_id && c.empresa_id !== "empresa-padrao" && c.empresa_id !== "vazia") {
         supabase.from("whatsapp_conversas").upsert({ numero: number, empresa_id: c.empresa_id, dados: c }).then(()=>{});
       }
    }
    console.log(`[HUMANO APP] Assumiu pelo celular ${number} e enviou: ${messageText}`);
    return;
  }
  if (!messageText && !midiaTipo) return;
  if (remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) return;

  console.log(`[Evolution][${empresa_id}][${number}]: ${messageText || legendaMidia}`);

  // Baixa a mídia (se houver) ANTES de registrar, pra já salvar completo de uma vez.
  let midiaBase64 = null, midiaMimetype = null;
  if (midiaTipo) {
    const resultado = await baixarMidiaBase64(instanceName, messageData);
    midiaBase64 = resultado.base64;
    midiaMimetype = resultado.mimetype;
    if (midiaBase64 && midiaBase64.length > 4_000_000) {
      console.log(`[Mídia] Arquivo grande demais pra salvar inline (${Math.round(midiaBase64.length / 1024)}KB) — mantendo só a legenda`);
      midiaBase64 = null;
    }
  }

  let convRec;
  try {
    const msgRecebida = {
      id: messageData.key.id,
      tipo: "recebida",
      texto: messageText || legendaMidia || "",
      numero: number,
      timestamp: new Date().toISOString(),
      ...(midiaTipo ? {
        midia_tipo: midiaTipo,
        midia_base64: midiaBase64,
        midia_mimetype: midiaMimetype,
        midia_filename: nomeArquivo,
      } : {}),
    };
    convRec = await registrarNaConversa(number, msgRecebida, nomeCliente, null, empresa_id, instanceName);
    convRec.unread = (convRec.unread || 0) + 1;
  } catch(errReg) {
    console.error("[Webhook] Erro ao registrar mensagem recebida:", errReg.message);
    return;
  }

  // ── Busca foto de perfil em background (apenas na 1ª msg ou se não tiver foto) ──
  if (!convRec.avatarUrl) {
    buscarFotoPerfil(number, instanceName).then(url => {
      if (url && conversas.has(chaveEvo)) {
        const c = conversas.get(chaveEvo);
        c.avatarUrl = url;
        console.log(`[Avatar] 🖼️ Foto salva para ${nomeCliente} (${number})`);
        if (supabase && c.empresa_id && c.empresa_id !== "empresa-padrao") {
          supabase.from("whatsapp_conversas")
            .upsert({ numero: number, empresa_id: c.empresa_id, dados: c })
            .then(() => {}).catch(() => {});
        }
      }
    }).catch(() => {});
  }

  if (supabase) {
    supabase.from("vivi_leads").select("id").eq("whatsapp", number).eq("empresa_id", empresa_id).then(({ data }) => {
      if (!data || data.length === 0) {
        supabase.from("vivi_leads").insert([{ nome: nomeCliente || number, whatsapp: number, canal: "whatsapp", status: "novo", empresa_id }]).then(()=>{});
      }
    }).catch(()=>{});
  }

  if (!conversationHistory.has(chaveEvo)) {
    let rebuild = [];
    const convDb = conversas.get(chaveEvo);
    if (convDb && convDb.mensagens) {
      convDb.mensagens.forEach(m => {
        if (m.tipo !== "interna" && m.id !== messageData.key.id) {
          let role = (m.tipo === "enviada" || m.tipo === "bot") ? "model" : "user";
          rebuild.push({ role, parts: [{ text: m.texto }] });
        }
      });
    }
    conversationHistory.set(chaveEvo, rebuild.slice(-10));
  }
  const history = conversationHistory.get(chaveEvo);

  try {
    let envioAoCliente;
    let nomeParaInbox = nomeCliente;
    let setorParaInbox = null;

    // 1. Se o bot está pausado manualmente ou por atendimento humano ativo
    if (botPausado.has(chaveEvo) || (convRec && convRec.botOn === false)) {
       console.log(`[${number}] Bot pausado — enviando apenas aviso de espera.`);
       const promptEspera = getPrompt(empresa_id, "prompt_espera", WAITING_PROMPT);
       const ctx = `O bot está pausado para este cliente (${nomeParaInbox}) que aguarda atendimento humano. Ele enviou: ${messageText || (midiaTipo ? `[mídia: ${midiaTipo}]` : "")}`;
       envioAoCliente = await chamarOpenRouter([], ctx, promptEspera);
       
       await enviarWhatsApp(number, envioAoCliente, instanceName, null, instCreds);
       const msgBotErr = { id: `bot-${Date.now()}`, tipo: "bot", texto: envioAoCliente, numero: number, timestamp: new Date().toISOString() };
       await registrarNaConversa(number, msgBotErr, nomeParaInbox, null, empresa_id, instanceName);
       return;
    }

    // 2. Se o cliente já foi marcado como transferido para um setor
    if (clientesTransferidos.has(chaveEvo)) {
      const info = clientesTransferidos.get(chaveEvo);
      nomeParaInbox = info.nome || nomeCliente;
      setorParaInbox = info.setor;

      if (info.respondidoPorHumano) return;

      const ctx = `Cliente ${info.nome} transferido para ${info.setor}. Pedido: ${info.pedido}. Mensagem: ${messageText || (midiaTipo ? `[mídia: ${midiaTipo}]` : "")}`;
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

      const contextoMidiaEvo = {
        image: "[Cliente enviou uma imagem sem legenda]",
        video: "[Cliente enviou um vídeo sem legenda]",
        audio: "[Cliente enviou um áudio]",
        ptt: "[Cliente enviou um áudio]",
        document: `[Cliente enviou um documento${nomeArquivo ? ": " + nomeArquivo : ""}]`,
      }[midiaTipo] || "";

      const resposta = await chamarOpenRouter(history, messageText || contextoMidiaEvo, PROMPT_DINAMICO);

      if (resposta.includes("#AGENDAR")) {
        const { envio, agendou } = await processarAgendamento(resposta, number, empresa_id);
        envioAoCliente = envio || `Perfeito! Agendei sua conversa com nosso especialista. A gente entra em contato no horário combinado 😊`;
        conversationHistory.set(chaveEvo, []);
        console.log(`[Evolution] 📅 Agendamento ${agendou ? "salvo" : "falhou"} para ${number}`);

      } else if (resposta.includes("#TRANSFERIR")) {
        const resumo = resposta.replace("#TRANSFERIR", "").trim();
        const setor  = resumo.match(/Setor:\s*([^\n]+)/i)?.[1]?.trim() || "geral";
        const nome   = resumo.match(/Nome:\s*([^\n]+)/i)?.[1]?.trim() || nomeCliente;
        const pedido = resumo.match(/Pedido:\s*([^\n]+)/i)?.[1]?.trim() || "";
        nomeParaInbox = nome;
        setorParaInbox = setor;

        clientesTransferidos.set(chaveEvo, { setor, nome, pedido, timestamp: Date.now(), respondidoPorHumano: false });

        const hour = new Date().getHours();
        const saudacao = hour < 12 ? "bom dia" : hour < 18 ? "boa tarde" : "boa noite";
        const pedidoLimpo = resumo.replace(/Setor:[^\n]+\n?/i, "").replace(/Nome:[^\n]+\n?/i, "").trim();
        envioAoCliente = `Tudo certo, ${nome}. Já anotei essas informações.\n\nResumo: ${pedidoLimpo}\n\nUm especialista do time de ${setor} vai assumir o atendimento por aqui em breve. Tenha um ótimo ${saudacao}.`;

        const timeDetectado = timesAtivos.find(t => t.nome.toLowerCase() === setor.toLowerCase());
        setorParaInbox = timeDetectado ? timeDetectado.nome.toLowerCase() : setor.toLowerCase();

        conversationHistory.set(chaveEvo, []);

      } else {
        envioAoCliente = resposta;
        history.push({ role: "user", parts: [{ text: messageText }] });
        history.push({ role: "model", parts: [{ text: resposta }] });
        if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
      }
    }

    await enviarWhatsApp(number, envioAoCliente, instanceName, null, instCreds);
    console.log(`[Bot → ${number}]: ${envioAoCliente}`);

    const msgBot = { id: `bot-${Date.now()}`, tipo: "bot", texto: envioAoCliente, numero: number, timestamp: new Date().toISOString() };
    await registrarNaConversa(number, msgBot, nomeParaInbox, setorParaInbox, empresa_id, instanceName);

  } catch (error) {
    console.error(`[Bot Erro ${number}]`, error.response?.data || error.message);
  }
});

// NOTA (isolamento multi-tenant): estas duas rotas antes não exigiam login
// e mexiam nos Maps globais só pelo número — qualquer pessoa que soubesse
// um número de telefone podia pausar/reativar o bot de qualquer empresa.
// Agora exigem authMiddleware e resolvem a chave a partir da empresa do
// usuário autenticado (ou de ?empresa_id= para o super admin).
router.post("/humano-assumiu/:numero", authMiddleware, async (req, res) => {
  const { numero } = req.params;
  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail || req.user.empresa_id === ADMIN_DEFAULT.empresa_id;
  const empresaAlvo = isSuperAdmin ? (req.query.empresa_id || req.user.empresa_id) : req.user.empresa_id;
  const chave = chaveConversa(empresaAlvo, numero);

  if (conversas.has(chave)) {
    const conv = conversas.get(chave);
    if (!isSuperAdmin && conv.empresa_id && conv.empresa_id !== req.user.empresa_id) {
      return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
    }
    conv.assumido_nome = req.body.nome || "Atendente";
    conv.botOn = false;
    await registrarNaConversa(numero, null, null, null, conv.empresa_id);
  }
  botPausado.set(chave, true);
  if (clientesTransferidos.has(chave)) {
    clientesTransferidos.get(chave).respondidoPorHumano = true;
  }
  res.json({ ok: true });
});

router.post("/reativar-bot/:numero", authMiddleware, async (req, res) => {
  const { numero } = req.params;
  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail || req.user.empresa_id === ADMIN_DEFAULT.empresa_id;
  const empresaAlvo = isSuperAdmin ? (req.query.empresa_id || req.user.empresa_id) : req.user.empresa_id;
  const chave = chaveConversa(empresaAlvo, numero);

  if (conversas.has(chave)) {
    const conv = conversas.get(chave);
    if (!isSuperAdmin && conv.empresa_id && conv.empresa_id !== req.user.empresa_id) {
      return res.status(403).json({ erro: "Acesso negado: conversa pertence a outra empresa" });
    }
  }

  clientesTransferidos.delete(chave);
  conversationHistory.delete(chave);
  botPausado.delete(chave);
  if (conversas.has(chave)) {
    const conv = conversas.get(chave);
    conv.assumido_nome = null;
    conv.botOn = true;
    await registrarNaConversa(numero, null, null, null, conv.empresa_id);
  }
  res.json({ ok: true });
});

// ─── CANAL BILLING: INFINITY PAY WEBHOOK ─────────────────────────────────────
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
