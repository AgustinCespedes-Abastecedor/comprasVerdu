# Reverse proxy: Ticketador + Compras Verdu en paralelo

Un único Nginx en el host escucha en **80** y **443** y reparte el tráfico por dominio:

- **Ticketador** → `proxy_pass` a `http://127.0.0.1:8080`
- **Compras Verdu** → `proxy_pass` a `http://127.0.0.1:8081`

---

## Puerto 80 ocupado por Docker (Ticketador)

Si el puerto 80 lo usa el contenedor **ticket-system-nginx** de Ticketador, ya está resuelto en este repo:

1. **Ticketador** se cambió para escuchar en **8082** y **8443** (en `ticketador/ticket-system/docker-compose.yml`). Reiniciá Ticketador: `cd ticketador/ticket-system && docker compose up -d`.
2. En el **host**, Nginx escucha en 80/443 y reparte por dominio: Ticketador → 8082, Compras Verdu → 8081.
3. Ejecutá (una sola vez):  
   `sudo ./deployment/reverse-proxy/activar-nginx-host-ambos.sh`  
   Ese script instala la config, arranca Nginx y corre Certbot para ambos dominios.

---

## Forma recomendada: usar el script (instala Nginx y Certbot si faltan)

**No hace falta tener Nginx instalado.** El script instala Nginx, el plugin de Certbot para Nginx, crea los directorios necesarios, copia la config y pide el certificado SSL.

Desde la raíz del proyecto:

```bash
# Solo Compras Verdu (agrega el sitio cverdu.elabastecedor.com.ar)
sudo ./deployment/reverse-proxy/instalar-reverse-proxy.sh

# Ticketador + Compras Verdu (ambos en un solo Nginx)
sudo ./deployment/reverse-proxy/instalar-reverse-proxy.sh ambos ticketador.elabastecedor.com.ar
```

Requisitos:

- Debian o Ubuntu (apt).
- DNS: `cverdu.elabastecedor.com.ar` (y el dominio de Ticketador si usás "ambos") apuntando a la IP del servidor.
- Puertos 80 y 443 reenviados al servidor.
- Docker con Compras Verdu en marcha en el puerto 8081.

Después del script:

1. En el `.env` del proyecto: `FRONTEND_URL=https://cverdu.elabastecedor.com.ar`
2. `docker compose up -d` en la raíz del proyecto.

---

## Archivos de configuración (referencia)

| Archivo | Uso |
|---------|-----|
| `cverdu-only.conf` | Solo Compras Verdu. Lo usa el script en modo por defecto. |
| `ambos-ticketador-compras-verdu.conf` | Ticketador + Compras Verdu. Lo usa el script con `ambos`. |

Si en tu servidor **ya tenés Nginx instalado** (por ejemplo para Ticketador) y solo querés agregar Compras Verdu a mano:

```bash
# Crear directorios si no existieran (en Debian/Ubuntu suelen existir)
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
sudo mkdir -p /var/www/certbot

sudo cp deployment/reverse-proxy/cverdu-only.conf /etc/nginx/sites-available/cverdu.elabastecedor.com.ar
sudo ln -sf /etc/nginx/sites-available/cverdu.elabastecedor.com.ar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cverdu.elabastecedor.com.ar
```

(En ese caso necesitás tener ya instalados `nginx` y `certbot` con `python3-certbot-nginx`.)

---

## Requisitos de red

- Forward de puertos **80** y **443** al servidor.
- DNS: dominio de Compras Verdu (`cverdu.elabastecedor.com.ar`) y, si aplica, el de Ticketador, apuntando a la IP del servidor.
- Compras Verdu en Docker escuchando en **8081**; Ticketador, si aplica, en **8080**.

---

## Nginx no arranca: "Job for nginx.service failed"

Suele ser que **el puerto 80 (o 443) ya está en uso** por otro servicio (Apache, otro Nginx, etc.).

**Ver qué usa el puerto 80:**

```bash
sudo ss -tlnp | grep :80
# o
sudo lsof -i :80
```

**Si es Apache** (Ticketador u otro sitio):

- Opción A: usar solo Nginx para todo. Detener Apache y dejar que Nginx escuche en 80/443:
  ```bash
  sudo systemctl stop apache2
  sudo systemctl disable apache2   # opcional, para que no arranque al reiniciar
  sudo systemctl start nginx
  ```
  Luego en Nginx tenés que tener (o agregar) los `server` para Ticketador y para Compras Verdu (modo "ambos" del script).

- Opción B: no instalar Nginx; agregar el proxy de Compras Verdu a la **config de Apache** (virtual host que haga ProxyPass a `http://127.0.0.1:8081` para `cverdu.elabastecedor.com.ar`).

**Si es otro Nginx** (por ejemplo el de Ticketador):

- No hace falta un segundo Nginx. Copiá solo el sitio de Compras Verdu:
  ```bash
  sudo cp deployment/reverse-proxy/cverdu-only.conf /etc/nginx/sites-available/cverdu.elabastecedor.com.ar
  sudo ln -sf /etc/nginx/sites-available/cverdu.elabastecedor.com.ar /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d cverdu.elabastecedor.com.ar
  ```

**Ver el error concreto de Nginx:**

```bash
sudo journalctl -u nginx.service --no-pager -n 30
```

---

## El sitio muestra "No es seguro" (SSL no aplicado)

Si **cverdu.elabastecedor.com.ar** abre pero el navegador lo marca como no seguro, el certificado no se está usando o no existe. Ejecutá:

```bash
cd /home/adm_agustin/comprasVerdu
sudo ./deployment/reverse-proxy/corregir-ssl-cverdu.sh
```

Ese script:

1. Obtiene el certificado Let's Encrypt para **cverdu.elabastecedor.com.ar** (y para Ticketador si falta).
2. Instala la config Nginx con bloques **HTTPS** explícitos (rutas a los certificados en `/etc/letsencrypt/live/...`).
3. Recarga Nginx.

Si después de ejecutarlo sigue apareciendo "no seguro", revisá que no haya otro virtual host que esté atendiendo ese dominio sin SSL, o probá en ventana privada / otro navegador.
