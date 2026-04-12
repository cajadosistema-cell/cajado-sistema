/**
 * VisioPro — Configuração do banco de dados
 * 
 * IMPORTANTE: Este é um servidor back-end. Todas as operações
 * DEVEM usar a service_role key para bypassar RLS.
 * A anon key é apenas para uso em browsers (frontend).
 * 
 * Se SUPABASE_SERVICE_ROLE_KEY não estiver configurada,
 * usa a anon key como fallback (com aviso).
 */

const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;
let supabaseAdmin = null;

if (env.SUPABASE_URL) {
  // Cliente admin (service_role key) — bypassa RLS para TODAS as operações server-side
  if (env.SUPABASE_SERVICE_KEY) {
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    console.log("✅ [DATABASE] Supabase Admin (service_role) configurado — RLS bypassado");
  } else {
    console.warn("⚠️  [DATABASE] SUPABASE_SERVICE_ROLE_KEY não configurada!");
    console.warn("   Configure no Railway: SUPABASE_SERVICE_ROLE_KEY = [chave do Supabase > Settings > API]");
    console.warn("   Usando anon key como fallback — operações PODEM falhar por RLS.");
  }

  // Cliente anon (apenas para fallback)
  const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  // REGRA: `supabase` SEMPRE aponta para o admin client quando disponível
  // Isso garante que TODOS os módulos que importam { supabase } usem a service key
  supabaseAdmin = supabaseAdmin || anonClient;
  supabase = supabaseAdmin; // <-- ISTO É INTENCIONAL: server-side SEMPRE usa admin
}

module.exports = { supabase, supabaseAdmin };
