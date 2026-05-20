# Deploy automático a Render
# Este script dispara el webhook de deploy después de hacer push

Write-Host "🚀 Iniciando deploy automático a Render..." -ForegroundColor Cyan

# Leer el webhook URL del archivo .env
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match 'RENDER_DEPLOY_HOOK_URL=(.+)') {
        $deployUrl = $matches[1].Trim()
        Write-Host "📡 URL de deploy encontrada" -ForegroundColor Green
    } else {
        Write-Host "❌ No se encontró RENDER_DEPLOY_HOOK_URL en .env" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host " Archivo .env no encontrado en: $envPath" -ForegroundColor Red
    exit 1
}

# Disparar el webhook
Write-Host "⏳ Disparando deploy..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Method Post -Uri $deployUrl
    if ($response.deploy) {
        Write-Host "✅ Deploy iniciado exitosamente!" -ForegroundColor Green
        Write-Host "🆔 ID: $($response.deploy.id)" -ForegroundColor White
        Write-Host "🔗 Monitorea el progreso en: https://dashboard.render.com" -ForegroundColor Cyan
    } else {
        Write-Host "️ Respuesta inesperada del servidor" -ForegroundColor Yellow
        Write-Host $response
    }
} catch {
    Write-Host "❌ Error al iniciar deploy: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Deploy completado" -ForegroundColor Green
