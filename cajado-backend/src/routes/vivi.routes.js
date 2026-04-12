const express = require("express");
const router = express.Router();

const { supabase } = require("../config/database");
const { authMiddleware } = require("../middlewares/auth");
const { ADMIN_DEFAULT } = require("../config/memory");

// ─── VIVI ───────────────────────────────────────────────────────
router.get("/conversas", authMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail;

  let query = supabase.from("vivi_conversas").select("*").order("created_at", { ascending: false });
  if (!isSuperAdmin) {
    if (req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao") {
      return res.json([]);
    }
    query = query.eq("empresa_id", req.user.empresa_id);
  }

  const { data, error } = await query;

    if (error || !data) {
    let fallbackQuery = supabase.from("vivi_conversas").select("*").order("id", { ascending: false });
    if (!isSuperAdmin) {
      if (req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao") return res.json([]);
      fallbackQuery = fallbackQuery.eq("empresa_id", req.user.empresa_id);
    }
    const respt = await fallbackQuery;
    if (respt.error || !respt.data) return res.json([]);
    return agruparConversas(respt.data);
  }
  
  return agruparConversas(data);

  function agruparConversas(mensagens) {
    const map = new Map();
    for (const msg of mensagens) {
      if (!map.has(msg.session_id)) {
        map.set(msg.session_id, {
          session_id: msg.session_id,
          nome: "Visitante " + (msg.session_id ? msg.session_id.slice(-4) : ""),
          whatsapp: "",
          canal: msg.canal || "site",
          atualizado_em: msg.created_at || msg.criado_em,
          ultima_mensagem: msg.mensagem,
          novas: 0
        });
      }
      if (msg.visto === false && msg.role === "user") {
        map.get(msg.session_id).novas++;
      }
    }
    res.json(Array.from(map.values()));
  }
});

router.patch("/conversas/:session_id/visto", authMiddleware, async (req, res) => {
  if (!supabase) return res.json({ ok: true });
  const { error } = await supabase.from("vivi_conversas")
    .update({ visto: true })
    .eq("session_id", req.params.session_id)
    .is("visto", false);
  if (error) return res.status(400).json({ erro: error.message });
  res.json({ ok: true });
});

router.get("/conversas/:session_id", authMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail;

  let query = supabase.from("vivi_conversas")
    .select("*")
    .eq("session_id", req.params.session_id);

  if (!isSuperAdmin) {
    if (req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao") {
      return res.json([]);
    }
    query = query.eq("empresa_id", req.user.empresa_id);
  }

  const { data, error } = await query;
    
  if (error) return res.json([]);
  
  const sortData = data.sort((a, b) => {
    const timeA = new Date(a.created_at || a.criado_em || 0).getTime();
    const timeB = new Date(b.created_at || b.criado_em || 0).getTime();
    return timeA - timeB;
  });
  
  res.json(sortData || []);
});

router.post("/conversas/:session_id/enviar", authMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: "Supabase não configurado" });
  const { session_id } = req.params;
  const { mensagem } = req.body;

  if (!mensagem) return res.status(400).json({ erro: "Mensagem obrigatória" });

  const { error } = await supabase.from("vivi_conversas").insert([
    {
      session_id, mensagem, role: "assistant", canal: "site",
      empresa_id: req.user.empresa_id, visto: true
    }
  ]);

  if (error) return res.status(400).json({ erro: error.message });
  res.json({ ok: true });
});

router.get("/leads", authMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail;

  let query = supabase.from("vivi_leads").select("*").order("criado_em", { ascending: false });
  if (!isSuperAdmin) {
    if (req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao") {
      return res.json([]);
    }
    query = query.eq("empresa_id", req.user.empresa_id);
  }
  const { data } = await query;
  res.json(data || []);
});

router.get("/agendamentos", authMiddleware, async (req, res) => {
  if (!supabase) return res.json([]);
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  const isSuperAdmin = req.user.email?.toLowerCase() === adminEmail;

  let query = supabase.from("vivi_agendamentos").select("*").order("id", { ascending: false });
  if (!isSuperAdmin) {
    if (req.user.empresa_id === ADMIN_DEFAULT.empresa_id || req.user.empresa_id === "empresa-padrao") {
      return res.json([]);
    }
    query = query.eq("empresa_id", req.user.empresa_id);
  }
  const { data } = await query;
  res.json(data || []);
});

router.patch("/agendamentos/:id", authMiddleware, async (req, res) => {
  if (!supabase) return res.json({ ok: true });
  const { error } = await supabase.from("vivi_agendamentos")
    .update(req.body)
    .eq("id", req.params.id);
  if (error) return res.status(400).json({ erro: error.message });
  res.json({ ok: true });
});

router.delete("/agendamentos/:id", authMiddleware, async (req, res) => {
  if (!supabase) return res.json({ ok: true });
  const { error } = await supabase.from("vivi_agendamentos")
    .delete()
    .eq("id", req.params.id);
  if (error) return res.status(400).json({ erro: error.message });
  res.json({ ok: true });
});

// ─── ROTA PÚBLICA ──────────────────
router.post("/site-message", async (req, res) => {
  // Set CORS headers manually if needed, but app.use(cors()) should handle it generally.
  // The original code had res.setHeader("Access-Control-Allow-Origin", "*");
  const { session_id, role, mensagem, canal, agendamento } = req.body;
  if (!session_id || !mensagem) return res.status(400).json({ erro: "session_id e mensagem obrigatórios" });

  // Atribui conversas do site exclusivamente para o Admin (para não vazar para outras empresas)
  const empresa_id = req.body.empresa_id || ADMIN_DEFAULT.empresa_id || null;

  if (supabase) {
    const { error } = await supabase.from("vivi_conversas").insert([{
      session_id, role: role || "user", mensagem, canal: canal || "site",
      empresa_id, visto: false
    }]);
    if (error) return res.status(500).json({ erro: error.message });

    if (agendamento && agendamento.nome) {
      const dtStr = agendamento.horario || "";
      const dtParts = dtStr.includes("T") ? dtStr.split("T") : dtStr.includes(" ") ? dtStr.split(" ") : [dtStr, ""];
      
      const { error: errAgendamento } = await supabase.from("vivi_agendamentos").insert([{
        session_id, nome: agendamento.nome, whatsapp: agendamento.whatsapp || null,
        data_agendamento: dtParts[0] || dtStr, hora_agendamento: dtParts[1]?.slice(0, 5) || "",
        status: "pendente", canal: "site", observacao: agendamento.observacao || null, empresa_id
      }]);

      await supabase.from("vivi_leads").insert([{
        nome: agendamento.nome, whatsapp: agendamento.whatsapp || null,
        canal: "site", status: "capturado", empresa_id
      }]);
    }
  }
  res.json({ ok: true, empresa_id });
});

router.options("/site-message", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

module.exports = router;
