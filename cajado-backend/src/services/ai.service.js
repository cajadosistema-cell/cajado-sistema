const axios = require("axios");
const { OPENROUTER_KEY } = require("../config/env");

/**
 * Chama o modelo de IA via OpenRouter.
 * @param {Array} history - Histórico da conversa [{role, parts:[{text}]}]
 * @param {string} userMessage - Mensagem atual do usuário
 * @param {string} systemPrompt - Prompt de sistema
 */
async function chamarOpenRouter(history, userMessage, systemPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(h => ({
      role: h.role === "model" ? "assistant" : "user",
      content: h.parts[0].text,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    { model: "openai/gpt-4o-mini", messages, max_tokens: 250, temperature: 0.8 },
    { headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" } }
  );

  return response.data.choices[0].message.content.trim();
}

module.exports = { chamarOpenRouter };
