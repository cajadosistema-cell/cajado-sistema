const { execSync } = require('child_process');

// 0.1 — Hex hardcoded
console.log('\n=== FASE 0.1 — Hex hardcoded em .tsx ===\n');
try {
  const result = execSync(
    'git grep -rEn "#[0-9A-Fa-f]{6}" -- "*.tsx"',
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, cwd: process.cwd() }
  ).split('\n').filter(Boolean);

  const files = {};
  result.forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const f = line.substring(0, colon);
      files[f] = (files[f] || 0) + 1;
    }
  });

  const sorted = Object.entries(files).sort((a, b) => b[1] - a[1]);
  console.log('Top 15 arquivos com hex hardcoded:');
  sorted.slice(0, 15).forEach(([f, n]) => console.log('  ' + n + 'x\t' + f));
  console.log('\nTotal arquivos afetados:', sorted.length);
  console.log('Total ocorrências:', result.length);
} catch(e) {
  console.log('Nenhum hex encontrado ou erro:', e.message.substring(0, 100));
}

// 0.2 — Classes Tailwind diretas de cor
console.log('\n=== FASE 0.2 — Classes Tailwind diretas (zinc/slate/gray) em .tsx ===\n');
try {
  const r2 = execSync(
    'git grep -rEn "(bg|text|border)-(black|white|gray|zinc|slate|neutral|stone)-[0-9]+" -- "*.tsx"',
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, cwd: process.cwd() }
  ).split('\n').filter(Boolean);

  const f2 = {};
  r2.forEach(line => {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const f = line.substring(0, colon);
      f2[f] = (f2[f] || 0) + 1;
    }
  });
  const s2 = Object.entries(f2).sort((a, b) => b[1] - a[1]);
  console.log('Top 15 arquivos com classes Tailwind diretas:');
  s2.slice(0, 15).forEach(([f, n]) => console.log('  ' + n + 'x\t' + f));
  console.log('\nTotal arquivos afetados:', s2.length);
  console.log('Total ocorrências:', r2.length);
} catch(e) {
  console.log('Nenhuma classe encontrada ou erro:', e.message.substring(0, 100));
}

// 0.3 — Componentes shadcn/ui
console.log('\n=== FASE 0.3 — Componentes shadcn/ui ===\n');
const fs = require('fs');
const path = require('path');
const uiDir = path.join('components', 'ui');
if (fs.existsSync(uiDir)) {
  const files = fs.readdirSync(uiDir);
  console.log('Componentes shadcn encontrados:', files.join(', '));
} else {
  console.log('Diretório components/ui não encontrado');
}
