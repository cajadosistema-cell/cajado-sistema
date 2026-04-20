const express = require("express");
const router = express.Router();
const { supabase } = require("../config/database");
const { enviarWhatsApp } = require("../services/evolution.service");
const { authMiddleware } = require("../middlewares/auth");

/**
 * POST /api/whatsapp/enviar
 * Body: { numero: string, mensagem: string }
 *
 * Verifica se há canal WhatsApp ativo para a empresa e envia a mensagem.
 * Retorna { ok: true } ou { ok: false, erro: string }
 */
router.post("/enviar", authMiddleware, async (req, res) => {
  const { numero, mensagem } = req.body;

  if (!numero || !mensagem) {
    return res.status(400).json({ ok: false, erro: "número e mensagem são obrigatórios" });
  }

  try {
    // Busca o canal WhatsApp ativo da empresa (Evolution ou Cloud API)
    let instanceName = null;

    if (supabase) {
      const { data: canais } = await supabase
        .from("canais")
        .select("tipo, status, dados_conexao")
        .eq("empresa_id", req.user.empresa_id)
        .in("status", ["conectado", "ativo"])
        .limit(5);

      const canal = (canais || []).find(
        (c) => c.tipo === "evolution" && c.dados_conexao?.instance_name
      );

      if (canal) {
        instanceName = canal.dados_conexao.instance_name;
      }
    }

    // Fallback: usa instância padrão do env
    if (!instanceName) {
      instanceName = process.env.INSTANCE || null;
    }

    if (!instanceName) {
      return res.status(503).json({
        ok: false,
        erro: "Nenhum canal WhatsApp ativo encontrado. Configure um canal em Segurança WA.",
      });
    }

    // Limpa o número (apenas dígitos)
    const numeroLimpo = numero.replace(/\D/g, "");

    await enviarWhatsApp(numeroLimpo, mensagem, instanceName);

    console.log(`[WA-Auto] ✅ Mensagem enviada para ${numeroLimpo} via ${instanceName}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[WA-Auto] Erro ao enviar mensagem:", err?.response?.data || err.message);
    return res.status(500).json({
      ok: false,
      erro: err?.response?.data?.message || "Erro ao enviar mensagem WhatsApp",
    });
  }
});

module.exports = router;
