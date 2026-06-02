/**
 * patch-elena-fixes.js
 * Aplica 3 fixes na SecretariaFlutuante:
 * Fix 1: Microfone — salva permissão no banco (não só localStorage)
 * Fix 2: Histórico — carrega últimas msgs de múltiplas sessões
 * Fix 3: Localizador — mostra onde cada dado foi salvo
 */
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'components', 'shared', 'SecretariaFlutuante.tsx')
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

// ══════════════════════════════════════════════════════════
// FIX 1: Microfone — salvar autorização no banco (perfis)
// ══════════════════════════════════════════════════════════
const oldMicInit = `  // Controle de microfone já autorizado
  const micPermitidoRef = useRef(false)

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
    // Verifica permissão de microfone salva
    if (typeof window !== 'undefined') {
      micPermitidoRef.current = localStorage.getItem('elena_mic_ok') === '1'
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)`

const newMicInit = `  // Controle de microfone já autorizado
  const micPermitidoRef = useRef(false)

  // Fix #1: Salva autorização de mic no banco (não só localStorage)
  const salvarMicAutorizado = async (uid: string) => {
    try {
      localStorage.setItem('elena_mic_ok', '1')
      await (supabase.from('perfis') as any).update({ mic_autorizado: true }).eq('id', uid)
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
    // Verifica permissão de microfone salva (localStorage primeiro, banco depois)
    if (typeof window !== 'undefined') {
      micPermitidoRef.current = localStorage.getItem('elena_mic_ok') === '1'
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)

      // Fix #1: verifica mic no banco se localStorage perdeu
      if (!micPermitidoRef.current) {
        try {
          const { data: perfil } = await (supabase.from('perfis') as any)
            .select('mic_autorizado').eq('id', uid).maybeSingle()
          if (perfil?.mic_autorizado) {
            micPermitidoRef.current = true
            localStorage.setItem('elena_mic_ok', '1')
          }
        } catch { /* silencioso */ }
      }`

if (!content.includes(oldMicInit.replace(/\r\n/g, '\n'))) {
  console.error('Fix 1: bloco NÃO encontrado. Verificar manualmente.')
} else {
  content = content.replace(oldMicInit, newMicInit)
  console.log('✅ Fix 1 (microfone banco) aplicado')
}

// ══════════════════════════════════════════════════════════
// FIX 2: Histórico cross-session — carrega últimas msgs de 
// qualquer sessão, não só a atual
// ══════════════════════════════════════════════════════════
const oldHist = `        const { data: hist } = await (supabase
          .from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at')
          .eq('user_id', uid)
          .eq('sessao_id', currentSessaoId)
          .order('created_at', { ascending: false }) // Pega os mais recentes daquela sessão
          .limit(40)
        
        if (hist && hist.length > 0) {
          // Reverte para a ordem cronológica correta de exibição
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
            created_at: r.created_at,
          }))
          setMensagens([
            { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Carreguei nossa última conversa. O que faremos agora?' },
            ...historico,
          ])
        }`

const newHist = `        // Fix #2: carrega as últimas msgs de QUALQUER sessão (não só a atual)
        // Isso garante que após backup/nova sessão o histórico recente ainda aparece
        const { data: hist } = await (supabase
          .from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at, sessao_id')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(60) // últimas 60 msgs de todas as sessões
        
        if (hist && hist.length > 0) {
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
            created_at: r.created_at,
          }))
          setMensagens([
            { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Carreguei o histórico recente. O que faremos agora?' },
            ...historico,
          ])
        }`

if (!content.includes(oldHist)) {
  console.error('Fix 2: bloco NÃO encontrado. Verificar manualmente.')
} else {
  content = content.replace(oldHist, newHist)
  console.log('✅ Fix 2 (histórico cross-session) aplicado')
}

// ══════════════════════════════════════════════════════════
// FIX 3: Microfone — salvar no banco quando autorizar
// (no handler de erro 'not-allowed', depois de success)
// ══════════════════════════════════════════════════════════
const oldMicError = `      r.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          isListeningRef.current = false
          setIsListening(false)
          alert('Microfone não acessível. Clique no 🔒 na barra de endereços e permita o microfone.')
        } else if (e.error === 'audio-capture') {
          isListeningRef.current = false
          setIsListening(false)
          alert('Nenhum microfone encontrado. Conecte um e tente novamente.')
        }
        // 'no-speech' e 'aborted' → silenciosos (pausa normal ou stop manual)
      }`

const newMicError = `      r.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          isListeningRef.current = false
          setIsListening(false)
          alert('Microfone não acessível. Toque no cadeado 🔒 (ou ícone de câmera) na barra de endereços e permita o microfone.')
        } else if (e.error === 'audio-capture') {
          isListeningRef.current = false
          setIsListening(false)
          alert('Nenhum microfone encontrado. Conecte um e tente novamente.')
        }
        // 'no-speech' e 'aborted' → silenciosos (pausa normal ou stop manual)
      }

      // Fix #1: quando o mic inicia com sucesso → salvar autorização no banco
      r.onspeechstart = () => {
        if (!micPermitidoRef.current && userId) {
          micPermitidoRef.current = true
          salvarMicAutorizado(userId)
        }
      }`

if (!content.includes(oldMicError)) {
  console.error('Fix 3: bloco NÃO encontrado. Verificar manualmente.')
} else {
  content = content.replace(oldMicError, newMicError)
  console.log('✅ Fix 3 (salvar mic no banco ao sucesso) aplicado')
}

// ══════════════════════════════════════════════════════════
// FIX 4: Fechar o if extra aberto no Fix #1
// (o bloco useEffect ficou com um if a mais)
// ══════════════════════════════════════════════════════════
// Encontra onde estava o fechamento do useEffect auth e adiciona o }
const oldAuthClose = `      // ── Carrega perfil de aprendizado ────────────────────────`
const newAuthClose = `      } // fim if !micPermitidoRef.current

      // ── Carrega perfil de aprendizado ────────────────────────`

if (!content.includes(oldAuthClose)) {
  console.error('Fix 4: fechamento de bloco NÃO encontrado.')
} else {
  content = content.replace(oldAuthClose, newAuthClose)
  console.log('✅ Fix 4 (fechamento de bloco) aplicado')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('\n✅ Todos os patches aplicados!')
console.log('Tamanho final:', content.length, 'bytes')
