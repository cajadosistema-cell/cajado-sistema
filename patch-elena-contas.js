// patch-elena-contas.js — corrige o bloco de contas na SecretariaFlutuante.tsx
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'components', 'shared', 'SecretariaFlutuante.tsx')
let content = fs.readFileSync(filePath, 'utf8')

const oldBlock = `      // ── Carrega contas cadastradas (PF e PJ) para Elena saber o que existe ──
      let blocoContas = ''
      try {
        const { data: contasCadastradas } = await (supabase.from('contas') as any)
          .select('nome, tipo, categoria, bandeira')
          .eq('ativo', true)
          .order('categoria', { ascending: true })
          .order('nome', { ascending: true })
        if (contasCadastradas && contasCadastradas.length > 0) {
          const pfList = contasCadastradas
            .filter((c: any) => c.categoria === 'pf')
            .map((c: any) => \`\${c.nome}\${c.bandeira ? \` (\${c.bandeira})\` : ''}\`)
            .join(', ')
          const pjList = contasCadastradas
            .filter((c: any) => c.categoria === 'pj')
            .map((c: any) => \`\${c.nome}\${c.bandeira ? \` (\${c.bandeira})\` : ''}\`)
            .join(', ')
          blocoContas = '\\n💳 CONTAS/CARTÕES CADASTRADOS (use esses nomes ao registrar):\\n'
          if (pfList) blocoContas += \`- PF (pessoal): \${pfList}\\n\`
          if (pjList) blocoContas += \`- PJ (empresa): \${pjList}\\n\`
          blocoContas += '⚠️ Se o Sr. Max mencionar uma conta/cartão diferente desses, o sistema vai criar automaticamente. Não precisa perguntar se a conta existe.\\n'
        }
      } catch { /* silencioso */ }`

const newBlock = `      // ── Carrega contas cadastradas (PF e PJ) para Elena saber o que existe ──
      let blocoContas = ''
      try {
        const { data: contasCadastradas } = await (supabase.from('contas') as any)
          .select('nome, nome_cartao, tipo, categoria, bandeira, dia_vencimento, limite_credito')
          .eq('user_id', uid)          // isolado por usuário — corrige RLS
          .eq('ativo', true)
          .order('categoria', { ascending: true })
          .order('nome', { ascending: true })
        if (contasCadastradas && contasCadastradas.length > 0) {
          const pfCartoes = contasCadastradas.filter((c: any) =>
            c.categoria === 'pf' && ['cartao_credito', 'cartao_debito'].includes(c.tipo)
          )
          const pfContas = contasCadastradas.filter((c: any) =>
            c.categoria === 'pf' && !['cartao_credito', 'cartao_debito'].includes(c.tipo)
          )
          const pjList = contasCadastradas
            .filter((c: any) => c.categoria === 'pj')
            .map((c: any) => \`\${c.nome_cartao || c.nome}\${c.bandeira ? \` (\${c.bandeira})\` : ''}\`)
            .join(', ')

          blocoContas = '\\n💳 CONTAS/CARTOES CADASTRADOS DO SR. MAX (use esses nomes ao registrar):\\n'

          if (pfCartoes.length > 0) {
            blocoContas += '- Cartoes de credito/debito PF (pessoal):\\n'
            pfCartoes.forEach((c: any) => {
              const nome = c.nome_cartao || c.nome
              const venc = c.dia_vencimento ? \` | vence todo dia \${c.dia_vencimento}\` : ''
              const limite = c.limite_credito ? \` | limite R\$ \${Number(c.limite_credito).toFixed(2)}\` : ''
              const band = c.bandeira ? \` (\${c.bandeira})\` : ''
              blocoContas += \`  * \${nome}\${band}\${venc}\${limite}\\n\`
            })
            blocoContas += '⚠️ IMPORTANTE: Use os dias de vencimento acima para agendar pagamentos. NAO pergunte a data de vencimento se ja estiver listada.\\n'
          }
          if (pfContas.length > 0) {
            const pfBancList = pfContas.map((c: any) => \`\${c.nome}\${c.bandeira ? \` (\${c.bandeira})\` : ''}\`).join(', ')
            blocoContas += \`- Contas bancarias PF: \${pfBancList}\\n\`
          }
          if (pjList) blocoContas += \`- Contas/cartoes PJ (empresa): \${pjList}\\n\`
          blocoContas += '⚠️ Se o Sr. Max mencionar uma conta diferente, o sistema cria automaticamente.\\n'
        }
      } catch { /* silencioso */ }`

// Normaliza CRLF para LF antes de comparar
const contentLF = content.replace(/\r\n/g, '\n')
const oldBlockLF = oldBlock.replace(/\r\n/g, '\n')
const newBlockLF = newBlock.replace(/\r\n/g, '\n')

if (!contentLF.includes(oldBlockLF)) {
  console.error('❌ Bloco original NÃO encontrado! Verifique o arquivo.')
  console.log('Procurando trecho parcial...')
  const partial = '          .select(\'nome, tipo, categoria, bandeira\')'
  console.log('Encontrado:', contentLF.includes(partial))
  process.exit(1)
}

const patched = contentLF.replace(oldBlockLF, newBlockLF)
fs.writeFileSync(filePath, patched, 'utf8')
console.log('✅ Patch aplicado com sucesso!')
console.log(`Tamanho original: ${content.length} | Novo: ${patched.length}`)
