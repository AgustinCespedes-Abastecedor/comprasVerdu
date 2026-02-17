# Ejecutar como Administrador. Permite conexiones entrantes al puerto 4000 (backend).
# Esto es necesario para que el celular en la misma red WiFi pueda conectar a la app.

$ruleName = "ComprasVerdu-Backend-4000"
$port = 4000

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "La regla '$ruleName' ya existe."
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow
    Write-Host "Regla creada: el puerto $port esta permitido para conexiones entrantes."
}

Write-Host "`nTu IP en esta red:"
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' }) | ForEach-Object { Write-Host "  $($_.IPAddress) ($($_.InterfaceAlias))" }
