# Despliegue en internet con HTTPS (cverdu.elabastecedor.com.ar)

Guía para exponer Compras Verdu en internet con certificados SSL y el dominio **cverdu.elabastecedor.com.ar**, de forma análoga a Ticketador (puertos 80 y 443).

**Método recomendado (todo en uno):** usar el script que instala Nginx, Certbot con plugin Nginx, crea los directorios, copia la config y pide el certificado. No hace falta tener Nginx instalado antes.

```bash
cd /ruta/al/comprasVerdu
sudo ./deployment/reverse-proxy/instalar-reverse-proxy.sh
```

Para **Ticketador + Compras Verdu** en el mismo Nginx:

```bash
sudo ./deployment/reverse-proxy/instalar-reverse-proxy.sh ambos ticketador.elabastecedor.com.ar
```

Requisitos: Debian/Ubuntu, DNS de `cverdu.elabastecedor.com.ar` apuntando al servidor, puertos 80 y 443 reenviados. Después del script: poner `FRONTEND_URL=https://cverdu.elabastecedor.com.ar` en el `.env` y ejecutar `docker compose up -d`. Ver **`deployment/reverse-proxy/README.md`**.

---

## ¿Solo forward de puertos + DNS alcanza?

**No.** Si solo hacés forward de 80/443 y configurás DNS, en el servidor **nada escucha** en 80/443. Docker expone Compras Verdu en el **8081**. Hace falta un **reverse proxy** (Nginx) que escuche en 80/443, termine SSL y reenvíe al 8081. El script anterior hace esa instalación y configuración.

---

## Si preferís hacerlo a mano (Nginx ya instalado)

Solo si en el servidor **ya tenés** Nginx y Certbot con plugin (`python3-certbot-nginx`) instalados:

1. Forward 80/443 al servidor y DNS de `cverdu.elabastecedor.com.ar` → IP del servidor.
2. Copiar y habilitar el sitio, recargar Nginx, ejecutar Certbot:

```bash
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/certbot
sudo cp deployment/reverse-proxy/cverdu-only.conf /etc/nginx/sites-available/cverdu.elabastecedor.com.ar
sudo ln -sf /etc/nginx/sites-available/cverdu.elabastecedor.com.ar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cverdu.elabastecedor.com.ar
```

3. En el `.env`: `FRONTEND_URL=https://cverdu.elabastecedor.com.ar` y luego `docker compose up -d`.

Si Nginx o Certbot no están instalados, **usá el script** `instalar-reverse-proxy.sh`; instala todo y evita errores de “No existe el archivo o el directorio” o “nginx plugin does not appear to be installed”.

---

## Checklist final

| Paso | Hecho |
|------|--------|
| Forward 80 y 443 al servidor | |
| DNS: cverdu.elabastecedor.com.ar → IP del servidor | |
| Ejecutar script `instalar-reverse-proxy.sh` (o Nginx + Certbot ya instalados y config a mano) | |
| FRONTEND_URL=https://cverdu.elabastecedor.com.ar en .env | |
| Docker (Compras Verdu) corriendo en 8081 | |

Después de eso está listo en `https://cverdu.elabastecedor.com.ar`.

---

## 1. Puertos a abrir en el firewall

Para que la aplicación sea accesible por internet con HTTPS:

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| **80**  | TCP | HTTP: redirección a HTTPS y validación ACME (Let's Encrypt). |
| **443** | TCP | HTTPS: tráfico cifrado de la aplicación. |

**Comandos ejemplo (ufw):**

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 2. Arquitectura recomendada

Compras Verdu en Docker expone solo el puerto **8081** (frontend Nginx). Para usar **80/443** y certificados:

- Un **reverse proxy** en el host (Nginx o Caddy) debe escuchar en **80** y **443**.
- Ese proxy atiende el dominio `cverdu.elabastecedor.com.ar`, termina SSL y reenvía al contenedor en `http://127.0.0.1:8081`.

```
Internet (80/443) → Reverse proxy (host) → Frontend contenedor (8081) → Backend (interno)
                         ↓
                   Certificados SSL
```

Si en el mismo servidor está **Ticketador**, el mismo Nginx/Caddy puede tener dos `server` (o server_name): uno para el dominio de Ticketador y otro para `cverdu.elabastecedor.com.ar`, cada uno con su proxy y sus certificados.

---

## 3. DNS

- Crear un registro **A** (o CNAME) para **cverdu.elabastecedor.com.ar** apuntando a la **IP pública del servidor** donde corre Docker (y el reverse proxy).
- Dejar propagar unos minutos antes de solicitar certificados.

---

## 4. Reverse proxy (ejemplo con Nginx en el host)

En el servidor (fuera de Docker), Nginx escucha 80/443. Ejemplo de sitio para Compras Verdu:

```nginx
# Redirección HTTP → HTTPS
server {
    listen 80;
    server_name cverdu.elabastecedor.com.ar;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;   # Para Let's Encrypt
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    server_name cverdu.elabastecedor.com.ar;

    ssl_certificate     /etc/letsencrypt/live/cverdu.elabastecedor.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cverdu.elabastecedor.com.ar/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Obtener certificados con Certbot (Let's Encrypt):

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d cverdu.elabastecedor.com.ar
```

Luego recargar Nginx: `sudo systemctl reload nginx`.

---

## 5. Variables de entorno del proyecto

En el `.env` en la **raíz** del proyecto:

```env
FRONTEND_URL=https://cverdu.elabastecedor.com.ar
```

Así el backend (CORS y cookies) acepta el origen correcto. El resto de variables (JWT_SECRET, PostgreSQL, EXTERNAL_DB_*, etc.) según `docs/ENV.md`.

---

## 6. Resumen

| Tema | Acción |
|------|--------|
| **Firewall** | Abrir **80** y **443** (TCP). |
| **DNS** | A o CNAME de `cverdu.elabastecedor.com.ar` → IP del servidor. |
| **SSL** | Certificados en el reverse proxy (ej. Certbot + Nginx/Caddy). |
| **Proxy** | Nginx/Caddy en el host: `server_name cverdu.elabastecedor.com.ar`, proxy a `http://127.0.0.1:8081`. |
| **.env** | `FRONTEND_URL=https://cverdu.elabastecedor.com.ar`. |

No hace falta cambiar los puertos internos de Docker (8081:80); el proxy en el host es quien escucha 80/443 y delega al 8081.
