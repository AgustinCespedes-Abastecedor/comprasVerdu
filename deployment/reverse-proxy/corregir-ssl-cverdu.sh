#!/usr/bin/env bash
# =============================================================================
# Corrige SSL para cverdu.elabastecedor.com.ar: obtiene certificado si falta
# y despliega la config Nginx con bloques HTTPS explícitos.
# Uso: sudo ./deployment/reverse-proxy/corregir-ssl-cverdu.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
CERTBOT_WEBROOT="/var/www/certbot"
CONFIG_NAME="elabastecedor-ambos"
TICKETADOR_DOMINIO="ticketador.elabastecedor.com.ar"
CVERDU_DOMINIO="cverdu.elabastecedor.com.ar"
LE_LIVE="/etc/letsencrypt/live"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutá con sudo: sudo $0"
  exit 1
fi

echo "=== Corregir SSL - cverdu.elabastecedor.com.ar ==="
mkdir -p "$CERTBOT_WEBROOT"

# 1. Obtener certificado para Compras Verdu si no existe
if [ ! -f "$LE_LIVE/$CVERDU_DOMINIO/fullchain.pem" ] || [ ! -f "$LE_LIVE/$CVERDU_DOMINIO/privkey.pem" ]; then
  echo "Obteniendo certificado SSL para $CVERDU_DOMINIO..."
  certbot certonly --webroot -w "$CERTBOT_WEBROOT" -d "$CVERDU_DOMINIO" \
    --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || \
  certbot certonly --webroot -w "$CERTBOT_WEBROOT" -d "$CVERDU_DOMINIO" --agree-tos --register-unsafely-without-email
  echo "  [OK] Certificado obtenido."
else
  echo "Certificado para $CVERDU_DOMINIO ya existe."
fi

# 2. Asegurar certificado para Ticketador (por si solo se había configurado cverdu)
if [ ! -f "$LE_LIVE/$TICKETADOR_DOMINIO/fullchain.pem" ]; then
  echo "Obteniendo certificado SSL para $TICKETADOR_DOMINIO..."
  certbot certonly --webroot -w "$CERTBOT_WEBROOT" -d "$TICKETADOR_DOMINIO" \
    --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || true
fi

# 3. Desplegar config Nginx con HTTPS explícito para ambos dominios
sed "s/TICKETADOR_DOMINIO/$TICKETADOR_DOMINIO/g" "$SCRIPT_DIR/ambos-ticketador-compras-verdu-ssl.conf" > "$NGINX_AVAILABLE/$CONFIG_NAME"
ln -sf "$NGINX_AVAILABLE/$CONFIG_NAME" "$NGINX_ENABLED/$CONFIG_NAME"

echo "Configuración Nginx con HTTPS instalada."
nginx -t
systemctl reload nginx
echo "  [OK] Nginx recargado."

echo ""
echo "=== Listo ==="
echo "  https://$TICKETADOR_DOMINIO"
echo "  https://$CVERDU_DOMINIO"
echo "Si el navegador sigue mostrando 'no seguro', probá en ventana privada o borrá caché."
