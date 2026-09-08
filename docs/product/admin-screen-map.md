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
| MVP 1 | Operar ventas y consultar el catálogo | Autenticación, Dashboard, Productos, Clientes, Ventas, Reservas, Inventario consultivo |
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

Los datos de estas rutas son demostrativos. Los pagos de ventas y los eventos de préstamos se representan como registros automáticos; el prototipo no define endpoints ni persistencia de backend.

## Permisos principales

| Área | Admin | Vendedor (`Employee`) |
|---|---|---|
| Dashboard y catálogo | Acceso completo | Consulta de dashboard, productos, categorías, subcategorías y tallas |
| Clientes | Crear, editar, bloquear y desbloquear | Crear y editar; no bloquear ni desbloquear |
| Ventas y reservas | Crear, cobrar, entregar, corregir, cancelar y realizar transiciones sensibles | Crear, consultar, cobrar, crear envíos y despacharlos; sin correcciones, cancelaciones, devoluciones ni transiciones posteriores a `Sent` |
| Inventario | Consulta y gestión de incidencias | Consulta de disponibilidad e incidencias; no puede abrir ni resolver incidencias |
| Catálogos, compras y configuración | Gestionar | Sin acceso de escritura |
| Finanzas | Gestionar | Sin acceso |

## Layout y patrones base

| Área | Contenido |
|---|---|
| Sidebar | Navegación por Operación, Inventario, Administración y Finanzas, filtrada por rol |
| Topbar | Usuario activo, rol, cierre de sesión y accesos rápidos |
| Área de contenido | Cabecera, filtros, tabla/formulario/detalle y estados de carga, error y vacío |
| Diálogos | Confirmaciones sensibles y formularios CRUD pequeños |

