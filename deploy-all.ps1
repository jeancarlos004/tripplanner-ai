# deploy-all.ps1 — Despliegue completo y reproducible de TripPlanner AI
#
#   .\deploy-all.ps1                 # todo: backend → agentes → frontend
#   .\deploy-all.ps1 -Step backend   # solo SAM (Cognito, API Gateway, Lambdas, DynamoDB, S3, CloudFront)
#   .\deploy-all.ps1 -Step agents    # solo AgentCore (Orchestrator, Flights, Weather)
#   .\deploy-all.ps1 -Step frontend  # build de React + publicación en S3 + invalidación de CloudFront
#
# Requisitos: AWS CLI v2 con credenciales, AWS SAM CLI, Node 18+, agentcore CLI, uv.

param(
    [ValidateSet('all', 'backend', 'agents', 'frontend')]
    [string]$Step = 'all',
    [string]$Region = 'us-east-2',
    [string]$StackName = 'tripplanner-backend'
)

$ErrorActionPreference = 'Stop'
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'tripplanner-web\backend'
$Frontend = Join-Path $Root 'tripplanner-web\frontend\tripplanner-frontend'

function Section($t) { Write-Host "`n━━ $t ━━" -ForegroundColor Cyan }
function Check($ok, $msg) { if (-not $ok) { Write-Host "❌ $msg" -ForegroundColor Red; exit 1 } }

function Write-NoBom($path, $text) {
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-StackOutputs {
    $json = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' --output json
    Check ($LASTEXITCODE -eq 0) "No se encontró el stack $StackName. Ejecuta primero -Step backend."
    $out = @{}
    ($json | ConvertFrom-Json) | ForEach-Object { $out[$_.OutputKey] = $_.OutputValue }
    return $out
}

function Get-OrchestratorArn {
    $state = Get-Content (Join-Path $Root 'agentcore\.cli\deployed-state.json') -Raw | ConvertFrom-Json
    return $state.targets.default.resources.runtimes.OrchestratorAgent.runtimeArn
}

function Deploy-Backend {
    Section 'Backend serverless (AWS SAM)'
    Push-Location $Backend
    try {
        $arn = Get-OrchestratorArn
        sam.cmd validate --lint;                      Check ($LASTEXITCODE -eq 0) 'Plantilla SAM inválida'
        sam.cmd build;                                Check ($LASTEXITCODE -eq 0) 'sam build falló'
        sam.cmd deploy --no-fail-on-empty-changeset --region $Region `
            --parameter-overrides "OrchestratorRuntimeArn=$arn"
        Check ($LASTEXITCODE -eq 0) 'sam deploy falló'
    } finally { Pop-Location }
    $o = Get-StackOutputs
    Write-Host "✅ API: $($o.ApiUrl)" -ForegroundColor Green
    Write-Host "✅ Frontend: $($o.FrontendUrl)" -ForegroundColor Green
}

function Sync-AgentApiUrl {
    # Mantiene TRIPPLANNER_API_URL del Orchestrator alineada con la salida del stack
    $o = Get-StackOutputs
    $path = Join-Path $Root 'agentcore\agentcore.json'
    $cfg = Get-Content $path -Raw | ConvertFrom-Json
    $orch = $cfg.runtimes | Where-Object { $_.name -eq 'OrchestratorAgent' }
    $var = $orch.envVars | Where-Object { $_.name -eq 'TRIPPLANNER_API_URL' }
    if ($var.value -ne $o.ApiUrl) {
        $var.value = $o.ApiUrl
        Write-NoBom $path ($cfg | ConvertTo-Json -Depth 20)
        Write-Host "🔧 TRIPPLANNER_API_URL actualizado a $($o.ApiUrl)" -ForegroundColor Yellow
    }
}

function Deploy-Agents {
    Section 'Agentes (Amazon Bedrock AgentCore)'
    Push-Location $Root
    try {
        Sync-AgentApiUrl
        agentcore validate;   Check ($LASTEXITCODE -eq 0) 'agentcore.json inválido'
        agentcore deploy -y;  Check ($LASTEXITCODE -eq 0) 'agentcore deploy falló'
    } finally { Pop-Location }
    Write-Host '✅ Orchestrator, Flights Agent y Weather Agent desplegados' -ForegroundColor Green
}

function Deploy-Frontend {
    Section 'Frontend (React → S3 + CloudFront)'
    $o = Get-StackOutputs
    $arn = Get-OrchestratorArn
    # Solo identificadores públicos. NINGUNA credencial AWS.
    $envLines = @(
        "VITE_AWS_REGION=$Region"
        "VITE_API_URL=$($o.ApiUrl)"
        "VITE_ORCHESTRATOR_ARN=$arn"
        "VITE_USER_POOL_ID=$($o.UserPoolId)"
        "VITE_USER_POOL_CLIENT_ID=$($o.UserPoolClientId)"
        "VITE_IDENTITY_POOL_ID=$($o.IdentityPoolId)"
    )
    Write-NoBom (Join-Path $Frontend '.env.production') (($envLines -join "`n") + "`n")
    # Misma configuración para desarrollo local (npm run dev); tiene prioridad sobre .env.local
    Write-NoBom (Join-Path $Frontend '.env.development.local') (($envLines -join "`n") + "`n")

    Push-Location $Frontend
    try {
        npm ci;         Check ($LASTEXITCODE -eq 0) 'npm ci falló'
        npm run build;  Check ($LASTEXITCODE -eq 0) 'npm run build falló'
        aws s3 sync dist "s3://$($o.FrontendBucketName)" --delete --region $Region `
            --exclude 'index.html' --cache-control 'public,max-age=31536000,immutable'
        aws s3 cp dist/index.html "s3://$($o.FrontendBucketName)/index.html" --region $Region `
            --cache-control 'no-cache' --content-type 'text/html'
        Check ($LASTEXITCODE -eq 0) 'Subida a S3 falló'
        aws cloudfront create-invalidation --distribution-id $o.FrontendDistributionId --paths '/*' | Out-Null
    } finally { Pop-Location }
    Write-Host "✅ Frontend publicado: $($o.FrontendUrl)" -ForegroundColor Green
}

switch ($Step) {
    'backend'  { Deploy-Backend }
    'agents'   { Deploy-Agents }
    'frontend' { Deploy-Frontend }
    'all'      { Deploy-Backend; Deploy-Agents; Deploy-Frontend }
}
