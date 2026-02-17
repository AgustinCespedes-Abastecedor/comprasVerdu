import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { proveedoresRouter } from './routes/proveedores.js';
import { productosRouter } from './routes/productos.js';
import { comprasRouter } from './routes/compras.js';
import { usersRouter } from './routes/users.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }
  next(err);
});

app.use('/api/auth', authRouter);
app.use('/api/proveedores', authMiddleware, proveedoresRouter);
app.use('/api/productos', authMiddleware, productosRouter);
app.use('/api/compras', authMiddleware, comprasRouter);
app.use('/api/users', authMiddleware, usersRouter);

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

const server = app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nError: el puerto ${PORT} ya está en uso.`);
    console.error('Cerrá la otra instancia del backend o usá otro puerto: PORT=4001 npm run dev\n');
    process.exit(1);
  }
  throw err;
});