Implementar y reutilizar `PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `EmptyState`, `StatusBadge`, `ConfirmDialog`, `LoadingButton` y notificaciones.

## Pantallas MVP

| Módulo | Pantalla y ruta | Roles | Acciones y datos | Endpoint confirmado |
|---|---|---|---|---|
| Autenticación | Login — `/login` | Admin, Vendedor | Iniciar sesión; mostrar errores de credenciales o sesión expirada | `POST /api/v1/auth/login` |
| Dashboard | Resumen — `/` | Admin, Vendedor | KPIs de ventas, cobros, reservas, entregas e incidencias; filtros de fecha inclusivos. Admin ve adicionalmente `financial`; Vendedor no debe depender de él | `GET /api/v1/dashboard/summary?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD` |
| Productos | Lista — `/products` | Admin, Vendedor | Buscar, filtrar y paginar; alternar entre tabla por variante/talla y cuadrícula visual por producto con su imagen principal. Al abrir una tarjeta, mostrar existencias desglosadas por variante y talla | `GET /api/v1/product-details` |
| Productos | Detalle — `/products/:productDetailId` | Admin, Vendedor | Información completa, variantes o detalle y disponibilidad | `GET /api/v1/product-details/{productDetailId}` |
| Clientes | Lista y formulario — `/clients` | Admin, Vendedor | Buscar, crear y editar clientes | `GET/POST /api/v1/clients`, `PUT /api/v1/clients/{id}` |
| Clientes | Estado — diálogo desde cliente | Admin | Bloquear o desbloquear, con motivo y confirmación | `PATCH /api/v1/clients/{id}/block`, `PATCH /api/v1/clients/{id}/unblock` |
| Ventas | Lista y detalle — `/sales`, `/sales/:id` | Admin, Vendedor | Consultar ventas con fecha de hoy como filtro inicial; el detalle incluye productos, pagos, prendas en selección y `deliveries` | `GET /api/v1/sales`, `GET /api/v1/sales/{id}` |
| Ventas | Crear venta — `/sales/new` | Admin, Vendedor | Seleccionar productos y añadir descuentos; tanto el cliente como el pago inicial son opcionales. Permitir crear rápidamente un cliente sin abandonar la venta y seleccionarlo al guardar | `POST /api/v1/sales`, `POST /api/v1/clients` |
| Ventas | Pagos — panel de `/sales/:id` | Admin, Vendedor | Registrar abono o pago; mostrar importes devueltos por API | `POST /api/v1/sales/{id}/payment-movements` |
| Ventas | Entrega/envío — panel de `/sales/:id` | Admin, Vendedor | Crear envío y despacharlo. Admin puede completar, fallar o cancelar después | `POST /api/v1/sales/{id}/deliveries`, `POST /api/v1/sales/{id}/deliveries/{deliveryId}/send` |
| Reservas | Crear/listar/detalle — `/reservations`, `/reservations/new`, `/reservations/:id` | Admin, Vendedor | Una reserva confirmada es una venta creada con `saleStatusId: 2` (`Reserved`); no implementar un flujo separado de `ProductHold` | `GET /api/v1/sales`, `GET /api/v1/sales/{id}`, `POST /api/v1/sales` |
| Inventario | Incidencias — `/inventory/issues`, `/inventory/issues/:id` | Admin, Vendedor | Consultar incidencias, sus estados y disponibilidad relacionada | `GET /api/v1/product-inventory-issues`, `GET /api/v1/product-inventory-issues/{id}` |

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
| Conciliar cobro contra entrega | Admin | `GET /api/v1/deliveryagencyreconciliations/pending-deliveries`, `POST /api/v1/deliveryagencyreconciliations` |

## Pantallas de soporte

| Módulo | Ruta sugerida | Roles | Endpoints |
|---|---|---|---|
| Categorías | `/catalog/categories` | Admin | `GET/POST /api/v1/categories`, `PUT /api/v1/categories/{id}` |
| Subcategorías | `/catalog/subcategories` | Admin | `GET /api/v1/subcategories`, `GET /api/v1/categories/{id}/subcategories`, `POST /api/v1/subcategories`, `PUT /api/v1/subcategories/{id}` |
| Tallas | `/catalog/sizes` | Admin | `GET/POST /api/v1/sizes`, `PUT /api/v1/sizes/{id}` |
| Proveedores | `/suppliers` | Admin | `GET/POST /api/v1/suppliers`, `PUT /api/v1/suppliers/{id}` |
| Órdenes de compra | `/purchases/orders` | Admin | `GET/POST /api/v1/orders`, `PUT /api/v1/orders/{id}` |
| Tracking de orden | panel de `/purchases/orders/:id` | Admin | `GET/POST /api/v1/orders/{id}/tracking-numbers`, `PUT/DELETE /api/v1/orders/{id}/tracking-numbers/{trackingId}` |
| Recepción | `/purchases/orders/:id/receipts` | Admin | `POST /api/v1/orders/{orderId}/receipts` |
| Campañas | `/discounts/campaigns` | Admin | `GET/POST /api/v1/discountcampaigns`, `PUT /api/v1/discountcampaigns/{id}`, `PATCH /api/v1/discountcampaigns/{id}/disable` |
| Usuarios | Lista, detalle y formulario — `/users`. Incluye listar, filtrar, consultar el detalle por id, crear usuarios, actualizar sus datos y credenciales; administrar su estado | Admin | `GET /api/v1/auth/users?user=&role=&enabled=`, `GET /api/v1/auth/users/{id}`, `POST /api/v1/auth/users`, `PUT /api/v1/auth/users/{id}` |
| Usuarios | Estado — acciones desde usuario: desbloquear, deshabilitar o habilitar | Admin | `POST /api/v1/auth/users/{id}/unlock`, `POST /api/v1/auth/users/{id}/disable`, `POST /api/v1/auth/users/{id}/enable` |
| Agencias de envío | `/settings/delivery-agencies` | Admin | `GET/POST /api/v1/deliveryagencies`, `PUT /api/v1/deliveryagencies/{id}` |
| Terminales de pago | `/settings/payment-terminals` | Admin | `GET/POST /api/v1/paymentterminals`, `PUT /api/v1/paymentterminals/{id}` |
| Categorías de gasto | `/settings/expense-categories` | Admin | `GET/POST /api/v1/expensecategories`, `PUT /api/v1/expensecategories/{id}` |

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

Crear wireframes para layout base, login, dashboard, lista y detalle de productos, crear/detalle de venta, reservas, órdenes de compra, recepción e inventario. Los CRUD simples y los diálogos de confirmación deben partir de patrones reutilizables.

## Orden de implementación

1. Inicializar el proyecto React y configurar variables de entorno para la API.
2. Implementar cliente HTTP, JWT, rutas protegidas y control de rol.
3. Construir el layout y los patrones reutilizables.
4. Integrar login, dashboard y productos.
5. Implementar clientes y el flujo de venta/reserva, pagos y entregas.
6. Incorporar inventario consultivo y, después, los módulos de soporte por prioridad.
