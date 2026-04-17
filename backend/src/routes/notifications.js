import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendError, MSG } from '../lib/errors.js';

const router = Router();

/**
 * GET /notifications — lista del usuario actual (no leídas primero).
 * Query: limit (1–100), unread=true
 */
router.get('/', async (req, res) => {
  try {
    if (!req.userId) {
      return sendError(res, 401, MSG.AUTH_TOKEN_FALTA, 'NOTIF_001');
    }
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10) || 50));
    const unreadOnly = req.query.unread === 'true' || req.query.unread === '1';

    const where = { userId: req.userId };
    if (unreadOnly) where.read = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          compraId: true,
          recepcionId: true,
          createdAt: true,
        },
      }),
      prisma.userNotification.count({
        where: { userId: req.userId, read: false },
      }),
    ]);

    res.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        compraId: n.compraId,
        recepcionId: n.recepcionId,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (e) {
    sendError(res, 500, 'No se pudieron obtener las notificaciones.', 'NOTIF_002', e);
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    if (!req.userId) {
      return sendError(res, 401, MSG.AUTH_TOKEN_FALTA, 'NOTIF_003');
    }
    await prisma.userNotification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });
    res.status(204).end();
  } catch (e) {
    sendError(res, 500, 'No se pudieron marcar las notificaciones.', 'NOTIF_004', e);
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    if (!req.userId) {
      return sendError(res, 401, MSG.AUTH_TOKEN_FALTA, 'NOTIF_005');
    }
    const { id } = req.params;
    const updated = await prisma.userNotification.updateMany({
      where: { id, userId: req.userId },
      data: { read: true },
    });
    if (updated.count === 0) {
      return sendError(res, 404, 'Notificación no encontrada.', 'NOTIF_006');
    }
    res.status(204).end();
  } catch (e) {
    sendError(res, 500, 'No se pudo marcar la notificación.', 'NOTIF_007', e);
  }
});

export const notificationsRouter = router;
