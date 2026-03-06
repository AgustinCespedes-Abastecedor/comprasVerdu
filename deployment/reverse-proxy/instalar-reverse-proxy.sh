#!/usr/bin/env bash
# =============================================================================
# Instala Nginx + Certbot y configura el reverse proxy para Compras Verdu
# (y opcionalmente Ticketador). Crea directorios si no existen.
#
# Uso (desde la raíz del proyecto):
#   Solo Compras Verdu:
#     sudo ./deployment/reverse-proxy/instalar-reverse-proxy.sh
#   Ticketador + Compras Verdu:
#     sudo ./deployment/reverse-proxy/instalar-reverse-proxy.sh ambos ticketador.elabastecedor.com.ar
#
# Requiere: Debian/Ubuntu (apt). DNS del dominio apuntando a este servidor.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
CERTBOT_WEBROOT="/var/www/certbot"
SITE_CVERDU="cverdu.elabastecedor.com.ar"

MODO="${1:-solo}"
TICKETADOR_DOMINIO="${2:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutá con sudo: sudo $0 [solo|ambos dominio_ticketador]"
  exit 1
fi

if ! command -v apt-get &>/dev/null; then
  echo "Este script está pensado para Debian/Ubuntu (apt-get)."
  echo "En otras distros instalá Nginx y Certbot a mano y usá los .conf de este directorio."
  exit 1
fi

echo "=== Reverse proxy - Compras Verdu (+ opcional Ticketador) ==="
echo "Proyecto: $PROJECT_DIR"
echo ""

# Instalar Nginx y Certbot con plugin Nginx (crea sites-available y sites-enabled)
echo "Instalando Nginx y Certbot (plugin nginx)..."
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

# Asegurar que existan directorios (por si la instalación no los creó)
mkdir -p "$NGINX_AVAILABLE" "$NGINX_ENABLED"
mkdir -p "$CERTBOT_WEBROOT"
echo "  [OK] Nginx y Certbot instalados; directorios listos"

# Habilitar Nginx al arranque (inicio real después de cargar la config)
systemctl enable nginx 2>/dev/null || true

# Configuración según modo
if [ "$MODO" = "ambos" ]; then
  if [ -z "$TICKETADOR_DOMINIO" ]; then
    echo ""
    echo "Modo 'ambos' requiere el dominio de Ticketador. Ejemplo:"
    echo "  sudo $0 ambos ticketador.elabastecedor.com.ar"
    exit 1
  fi
  CONFIG_SRC="$SCRIPT_DIR/ambos-ticketador-compras-verdu.conf"
  CONFIG_DEST="$NGINX_AVAILABLE/elabastecedor-ticketador-compras-verdu"
  sed "s/TICKETADOR_DOMINIO/$TICKETADOR_DOMINIO/g" "$CONFIG_SRC" > "$CONFIG_DEST"
  ln -sf "$CONFIG_DEST" "$NGINX_ENABLED/$(basename "$CONFIG_DEST")"
  echo "  [OK] Config: Ticketador ($TICKETADOR_DOMINIO) + Compras Verdu ($SITE_CVERDU)"
  CERTBOT_DOMINIOS=(-d "$TICKETADOR_DOMINIO" -d "$SITE_CVERDU")
else
  cp "$SCRIPT_DIR/cverdu-only.conf" "$NGINX_AVAILABLE/$SITE_CVERDU"
  ln -sf "$NGINX_AVAILABLE/$SITE_CVERDU" "$NGINX_ENABLED/$SITE_CVERDU"
  echo "  [OK] Config: solo Compras Verdu ($SITE_CVERDU)"
  CERTBOT_DOMINIOS=(-d "$SITE_CVERDU")
fi

echo ""
echo "Comprobando configuración Nginx..."
nginx -t

# Verificar si el puerto 80 ya está en uso (Apache, otro Nginx, etc.)
if command -v ss &>/dev/null; then
  PUERTO80=$(ss -tlnp 2>/dev/null | grep -E ':80\s' || true)
elif command -v netstat &>/dev/null; then
  PUERTO80=$(netstat -tlnp 2>/dev/null | grep -E ':80\s' || true)
else
  PUERTO80=""
fi
if [ -n "$PUERTO80" ] && ! systemctl is-active --quiet nginx 2>/dev/null; then
  echo ""
  echo "  [AVISO] El puerto 80 ya está en uso (otro servicio escucha ahí):"
  echo "  $PUERTO80"
  echo "  Si Ticketador u otro sitio usan Apache/Nginx, tenés dos opciones:"
  echo "  1) Agregar solo el sitio de Compras Verdu a ese Nginx/Apache existente (ver README), o"
  echo "  2) Detener el otro servicio (ej: sudo systemctl stop apache2) y volver a ejecutar este script."
  echo ""
  read -p "¿Seguir igual e intentar arrancar Nginx? [s/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[sS]$ ]]; then
    echo "Abortado. Resolvé el conflicto del puerto 80 y volvé a ejecutar el script."
    exit 1
  fi
fi

echo "Arrancando Nginx..."
if ! systemctl start nginx 2>/dev/null; then
  echo ""
  echo "  [ERROR] Nginx no pudo arrancar. Últimas líneas del log:"
  echo "  ---"
  journalctl -u nginx.service --no-pager -n 20 2>/dev/null || true
  echo "  ---"
  echo ""
  echo "  Causas habituales:"
  echo "  - Puerto 80 o 443 en uso: otro servidor web (Apache, otro Nginx) ya los usa."
  echo "    Solución: detené el otro (ej: sudo systemctl stop apache2) o agregá este sitio a su config."
  echo "  - Permisos: ejecutá el script con sudo."
  echo ""
  echo "  Para más detalle: journalctl -xeu nginx.service"
  exit 1
fi
systemctl reload nginx
echo "  [OK] Nginx en ejecución y config recargada"

# Certificados SSL (no interactivo; si falla por DNS/red se indica al final)
echo ""
echo "Solicitando certificado SSL para $SITE_CVERDU..."
if certbot --nginx "${CERTBOT_DOMINIOS[@]}" --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>/dev/null; then
  echo "  [OK] Certificado SSL instalado; HTTPS activo"
else
  echo "  [AVISO] Certbot no pudo obtener el certificado (revisá DNS y que 80 esté accesible desde internet)."
  echo "  Ejecutá después: sudo certbot --nginx ${CERTBOT_DOMINIOS[*]}"
fi

echo ""
echo "=== Listo ==="
echo "1. En el .env de Compras Verdu poné: FRONTEND_URL=https://$SITE_CVERDU"
echo "2. Reiniciá los contenedores: cd $PROJECT_DIR && docker compose up -d"
echo ""
echo "Acceso: https://$SITE_CVERDU"
