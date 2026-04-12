# Deploy Sistema Cajado no Railway
## Guia passo a passo

---

## Pré-requisitos

- Conta GitHub da Cajado com o repositório do sistema
- Conta Railway nova (cajado@...)
- Projeto Supabase criado e schema rodado

---

## Passo 1 — Adicionar arquivos ao repositório

Copie estes arquivos para a raiz do projeto `cajado-sistema`:

```
Dockerfile          ← build da imagem Docker
railway.json        ← configuração do Railway
next.config.ts      ← substitui o existente (adiciona output: standalone)
app/api/health/route.ts  ← health check
```

Commit e push:

```bash
git add Dockerfile railway.json next.config.ts app/api/health/route.ts
git commit -m "chore: Railway deploy config"
git push origin main
```

---

## Passo 2 — Criar conta no Railway

1. Acesse [railway.app](https://railway.app)
2. **Sign up** com o e-mail da Cajado
3. Conecte com a conta **GitHub da Cajado**
4. Confirme o acesso ao repositório `cajado-sistema`

---

## Passo 3 — Criar o projeto

1. No painel do Railway → **New Project**
2. Escolha **Deploy from GitHub repo**
3. Selecione o repositório `cajado-sistema`
4. Railway detecta o `Dockerfile` automaticamente
5. Clique em **Deploy Now**

---

## Passo 4 — Configurar variáveis de ambiente

1. Clique no serviço criado
2. Vá em **Variables**
3. Clique em **+ New Variable** e adicione uma a uma:

```
NEXT_PUBLIC_SUPABASE_URL        = https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = sua_anon_key
SUPABASE_SERVICE_ROLE_KEY       = sua_service_role_key
NEXT_PUBLIC_INBOX_API_URL       = https://cajado-inbox-backend.up.railway.app
NEXT_PUBLIC_APP_NAME            = Sistema Cajado
OPENROUTER_API_KEY              = sua_chave_openrouter
JWT_SECRET                      = cajado-secret-2025
```

4. Após adicionar todas, o Railway faz **redeploy automático**

---

## Passo 5 — Pegar a URL e atualizar

1. Após o deploy, clique em **Settings** → **Networking**
2. Copie a URL gerada (ex: `cajado-sistema-production.up.railway.app`)
3. Volte em **Variables** e adicione:
   ```
   NEXT_PUBLIC_APP_URL = https://cajado-sistema-production.up.railway.app
   ```
4. Railway faz redeploy automático novamente

---

## Passo 6 — Verificar se está funcionando

Acesse no navegador:
```
https://cajado-sistema-production.up.railway.app/api/health
```

Deve retornar:
```json
{
  "status": "ok",
  "app": "Sistema Cajado",
  "timestamp": "2025-04-05T..."
}
```

Se retornar JSON → deploy OK. Acesse a URL principal e faça login.

---

## Domínio customizado (opcional)

1. No Railway → Settings → **Networking** → **Custom Domain**
2. Digite o domínio desejado (ex: `app.cajadosolucoes.com.br`)
3. Copie o CNAME gerado
4. No seu provedor DNS (Registro.br ou CloudFlare):
   - Crie um registro **CNAME**
   - Nome: `app`
   - Valor: o CNAME do Railway
5. Aguarde propagação (5 a 30 minutos)

---

## Para cada novo cliente (template)

O fluxo se repete:

```
1. Criar conta Railway com e-mail do cliente
2. Fazer fork do repositório cajado-sistema
3. Deploy from GitHub no Railway
4. Configurar variáveis com os dados do Supabase do cliente
5. Configurar domínio customizado do cliente
```

Tempo médio por cliente: ~20 minutos.

---

## Troubleshooting

| Problema | Solução |
|---|---|
| Build falha | Verifique se `output: 'standalone'` está no `next.config.ts` |
| Health check falha | Verifique se o arquivo `app/api/health/route.ts` está no repo |
| Tela branca após login | Verifique as variáveis de Supabase no Railway |
| Inbox não conecta | Verifique `NEXT_PUBLIC_INBOX_API_URL` apontando para o backend correto |
