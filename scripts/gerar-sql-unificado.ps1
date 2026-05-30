# Gera um unico SQL com todas as migrations em ordem
$migrationsDir = "d:\projetos visiopro\cajado-sistema01\supabase\migrations"
$outputFile    = "d:\projetos visiopro\cajado-sistema01\scripts\SETUP_BANCO_COMPLETO.sql"

$header = @"
-- =============================================================
-- NEXUM SAAS -- SETUP COMPLETO DO BANCO DE DADOS
-- Cole e execute no SQL Editor do novo projeto Supabase
-- =============================================================

"@
Set-Content $outputFile $header -Encoding UTF8

$migrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
    Where-Object { $_.Name -match "^\d+" } |
    Sort-Object Name

Write-Host "Encontradas: $($migrations.Count) migrations"

foreach ($m in $migrations) {
    $sep = "-- -------------------------------------------------------------`r`n-- MIGRATION: $($m.Name)`r`n-- -------------------------------------------------------------`r`n"
    Add-Content $outputFile $sep -Encoding UTF8
    Get-Content $m.FullName | Add-Content $outputFile -Encoding UTF8
    Add-Content $outputFile "`r`n" -Encoding UTF8
}

$info = Get-Item $outputFile
Write-Host "Arquivo gerado: $outputFile"
Write-Host "Tamanho: $([math]::Round($info.Length/1KB, 1)) KB"
Write-Host "Migrations incluidas: $($migrations.Count)"
