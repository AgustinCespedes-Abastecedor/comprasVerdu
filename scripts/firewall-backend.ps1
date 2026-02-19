# Permitir conexiones entrantes al backend (puerto 4000) para que el celular/APK en LAN pueda conectar.
# Ejecutar como Administrador: PowerShell -ExecutionPolicy Bypass -File scripts\firewall-backend.ps1

# Verificar ejecución como Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "AVISO: Ejecutá este script como Administrador para crear reglas de firewall." -ForegroundColor Yellow
    Write-Host "Clic derecho en PowerShell -> Ejecutar como administrador" -ForegroundColor Gray
    Write-Host "O desde una ventana de Admin: cd '$PSScriptRoot\..'; .\scripts\firewall-backend.ps1" -ForegroundColor Gray
    exit 1
}

$ruleName = "ComprasVerdu-Backend-4000"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "La regla '$ruleName' ya existe. Puerto 4000 permitido para el backend." -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -DisplayName $ruleName `
            -Direction Inbound `
            -LocalPort 4000 `
            -Protocol TCP `
            -Action Allow `
            -Profile Any `
            -Description "Backend Compras Verdu - API para celular/APK en red local"
        Write-Host "Regla de firewall creada: $ruleName (puerto 4000 TCP)" -ForegroundColor Green
    } catch {
        Write-Host "Error al crear regla: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "El celular/emulador en tu red local puede conectar al backend en http://<tu-IP>:4000" -ForegroundColor Cyan
