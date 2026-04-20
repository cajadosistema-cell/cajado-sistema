const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://cajado-sistema.vercel.app',
    // Permite qualquer preview URL da Vercel para este projeto
    /^https:\/\/cajado-sistema.*\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// ─── CONFIGURAÇÕES EXPORTADAS PARA src/config/ ───────────────────────────
const env = require("./src/config/env");
const supabase = require("./src/config/database");

const {
  PORT, EVOLUTION_URL, EVOLUTION_KEY, INSTANCE,
  OPENROUTER_KEY, JWT_SECRET, CHATWOOT_URL,
  CHATWOOT_TOKEN, CHATWOOT_ACCOUNT, TEAM_MAP
} = env;

const {
  botPausado,
  conversas,
  conversationHistory,
  clientesTransferidos,
  processedMessages,
  MAX_HISTORY,
  usuariosMemoria,
  ADMIN_DEFAULT,
  timesMemoria,
  configMemoria,
  canaisMemoria,
} = require("./src/config/memory");

// O estado em memória agora é gerenciado pelo src/config/memory.js
const { bootstrap, iniciarSyncPeriodico, agendarCronDiario } = require("./src/boot");

// Dispara o boot central da aplicação
bootstrap().then(() => {
  iniciarSyncPeriodico();
  agendarCronDiario();
}).catch(console.error);

// ─── CANAIS EM MEMÓRIA ───────────────────────────────────────────────────
// canaisMemoria definido em src/config/memory.js

// ─── HELPERS / MIDDLEWARES ──────────────────────────────────────────────────
const { authMiddleware, superAdminMiddleware } = require("./src/middlewares/auth");

const { chamarOpenRouter } = require("./src/services/ai.service");
const { enviarWhatsApp } = require("./src/services/evolution.service");

// ─── SERVIR FRONTEND ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── HEALTH CHECK & STATUS ───────────────────────────────────────
app.use("/", require("./src/routes/health.routes"));

// ─── AUTH ───────────────────
app.use("/auth", require("./src/routes/auth.routes"));

// ─── ADMIN & BILLING ───────────────────
app.use("/admin", require("./src/routes/admin.routes"));
app.use("/minha-conta", require("./src/routes/admin.routes"));

// ─── CANAIS ───────────────────
app.use("/canais", require("./src/routes/canais.routes"));

// ─── VIVI ───────────────────
app.use("/vivi", require("./src/routes/vivi.routes"));

// ─── CONFIG & TIMES ───────────────────
app.use("/", require("./src/routes/config.routes"));

// ─── INBOX & BRIDGE (Cajado) ───────────────────
app.use("/", require("./src/routes/inbox.routes"));

// ─── WEBHOOKS ───────────────────
app.use("/webhook", require("./src/routes/webhook.routes"));

// ─── WHATSAPP (Envio automático CRM) ───────────────────
app.use("/api/whatsapp", require("./src/routes/whatsapp.routes"));



// O index.js agora atua apenas como orquestrador e ponto de entrada.
// Todas as rotas foram modularizadas em src/routes/.


// Qualquer rota não encontrada → serve o frontend (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// ─── START ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Unified API rodando na porta ${PORT}`);
  console.log(`📱 Instância: ${INSTANCE}`);
  console.log(`🔗 Evolution API: ${EVOLUTION_URL}`);
  console.log(`🗄️  Supabase: ${supabase ? "✅ Conectado" : "⚠️  Sem Supabase (modo memória)"}`);
  console.log(`\n📋 Rotas disponíveis:`);
  console.log(`   POST /webhook              ← Evolution API (bot)`);
  console.log(`   POST /inbox/webhook        ← Evolution API (inbox)`);
  console.log(`   GET  /inbox/conversas`);
  console.log(`   POST /inbox/enviar`);
  console.log(`   POST /auth/login`);
  console.log(`   GET  /api/status`);
  console.log(`   GET  /                     ← Frontend`);
});
