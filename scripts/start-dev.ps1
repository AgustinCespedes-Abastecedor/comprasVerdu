# Script de inicio completo - Compras Verdu
# Levanta PostgreSQL (Docker), Backend (puerto 4000), Frontend (puerto 5173)
# Ejecutar desde la raíz del proyecto: .\scripts\start-dev.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\package.json")) {
    $projectRoot = Get-Location
}
Set-Location $projectRoot

Write-Host "=== Compras Verdu - Inicio de desarrollo ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Docker y PostgreSQL
if (Test-Path "docker-compose.yml") {
    Write-Host "[1/6] Verificando PostgreSQL (Docker)..." -ForegroundColor Yellow
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Docker no está corriendo. Iniciá Docker Desktop y volvé a ejecutar." -ForegroundColor Red
        exit 1
    }
    cmd /c "docker-compose up -d db 2>nul"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ADVERTENCIA: No se pudo levantar Docker. Si PostgreSQL ya corre en 5433, continuamos." -ForegroundColor Yellow
    } else {
        Write-Host "  PostgreSQL iniciado (puerto 5433)" -ForegroundColor Green
    }
    # Esperar a que PostgreSQL acepte conexiones
    $maxAttempts = 15
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5433)
            $tcp.Close()
            break
        } catch {
            $attempt++
            Start-Sleep -Seconds 2
            if ($attempt -eq $maxAttempts) {
                Write-Host "  ERROR: PostgreSQL no respondió en 5433 tras $maxAttempts intentos." -ForegroundColor Red
                exit 1
            }
        }
    }
    Write-Host "  PostgreSQL listo." -ForegroundColor Green
} else {
    Write-Host "[1/6] Sin docker-compose. Asumimos PostgreSQL ya corre en 5433." -ForegroundColor Yellow
}

# 2. Prisma generate
Write-Host ""
Write-Host "[2/6] Generando cliente Prisma..." -ForegroundColor Yellow
Push-Location backend
try {
    npm run db:generate 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Prisma generate falló" }
    Write-Host "  OK" -ForegroundColor Green
} catch {
    Write-Host "  ERROR en Prisma generate. Cerrá el backend si está corriendo y ejecutá: cd backend && npm run db:generate" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# 3. Aplicar schema y seed
Write-Host ""
Write-Host "[3/6] Aplicando schema a la base de datos..." -ForegroundColor Yellow
Push-Location backend
npm run db:push 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: db:push falló. Verificá DATABASE_URL en backend/.env" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "  Ejecutando seed (usuarios de prueba)..." -ForegroundColor Yellow
npm run db:seed 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ADVERTENCIA: Seed falló. Podés crear usuario manualmente desde /registro" -ForegroundColor Yellow
} else {
    Write-Host "  Usuarios: comprador@comprasverdu.com / admin123, a.cespedes@elabastecedor.com.ar / admin1234" -ForegroundColor Gray
}
Pop-Location

# 4. Firewall (puerto 4000 para APK/celular en LAN)
Write-Host ""
Write-Host "[4/6] Firewall (puerto 4000 para celular/APK en red local)..." -ForegroundColor Yellow
$fwScript = Join-Path $projectRoot "scripts\firewall-backend.ps1"
if (Test-Path $fwScript) {
    try {
        & powershell -ExecutionPolicy Bypass -File $fwScript
    } catch {
        Write-Host "  Ejecutá como Admin para permitir conexiones: PowerShell -ExecutionPolicy Bypass -File scripts\firewall-backend.ps1" -ForegroundColor Yellow
    }
}

# 5. Obtener IP local para .env (APK)
$localIP = $null
try {
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -match "^\d+\.\d+\.\d+\.\d+$" } | Select-Object -First 1).IPAddress
} catch { }
if (-not $localIP) {
    $localIP = (Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4Address.IPAddress } | Select-Object -First 1).IPv4Address.IPAddress
}
if (-not $localIP) { $localIP = "tu-IP" }
Write-Host ""
Write-Host "  IP en LAN: $localIP -> Para APK: VITE_API_URL=http://${localIP}:4000/api en frontend/.env" -ForegroundColor Gray

# 6. Iniciar Backend y Frontend
Write-Host ""
Write-Host "[5/6] Iniciando Backend en nueva ventana (puerto 4000)..." -ForegroundColor Yellow
$backendCmd = "Set-Location '$($projectRoot -replace "'", "''")'; Write-Host 'Backend Compras Verdu - Puerto 4000' -ForegroundColor Cyan; npm run dev:backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Esperar a que el backend arranque
Start-Sleep -Seconds 4

Write-Host "[6/6] Iniciando Frontend (puerto 5173)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Web: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API: http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Para APK: backend accesible en http://${localIP}:4000" -ForegroundColor Gray
Write-Host ""
Write-Host "Cerrá esta ventana para detener el frontend. El backend corre en otra ventana." -ForegroundColor Yellow
Write-Host ""

npm run dev:frontend
