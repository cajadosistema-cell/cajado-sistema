/**
 * fix-all-classes.js
 * Substitui classes Tailwind hardcoded dark por tokens semânticos
 * em todos os .tsx do projeto (exceto os já tratados e node_modules)
 */
const fs = require('fs');
const path = require('path');

// Arquivos já tratados individualmente
const SKIP = new Set([
  'app/(dashboard)/comunicacao/comunicacao-client.tsx',
  'app/(dashboard)/inbox/inbox-client.tsx',
  'components/shared/sidebar.tsx',
]);

// Mapeamento de classes diretas -> tokens semânticos
const REPLACEMENTS = [
  // ── Backgrounds ──
  ['bg-zinc-950', 'bg-sidebar'],
  ['bg-zinc-900', 'bg-page'],
  ['bg-gray-900', 'bg-page'],
  ['bg-slate-900', 'bg-page'],
  ['bg-zinc-800', 'bg-muted'],
  ['bg-gray-800', 'bg-muted'],
  ['bg-zinc-700', 'bg-surface-hover'],
  // ── Text ──
  ['text-zinc-100', 'text-fg'],
  ['text-zinc-200', 'text-fg'],
  ['text-gray-100', 'text-fg'],
  ['text-zinc-300', 'text-fg-secondary'],
  ['text-gray-300', 'text-fg-secondary'],
  ['text-zinc-400', 'text-fg-secondary'],
  ['text-gray-400', 'text-fg-secondary'],
  ['text-zinc-500', 'text-fg-tertiary'],
  ['text-gray-500', 'text-fg-tertiary'],
  ['text-zinc-600', 'text-fg-disabled'],
  // ── Borders ──
  ['border-zinc-800', 'border-border-subtle'],
  ['border-zinc-700', 'border-border-subtle'],
  ['border-gray-800', 'border-border-subtle'],
  ['border-gray-700', 'border-border-subtle'],
  // ── Hover states ──
  ['hover:bg-zinc-800', 'hover:bg-surface-hover'],
  ['hover:bg-zinc-700', 'hover:bg-surface-hover'],
  ['hover:text-zinc-100', 'hover:text-fg'],
  ['hover:text-white', 'hover:text-fg'],
  // ── Focus ──
  ['focus:ring-amber-500', 'focus:ring-brand-gold'],
  ['focus:border-amber-500', 'focus:border-brand-gold'],
  // ── Common hardcoded hex ──
  ["bg-\\[#111827\\]", 'bg-surface'],
  ["bg-\\[#080b14\\]", 'bg-page'],
  ["bg-\\[#0d1120\\]", 'bg-sidebar'],
  ["bg-\\[#1f2744\\]", 'bg-surface'],
  ["text-\\[#8b98b8\\]", 'text-fg-secondary'],
  ["text-\\[#f0f4ff\\]", 'text-fg'],
  ["border-\\[#1f2744\\]", 'border-border-subtle'],
  // ── placeholder text ──
  ['placeholder:text-zinc-500', 'placeholder:text-fg-tertiary'],
  ['placeholder:text-zinc-400', 'placeholder:text-fg-tertiary'],
  // ── scroll ──
  ["bg-\\[#1f2744\\] rounded-full", 'bg-border-default rounded-full'],
  // ── divide ──
  ['divide-zinc-800', 'divide-border-subtle'],
  ['divide-zinc-700', 'divide-border-subtle'],
];

function getAllTsx(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(entry.name)) {
        getAllTsx(fullPath, results);
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllTsx('app').concat(getAllTsx('components'));
let totalChanges = 0;
let totalFiles = 0;

for (const fullPath of files) {
  const rel = fullPath.replace(/\\/g, '/');
  if (SKIP.has(rel)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const [from, to] of REPLACEMENTS) {
    // Handle escaped regex patterns (those with backslashes)
    const regex = from.startsWith('bg-\\[') || from.startsWith('text-\\[') || from.startsWith('border-\\[')
      ? new RegExp(from.replace(/\\\[/g, '\\[').replace(/\\\]/g, '\\]'), 'g')
      : new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    
    const newContent = content.replace(regex, to);
    if (newContent !== content) {
      content = newContent;
      changed = true;
      totalChanges++;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    totalFiles++;
    console.log('  Fixed: ' + rel);
  }
}

console.log(`\nDone! ${totalChanges} replacements across ${totalFiles} files.`);
