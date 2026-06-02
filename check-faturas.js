require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching faturas_cartoes...");
    const { data: faturas, error: fErr } = await supabase.from('faturas_cartoes').select('*');
    if (fErr) console.error("Error faturas:", fErr);
    else console.log("Faturas:", faturas);

    console.log("\nFetching contas...");
    const { data: contas, error: cErr } = await supabase.from('contas').select('id, nome, tipo, categoria, ativo, user_id').eq('categoria', 'pf');
    if (cErr) console.error("Error contas:", cErr);
    else console.log("Contas:", contas);

    // Let's also check if any 'faturas_cartao' table still exists and has data (maybe the migration failed?)
    const { data: oldFaturas, error: oldErr } = await supabase.from('faturas_cartao').select('*').limit(5);
    if (!oldErr) console.log("Old faturas_cartao data:", oldFaturas);
    else console.log("Old faturas_cartao does not exist or error:", oldErr.message);
}

main();
