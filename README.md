# Sistema Cajado — Documentação de Setup

Sistema integrado de gestão com 9 módulos: Financeiro, Cajado Empresa, Segurança WhatsApp, Organização, Trader, Investimentos, Patrimônio, Inteligência e Segurança Geral.

## Stack

- **Next.js 14** — App Router, Server Components, Server Actions
- **Supabase** — PostgreSQL, Auth, Realtime, Storage
- **Tailwind CSS** — Estilização
- **TypeScript** — Tipagem completa

---

## 1. Instalação

```bash
npm install
```

---

## 2. Variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais do Supabase:

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

---

## 3. Banco de dados (Supabase)

Execute a migration no SQL Editor do Supabase ou via CLI:

```bash
# Via Supabase CLI
npx supabase db push

# Ou copie e cole no SQL Editor do Supabase Dashboard:
# supabase/migrations/001_schema_inicial.sql
```

---

## 4. Gerar tipos TypeScript do Supabase

Após rodar a migration, gere os tipos automáticos:

```bash
npx supabase gen types typescript \
  --project-id SEU_PROJECT_ID \
  > lib/types/database.ts
```

---

## 5. Rodar em desenvolvimento

```bash
npm run dev
# Acesse: http://localhost:3000
```

---

## Estrutura de pastas

```
cajado-sistema/
├── app/
│   ├── (auth)/login/          # Página de login
│   ├── (dashboard)/           # Layout autenticado
│   │   ├── financeiro/        # M01 — Financeiro
│   │   ├── cajado/            # M02 — Cajado Empresa
│   │   ├── seguranca-wa/      # M03 — Segurança WhatsApp
│   │   ├── organizacao/       # M04 — Organização
│   │   ├── trader/            # M05 — Trader
│   │   ├── investimentos/     # M06 — Investimentos
│   │   ├── patrimonio/        # M07 — Patrimônio
│   │   ├── inteligencia/      # M08 — Inteligência
│   │   └── seguranca-geral/   # M09 — Segurança Geral
│   └── globals.css
├── components/
│   └── shared/
│       ├── sidebar.tsx        # Navegação lateral
│       └── ui.tsx             # Componentes base
├── lib/
│   ├── hooks/useSupabase.ts   # Hooks de acesso ao banco
│   ├── supabase/              # Clientes Supabase (client + server)
│   ├── types/                 # Tipos TypeScript (9 módulos)
│   └── utils/                 # Formatadores e utilitários
├── supabase/migrations/
│   └── 001_schema_inicial.sql # Schema completo (9 módulos)
├── middleware.ts               # Proteção de rotas
└── README.md
```

---

## Módulos

| # | Módulo | Rota | Tabelas principais |
|---|--------|------|-------------------|
| 01 | Financeiro | `/financeiro` | contas, lancamentos, recorrencias, conciliacao_extrato |
| 02 | Cajado Empresa | `/cajado` | leads, atividades, parceiros, campanhas, checkins |
| 03 | Segurança WhatsApp | `/seguranca-wa` | numeros_whatsapp, backup_contatos |
| 04 | Organização | `/organizacao` | projetos, ideias, decisoes |
| 05 | Trader | `/trader` | operacoes, regras_risco |
| 06 | Investimentos | `/investimentos` | ativos, movimentacoes_ativos |
| 07 | Patrimônio | `/patrimonio` | projetos_patrimonio, custos_patrimonio |
| 08 | Inteligência | `/inteligencia` | analises_mercado, tendencias |
| 09 | Segurança Geral | `/seguranca-geral` | log_acesso, audit_log |

---

## Deploy

### Vercel

```bash
vercel --prod
```

Adicione as variáveis de ambiente no painel da Vercel.

### Railway (alternativa)

Configure o Dockerfile ou use detecção automática do Next.js.

---

## Próximos passos após setup

1. Cadastrar a primeira conta no módulo Financeiro
2. Configurar números de WhatsApp no módulo Segurança WA
3. Adicionar membros da equipe em Cajado Empresa
4. Criar o primeiro projeto em Organização
