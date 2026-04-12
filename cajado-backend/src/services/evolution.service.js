const axios = require("axios");
const { EVOLUTION_URL, EVOLUTION_KEY } = require("../config/env");

/**
 * Envia uma mensagem de texto pelo WhatsApp via Evolution API.
 * @param {string} number - Número de destino
 * @param {string} text - Texto da mensagem
 * @param {string} targetInstance - Nome da instância (opcional, usa default do env)
 */
async function enviarWhatsApp(number, text, targetInstance) {
  const instance = targetInstance || process.env.INSTANCE || "botwhatsapp01";
  const url = `${EVOLUTION_URL}/message/sendText/${instance}`;
  const response = await axios.post(
    url,
    { number, text },
    { headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" } }
  );
  return response.data;
}

/**
 * Cria uma instância no Evolution API e configura o webhook.
 * @param {string} instanceName - Nome da instância
 * @param {string} webhookUrl - URL do webhook
 */
async function criarInstanciaEvolution(instanceName, webhookUrl) {
  const criacao = await axios.post(`${EVOLUTION_URL}/instance/create`, {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  }, { headers: { apikey: EVOLUTION_KEY } });

  // Configura webhook automaticamente
  await axios.post(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
    }
  }, { headers: { apikey: EVOLUTION_KEY } }).catch(() => {}); // ignora erro de webhook, não crítico

  return criacao.data;
}

/**
 * Retorna o QR code de uma instância.
 */
async function getQrCode(instanceName) {
  const r = await axios.get(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
    headers: { apikey: EVOLUTION_KEY }
  });
  return r.data?.base64 || r.data?.qrcode?.base64 || null;
}

/**
 * Retorna o status de conexão de uma instância.
 */
async function getStatusInstancia(instanceName) {
  const r = await axios.get(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
    headers: { apikey: EVOLUTION_KEY }
  });
  const state = r.data?.instance?.state || r.data?.state || "unknown";
  return { state, connected: state === "open" };
}

/**
 * Deleta uma instância do Evolution API.
 */
async function deletarInstanciaEvolution(instanceName) {
  await axios.delete(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
    headers: { apikey: EVOLUTION_KEY }
  }).catch(() => {});
}

/**
 * Lista todas as instâncias.
 */
async function listarInstancias() {
  const resp = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
    headers: { apikey: EVOLUTION_KEY }
  });
  return resp.data;
}

module.exports = {
  enviarWhatsApp,
  criarInstanciaEvolution,
  getQrCode,
  getStatusInstancia,
  deletarInstanciaEvolution,
  listarInstancias,
};
