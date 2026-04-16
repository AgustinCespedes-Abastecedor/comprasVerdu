/**
 * Backfill de CompraAuditoriaEvento desde ActivityLog (idempotente).
 *
 * Uso:
 *   node scripts/backfill-compra-auditoria.mjs
 *
 * Notas:
 * - Marca fuente=backfill.
 * - UXB sin compraIds intenta inferir por recepcionIds; si no, por código + proximidad temporal vs compra.createdAt.
 */

import { prisma } from '../src/lib/prisma.js';
import {
  appendCompraAuditoriaDesdeActivityLog,
  appendCompraAuditoriaEvento,
  tipoCanonicoDesdeLegacyLog,
} from '../src/lib/compraAuditoria.js';

const BATCH = 750;
const recepcionCompraCache = new Map();

function asObj(v) {
  return v && typeof v === 'object' ? v : null;
}

async function recepcionToCompraId(recepcionId) {
  const rid = recepcionId ? String(recepcionId) : '';
  if (!rid) return null;
  if (recepcionCompraCache.has(rid)) return recepcionCompraCache.get(rid);
  const r = await prisma.recepcion.findUnique({
    where: { id: rid },
    select: { compraId: true },
  });
  const out = r?.compraId ? String(r.compraId) : null;
  recepcionCompraCache.set(rid, out);
  return out;
}

async function inferComprasPorUxbHeuristic({ codigo, occurredAt }) {
  const code = codigo ? String(codigo).trim() : '';
  if (!code) return [];
  const t = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT c.id AS "compraId",
            ABS(EXTRACT(EPOCH FROM (c."createdAt" - $1::timestamp))) AS "dtSec"
     FROM "Compra" c
     JOIN "DetalleCompra" dc ON dc."compraId" = c.id
     JOIN "Producto" p ON p.id = dc."productoId"
     WHERE TRIM(p.codigo) = $2
     ORDER BY "dtSec" ASC
     LIMIT 5`,
    t,
    code,
  );

  return Array.isArray(rows) ? rows : [];
}

async function processLogRow(row) {
  const id = String(row.id);
  const userId = row.userId ? String(row.userId) : null;
  const occurredAt = new Date(row.createdAt);
  const entity = String(row.entity || '');
  const action = String(row.action || '');
  const entityId = row.entityId != null ? String(row.entityId) : null;
  const details = asObj(row.details);

  if (entity === 'compra' && entityId) {
    await appendCompraAuditoriaDesdeActivityLog(prisma, {
      activityLogId: id,
      userId,
      occurredAt,
      entity,
      action,
      entityId,
      details,
      compraId: entityId,
      recepcionId: null,
      fuente: 'backfill',
      confianza: 'alta',
    });
    return;
  }

  if (entity === 'recepcion') {
    let compraId = details?.compraId ? String(details.compraId) : '';
    let recepcionId = entityId;
    if (!compraId && recepcionId) {
      compraId = (await recepcionToCompraId(recepcionId)) || '';
    }
    if (!compraId) return;

    await appendCompraAuditoriaDesdeActivityLog(prisma, {
      activityLogId: id,
      userId,
      occurredAt,
      entity,
      action,
      entityId,
      details,
      compraId,
      recepcionId: recepcionId || null,
      fuente: 'backfill',
      confianza: 'alta',
    });
    return;
  }

  if (entity === 'info-final-uxb') {
    const compraIds = Array.isArray(details?.compraIds) ? details.compraIds.map((x) => String(x)).filter(Boolean) : [];
    if (compraIds.length > 0) {
      const recepcionIds = Array.isArray(details?.recepcionIds) ? details.recepcionIds.map((x) => String(x)).filter(Boolean) : [];
      const recepcionPorCompra = new Map();
      for (const rid of recepcionIds) {
        const cid = await recepcionToCompraId(rid);
        if (!cid) continue;
        if (!recepcionPorCompra.has(cid)) recepcionPorCompra.set(cid, new Set());
        recepcionPorCompra.get(cid).add(rid);
      }

      const usarActivityLogIdUnico = compraIds.length === 1;
      const tipo = tipoCanonicoDesdeLegacyLog({ entity, action, details });
      for (const compraId of compraIds) {
        const rset = recepcionPorCompra.get(String(compraId));
        const recepcionId = rset && rset.size === 1 ? [...rset][0] : null;
        await appendCompraAuditoriaEvento(prisma, {
          compraId: String(compraId),
          recepcionId,
          userId,
          occurredAt,
          tipo,
          accion: action,
          confianza: 'alta',
          fuente: 'backfill',
          dedupeKey: `activitylog:${id}:compra:${compraId}`,
          payload: { ...(details || {}), _backfill: true },
          activityLogId: usarActivityLogIdUnico ? id : null,
        });
      }
      return;
    }

    const recepcionIds = Array.isArray(details?.recepcionIds) ? details.recepcionIds.map((x) => String(x)).filter(Boolean) : [];
    const inferredCompraIds = [];
    for (const rid of recepcionIds) {
      const cid = await recepcionToCompraId(rid);
      if (cid) inferredCompraIds.push({ compraId: cid, recepcionId: rid, confianza: 'media' });
    }
    const uniq = new Map();
    for (const x of inferredCompraIds) {
      if (!uniq.has(x.compraId)) uniq.set(x.compraId, x);
    }
    let candidates = [...uniq.values()];

    if (candidates.length === 0) {
      const heur = await inferComprasPorUxbHeuristic({ codigo: details?.codigo, occurredAt });
      const compraIdsHeur = (heur || []).map((h) => String(h.compraId)).filter(Boolean);
      const uniqH = new Set(compraIdsHeur);
      const ambiguous = uniqH.size > 1;
      candidates = [...uniqH].map((compraId) => ({
        compraId,
        recepcionId: null,
        confianza: ambiguous ? 'baja' : 'media',
      }));
    }

    const tipo = tipoCanonicoDesdeLegacyLog({ entity, action, details });
    const usarActivityLogIdUnico = candidates.length === 1;
    const modoInferencia = recepcionIds.length
      ? 'por_recepcion'
      : 'heuristica_codigo';

    for (const c of candidates) {
      await appendCompraAuditoriaEvento(prisma, {
        compraId: String(c.compraId),
        recepcionId: c.recepcionId,
        userId,
        occurredAt,
        tipo,
        accion: action,
        confianza: c.confianza,
        fuente: 'backfill',
        dedupeKey: `activitylog:${id}:compra:${c.compraId}`,
        payload: {
          ...(details || {}),
          _backfill: true,
          _inferencia: {
            modo: modoInferencia,
          },
        },
        activityLogId: usarActivityLogIdUnico ? id : null,
      });
    }
  }
}

async function main() {
  let offset = 0;
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, "userId", action, entity, "entityId", details, "createdAt"
       FROM "ActivityLog"
       ORDER BY "createdAt" ASC
       LIMIT $1 OFFSET $2`,
      BATCH,
      offset,
    );

    const batch = Array.isArray(rows) ? rows : [];
    if (batch.length === 0) break;

    for (const row of batch) {
      // eslint-disable-next-line no-await-in-loop
      await processLogRow(row);
      total += 1;
    }

    offset += batch.length;
    // eslint-disable-next-line no-console
    console.log(`[backfill auditoría] procesados=${total} (offset=${offset})`);
  }

  // eslint-disable-next-line no-console
  console.log(`[backfill auditoría] OK. Filas ActivityLog visitadas=${total}`);
}

main()
  .catch((e) => {
    console.error('[backfill auditoría] FATAL:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
