# Pretty Woman Admin - Mapa de pantallas

Este documento define las pantallas del frontend administrativo y sirve de puente entre producto, diseño e implementación.

La fuente de verdad de integración es `../Pretty-Woman_Backend/docs/frontend-handoff.md`. Ante cualquier diferencia, prevalecen los contratos y reglas de negocio del backend.

## Decisiones de producto y técnicas

- El alcance inicial es una aplicación administrativa interna; no incluye tienda pública.
- Los roles son **Admin** y **Vendedor**. En la API, el rol técnico de Vendedor es `Employee`.
- El stack objetivo es Vite + React + TypeScript, Tailwind CSS, shadcn/ui y lucide-react.
- El backend calcula y devuelve stock disponible, totales, descuentos, comisiones y estados finales. La UI no debe recalcularlos.
- Todo endpoint protegido del alcance requiere JWT; el login es la excepción. Los errores `400` siguen `ProblemDetails`: mostrar `title` y `detail`.
- Las acciones destructivas o sensibles requieren confirmación visual.

## Prioridades

| Prioridad | Objetivo | Módulos |
|---|---|---|
| MVP 1 | Operar ventas y consultar el catálogo | Autenticación, Dashboard, Productos, Clientes, Ventas (incluye reservas), Inventario consultivo |
| MVP 2 | Abastecer y recibir inventario | Catálogos, Proveedores, Compras, Tracking, Recepciones |
| MVP 3 | Administración comercial | Descuentos, Usuarios, Configuración operativa |
| Post-MVP | Control financiero y análisis | Finanzas, Préstamos, Reportes avanzados |

### Prototipos de Finanzas (sin contrato de API aún)

| Ruta de prototipo | Propósito | Rol |
|---|---|---|
| `docs/prototypes/finances.html` | Resumen del saldo general de la tienda, flujo del período y alertas de préstamos | Admin |
| `docs/prototypes/financial-movements.html` | Historial consolidado y registro manual de gastos, retiros, inversiones e ingresos | Admin |
| `docs/prototypes/loans.html` | Consulta y priorización de préstamos por estado | Admin |
| `docs/prototypes/loan-detail.html?id=<loanId>` | Calendario, historial y registro de pagos o desembolsos | Admin |

Los archivos de prototipo son demostrativos y no definen endpoints ni persistencia. Las pantallas funcionales de movimientos y préstamos están en las rutas de aplicación `/finances`, `/finances/loans` y `/finances/loans/:id` descritas en el inventario.

## Permisos principales

| Área | Admin | Vendedor (`Employee`) |
|---|---|---|
| Dashboard y catálogo | Acceso completo | Consulta de dashboard, productos, categorías, subcategorías y tallas |
| Clientes | Crear, editar, bloquear y desbloquear | Crear y editar; no bloquear ni desbloquear |
| Ventas (incluye reservas) | Crear, cobrar, entregar, corregir, cancelar y realizar transiciones sensibles | Crear, consultar, cobrar, crear envíos y despacharlos; sin correcciones, cancelaciones, devoluciones ni transiciones posteriores a `Sent` |
| Inventario | Consulta y gestión de incidencias | Consulta de disponibilidad e incidencias; no puede abrir ni resolver incidencias |
| Catálogos, compras y configuración | Gestionar | Sin acceso de escritura |
| Finanzas | Gestionar | Sin acceso |

Esta tabla define los permisos objetivo del producto. El inventario de rutas más abajo indica cuáles de esas áreas ya tienen pantalla en el frontend.

## Layout y patrones base

| Área | Contenido |
|---|---|
| Sidebar | Navegación por Operación, Inventario, Administración y Finanzas, filtrada por rol |
| Topbar | Usuario activo, rol, cierre de sesión y accesos rápidos |
| Área de contenido | Cabecera, filtros, tabla/formulario/detalle y estados de carga, error y vacío |
| Diálogos | Confirmaciones sensibles y formularios CRUD pequeños |

