#!/usr/bin/env bash
# =============================================================================
# Activa Nginx en el HOST para Ticketador (8082) + Compras Verdu (8081).
# Ejecutar DESPUÉS de haber cambiado Ticketador a puertos 8082/8443 (puerto 80 libre).
# Uso: sudo ./deployment/reverse-proxy/activar-nginx-host-ambos.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
CERTBOT_WEBROOT="/var/www/certbot"
CONFIG_NAME="elabastecedor-ambos"
TICKETADOR_DOMINIO="ticketador.elabastecedor.com.ar"
CVERDU_DOMINIO="cverdu.elabastecedor.com.ar"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutá con sudo: sudo $0"
  exit 1
fi

# Generar config con HTTPS explícito para ambos dominios
sed "s/TICKETADOR_DOMINIO/$TICKETADOR_DOMINIO/g" "$SCRIPT_DIR/ambos-ticketador-compras-verdu-ssl.conf" > "$NGINX_AVAILABLE/$CONFIG_NAME"
mkdir -p "$CERTBOT_WEBROOT"
# Evitar conflicto con el sitio default de Nginx
rm -f "$NGINX_ENABLED/default" 2>/dev/null || true
ln -sf "$NGINX_AVAILABLE/$CONFIG_NAME" "$NGINX_ENABLED/$CONFIG_NAME"

echo "Configuración instalada: $TICKETADOR_DOMINIO -> 8082, $CVERDU_DOMINIO -> 8081"
nginx -t
systemctl start nginx
systemctl reload nginx
echo "Nginx en el host en marcha."

echo ""
echo "Solicitando certificados SSL (si no existen)..."
for dom in "$TICKETADOR_DOMINIO" "$CVERDU_DOMINIO"; do
  if [ ! -f "/etc/letsencrypt/live/$dom/fullchain.pem" ]; then
    certbot certonly --webroot -w "$CERTBOT_WEBROOT" -d "$dom" --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || true
  fi
done
echo "Recargando Nginx con la config HTTPS..."
nginx -t && systemctl reload nginx
echo "Certificados listos (si Certbot falló para alguno, ejecutá: sudo ./deployment/reverse-proxy/corregir-ssl-cverdu.sh)"

echo ""
echo "=== Listo ==="
echo "  Ticketador:  https://$TICKETADOR_DOMINIO"
echo "  Compras Verdu: https://$CVERDU_DOMINIO"
echo "En el .env de Compras Verdu: FRONTEND_URL=https://$CVERDU_DOMINIO"
