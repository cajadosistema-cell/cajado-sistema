# Guia de Migração — SecretariaFlutuante

## Estrutura final

```
components/SecretariaFlutuante/
  index.ts                      ← exportação pública (não mude o import nas páginas)
  SecretariaFlutuante.tsx       ← orquestrador: JSX + conecta hooks
  hooks/
    useElenaSession.ts          ← userId, sessaoId, histórico, perfil
    useElenaSalvar.ts           ← salvarAcao, resolvers de conta, confirmação
    useElenaVoz.ts              ← microfone, SpeechRecognition, mãos-livres
    useElenaOffline.ts          ← fila offline, sync, formulário emergência
  lib/
    elena-types.ts              ← todos os tipos (Msg, AcaoIA, etc.)
    elena-constants.ts          ← UUIDs, listas de categorias, keywords
    elena-prompt.ts             ← buildSystemPrompt, extrairAcoes, formatarTexto
```

---

## Ordem de migração (cada passo = 1 commit)

### Passo 1 — Copiar os arquivos novos
Copie toda a pasta `SecretariaFlutuante/` para `components/`.

### Passo 2 — Completar `carregarResumoFinanceiro` no orquestrador
No `SecretariaFlutuante.tsx`, há um comentário marcando onde copiar essa função.
Copie as linhas **2100–2303** do arquivo original.

### Passo 3 — Colar o JSX original
No `SecretariaFlutuante.tsx`, há um comentário onde o JSX deve entrar.
Copie as linhas **3182–3716** do arquivo original e ajuste os nomes:

| Antes (original)       | Depois (hook)                          |
|------------------------|----------------------------------------|
| `userId`               | `session.userId`                       |
| `sessaoId`             | `session.sessaoId`                     |
| `mensagens`            | `session.mensagens`                    |
| `setMensagens`         | `session.setMensagens`                 |
| `colaboradores`        | `session.colaboradores`                |
| `showHistory`          | `session.showHistory`                  |
| `sessoesAnteriores`    | `session.sessoesAnteriores`            |
| `isListening`          | `voz.isListening`                      |
| `modoVozContinuo`      | `voz.modoVozContinuo`                  |
| `interimTranscript`    | `voz.interimTranscript`                |
| `toggleMic`            | `voz.toggleMic`                        |
| `handlePressMic`       | `voz.handlePressMic`                   |
| `handleReleaseMic`     | `voz.handleReleaseMic`                 |
| `isOnline`             | `offline.isOnline`                     |
| `offlineQueue`         | `offline.offlineQueue`                 |
| `offlineForm`          | `offline.offlineForm`                  |
| `setOfflineForm`       | `offline.setOfflineForm`               |
| `offlineSaved`         | `offline.offlineSaved`                 |
| `handleRegistrarOffline` | `offline.handleRegistrarOffline`     |
| `setAcaoStatus`        | `salvar.setAcaoStatus`                 |
| `salvarAcao`           | `salvar.salvarAcao`                    |

### Passo 4 — Remover o arquivo original
Só após testar em dev e tudo funcionar, remova o `SecretariaFlutuante.tsx` antigo.

---

## Regras que evitam as quebras atuais

### Nunca use state para userId/sessaoId em callbacks
```ts
// ❌ Stale closure — o callback captura o valor do primeiro render
const salvarAcao = useCallback(async () => {
  console.log(userId) // pode ser '' mesmo depois do login
}, [])

// ✅ Ref — sempre o valor atual
const salvarAcao = useCallback(async () => {
  console.log(userIdRef.current) // sempre atualizado
}, [userIdRef])
```

### Nunca duplique ref + state para a mesma coisa
```ts
// ❌ Dessincroniza inevitavelmente
const [attachedFile, setAttachedFileState] = useState(null)
const attachedFileRef = useRef(null)
// wrapper manual...

// ✅ Um padrão só
// Se precisa na UI → só state, passa como arg para callbacks
// Se só precisa em handlers → só ref
```

### Sempre liste dependências reais nos useCallback
```ts
// ❌ Dependências vazias = stale
const salvarAcao = useCallback(async (...) => { ... }, [])

// ✅ Lista real
const salvarAcao = useCallback(async (...) => { ... }, [
  supabase, resolverContaPf, resolverContaPj, setMensagens
])
```

### Mantenha IDs de categoria em constants, nunca inline
```ts
// ❌ Hardcoded no meio da função
categoria_id: 'd4f05276-7633-49b3-9d72-09fb0fa07fbe'

// ✅ Importado da constante nomeada
import { CAT_DESPESA_ID } from '../lib/elena-constants'
categoria_id: CAT_DESPESA_ID
```
