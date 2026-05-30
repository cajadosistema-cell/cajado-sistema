# =============================================================
# SCRIPT DE MIGRAÇÃO PARA NOVA CONTA SUPABASE
# Cajado Sistema → Novo Produto SaaS
# =============================================================
# PRÉ-REQUISITOS:
#   1. Supabase CLI instalado: npm install -g supabase
#   2. Nova conta criada em https://supabase.com
#   3. Novo projeto criado na nova conta
# =============================================================

# ---- CONFIGURAÇÕES — PREENCHA ANTES DE RODAR ----
$NOVO_PROJECT_ID  = "SEU_NOVO_PROJECT_ID"   # Ex: abcdefghijklmnop
$NOVO_DB_HOST     = "db.SEU_PROJECT_ID.supabase.co"
$NOVO_DB_PASSWORD = "SUA_NOVA_SENHA_DB"
$NOVO_DB_PORT     = "5432"
$NOVO_DB_USER     = "postgres"
$NOVO_DB_NAME     = "postgres"

# DB da conta ANTIGA (para exportar dados)
$ANTIGO_DB_HOST     = "db.SEU_ANTIGO_PROJECT_ID.supabase.co"
$ANTIGO_DB_PASSWORD = "SUA_SENHA_ANTIGA"
$ANTIGO_DB_PORT     = "5432"
$ANTIGO_DB_USER     = "postgres"
$ANTIGO_DB_NAME     = "postgres"

# Pasta do projeto
$PROJETO_DIR = "d:\projetos visiopro\cajado-sistema01"
$MIGRATIONS_DIR = "$PROJETO_DIR\supabase\migrations"
$BACKUP_DIR = "$PROJETO_DIR\scripts\backup"
# --------------------------------------------------

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  MIGRAÇÃO SUPABASE — CAJADO SISTEMA" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Criar pasta de backup
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# =============================================================
# PASSO 1: VERIFICAR SUPABASE CLI
# =============================================================
Write-Host "`n[1/5] Verificando Supabase CLI..." -ForegroundColor Yellow
try {
    $version = supabase --version 2>&1
    Write-Host "✅ Supabase CLI encontrado: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI não encontrado. Instalando..." -ForegroundColor Red
    npm install -g supabase
}

# =============================================================
# PASSO 2: LOGIN NA NOVA CONTA
# =============================================================
Write-Host "`n[2/5] Fazendo login no Supabase..." -ForegroundColor Yellow
Write-Host "   → Uma janela do browser vai abrir para autenticar" -ForegroundColor Gray
supabase login

# =============================================================
# PASSO 3: LINKAR PROJETO COM A NOVA CONTA
# =============================================================
Write-Host "`n[3/5] Linkando com o novo projeto..." -ForegroundColor Yellow
Set-Location $PROJETO_DIR

if ($NOVO_PROJECT_ID -eq "SEU_NOVO_PROJECT_ID") {
    Write-Host "❌ ERRO: Preencha o NOVO_PROJECT_ID no topo do script!" -ForegroundColor Red
    exit 1
}

supabase link --project-ref $NOVO_PROJECT_ID --password $NOVO_DB_PASSWORD

# =============================================================
# PASSO 4: APLICAR TODAS AS MIGRATIONS NA NOVA CONTA
# =============================================================
Write-Host "`n[4/5] Aplicando migrations na nova conta..." -ForegroundColor Yellow
Write-Host "   → Serão aplicadas todas as migrations em ordem" -ForegroundColor Gray

# Lista migrations em ordem
$migrations = Get-ChildItem -Path $MIGRATIONS_DIR -Filter "*.sql" | 
    Where-Object { $_.Name -match "^\d+" } |  # apenas as numeradas
    Sort-Object Name

Write-Host "   → $($migrations.Count) migrations encontradas" -ForegroundColor Gray

# Aplica via supabase db push (aplica todas as migrations pendentes)
Write-Host "`n   Executando: supabase db push" -ForegroundColor Gray
supabase db push --password $NOVO_DB_PASSWORD

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migrations aplicadas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Algumas migrations podem ter falhado. Verifique o log acima." -ForegroundColor Yellow
    Write-Host "   Você pode aplicar manualmente pelo Dashboard do Supabase." -ForegroundColor Gray
}

