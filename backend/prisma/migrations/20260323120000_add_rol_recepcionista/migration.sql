-- Rol Recepcionista: igual que Comprador salvo que no incluye el permiso "comprar".
INSERT INTO "Role" ("id", "nombre", "descripcion", "permisos", "createdAt", "updatedAt")
VALUES (
  'rol_recep_004',
  'Recepcionista',
  'Recepción de compras y consultas. No puede crear compras.',
  '["home","ver-compras","recepcion","ver-recepciones","info-final-articulos"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("nombre") DO UPDATE SET
  "descripcion" = EXCLUDED."descripcion",
  "permisos" = EXCLUDED."permisos",
  "updatedAt" = CURRENT_TIMESTAMP;
