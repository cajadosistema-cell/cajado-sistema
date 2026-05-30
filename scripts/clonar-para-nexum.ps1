# =============================================================
# CLONAR CAJADO-SISTEMA -> NEXUM (Novo Produto)
# =============================================================

$ORIGEM  = "d:\projetos visiopro\cajado-sistema01"
$DESTINO = "d:\projetos visiopro\nexum"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  CLONANDO PROJETO -> NEXUM" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Verificar se destino ja existe
if (Test-Path $DESTINO) {
    Write-Host "Pasta '$DESTINO' ja existe!" -ForegroundColor Red
    $confirma = Read-Host "Deletar e recriar? (s/N)"
    if ($confirma -ne "s" -and $confirma -ne "S") { exit 0 }
    Remove-Item -Recurse -Force $DESTINO
}

# ---- COPIAR (excluindo pastas pesadas) ----
Write-Host "`n[1/4] Copiando arquivos..." -ForegroundColor Yellow

robocopy $ORIGEM $DESTINO /E /XD ".git" "node_modules" ".next" ".turbo" "dist" "build" /XF "*.log" /NFL /NDL /NJH /NJS

Write-Host "OK: Arquivos copiados!" -ForegroundColor Green

# ---- REMOVER ARQUIVOS SENSIVEIS ----
Write-Host "`n[2/4] Removendo arquivos sensiveis..." -ForegroundColor Yellow

$arquivos = @(".env", ".env.local", ".env.production", ".env.development")
foreach ($f in $arquivos) {
    $path = "$DESTINO\$f"
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "   Removido: $f" -ForegroundColor Gray
    }
}

# Criar .env.local vazio com template
$template = @"
# ============================================================
# NEXUM -- Variaveis de Ambiente
# Preencha com as credenciais da nova conta Supabase
# ============================================================

# Supabase (nova conta)
NEXT_PUBLIC_SUPABASE_URL=https://SEU_NOVO_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=https://nexum.com.br

# Backend WhatsApp (novo Railway)
INBOX_BACKEND_URL=https://SEU_BACKEND.railway.app

# OpenAI (Elena AI)
OPENAI_API_KEY=

# Resend (email)
RESEND_API_KEY=

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
"@

$template | Set-Content "$DESTINO\.env.local" -Encoding UTF8
Write-Host "OK: .env.local criado (template vazio)" -ForegroundColor Green

# ---- INICIAR NOVO REPOSITORIO GIT ----
Write-Host "`n[3/4] Iniciando novo repositorio Git..." -ForegroundColor Yellow

Set-Location $DESTINO
git init
git add .
git commit -m "feat: initial commit -- Nexum SaaS (fork cajado-sistema)"

Write-Host "OK: Repositorio Git iniciado!" -ForegroundColor Green

# ---- INSTRUCOES FINAIS ----
Write-Host "`n[4/4] PROXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. GITHUB -- Criar novo repositorio:" -ForegroundColor White
Write-Host "   -> github.com -> New repository -> 'nexum'" -ForegroundColor Gray
Write-Host "   git remote add origin https://github.com/SEU_USER/nexum.git" -ForegroundColor DarkCyan
Write-Host "   git push -u origin main" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "2. SUPABASE -- Nova conta:" -ForegroundColor White
Write-Host "   -> Criar projeto em supabase.com" -ForegroundColor Gray
Write-Host "   -> SQL Editor -> rodar as migrations em ordem" -ForegroundColor Gray
Write-Host "   -> Migrations em: supabase\migrations\" -ForegroundColor Gray
Write-Host "   -> Copiar URL e KEYS para o .env.local" -ForegroundColor Gray
Write-Host ""
Write-Host "3. RAILWAY -- Novo servico:" -ForegroundColor White
Write-Host "   -> Conectar novo repo GitHub" -ForegroundColor Gray
Write-Host "   -> Adicionar as variaveis de ambiente" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ABRIR NO ANTIGRAVITY:" -ForegroundColor White
Write-Host "   -> File -> Open Folder -> $DESTINO" -ForegroundColor Gray
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "OK: Projeto Nexum criado em: $DESTINO" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

# Abrir a pasta no Explorer
explorer $DESTINO