# =============================================================
# PASSO 5: EXPORTAR DADOS DO BANCO ANTIGO (opcional)
# =============================================================
Write-Host "`n[5/5] Exportar dados do banco ANTIGO?" -ForegroundColor Yellow
$exportar = Read-Host "   Deseja exportar os dados da Cajado Soluções? (s/N)"

if ($exportar -eq "s" -or $exportar -eq "S") {
    Write-Host "   → Verificando pg_dump..." -ForegroundColor Gray
    
    # Verificar se pg_dump está disponível
    $pgdump = Get-Command pg_dump -ErrorAction SilentlyContinue
    if (-not $pgdump) {
        Write-Host "   ⚠️  pg_dump não encontrado. Instale o PostgreSQL client." -ForegroundColor Yellow
        Write-Host "   Download: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    } else {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = "$BACKUP_DIR\backup_cajado_$timestamp.sql"
        
        Write-Host "   → Exportando dados do banco antigo para:" -ForegroundColor Gray
        Write-Host "      $backupFile" -ForegroundColor Gray
        
        $env:PGPASSWORD = $ANTIGO_DB_PASSWORD
        
        # Exportar apenas dados (schema já foi aplicado pelas migrations)
        pg_dump `
            --host=$ANTIGO_DB_HOST `
            --port=$ANTIGO_DB_PORT `
            --username=$ANTIGO_DB_USER `
            --dbname=$ANTIGO_DB_NAME `
            --data-only `
            --no-privileges `
            --no-owner `
            --exclude-table=schema_migrations `
            --file=$backupFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Dados exportados: $backupFile" -ForegroundColor Green
            
            # Importar no novo banco
            $importar = Read-Host "   Importar dados no novo banco agora? (s/N)"
            if ($importar -eq "s" -or $importar -eq "S") {
                Write-Host "   → Importando dados no novo banco..." -ForegroundColor Gray
                $env:PGPASSWORD = $NOVO_DB_PASSWORD
                
                psql `
                    --host=$NOVO_DB_HOST `
                    --port=$NOVO_DB_PORT `
                    --username=$NOVO_DB_USER `
                    --dbname=$NOVO_DB_NAME `
                    --file=$backupFile
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Dados importados com sucesso!" -ForegroundColor Green
                } else {
                    Write-Host "⚠️  Erro na importação. Verifique o arquivo: $backupFile" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "❌ Falha ao exportar. Verifique as credenciais do banco antigo." -ForegroundColor Red
        }
        
        $env:PGPASSWORD = ""
    }
}

# =============================================================
# RESUMO FINAL
# =============================================================
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  PRÓXIMOS PASSOS MANUAIS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copie as novas credenciais do Supabase:" -ForegroundColor White
Write-Host "   → Dashboard → Settings → API" -ForegroundColor Gray
Write-Host "   → SUPABASE_URL (novo)" -ForegroundColor Gray
Write-Host "   → SUPABASE_ANON_KEY (nova)" -ForegroundColor Gray
Write-Host "   → SUPABASE_SERVICE_ROLE_KEY (nova)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Atualize o .env.local do projeto:" -ForegroundColor White
Write-Host "   NEXT_PUBLIC_SUPABASE_URL=https://NOVO_ID.supabase.co" -ForegroundColor Gray
Write-Host "   NEXT_PUBLIC_SUPABASE_ANON_KEY=nova_chave_aqui" -ForegroundColor Gray
Write-Host "   SUPABASE_SERVICE_ROLE_KEY=nova_service_key_aqui" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Atualize as variáveis no Railway:" -ForegroundColor White
Write-Host "   → Railway Dashboard → seu serviço → Variables" -ForegroundColor Gray
Write-Host "   → Substituir SUPABASE_URL e chaves" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Configure Auth no novo projeto:" -ForegroundColor White
Write-Host "   → Authentication → URL Configuration" -ForegroundColor Gray
Write-Host "   → Site URL = seu domínio de produção" -ForegroundColor Gray
Write-Host "   → Redirect URLs = domínio/auth/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Recrie os buckets Storage:" -ForegroundColor White
Write-Host "   → Storage → New Bucket" -ForegroundColor Gray
Write-Host "   → 'avatars' (público)" -ForegroundColor Gray
Write-Host "   → 'inbox-media' (público)" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Migração concluída!" -ForegroundColor Green
