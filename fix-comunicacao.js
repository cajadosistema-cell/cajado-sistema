const fs = require('fs');
const file = 'app/(dashboard)/comunicacao/comunicacao-client.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix hardcoded dark hex backgrounds -> CSS variables via inline style pattern
// We'll replace classes that can't be overridden with style props via className substitution
const replacements = [
  // Panel backgrounds
  ['bg-[#05070a]', 'bg-sidebar'],
  ['bg-[#080b14]', 'bg-page'],
  ['bg-[#0a0d16]/90', 'bg-sidebar/90'],
  ['bg-[#080b14]', 'bg-page'],
  ['bg-[#111827]', 'bg-surface'],
  ['bg-[#1f2744]', 'bg-surface'],
  // Text classes
  ['text-zinc-100', 'text-fg'],
  ['text-zinc-200', 'text-fg'],
  ['text-zinc-300', 'text-fg-secondary'],
  ['text-zinc-500', 'text-fg-tertiary'],
  ['text-zinc-600', 'text-fg-disabled'],
  ['text-zinc-400', 'text-fg-secondary'],
  // Border classes
  ['border-zinc-800', 'border-border-subtle'],
  ['border-zinc-700', 'border-border-subtle'],
  // Hover backgrounds
  ['hover:bg-zinc-800/40', 'hover:bg-surface'],
  ['hover:bg-zinc-800/60', 'hover:bg-surface-hover'],
  ['active:bg-zinc-800/60', 'active:bg-surface-hover'],
  // Background opacities
  ['bg-zinc-800/40', 'bg-surface-hover'],
  ['bg-zinc-800', 'bg-muted'],
  // Inline emoji -> text
  ['text-violet-300', 'text-brand-gold'],
  ['text-violet-500/10', 'text-brand-gold-soft'],
  ['border-violet-500', 'border-brand-gold'],
  ['bg-violet-500/10', 'bg-brand-gold-soft'],
  ['bg-violet-500/20', 'bg-brand-gold-soft'],
  // Status border in contact list
  ['border-[#05070a]', 'border-surface'],
  // Online badge
  ['text-emerald-400 bg-emerald-500/10', 'text-success bg-success-soft'],
  ['text-zinc-600 bg-zinc-800', 'text-fg-tertiary bg-muted'],
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
console.log(`Done! ${changed} class patterns replaced in comunicacao-client.tsx`);
