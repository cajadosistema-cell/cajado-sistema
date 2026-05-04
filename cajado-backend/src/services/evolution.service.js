const axios = require("axios");
const { EVOLUTION_URL, EVOLUTION_KEY } = require("../config/env");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Delay humanizado: variação aleatória ±30% ao redor do valor base (ms) */
const sleep = (ms) => new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * ms * 0.3)));

/** Helper base para chamar a Evolution API com timeout */
const evoCall = (method, path, data = null, timeoutMs = 12000) => {
  const config = {
    method,
    url: `${EVOLUTION_URL}${path}`,
    headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" },
    timeout: timeoutMs,
  };
  if (data) config.data = data;
  return axios(config);
};

/**
 * Fragmenta mensagem longa em blocos menores para parecer mais humano.
 * Máximo 280 chars por bloco, quebra em pontuação natural.
 */
function fragmentarMensagem(texto, maxLen = 280) {
  if (texto.length <= maxLen) return [texto];

  const blocos = [];
  const paragrafos = texto.split(/\n\n+/);
  let acumulado = "";

  for (const par of paragrafos) {
    if ((acumulado + "\n\n" + par).length <= maxLen) {
      acumulado = acumulado ? acumulado + "\n\n" + par : par;
    } else {
      if (acumulado) blocos.push(acumulado.trim());
      if (par.length > maxLen) {
        const frases = par.match(/[^.!?]+[.!?]+\s*/g) || [par];
        let bloco = "";
        for (const frase of frases) {
          if ((bloco + frase).length <= maxLen) {
            bloco += frase;
          } else {
            if (bloco) blocos.push(bloco.trim());
            bloco = frase;
          }
        }
        acumulado = bloco;
      } else {
        acumulado = par;
      }
    }
  }
  if (acumulado.trim()) blocos.push(acumulado.trim());
  return blocos.filter(b => b.length > 0);
}

/**
 * Simula digitação antes de enviar (anti-ban: comportamento humano).
 * Calcula o tempo de "typing" baseado no tamanho do texto (~25ms/char).
 */
async function simularDigitacao(instance, number, textoTamanho) {
  try {
    const delayMs = Math.min(Math.max(textoTamanho * 25, 1000), 5000); // entre 1s e 5s
    await evoCall("POST", `/chat/sendPresence/${instance}`, {
      number: `${number}@s.whatsapp.net`,
      presence: "composing",
      delay: delayMs,
    });
    await sleep(delayMs);
  } catch {
    // Falha silenciosa — o typing indicator não é crítico
    await sleep(1500);
  }
}

// ─── CONFIGURAÇÕES ANTI-BAN DA INSTÂNCIA ─────────────────────────────────────

/**
 * Aplica configurações anti-ban em uma instância Evolution.
 * Chame após criar a instância e após reconectar.
 */
async function configurarAntiBan(instanceName) {
  try {
    await evoCall("POST", `/settings/set/${instanceName}`, {
      rejectCall: true,           // Rejeita chamadas de voz (bot não atende)
      msgCall: "Não realizamos atendimentos por chamada. Envie uma mensagem! 😊",
      groupsIgnore: true,         // Ignora grupos (reduz detecção)
      alwaysOnline: false,        // NÃO fique online 24h (comportamento suspeito)
      readMessages: false,        // NÃO marque como lido automaticamente
      readStatus: false,          // NÃO atualize status "visto"
      syncFullHistory: false,     // Não sincroniza histórico completo (mais leve)
    });
    console.log(`[EVO-ANTIBAN] ✅ Configurações anti-ban aplicadas em ${instanceName}`);
  } catch (e) {
    console.warn(`[EVO-ANTIBAN] ⚠️ Não foi possível aplicar settings em ${instanceName}:`, e.message);
  }
}

// ─── ENVIO PRINCIPAL (COM ANTI-BAN) ──────────────────────────────────────────

/**
 * Envia mensagem de texto via Evolution API com proteção anti-ban completa:
 * - Simula digitação antes de cada bloco
 * - Fragmenta mensagens longas
 * - Delay humanizado entre blocos
 * - Retry automático com backoff exponencial
 * - Suporte a Meta Cloud API (phone_number_id numérico)
 *
 * @param {string} number - Número de destino (sem +, ex: 5511999999999)
 * @param {string} text - Texto da mensagem
 * @param {string} targetInstance - Nome da instância Evolution OU phone_number_id da Meta
 */
