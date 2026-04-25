const fs = require('fs');
const file = 'app/(dashboard)/inbox/inbox-client.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  // Panel/layout backgrounds
  ['bg-zinc-950', 'bg-sidebar'],
  ['bg-zinc-900', 'bg-page'],
  ['bg-[#0d1117]', 'bg-sidebar'],
  ['bg-[#111827]', 'bg-surface'],
  ['bg-[#080b14]', 'bg-page'],
  ['bg-[#1f2744]', 'bg-surface'],
  // Text colors
  ['text-zinc-100', 'text-fg'],
  ['text-zinc-200', 'text-fg'],
  ['text-zinc-300', 'text-fg-secondary'],
  ['text-zinc-400', 'text-fg-secondary'],
  ['text-zinc-500', 'text-fg-tertiary'],
  ['text-zinc-600', 'text-fg-disabled'],
  // Borders
  ['border-zinc-800', 'border-border-subtle'],
  ['border-zinc-700', 'border-border-subtle'],
  ['border-white/5', 'border-border-subtle'],
  ['border-white/10', 'border-border-subtle'],
  // Hover
  ['hover:bg-zinc-800', 'hover:bg-surface-hover'],
  ['hover:bg-zinc-700', 'hover:bg-surface-hover'],
  ['hover:bg-white/5', 'hover:bg-surface-hover'],
  // Misc
  ['bg-zinc-800', 'bg-muted'],
  ['bg-zinc-700', 'bg-surface-hover'],
  // DoubleCheck color
  ["'text-zinc-500'", "'text-fg-tertiary'"],
  // Etiquetas - rewrite map
  ["'bg-zinc-700 text-zinc-400'", "'bg-muted text-fg-tertiary'"],
];

let changed = 0;
for (const [from, to] of replacements) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  const newContent = content.replace(regex, to);
  if (newContent !== content) {
    changed++;
    content = newContent;
  }
}

fs.writeFileSync(file, content, 'utf8');
console.log(`Done! ${changed} class patterns replaced in inbox-client.tsx`);
