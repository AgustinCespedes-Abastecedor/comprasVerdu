# Recepción e inventario

## Alcance de la recepción en ComprasVerdu

**Registrar una recepción en ComprasVerdu no actualiza el inventario en ningún sistema.**

En esta aplicación, “recepción” significa:

- Registrar **qué se recibió** de una compra (cantidades por ítem, UxB, y luego precio de venta y margen).
- Dejar trazabilidad de quién cargó esos datos y cuándo (historial de actividad).

ComprasVerdu **no** escribe stock en:

- La base PostgreSQL del proyecto (no hay tabla de movimientos de stock).
- El sistema externo (SQL Server / ELABASTECEDOR). La integración con ese sistema es **solo de lectura** (artículos, precios, IVA, stock actual, ventas, etc.).

Por tanto, los datos de stock que se muestran en la planilla de compra o en otros listados provienen del sistema externo y **no se modifican** al confirmar una recepción aquí.

## Conciliación e inventario

La **conciliación entre lo recibido y el inventario** (y cualquier actualización de stock) se realiza **por otro canal**, fuera de ComprasVerdu:

- En el sistema de gestión (Tecnolar, ELABASTECEDOR u otro), o
- Mediante procesos batch / integraciones que toman como fuente los datos ya cargados en ComprasVerdu o en otros sistemas.

Si en el futuro se requiere que al recibir en ComprasVerdu se dispare una actualización de inventario, habría que definir ese flujo (por ejemplo una integración que lea recepciones y actualice stock en el sistema correspondiente) e implementarlo aparte.
