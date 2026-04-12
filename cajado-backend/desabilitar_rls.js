/**
 * Script para desabilitar RLS via Supabase Management API
 * Execute: node desabilitar_rls.js
 */

const https = require("https");

// Configs do projeto Supabase
const PROJECT_ID = "agwgaxahgmeacfjfjoid";
const SUPABASE_URL = "https://agwgaxahgmeacfjfjoid.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTMwMDgsImV4cCI6MjA4ODkyOTAwOH0.cAdD31ZOQP9mvwZk0JKcwSH40lpNuoRkfC6YP0OMFdo";

// SQL para desabilitar RLS
const SQL = `
ALTER TABLE IF EXISTS public.empresas       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarios       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.times          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.canais         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracoes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vp_cobrancas   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vivi_leads     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vivi_conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vivi_agendamentos DISABLE ROW LEVEL SECURITY;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
`;

// Tenta via RPC exec_sql (se existir)
async function tryViaRpc() {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: SQL });
    const options = {
      hostname: `${PROJECT_ID}.supabase.co`,
      path: "/rest/v1/rpc/exec_sql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.write(body);
    req.end();
  });
}

// Verifica tabelas com RLS ativo
async function checkRLS() {
  return new Promise((resolve) => {
    const options = {
      hostname: `${PROJECT_ID}.supabase.co`,
      path: "/rest/v1/pg_tables?schemaname=eq.public&select=tablename,rowsecurity",
      method: "GET",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

(async () => {
  console.log("🔍 Verificando estado do RLS...\n");
  
  const check = await checkRLS();
  console.log(`Status verificação: ${check.status}`);
  
  console.log("\n📦 Tentando desabilitar RLS via RPC...");
  const rpc = await tryViaRpc();
  console.log(`Status RPC: ${rpc.status}`);
  console.log(`Resposta: ${rpc.body || rpc.error}`);
  
  if (rpc.status !== 200) {
    console.log("\n⚠️  Não foi possível desabilitar via API. Você precisa:");
    console.log("1. Abrir: https://supabase.com/dashboard/project/agwgaxahgmeacfjfjoid/sql/new");
    console.log("2. Colar e executar o SQL no arquivo fix_rls.sql");
    console.log("\nOU adicionar no Railway:");
    console.log("SUPABASE_SERVICE_ROLE_KEY = [service_role key do Supabase Dashboard > Settings > API]");
  } else {
    console.log("\n✅ RLS desabilitado com sucesso!");
  }
})();
