# Precios y ventas

## ComprasVerdu es solo registro interno

ComprasVerdu es un **registro interno** de compras, recepciones y precios de venta cargados por el usuario. No es el sistema que alimenta las ventas en mostrador ni el que define los precios que ve el cliente.

- Los **precios de venta** que se cargan en “Ver recepciones” (y el margen asociado) se guardan en ComprasVerdu para trazabilidad y para comparar con el “Sistema Tecnolar” en Info Final de Artículos.
- Esos datos **no se envían** a ningún sistema de ventas. La integración con SQL Server / ELABASTECEDOR es **solo de lectura** (consulta de artículos, precios de referencia, IVA, stock, ventas históricas, etc.).

## Carga de precios al sistema de ventas

**La carga de precios al sistema de ventas (Tecnolar, caja, listas de precio, etc.) es 100 % manual o la realiza otro sistema.**

ComprasVerdu no tiene integración que:

- Envíe el precio de venta guardado en una recepción al sistema de ventas.
- Actualice listas de precios, canales o precios por sucursal en el sistema externo.

Si el precio definido en “Ver recepciones” o en Info Final debe reflejarse en el sistema de ventas, debe llevarse a cabo por:

- Carga **manual** en el sistema correspondiente, o
- Un **proceso o sistema distinto** (exportación, integración propia, etc.) que no forma parte de ComprasVerdu.

En resumen: ComprasVerdu sirve como registro y apoyo a la decisión; la efectivización de precios en ventas queda fuera de esta aplicación.
