/**
 * Script para aplicar a migration 049 — Expande tipos válidos da agenda_eventos
 * 
 * Problema resolvido:
 * - "new row for relation agenda_eventos violates check" 
 *   ao tentar criar evento com tipo "vencimento", "prazo" ou "pessoal"
 * 
 * Uso: node run-migration-049.js
 */

const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local');
  process.exit(1);
}

const SQL = `
-- Migration 049: Expande tipos válidos da agenda_eventos
-- Adiciona: vencimento, prazo, pessoal (usados pela Elena mas ausentes na constraint original)

ALTER TABLE public.agenda_eventos
  DROP CONSTRAINT IF EXISTS agenda_eventos_tipo_check;

ALTER TABLE public.agenda_eventos
  ADD CONSTRAINT agenda_eventos_tipo_check
  CHECK (tipo IN (
    'compromisso',
    'lembrete',
    'nota',
    'tarefa',
    'aniversario',
    'reuniao',
    'vencimento',
    'prazo',
    'pessoal'
  ));
`;

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);
    const data = JSON.stringify({ query: sql });

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: body });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔄 Aplicando migration 049 — agenda_tipos_expand...');
  console.log('📍 Supabase:', SUPABASE_URL);
  console.log('');
  
  const result = await runSQL(SQL);
  
  if (result.status === 200 || result.status === 204) {
    console.log('✅ Migration aplicada com sucesso!');
    console.log('✅ Agora a Elena pode criar eventos com tipos: vencimento, prazo, pessoal');
  } else {
    console.error(`❌ Erro ao aplicar migration (HTTP ${result.status})`);
    console.error(result.body);
    console.log('');
    console.log('📌 Execute manualmente no Supabase Dashboard → SQL Editor:');
    console.log('='.repeat(60));
    console.log(SQL);
    console.log('='.repeat(60));
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  console.log('');
  console.log('📌 Execute manualmente no Supabase Dashboard → SQL Editor:');
  console.log('='.repeat(60));
  console.log(SQL);
});