Implementar y reutilizar `PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `EmptyState`, `StatusBadge`, `ConfirmDialog`, `LoadingButton` y notificaciones.

## Inventario de pantallas implementadas

La siguiente tabla refleja las rutas que existen actualmente en `src/App.tsx` y los flujos que viven dentro de sus páginas. “Implementada” indica que hay pantalla integrada en el frontend; la cobertura de pruebas automatizadas o de extremo a extremo se registra aparte.

| Módulo | Pantalla y ruta | Roles | Acciones principales | Endpoints principales | Estado |
|---|---|---|---|---|---|
| Autenticación | Inicio de sesión — `/login` | Admin, Vendedor | Iniciar sesión, restaurar sesión, renovar y cerrar sesión | `/api/v1/auth/login`, `/refresh`, `/logout`, `/csrf` | Implementada |
| Dashboard | Resumen — `/` | Admin, Vendedor | Consultar indicadores disponibles según el rol y filtrar por período | `GET /api/v1/dashboard/summary` | Implementada |
| Productos | Catálogo — `/products` | Admin, Vendedor | Buscar y filtrar; ver productos, imágenes, variantes, tallas, precios, existencias y movimientos desde la lista | `GET /api/v1/product-details` y endpoints de catálogo/inventario usados por la página | Implementada |
| Clientes | Lista — `/clients` | Admin, Vendedor | Buscar, crear y editar; bloquear/desbloquear con motivo (solo Admin). La creación rápida también está disponible desde ventas | `/api/v1/clients` | Implementada |
| Ventas | Lista — `/sales` | Admin, Vendedor | Buscar y filtrar ventas, incluidas reservas; abrir el detalle | `GET /api/v1/sales` | Implementada |
| Ventas | Crear venta o reserva — `/sales/new` | Admin, Vendedor | Seleccionar productos, aplicar descuentos individuales y globales, asociar cliente y registrar pago inicial opcional | `POST /api/v1/sales`, `POST /api/v1/clients` | Implementada |
| Ventas | Detalle y operación — `/sales/:id` | Admin, Vendedor | Consultar y editar información, productos, pagos y entregas según permisos; solicitar cambios y devoluciones. Incluye diálogos para pagos, reembolsos y acciones postventa | `/api/v1/sales/{id}`, `/payment-movements`, `/deliveries`, `/exchanges`, `/returns` | Implementada |
| Envíos | Listado y seguimiento — `/shipments` | Admin, Vendedor | Filtrar por fecha, estado, agencia y búsqueda de clienta; consultar envíos y abrir la venta; actualizar estados permitidos | `GET /api/v1/sales/deliveries` y comandos de entrega | Implementada |
| Envíos | Conciliación por agencia — `/shipments/reconciliation` | Admin | Seleccionar envíos normales y postventa; registrar cobros, vuelto y pago de flete en una liquidación | `GET /api/v1/deliveryagencyreconciliations/pending-deliveries`, `GET /api/v1/deliveryagencyreconciliations/pending-post-sale-deliveries`, `POST /api/v1/deliveryagencyreconciliations` | Implementada |
| Inventario | Incidencias — `/inventory/issues`, `/inventory/issues/:id` | Admin, Vendedor | Consultar incidencias; Admin puede abrir, resolver o cancelar las permitidas | `/api/v1/product-inventory-issues` | Implementada |
| Compras | Órdenes — `/purchases/orders`, `/purchases/orders/new`, `/purchases/orders/:id`, `/purchases/orders/:id/edit` | Admin | Listar, crear, consultar y editar órdenes; cerrar faltantes y registrar reembolso o renuncia a reembolso del proveedor | `/api/v1/orders`, `/shortages/close`, `/supplier-refund` | Implementada |
| Compras | Recepción — `/purchases/orders/:id/receive` y panel de orden | Admin | Registrar y corregir recepciones, cantidades, precios y costos logísticos | `/api/v1/orders/{id}/receipts` | Implementada |
| Compras | Tracking global y por orden — `/purchases/tracking-numbers`, panel de orden | Admin | Consultar, registrar, editar y eliminar números de tracking | `/api/v1/tracking-numbers`, `/api/v1/orders/{id}/tracking-numbers` | Implementada |
| Descuentos | Campañas — `/discounts/campaigns`, `/discounts/campaigns/new`, `/discounts/campaigns/:id`, `/discounts/campaigns/:id/edit` | Admin | Consultar, crear, editar, deshabilitar y reactivar campañas | `/api/v1/discountcampaigns` | Implementada |
| Usuarios | Administración — `/users` | Admin | Buscar y filtrar; crear, editar, desbloquear, habilitar y deshabilitar cuentas | `/api/v1/auth/users` y sus acciones | Implementada |
| Finanzas | Movimientos — `/finances` | Admin | Consultar, crear, editar y eliminar movimientos financieros | `/api/v1/finances/movements` | Implementada |
| Finanzas | Préstamos — `/finances/loans`, `/finances/loans/:id` | Admin | Consultar y administrar préstamos; registrar y corregir pagos | `/api/v1/loans` | Implementada |

La lista de productos ofrece una vista expandible por producto, pero no existe una ruta de detalle `/products/:productDetailId`. Los detalles de clientes, órdenes, préstamos, devoluciones y cambios se muestran en la página, panel o diálogo asociado; no todos tienen una pantalla independiente.

## Reglas para ventas, pagos, envíos y reservas

- Al crear una venta, `products` y `selectionProducts` son listas diferentes. Cada producto requiere `productId`, `quantity`, `discountAmount` y `discountSourceId`.
- El pago inicial es opcional. Cada movimiento requiere `paymentMethodId`, `productAmount` y `shippingAmount`.
- `productAmount` y `shippingAmount` siempre se aplican en córdobas. Registrar lo entregado en `amountReceivedNio` o `amountReceivedUsd` y, si corresponde, el cambio en `changeGivenNio`; no mezclar dos monedas en un mismo movimiento.
- El monto sugerido en dólares se calcula con `ceil(saldoNio / exchangeRate * 100) / 100`. Efectivo y Transferencia admiten USD con `exchangeRate`; POS permanece únicamente en córdobas.
- La UI debe aceptar una denominación mayor, aplicar a la venta solo el saldo necesario y calcular el cambio en córdobas. Un pago mixto se representa con dos movimientos y el segundo calcula su aplicación y cambio considerando el saldo dejado por el primero.
- Si `shippingAmount` es mayor que cero, también se exige `saleDeliveryId`. Para tarjeta (`paymentMethodId: 3`), se exige `paymentTerminalId`; no enviarlo para efectivo o transferencia.
- Nunca recalcular el total o el `grossAmount`: mostrar los importes de la respuesta del backend.
- Después de un `POST`, `PATCH` o transición, recargar `GET /api/v1/sales/{id}` o actualizar con la respuesta recibida.
- No mostrar la cancelación de una línea individual: no existe esa ruta. La corrección o cancelación completa es exclusiva de Admin.
- Una venta remota puede tener un envío creado aunque conserve saldo pendiente. Para despacharlo (`Sent`) debe cumplir las condiciones de pago definidas por el backend; cuando se exige pago completo, la UI mantiene deshabilitada la acción y muestra el saldo faltante. Un envío contra entrega solo se completa cuando la agencia recauda el saldo total.
- Las ventas cuyo canal es local o tienda física no pueden crear envíos ni registrar cargos de envío; en la UI, entrega se muestra como `No aplica`.
- El cliente es opcional al crear la venta y puede asociarse posteriormente. Para crear una entrega, la venta sí debe tener un cliente.
- La creación rápida de cliente desde la venta solicita nombre y teléfono; dirección, usuario de Instagram y usuario de Messenger son opcionales. Valida teléfonos duplicados y selecciona automáticamente el cliente creado sin perder el estado de la venta.
- Desde el detalle se puede asociar o cambiar el cliente, el canal de venta y los comentarios. Si ya existe una entrega, no se permite cambiar el canal a tienda física.
- La dirección de la entrega es opcional. Si la UI no la envía, el backend utiliza la dirección registrada en el cliente asociado.
- Al crear una entrega, enviar `code`, `municipalityId`, `deliveryAgencyId`, `shippingChargedToClient` y `comments`; `deliveryAddress` continúa siendo opcional y `clientId` puede omitirse para utilizar el cliente asociado a la venta.

## Estados y transiciones de entrega

| Acción | Roles | Endpoint |
|---|---|---|
| Crear envío (`ReadyForDelivery`) | Admin, Vendedor | Puede hacerse con saldo pendiente · `POST /api/v1/sales/{id}/deliveries` |
| Despachar (`Sent`) | Admin, Vendedor | Validar condiciones de pago; mostrar el motivo si está bloqueado · `POST /api/v1/sales/{id}/deliveries/{deliveryId}/send` |
| Completar, fallar o cancelar | Admin | `.../complete`, `.../fail`, `.../cancel` |
| Conciliar envíos normales y postventa | Admin | `GET /api/v1/deliveryagencyreconciliations/pending-deliveries`, `GET /api/v1/deliveryagencyreconciliations/pending-post-sale-deliveries`, `POST /api/v1/deliveryagencyreconciliations` |

La pantalla de conciliación carga los envíos de ventas con `pending-deliveries` y los envíos generados por cambios y devoluciones con `pending-post-sale-deliveries`; ambos GET reciben `deliveryAgencyId`. El POST de conciliación agrupa los registros en `deliveries` y `postSaleDeliveries`. Cada elemento postventa identifica su entrega con `postSaleDeliveryId` y envía `amountCollectedNio`, `amountCollectedUsd`, `changeGivenNio` y `shippingPaidToAgency`; si se recibe dinero en dólares, también envía `collectionExchangeRate`. Los envíos normales usan los mismos montos y tasa, identificándose con `saleDeliveryId`.

El listado general de envíos (`GET /api/v1/sales/deliveries`) pagina sobre entregas individuales. Acepta `page`, `pageSize`, `date` (`YYYY-MM-DD`, día local de Managua), `deliveryStatusId`, `deliveryAgencyId` y `clientSearch`; `date` filtra el día local completo y `clientSearch` busca por nombre, teléfono, Instagram o Messenger de la clienta. La pantalla muestra por defecto la fecha actual y no presenta conteos por estado.

## Pantallas planificadas sin ruta propia en el frontend

Estas capacidades aparecen en el alcance de producto o tienen endpoints identificados, pero no cuentan actualmente con una pantalla/ruta propia en `src/App.tsx`. Parte de los datos necesarios puede administrarse fuera del frontend o cargarse en el backend para probar los flujos ya implementados.

| Módulo | Pantalla/ruta propuesta | Roles | Endpoints conocidos | Dependencia o nota |
|---|---|---|---|---|
| Productos | Detalle — `/products/:productDetailId` | Admin, Vendedor | `GET /api/v1/product-details/{productDetailId}` | El catálogo actual muestra variantes y existencias de forma expandible; no tiene detalle como ruta aparte. |
| Catálogos | Categorías — `/catalog/categories` | Admin | `GET/POST /api/v1/categories`, `PUT /api/v1/categories/{id}` | Necesaria para administrar el catálogo sin preparar datos directamente en backend. |
| Catálogos | Subcategorías — `/catalog/subcategories` | Admin | `GET /api/v1/subcategories`, `GET /api/v1/categories/{id}/subcategories`, `POST /api/v1/subcategories`, `PUT /api/v1/subcategories/{id}` | Requiere categorías. |
| Catálogos | Tallas — `/catalog/sizes` | Admin | `GET/POST /api/v1/sizes`, `PUT /api/v1/sizes/{id}` | — |
| Proveedores | Lista y formulario — `/suppliers` | Admin | `GET/POST /api/v1/suppliers`, `PUT /api/v1/suppliers/{id}` | Las órdenes de compra requieren proveedores existentes. |
| Configuración | Agencias de envío — `/settings/delivery-agencies` | Admin | `GET/POST /api/v1/deliveryagencies`, `PUT /api/v1/deliveryagencies/{id}` | La operación actual consume agencias existentes. |
| Configuración | Terminales de pago — `/settings/payment-terminals` | Admin | `GET/POST /api/v1/paymentterminals`, `PUT /api/v1/paymentterminals/{id}` | Requerida para pagos con tarjeta/POS. |
| Configuración | Categorías de gasto — `/settings/expense-categories` | Admin | `GET/POST /api/v1/expensecategories`, `PUT /api/v1/expensecategories/{id}` | Requerida para clasificar movimientos de gasto. |
| Finanzas | Resumen financiero y reportes | Admin | Sin ruta de aplicación confirmada | Solo existen prototipos demostrativos en `docs/prototypes/`; no forman parte de las rutas activas. |

El listado de usuarios acepta filtros opcionales combinables: `user` busca parcialmente, sin distinguir mayúsculas, en usuario, nombre, apellido o correo; `role` admite `Admin` o `Employee`; `enabled` filtra por estado (`true` o `false`). Ejemplos: `GET /api/v1/auth/users?user=maria` y `GET /api/v1/auth/users?role=Employee&enabled=true`.

## Inventario: incidencias

Solo Admin puede abrir, resolver o cancelar incidencias. Al abrir una, el backend mueve la cantidad de disponible a no disponible. Los tipos son `Damaged=1`, `Dirty=2`, `Missing=3`, `UnderReview=4` y `Repairing=5`; los estados de resolución son `ResolvedToAvailable=2`, `Discarded=3`, `ConfirmedLost=4` y `Cancelled=5`.

| Acción | Endpoint |
|---|---|
| Abrir incidencia | `POST /api/v1/product-inventory-issues` |
| Resolver | `PATCH /api/v1/product-inventory-issues/{id}/resolution` |
| Cancelar una incidencia abierta | `DELETE /api/v1/product-inventory-issues/{id}` |

## Estados UI obligatorios

Toda pantalla de datos debe contemplar carga inicial, error de carga, estado vacío, ausencia de resultados con filtros, validación y error de formulario, éxito de guardado y falta de permisos. Interpretar `401` como sesión expirada/no autenticada, `403` como permiso insuficiente y `404` como recurso inexistente.

## Diseño a priorizar

Crear wireframes para layout base, login, dashboard, lista y detalle de productos, crear/detalle de venta (incluye reservas), órdenes de compra, recepción e inventario. Los CRUD simples y los diálogos de confirmación deben partir de patrones reutilizables.

## Orden de implementación

1. Inicializar el proyecto React y configurar variables de entorno para la API.
2. Implementar cliente HTTP, JWT, rutas protegidas y control de rol.
3. Construir el layout y los patrones reutilizables.
4. Integrar login, dashboard y productos.
5. Implementar clientes y el flujo de venta/reserva, pagos y entregas.
6. Incorporar inventario consultivo y, después, los módulos de soporte por prioridad.
