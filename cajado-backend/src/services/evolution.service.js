const axios = require("axios");
const { EVOLUTION_URL, EVOLUTION_KEY } = require("../config/env");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Delay humanizado com variação aleatória de ±50% (mais humano que ±30%).
 * Nunca abaixo de 300ms para evitar envios instantâneos.
 */
const sleep = (ms) => {
  const jitter = ms * 0.5 * (Math.random() - 0.5) * 2; // ±50%
  return new Promise(r => setTimeout(r, Math.max(300, ms + jitter)));
};

/** Delay leve para simular "pausa de leitura" antes de começar a digitar */
const sleepLeitura = () => sleep(800 + Math.random() * 1200); // 0.8s a 2s

/** Helper base para chamar a Evolution API com timeout e credenciais opcionais por instância */
const evoCall = (method, path, data = null, timeoutMs = 15000, creds = {}) => {
  const url = creds.evolution_url || EVOLUTION_URL;
  const key = creds.api_key       || EVOLUTION_KEY;
  const config = {
    method,
    url: `${url}${path}`,
    headers: { apikey: key, "Content-Type": "application/json" },
    timeout: timeoutMs,
  };
  if (data) config.data = data;
  return axios(config);
};

/**
 * Fragmenta mensagem longa em blocos menores para parecer mais humano.
 * Aumentado para 500 chars (evita fragmentação excessiva que parece spam).
 * Quebra em pontuação natural: parágrafo → frase → palavra.
 */
function fragmentarMensagem(texto, maxLen = 500) {
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
        // Quebra por frase
        const frases = par.match(/[^.!?]+[.!?]+\s*/g) || [par];
        let bloco = "";
        for (const frase of frases) {
          if ((bloco + frase).length <= maxLen) {
            bloco += frase;
          } else {
            if (bloco) blocos.push(bloco.trim());
            // Frase maior que maxLen: quebra por vírgula ou palavra
            if (frase.length > maxLen) {
              const partes = frase.match(new RegExp(`.{1,${maxLen}}(,|\\s|$)`, "g")) || [frase];
              partes.forEach(p => { if (p.trim()) blocos.push(p.trim()); });
              bloco = "";
            } else {
              bloco = frase;
            }
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
 * Simula "composing" (digitando) antes de enviar — anti-ban comportamento humano.
 * ~30ms por char, limitado entre 1.5s e 6s.
 */
async function simularDigitacao(instance, number, textoTamanho, creds = {}) {
  try {
    const delayMs = Math.min(Math.max(textoTamanho * 30, 1500), 6000);
    await evoCall("POST", `/chat/sendPresence/${instance}`, {
      number: `${number}@s.whatsapp.net`,
      presence: "composing",
      delay: delayMs,
    }, 15000, creds);
    await sleep(delayMs);
  } catch {
    await sleep(2000); // fallback silencioso
  }
}

/**
 * Para de "digitar" — envia presence "paused" após enviar cada bloco.
 * Faz o WhatsApp exibir que o bot parou de escrever (mais natural).
 */
async function pararDigitacao(instance, number, creds = {}) {
  try {
    await evoCall("POST", `/chat/sendPresence/${instance}`, {
      number: `${number}@s.whatsapp.net`,
      presence: "paused",
      delay: 0,
    }, 15000, creds);
  } catch {
    // silencioso
  }
}

/**
 * Marca o chat como lido após receber mensagem do cliente.
 * Comportamento humano: leu antes de responder.
 */
async function marcarComoLido(instance, number, messageId, creds = {}) {
  try {
    await evoCall("POST", `/chat/markMessageAsRead/${instance}`, {
      readMessages: [{ remoteJid: `${number}@s.whatsapp.net`, fromMe: false, id: messageId }],
    }, 15000, creds);
  } catch {
    // silencioso — não é crítico
  }
}

// ─── CONFIGURAÇÕES ANTI-BAN DA INSTÂNCIA ─────────────────────────────────────

/**
 * Aplica configurações anti-ban em uma instância Evolution.
 * Deve ser chamado: ao criar, ao reconectar e periodicamente.
 */
async function configurarAntiBan(instanceName) {
  try {
    await evoCall("POST", `/settings/set/${instanceName}`, {
      rejectCall: true,           // Rejeita chamadas de voz automaticamente
      msgCall: "Não realizamos atendimentos por chamada. Envie uma mensagem de texto! 😊",
      groupsIgnore: true,         // Não responde em grupos
      alwaysOnline: false,        // Não fica online 24/7 (comportamento suspeito)
      readMessages: false,        // Não marca lido automaticamente (fazemos manual)
      readStatus: false,          // Não atualiza "visto por" automático
      syncFullHistory: false,     // Não baixa histórico completo ao conectar
    });
    console.log(`[EVO-ANTIBAN] ✅ Settings anti-ban aplicados em ${instanceName}`);
  } catch (e) {
    console.warn(`[EVO-ANTIBAN] ⚠️ Não foi possível aplicar settings em ${instanceName}:`, e.message);
  }

  // Configura webhook com eventos mínimos necessários (menos overhead)
  try {
    const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.RAILWAY_STATIC_URL
      ? `https://${process.env.RAILWAY_STATIC_URL}/webhook/evolution`
      : null;
    if (WEBHOOK_URL) {
      await evoCall("POST", `/webhook/set/${instanceName}`, {
        webhook: {
          enabled: true,
          url: WEBHOOK_URL,
          webhookByEvents: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        }
      });
      console.log(`[EVO-ANTIBAN] ✅ Webhook reconfigurado para ${instanceName}`);
    }
  } catch {
    // silencioso
  }
}

// ─── ENVIO PRINCIPAL (COM ANTI-BAN MÁXIMO) ───────────────────────────────────

/**
 * Envia mensagem de texto via Evolution API com proteção anti-ban máxima:
 * 1. Pausa de "leitura" antes de começar (simula humano lendo a mensagem)
 * 2. Fragmenta mensagens longas em blocos naturais
 * 3. Simula digitação (composing) com duração proporcional ao texto
 * 4. Envia o bloco
 * 5. Para de digitar (paused presence)
 * 6. Delay humanizado ±50% entre blocos
 * 7. Retry automático com backoff exponencial + jitter
 *
 * @param {string} number - Número de destino (apenas dígitos, com DDI)
 * @param {string} text - Texto da mensagem
 * @param {string} targetInstance - Nome da instância Evolution OU phone_number_id da Meta
 * @param {string} [messageId] - ID da mensagem recebida (para marcar como lido)
 */
async function enviarWhatsApp(number, text, targetInstance, messageId = null, creds = {}) {
  const instance = targetInstance || process.env.INSTANCE || "botwhatsapp01";

  // Detecta canal Meta Cloud API (phone_number_id é numérico longo)
  const isMetaChannel = /^\d{10,}$/.test(instance) || instance === "oficial";
  if (isMetaChannel) {
    return enviarMetaCloudAPI(number, text, instance);
  }

  // Se não vieram creds explícitas, busca do canaisMemoria (multi-tenant)
  if (!creds.api_key && !creds.evolution_url) {
    const { canaisMemoria } = require("../config/memory");
    const canalInfo = canaisMemoria.get(instance);
    if (canalInfo && typeof canalInfo === "object" && canalInfo.api_key) {
      creds = { api_key: canalInfo.api_key, evolution_url: canalInfo.evolution_url };
    }
  }

  const credsLog = creds.api_key ? `[chave-instância]` : `[chave-global]`;
  console.log(`[EVO-SEND] ${instance} ${credsLog} → ${number}`);

  // Marca como lido ANTES de começar a responder (comportamento humano)
  if (messageId) {
    await marcarComoLido(instance, number, messageId, creds);
    await sleepLeitura(); // pausa de "leitura" (800ms a 2s)
  }

  const blocos = fragmentarMensagem(text);

  for (let i = 0; i < blocos.length; i++) {
    const bloco = blocos[i];

    // 1. Simula digitação proporcional ao tamanho do bloco
    await simularDigitacao(instance, number, bloco.length, creds);

    // 2. Envia com retry exponencial + jitter
    let enviado = false;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await evoCall("POST", `/message/sendText/${instance}`, {
          number,
          text: bloco,
          delay: Math.floor(500 + Math.random() * 500),
        }, 15000, creds);
        enviado = true;
        console.log(`[EVO] ✅ Bloco ${i + 1}/${blocos.length} → ${number} (${bloco.length} chars)`);
        break;
      } catch (err) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err.message;
        console.warn(`[EVO] ⚠️ Tentativa ${tentativa}/3 falhou (${status}): ${msg}`);
        if (tentativa < 3) await sleep(2000 * Math.pow(2, tentativa - 1)); // 2s, 4s
      }
    }

    if (!enviado) {
      console.error(`[EVO] ❌ Bloco ${i + 1} não enviado para ${number} após 3 tentativas`);
    }

    // 3. Para a animação de digitação
    await pararDigitacao(instance, number, creds);

    // 4. Delay humanizado entre blocos
    if (i < blocos.length - 1) {
      const entreBloco = 2000 + Math.random() * 3000;
      await sleep(entreBloco);
    }
  }
}

