#!/usr/bin/env bash
# Muestra cómo instalar Node.js 22 LTS en Linux (Capacitor 8 / este repo).
# No modifica el sistema salvo que ejecutes manualmente los comandos indicados.
set -euo pipefail

major="$(node -p "parseInt(process.version.slice(1),10)" 2>/dev/null || echo 0)"

if [[ "${major}" -ge 22 ]]; then
  echo "Node OK para este repo: $(node -v)"
  exit 0
fi

echo ""
echo "Este proyecto requiere Node.js >= 22 (Capacitor CLI 8). Versión actual: $(node -v 2>/dev/null || echo 'no encontrada')."
echo ""
echo "Opción A — Sin tocar la versión global de Node (recomendado): nvm + .nvmrc"
echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
echo "  source \"\$HOME/.nvm/nvm.sh\""
echo "  cd \"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)\""
echo "  nvm install"
echo "  nvm use"
echo "  npm install --prefix frontend && npm run apk:build --prefix frontend"
echo ""
echo "Opción B — Ubuntu/Debian con paquetes (NodeSource):"
echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
echo "  sudo apt-get install -y nodejs"
echo ""
echo "Opción C — Compilar la APK sin Node 22 en esta máquina (solo Docker):"
echo "  cd \"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)\""
echo "  npm run apk:docker"
echo ""
exit 1
