/**
 * fix-chaves.js — remove a linha extra "} // fim if !micPermitidoRef.current"
 * e realinha o bloco de carregamento de perfil dentro do historyLoadedRef
 */
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'components', 'shared', 'SecretariaFlutuante.tsx')
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

// Bloco problemático — tem a chave extra e o carregamento de perfil mal indentado
const oldBlock = `        }

        } // fim if !micPermitidoRef.current

      // ── Carrega perfil de aprendizado ────────────────────────
        const { data: perfil } = await (supabase.from('elena_perfil') as any)
          .select('*').eq('user_id', uid).maybeSingle()
        if (perfil) {
          setPerfilUsuario(perfil)
          perfilRef.current = perfil
        }
      }
    })`

const newBlock = `        }

        // ── Carrega perfil de aprendizado ──────────────────────
        const { data: perfil } = await (supabase.from('elena_perfil') as any)
          .select('*').eq('user_id', uid).maybeSingle()
        if (perfil) {
          setPerfilUsuario(perfil)
          perfilRef.current = perfil
        }
      }
    })`

if (!content.includes(oldBlock)) {
  console.error('❌ Bloco não encontrado — verificar manualmente')
  // Mostra contexto para debug
  const idx = content.indexOf('fim if !micPermitidoRef')
  if (idx >= 0) {
    console.log('Contexto ao redor da linha problemática:')
    console.log(content.substring(idx - 200, idx + 200))
  }
  process.exit(1)
}

content = content.replace(oldBlock, newBlock)
fs.writeFileSync(filePath, content, 'utf8')
console.log('✅ Chave extra removida e indentação corrigida!')
console.log('Tamanho:', content.length)