// ─── META CLOUD API ───────────────────────────────────────────────────────────

async function enviarMetaCloudAPI(number, text, phoneNumberId) {
  const { canaisMemoria } = require("../config/memory");
  const { supabase } = require("../config/database");

  const canalData = canaisMemoria.get(phoneNumberId);
  let token = canalData?.access_token
    || process.env.WABA_ACCESS_TOKEN
    || process.env.META_ACCESS_TOKEN
    || "";

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
      console.warn(`[META-SEND] Aviso: falha ao buscar token para ${phoneNumberId}`);
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
    console.error(`[META-SEND] ❌ Erro:`, err.response?.data || err.message);
    throw err;
  }
}

// ─── GESTÃO DE INSTÂNCIAS ─────────────────────────────────────────────────────

async function criarInstanciaEvolution(instanceName, webhookUrl) {
  const criacao = await evoCall("POST", "/instance/create", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  });

  await sleep(2500); // aguarda inicialização

  // Configura webhook
  await evoCall("POST", `/webhook/set/${instanceName}`, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    }
  }).catch(() => {});

  // Aplica anti-ban ao criar
  await configurarAntiBan(instanceName);

  return criacao.data;
}

async function getQrCode(instanceName) {
  const r = await evoCall("GET", `/instance/connect/${instanceName}`);
  return r.data?.base64 || r.data?.qrcode?.base64 || null;
}

async function getStatusInstancia(instanceName) {
  const r = await evoCall("GET", `/instance/connectionState/${instanceName}`);
  const state = r.data?.instance?.state || r.data?.state || "unknown";
  return { state, connected: state === "open" };
}

async function deletarInstanciaEvolution(instanceName) {
  await evoCall("DELETE", `/instance/delete/${instanceName}`).catch(() => {});
}

async function listarInstancias() {
  const resp = await evoCall("GET", "/instance/fetchInstances");
  return resp.data;
}

module.exports = {
  enviarWhatsApp,
  enviarMetaCloudAPI,
  criarInstanciaEvolution,
  configurarAntiBan,
  marcarComoLido,
  getQrCode,
  getStatusInstancia,
  deletarInstanciaEvolution,
  listarInstancias,
};
