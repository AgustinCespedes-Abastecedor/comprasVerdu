import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { proveedoresRouter } from './routes/proveedores.js';
import { productosRouter } from './routes/productos.js';
import { comprasRouter } from './routes/compras.js';
import { recepcionesRouter } from './routes/recepciones.js';
import { infoFinalArticulosRouter } from './routes/infoFinalArticulos.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter } from './routes/roles.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Orígenes permitidos: web (dev) + Capacitor (app móvil) + LAN (192.168.x.x)
const allowedOrigins = [
  FRONTEND_URL,
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,  // LAN: 192.168.x.x
  /^https?:\/\/10\.0\.2\.\d+(:\d+)?$/,       // Emulador Android
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
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
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

// Handler global: errores no capturados devuelven JSON 500
app.use((err, _req, res, _next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error del servidor' : (err.message || String(err)),
  });
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
