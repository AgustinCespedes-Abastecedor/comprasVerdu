import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { proveedoresRouter } from './routes/proveedores.js';
import { productosRouter } from './routes/productos.js';
import { comprasRouter } from './routes/compras.js';
import { recepcionesRouter } from './routes/recepciones.js';
import { infoFinalArticulosRouter } from './routes/infoFinalArticulos.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter } from './routes/roles.js';
import { logsRouter } from './routes/logs.js';
import { trazabilidadRouter } from './routes/trazabilidad.js';
import { notificationsRouter } from './routes/notifications.js';
import { authMiddleware } from './middleware/auth.js';
import { sendError, MSG } from './lib/errors.js';
import { getJwtSecret } from './lib/config.js';

// En producción exige JWT_SECRET válido al arrancar (evita secret por defecto)
try {
  getJwtSecret();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== 'false') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const limiterGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Demasiadas peticiones. Intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de acceso. Intentá en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiterGlobal);
app.use('/api/auth/login', limiterAuth);
app.use('/api/auth/registro', limiterAuth);

// Orígenes permitidos: FRONTEND_URL + dev + Capacitor + LAN (cualquiera en la misma red/organización)
const allowedOrigins = [
  FRONTEND_URL,
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,  // LAN típica
  /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,   // Red interna 10.x.x.x
  /^https?:\/\/10\.0\.2\.\d+(:\d+)?$/,       // Emulador Android
  /** Producción típica Compras Verdu detrás de subdominio elabastecedor.com.ar */
  /^https:\/\/[a-z0-9-]+\.elabastecedor\.com\.ar$/i,
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);  // apps nativas (Origin null)
    const ok = allowedOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin));
    cb(null, ok);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 400, MSG.JSON_INVALIDO, 'GEN_001');
  }
  next(err);
});

const runAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use('/api/auth', authRouter);
app.use('/api/proveedores', runAsync(authMiddleware), proveedoresRouter);
app.use('/api/productos', runAsync(authMiddleware), productosRouter);
app.use('/api/compras', runAsync(authMiddleware), comprasRouter);
app.use('/api/recepciones', runAsync(authMiddleware), recepcionesRouter);
app.use('/api/info-final-articulos', runAsync(authMiddleware), infoFinalArticulosRouter);
app.use('/api/users', runAsync(authMiddleware), usersRouter);
app.use('/api/roles', runAsync(authMiddleware), rolesRouter);
app.use('/api/logs', runAsync(authMiddleware), logsRouter);
app.use('/api/trazabilidad', runAsync(authMiddleware), trazabilidadRouter);
app.use('/api/notifications', runAsync(authMiddleware), notificationsRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.get('/api/health/db', async (_, res) => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    console.error('Health DB error:', e);
    res.status(503).json({ ok: false, db: 'error', message: e.message });
  }
});

// Cualquier otra petición a /api que no haya coincidido → 404 JSON (evita HTML por defecto de Express)
app.use('/api', (req, res) => {
  sendError(res, 404, 'Ruta no encontrada', 'RUTA_NO_ENCONTRADA');
});

// Handler global: errores no capturados devuelven JSON 500 con código
app.use((err, _req, res, _next) => {
  const code = err.code || 'GEN_500';
  const message = err.status === 400 ? (err.message || MSG.ERROR_SERVIDOR) : MSG.ERROR_SERVIDOR;
  sendError(res, err.status || 500, message, code, err);
});

const HOST = '0.0.0.0';  // Aceptar conexiones desde LAN (celular, emulador)
const server = app.listen(PORT, HOST, async () => {
  console.log(`Servidor en http://localhost:${PORT} (LAN: puerto ${PORT})`);
  // Verificar conexión a la base al iniciar
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    console.log('Base de datos: OK');
  } catch (e) {
    console.error('ERROR: No se pudo conectar a la base de datos:', e.message);
    console.error('Verificá que PostgreSQL esté corriendo (docker-compose up -d db) y que DATABASE_URL en .env sea correcto.');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nError: el puerto ${PORT} ya está en uso.`);
    console.error('Cerrá la otra instancia del backend o usá otro puerto: PORT=4001 npm run dev\n');
    process.exit(1);
  }
  throw err;
});
