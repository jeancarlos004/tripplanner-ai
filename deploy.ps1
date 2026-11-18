# deploy.ps1
# Script de ayuda para desplegar el Trip Planner A2A

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('validate', 'deploy', 'status', 'update-urls', 'invoke', 'logs', 'cleanup')]
    [string]$Action = 'help',
    
    [Parameter(Mandatory=$false)]
    [string]$Prompt = "Quiero viajar de Bogotá a Cartagena este fin de semana. ¿Qué vuelos hay y cómo estará el clima?"
)

function Show-Help {
    Write-Host "🌍 Trip Planner A2A - Script de Despliegue" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso: .\deploy.ps1 -Action <acción> [-Prompt <texto>]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Acciones disponibles:" -ForegroundColor Green
    Write-Host "  validate     - Valida la configuración de agentcore.json"
    Write-Host "  deploy       - Despliega todos los agentes a AWS"
    Write-Host "  status       - Muestra el estado y URLs de los agentes"
    Write-Host "  update-urls  - Ayuda a actualizar las URLs en agentcore.json"
    Write-Host "  invoke       - Invoca el orquestrador con un prompt (usar -Prompt)"
    Write-Host "  logs         - Muestra los logs del orquestrador"
    Write-Host "  cleanup      - Elimina todos los agentes desplegados"
    Write-Host ""
    Write-Host "Ejemplos:" -ForegroundColor Magenta
    Write-Host "  .\deploy.ps1 -Action validate"
    Write-Host "  .\deploy.ps1 -Action deploy"
    Write-Host "  .\deploy.ps1 -Action status"
    Write-Host "  .\deploy.ps1 -Action invoke -Prompt 'Busca vuelos a Medellín'"
    Write-Host ""
}

function Validate-Config {
    Write-Host "🔍 Validando configuración..." -ForegroundColor Cyan
    agentcore validate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Configuración válida" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en la configuración" -ForegroundColor Red
        exit 1
    }
}

function Deploy-Agents {
    Write-Host "🚀 Desplegando agentes a AWS..." -ForegroundColor Cyan
    Write-Host ""
    
    # Validar primero
    Validate-Config
    
    Write-Host ""
    Write-Host "📦 Iniciando despliegue..." -ForegroundColor Yellow
    agentcore deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Despliegue completado" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANTE: Ahora debes actualizar las URLs" -ForegroundColor Yellow
        Write-Host "Ejecuta: .\deploy.ps1 -Action status" -ForegroundColor Cyan
        Write-Host "Luego:   .\deploy.ps1 -Action update-urls" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Error en el despliegue" -ForegroundColor Red
        exit 1
    }
}

function Show-Status {
    Write-Host "📊 Estado de los agentes:" -ForegroundColor Cyan
    Write-Host ""
    agentcore status
    Write-Host ""
    Write-Host "💡 Copia las URLs de FlightsAgent y WeatherAgent" -ForegroundColor Yellow
    Write-Host "   y actualiza agentcore.json con: .\deploy.ps1 -Action update-urls" -ForegroundColor Yellow
}

function Update-URLs {
    Write-Host "🔧 Actualizador de URLs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Obtén las URLs con: .\deploy.ps1 -Action status" -ForegroundColor Yellow
    Write-Host ""
    
    $flightsUrl = Read-Host "Ingresa la URL del FlightsAgent"
    $weatherUrl = Read-Host "Ingresa la URL del WeatherAgent"
    
    if ([string]::IsNullOrWhiteSpace($flightsUrl) -or [string]::IsNullOrWhiteSpace($weatherUrl)) {
        Write-Host "❌ URLs no pueden estar vacías" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "📝 Actualizando agentcore.json..." -ForegroundColor Cyan
    
    # Leer el archivo
    $config = Get-Content "agentcore.json" -Raw | ConvertFrom-Json
    
    # Actualizar las envVars del OrchestratorAgent
    foreach ($runtime in $config.runtimes) {
        if ($runtime.name -eq "OrchestratorAgent") {
            foreach ($envVar in $runtime.envVars) {
                if ($envVar.name -eq "FLIGHTS_AGENT_URL") {
                    $envVar.value = $flightsUrl
                }
                if ($envVar.name -eq "WEATHER_AGENT_URL") {
                    $envVar.value = $weatherUrl
                }
            }
        }
    }
    
    # Guardar el archivo
    $config | ConvertTo-Json -Depth 10 | Set-Content "agentcore.json"
    
    Write-Host "✅ URLs actualizadas correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ahora redespliega el orquestador con: agentcore deploy" -ForegroundColor Yellow
}

function Invoke-Orchestrator {
    Write-Host "🎯 Invocando el orquestador..." -ForegroundColor Cyan
    Write-Host "Prompt: $Prompt" -ForegroundColor Yellow
    Write-Host ""
    
    $payload = @{
        prompt = $Prompt
    } | ConvertTo-Json -Compress
    
    agentcore invoke --runtime OrchestratorAgent --payload $payload
}

function Show-Logs {
    Write-Host "📜 Logs del OrchestratorAgent:" -ForegroundColor Cyan
    Write-Host ""
    agentcore logs --runtime OrchestratorAgent
}

function Cleanup-Agents {
    Write-Host "🗑️  Limpiando agentes..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  ADVERTENCIA: Esto eliminará todos los agentes desplegados" -ForegroundColor Red
    $confirm = Read-Host "¿Estás seguro? (s/N)"
    
    if ($confirm -eq "s" -or $confirm -eq "S") {
        Write-Host ""
        Write-Host "Eliminando agentes..." -ForegroundColor Yellow
        agentcore delete --all
        Write-Host "✅ Agentes eliminados" -ForegroundColor Green
    } else {
        Write-Host "❌ Operación cancelada" -ForegroundColor Yellow
    }
}

# Main execution
switch ($Action) {
    'validate' { Validate-Config }
    'deploy' { Deploy-Agents }
    'status' { Show-Status }
    'update-urls' { Update-URLs }
    'invoke' { Invoke-Orchestrator }
    'logs' { Show-Logs }
    'cleanup' { Cleanup-Agents }
    default { Show-Help }
}
