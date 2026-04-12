require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3000,
  EVOLUTION_URL: process.env.API_URL || "https://evolution-api-production-2ae1.up.railway.app",
  EVOLUTION_KEY: process.env.API_KEY,
  INSTANCE: process.env.INSTANCE || "botwhatsapp01",
  OPENROUTER_KEY: process.env.OPENROUTER_API_KEY,
  JWT_SECRET: process.env.JWT_SECRET || "visiopro-secret-2025",
  CHATWOOT_URL: process.env.CHATWOOT_URL || "https://app.chatwoot.com",
  CHATWOOT_TOKEN: process.env.CHATWOOT_TOKEN,
  CHATWOOT_ACCOUNT: process.env.CHATWOOT_ACCOUNT_ID,
  TEAM_MAP: {
    site:       process.env.TEAM_SITE,
    app:        process.env.TEAM_APP,
    bot:        process.env.TEAM_BOT,
    marketing:  process.env.TEAM_MARKETING,
    financeiro: process.env.TEAM_FINANCEIRO,
    suporte:    process.env.TEAM_SUPORTE,
    videos:     process.env.TEAM_VIDEOS,
  },
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@visiopro.com",
  ADMIN_SENHA: process.env.ADMIN_SENHA || "visiopro2025",
  INFINITYPAY_HANDLE: process.env.INFINITYPAY_HANDLE || "visiopro",
  RAILWAY_URL: process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "https://visiopro-unified01-production.up.railway.app",
  APP_BASE_URL: process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "https://visiopro-unified01-production.up.railway.app")
};
