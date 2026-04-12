const express = require("express");
const router = express.Router();

const { supabase } = require("../config/database");
const { authMiddleware } = require("../middlewares/auth");
const { timesMemoria, configMemoria } = require("../config/memory");
const { chamarOpenRouter } = require("../services/ai.service");
const { listarTimes } = require("../services/config.service");

// ─── TIMES ───────────────────────────────────────────────────────
router.get("/times", authMiddleware, async (req, res) => {
  res.json(await listarTimes());
});

router.post("/times", authMiddleware, async (req, res) => {
  const t = { id: Date.now().toString(), empresa_id: req.user.empresa_id, ...req.body, ativo: true };
  if (supabase) {
    const { error } = await supabase.from("times").insert([t]);
    if (error) return res.status(400).json({ erro: error.message });
  }
  timesMemoria.set(t.id, t);
  res.json({ ok: true, time: t });
});

router.patch("/times/:id", authMiddleware, async (req, res) => {
  if (supabase) await supabase.from("times").update(req.body).eq("id", req.params.id).eq("empresa_id", req.user.empresa_id);
  if (timesMemoria.has(req.params.id)) timesMemoria.set(req.params.id, { ...timesMemoria.get(req.params.id), ...req.body });
  res.json({ ok: true });
});

router.delete("/times/:id", authMiddleware, async (req, res) => {
  if (supabase) await supabase.from("times").delete().eq("id", req.params.id).eq("empresa_id", req.user.empresa_id);
  timesMemoria.delete(req.params.id);
  res.json({ ok: true });
});

// ─── CONFIGURAÇÕES ─────────────────────────────────────
router.get("/configuracoes", authMiddleware, async (req, res) => {
  res.json(Object.fromEntries(configMemoria));
});

router.post("/configuracoes", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Sem permissão" });
  for (const [id, valor] of Object.entries(req.body)) {
    configMemoria.set(`${req.user.empresa_id}_${id}`, valor);
    if (supabase) {
      supabase.from("configuracoes").upsert({ id, empresa_id: req.user.empresa_id, valor }).then(({error})=>{
        if(error && error.code !== '42P01') console.error("Erro config DB:", error.message);
      });
    }
  }
  res.json({ ok: true });
});

router.post("/configuracoes/gerar-prompt", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ erro: "Sem permissão" });
  const { nomeBot, nomeEmpresa, descricao, tom } = req.body;
  if (!nomeBot || !nomeEmpresa || !descricao) return res.status(400).json({ erro: "Preencha os campos obrigatorios." });

  const aiBuilderSystem = "Você é um engenheiro de prompt. Devolva apenas o texto final configurado, sem introduções ou blocos de markdown.";
  const userText = `Crie o 'System Prompt' (A instrução principal do robô) com base nos seguintes dados:
- Nome da assistente: ${nomeBot}
- Empresa: ${nomeEmpresa}
- Ramo / O que a empresa faz: ${descricao}
- Tom de Voz: ${tom || "Amigável e consultivo"}

ESTRUTURA DE MOLDURA OBRIGATÓRIA (Mantenha as linhas com colchetes e a lógica intocadas):
===
Você é a \${nomeBot}, assistente da \${nomeEmpresa}... [descreva o comportamento da empresa e serviços aqui baseado no ramo]

Nós oferecemos os seguintes serviços/setores:
[TIMES_DISPONIVEIS]

SEU PAPEL:
[insira as regras comportamentais aqui em 3-4 tópicos curtos de acordo com o tom de voz e negócio]
- Nunca dar preços exatos.
- Uma pergunta por vez.

===== QUANDO TRANSFERIR =====
Quando tiver: nome + serviço + contexto do negócio — NÃO faça mais perguntas.
Sua ÚLTIMA mensagem DEVE começar com "#TRANSFERIR":

#TRANSFERIR
Setor: [Escolha APENAS UM dos setores: [NOMES_TIMES]]
Nome: [Nome do Cliente]
Pedido: [Resumo objetivo em 1-2 frases]
===
Devolva apenas o prompt.`;

  try {
    const rawPrompt = await chamarOpenRouter([], userText, aiBuilderSystem);
    res.json({ ok: true, prompt: rawPrompt.replace(/`{3}[^\\n]*\\n?/g, '').trim() });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao gerar IA" });
  }
});

module.exports = router;
