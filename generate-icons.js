/**
 * generate-icons.js
 * Gera todos os ícones PWA a partir do icon-512.png existente
 * Uso: node generate-icons.js
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const SOURCE = path.join(__dirname, 'public', 'icons', 'icon-512.png')
const OUT_DIR = path.join(__dirname, 'public', 'icons')

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]

async function generate() {
  console.log('🎨 Gerando ícones PWA...\n')

  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`)
    if (size === 512) {
      // Já existe como source, só garante que está no lugar certo
      if (!fs.existsSync(out)) fs.copyFileSync(SOURCE, out)
      console.log(`✅ icon-${size}.png (já existe)`)
      continue
    }
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 26, g: 22, b: 18, alpha: 1 } })
      .png()
      .toFile(out)
    console.log(`✅ icon-${size}.png`)
  }

  // Maskable (com padding 20% — fundo escuro)
  for (const size of [192, 512]) {
    const padded = Math.round(size * 0.8)
    const padding = Math.round(size * 0.1)
    const out = path.join(OUT_DIR, `icon-${size}-maskable.png`)
    await sharp(SOURCE)
      .resize(padded, padded, { fit: 'contain', background: { r: 31, g: 74, b: 46, alpha: 1 } })
      .extend({
        top: padding, bottom: padding, left: padding, right: padding,
        background: { r: 31, g: 74, b: 46, alpha: 1 }
      })
      .resize(size, size)
      .png()
      .toFile(out)
    console.log(`✅ icon-${size}-maskable.png`)
  }

  // Apple touch icon (180x180, sem padding)
  await sharp(SOURCE)
    .resize(180, 180, { fit: 'contain', background: { r: 26, g: 22, b: 18, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_DIR, 'apple-touch-icon.png'))
  console.log('✅ apple-touch-icon.png')

  // ⚠️ NÃO sobrescrever /public/logo.png — é a logo completa com nome "CAJADO SOLUÇÕES"
  // O /public/logo.png é usado no sidebar e deve ser mantido manualmente.

  // Screenshots (placeholder 1280x720 com fundo escuro)
  const screenshotsDir = path.join(OUT_DIR, 'screenshots')
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir)

  for (const [name, w, h] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    const out = path.join(screenshotsDir, `screenshot-${name}.png`)
    await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 10, g: 13, b: 22, alpha: 1 } }
    }).png().toFile(out)
    console.log(`✅ screenshots/screenshot-${name}.png`)
  }

  // Shortcuts icons (96x96 com cores diferentes)
  const shortcuts = [
    { name: 'shortcut-inbox.png',      bg: { r: 16, g: 185, b: 129 } },
    { name: 'shortcut-financeiro.png', bg: { r: 245, g: 158, b: 11 } },
    { name: 'shortcut-vendas.png',     bg: { r: 59,  g: 130, b: 246 } },
    { name: 'shortcut-crm.png',        bg: { r: 139, g: 92,  b: 246 } },
  ]
  for (const s of shortcuts) {
    await sharp(SOURCE)
      .resize(64, 64, { fit: 'contain', background: { ...s.bg, alpha: 1 } })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { ...s.bg, alpha: 1 } })
      .resize(96, 96)
      .png()
      .toFile(path.join(OUT_DIR, s.name))
    console.log(`✅ ${s.name}`)
  }

  console.log('\n🎉 Todos os ícones gerados com sucesso!')
  console.log(`📁 ${fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).length} ícones em /public/icons/`)
}

generate().catch(err => { console.error('❌ Erro:', err.message); process.exit(1) })