async function enviarWhatsApp(number, text, targetInstance) {
  const instance = targetInstance || process.env.INSTANCE || "botwhatsapp01";

  // Detecta se é canal Meta Cloud API (phone_number_id é numérico longo)
  const isMetaChannel = /^\d{10,}$/.test(instance) || instance === "oficial";
  if (isMetaChannel) {
    return enviarMetaCloudAPI(number, text, instance);
  }

  // Evolution API com anti-ban
  const blocos = fragmentarMensagem(text);

  for (let i = 0; i < blocos.length; i++) {
    const bloco = blocos[i];

    // Simula digitação com delay humanizado
    await simularDigitacao(instance, number, bloco.length);

    let enviado = false;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await evoCall("POST", `/message/sendText/${instance}`, { number, text: bloco });
        enviado = true;
        console.log(`[EVO] ✅ Enviado bloco ${i + 1}/${blocos.length} para ${number} (${bloco.length} chars)`);
        break;
      } catch (err) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err.message;
        console.warn(`[EVO] ⚠️ Tentativa ${tentativa}/3 falhou (status=${status}): ${msg}`);
        if (tentativa < 3) await sleep(2000 * tentativa);
      }
    }

    if (!enviado) {
      console.error(`[EVO] ❌ Falha ao enviar bloco ${i + 1} para ${number} após 3 tentativas`);
    }

    // Delay humano entre os blocos
    if (i < blocos.length - 1) {
      await sleep(1500 + Math.random() * 1500);
    }
  }
}

// ─── META CLOUD API ───────────────────────────────────────────────────────────

/**
 * Envia mensagem via Meta Cloud API (WhatsApp Business API Oficial).
 * Busca o access_token em: 1) canaisMemoria 2) env var WABA_ACCESS_TOKEN
 */
async function enviarMetaCloudAPI(number, text, phoneNumberId) {
  const { canaisMemoria } = require("../config/memory");
  const { supabase } = require("../config/database");

  const canalData = canaisMemoria.get(phoneNumberId);
  let token = canalData?.access_token
    || process.env.WABA_ACCESS_TOKEN
    || process.env.META_ACCESS_TOKEN
    || "";

  // Fallback: busca no banco se não estiver na memória
  if (!token && supabase) {
    try {
      const { data } = await supabase.from("canais")
        .select("dados_conexao")
        .eq("tipo", "cloud_api")
        .contains("dados_conexao", { phone_number_id: phoneNumberId })
        .single();
      if (data?.dados_conexao?.access_token) {
        token = data.dados_conexao.access_token;
        canaisMemoria.set(phoneNumberId, {
          tipo: "cloud_api",
          access_token: token,
          phone_number_id: phoneNumberId,
        });
      }
    } catch (e) {
      console.warn(`[META-SEND] Aviso: falha ao buscar token no banco para ${phoneNumberId}`);
    }
  }

  if (!token) {
    console.error(`[META-SEND] ❌ Sem access_token para phone_number_id=${phoneNumberId}.`);
    return null;
  }

  const realPhoneId = canalData?.phone_number_id || phoneNumberId;
  const url = `https://graph.facebook.com/v21.0/${realPhoneId}/messages`;

  try {
    const response = await axios.post(url, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: number,
      type: "text",
      text: { preview_url: false, body: text }
    }, {
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    });
    console.log(`[META-SEND] ✅ Enviado para ${number} via phone_id=${realPhoneId}`);
    return response.data;
  } catch (err) {
    console.error(`[META-SEND] ❌ Erro ao enviar para ${number}:`, err.response?.data || err.message);
    throw err;
  }
}

// ─── GESTÃO DE INSTÂNCIAS ─────────────────────────────────────────────────────

/**
 * Cria instância no Evolution API, configura webhook e aplica anti-ban.
 */
async function criarInstanciaEvolution(instanceName, webhookUrl) {
  const criacao = await evoCall("POST", "/instance/create", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  });

  await sleep(2000); // aguarda a instância inicializar

  // Configura webhook
  await evoCall("POST", `/webhook/set/${instanceName}`, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
    }
  }).catch(() => {});

  // Aplica anti-ban assim que cria
  await configurarAntiBan(instanceName);

  return criacao.data;
}

/** Retorna o QR code de uma instância */
async function getQrCode(instanceName) {
  const r = await evoCall("GET", `/instance/connect/${instanceName}`);
  return r.data?.base64 || r.data?.qrcode?.base64 || null;
}

/** Retorna o status de conexão de uma instância */
async function getStatusInstancia(instanceName) {
  const r = await evoCall("GET", `/instance/connectionState/${instanceName}`);
  const state = r.data?.instance?.state || r.data?.state || "unknown";
  return { state, connected: state === "open" };
}

/** Deleta uma instância */
async function deletarInstanciaEvolution(instanceName) {
  await evoCall("DELETE", `/instance/delete/${instanceName}`).catch(() => {});
}

/** Lista todas as instâncias */
async function listarInstancias() {
  const resp = await evoCall("GET", "/instance/fetchInstances");
  return resp.data;
}

module.exports = {
  enviarWhatsApp,
  enviarMetaCloudAPI,
  criarInstanciaEvolution,
  configurarAntiBan,
  getQrCode,
  getStatusInstancia,
  deletarInstanciaEvolution,
  listarInstancias,
};
