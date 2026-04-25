const { execSync } = require('child_process');
const r = execSync('git grep -rn ".from(" -- "app/(dashboard)/pf-pessoal/"', {
  encoding: 'utf8', maxBuffer: 5 * 1024 * 1024
});
const lines = r.split('\n').filter(l => 
  l.includes('gastos') || l.includes('receitas') || l.includes('agenda')
);
console.log('=== Tabelas usadas no pf-pessoal ===');
console.log(lines.join('\n'));

// Também checkar TabAssistente especificamente
const r2 = execSync('git grep -rn ".from(" -- "app/(dashboard)/pf-pessoal/_components/tabs/TabAssistente.tsx"', {
  encoding: 'utf8', maxBuffer: 1024 * 1024
});
console.log('\n=== TabAssistente - todas as tabelas ===');
console.log(r2);
