# Deployment - Compras Verdu

## Reverse proxy (Ticketador + Compras Verdu en paralelo)

Para exponer la app en internet con HTTPS (dominio `cverdu.elabastecedor.com.ar`) y que funcione junto con Ticketador en el mismo servidor, usá los archivos en **`reverse-proxy/`**:

- **`reverse-proxy/README.md`** — instrucciones según si ya tenés Nginx (Ticketador) o instalás desde cero.
- **`reverse-proxy/instalar-reverse-proxy.sh`** — script que instala Nginx, configura el sitio y te guía con Certbot.

---

## Arranque automático y recuperación

Este directorio contiene lo necesario para que Compras Verdu:

1. **Se levante solo** al reiniciar el SO.
2. **(Opcional)** Se auto-recupere cada 5 minutos si alguien bajó los contenedores.

---

## 1. Levantar / recuperar manualmente

Desde la raíz del proyecto:

```bash
cd /home/adm_agustin/comprasVerdu
./levantar.sh
```

O solo subir contenedores sin build:

```bash
docker compose up -d
```

---

## 2. Arranque automático al reiniciar el SO

**Una sola vez:** instalar el servicio systemd.

```bash
cd /home/adm_agustin/comprasVerdu
sudo ./deployment/instalar-servicio.sh
```

El script copia los archivos a `/etc/systemd/system/`, ajusta la ruta del proyecto y habilita el arranque al boot. Opcionalmente habilita el watchdog cada 5 minutos.

**Requisitos:** Docker instalado y habilitado al arranque (`sudo systemctl enable docker`).

| Acción | Comando |
|--------|--------|
| Ver estado | `sudo systemctl status compras-verdu` |
| Levantar ahora | `sudo systemctl start compras-verdu` |
| Bajar contenedores | `sudo systemctl stop compras-verdu` |
| Timer del watchdog | `sudo systemctl list-timers compras-verdu-watchdog` |

---

## 3. Instalación manual (sin el script)

1. Editar en `compras-verdu.service` y `compras-verdu-watchdog.service` la ruta  
   `/home/adm_agustin/comprasVerdu`  
   por la ruta real del proyecto.

2. Copiar y habilitar:

```bash
sudo cp deployment/compras-verdu.service /etc/systemd/system/
sudo cp deployment/compras-verdu-watchdog.service deployment/compras-verdu-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable compras-verdu.service
# Opcional:
sudo systemctl enable compras-verdu-watchdog.timer
sudo systemctl start compras-verdu-watchdog.timer
```

---

## Resumen de archivos

| Archivo | Uso |
|---------|-----|
| `compras-verdu.service` | Servicio systemd: compose up -d al arrancar el SO. |
| `compras-verdu-watchdog.service` | Servicio que ejecuta el timer (compose up -d). |
| `compras-verdu-watchdog.timer` | Timer: cada 5 min ejecuta el watchdog. |
| `instalar-servicio.sh` | Instala y habilita todo con la ruta actual. |
