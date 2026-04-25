const fs = require('fs');

// Verifica que o tema escuro está presente no globals.css como variáveis semânticas
console.log('=== Cajado Dark Theme Guardian ===\n');

const globals = fs.readFileSync('app/globals.css', 'utf8');

// Regras: verifica presença das variáveis CSS do dark theme
const RULES = [
  { pattern: /\[data-theme="dark"\]/, description: 'Seletor [data-theme="dark"] presente' },
  { pattern: /--bg-page:\s*#080b14/, description: 'bg-page dark (#080b14)' },
  { pattern: /--bg-surface:\s*#111827/, description: 'bg-surface dark (#111827)' },
  { pattern: /--text-primary:\s*#f0f4ff/, description: 'text-primary dark (#f0f4ff)' },
  { pattern: /--brand-gold:\s*#F59E0B/, description: 'brand-gold dark (#F59E0B)' },
  { pattern: /--focus-ring:.*245, 158, 11/, description: 'focus-ring âmbar no dark' },
];

console.log('--- Verificando variáveis do dark theme no globals.css ---\n');

let warnings = 0;
for (const rule of RULES) {
  if (rule.pattern.test(globals)) {
    console.log('  ✓ ' + rule.description);
  } else {
    warnings++;
    console.log('  ❌ AUSENTE: ' + rule.description);
  }
}

console.log('\n=================================');
if (warnings === 0) {
  console.log('✅ Dark theme INTACTO — OK para aplicar tema claro');
} else {
  console.log(`❌ ${warnings} problema(s) — globals.css pode estar incompleto`);
}
console.log('=================================\n');
