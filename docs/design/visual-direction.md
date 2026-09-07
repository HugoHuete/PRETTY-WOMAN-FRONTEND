# Pretty Woman Admin — Dirección visual inicial

## Propósito

Diseñar una aplicación administrativa minimalista, clara y rápida para uso diario en computadora y tablet. La identidad debe tomar el rosa y la expresividad del logo sin convertir la interfaz operativa en una pantalla recargada.

## Referencia de marca

- Logos canónicos: `https://media.prettywomanboutiquenic.com/branding/pink_logo.png` y `https://media.prettywomanboutiquenic.com/branding/white_logo.png`. Los archivos locales en `assets/brand/` se conservan como referencia de diseño.
- Rasgos: tipografía manuscrita rosa coral, contraste negro/blanco y subtítulo clásico.
- Uso: colocar el logo completo en login y en el encabezado de la barra lateral. En el modo claro, la barra lateral usa superficie blanca y el logo se presenta con contraste oscuro; en el modo oscuro se conserva la versión blanca. La versión blanca también se usa en el panel de login. En áreas densas, priorizar una marca compacta para preservar la legibilidad.

## Principios

1. **Operación primero.** La información de venta, stock y estados debe ser más visible que la decoración.
2. **Rosa con intención.** El rosa identifica acciones principales, selección y elementos de marca; no se usa como fondo dominante de tablas o formularios.
3. **Densidad controlada.** Tablas legibles, filtros accesibles y espacios suficientes para uso táctil en tablet.
4. **Estados inequívocos.** Disponible, reservado, vendido, no disponible, pago pendiente y envío deben distinguirse por texto e icono, no solo por color.
5. **Responsive por modo de trabajo.** Escritorio privilegia navegación permanente y datos en tabla; tablet usa sidebar plegable, acciones visibles y paneles apilados.

## Tokens visuales propuestos

Los valores son una primera base derivada visualmente del logo y podrán ajustarse al construir el sistema de componentes.

| Token | Valor | Uso |
|---|---|---|
| `brand-500` | `#E97894` | Acción principal, selección, enlaces destacados |
| `brand-600` | `#C95773` | Hover, foco y acción principal activa |
| `brand-50` | `#FFF3F6` | Fondo sutil de selección o aviso de marca |
| `ink-950` | `#1C191B` | Texto principal y navegación oscura |
| `ink-600` | `#57534E` | Texto secundario |
| `surface` | `#FFFFFF` | Tarjetas, formularios y diálogos |
| `canvas` | `#FAFAF9` | Fondo general de la aplicación |
| `border` | `#E7E5E4` | Bordes y separadores |
| `success` | `#15803D` | Confirmado, disponible, completado |
| `warning` | `#B45309` | Pendiente, reservado, atención |
| `danger` | `#B91C1C` | Error, cancelado, no disponible |
| `info` | `#0369A1` | Información y envío en curso |

Usar fondo blanco, texto oscuro y rosa coral para el contraste principal. No usar el rosa como único indicador de error, éxito o estado.

### Modo oscuro

El modo oscuro debe ser una alternativa del mismo sistema, no una inversión automática de colores. Se activará desde el control de tema de la topbar y respetará la preferencia guardada como valor inicial.

| Token | Valor oscuro | Uso |
|---|---|---|
| `canvas` | `#171415` | Fondo general |
| `surface` | `#242021` | Tarjetas, formularios y diálogos |
| `surface-raised` | `#302A2C` | Hover, filtros y elementos elevados |
| `ink-950` | `#FFF8F8` | Texto principal |
| `ink-600` | `#D6CDCF` | Texto secundario |
| `border` | `#494041` | Bordes y separadores |
| `brand-500` | `#F08AA4` | Acción principal y foco, con luminosidad suficiente |

- El logo blanco se conserva sin alteración sobre una superficie oscura limpia.
- Las tablas usan filas oscuras con separación sutil; evitar grandes fondos negros puros.
- Los estados semánticos mantienen texto, icono y etiqueta explícita para conservar accesibilidad en ambos temas.
- La preferencia elegida por la persona usuaria debe persistir entre sesiones y se cambia desde la acción de tema de la topbar.

## Tipografía

- **Inter** o **Manrope** para toda la interfaz: cuerpo, datos, formularios y tablas.
- El lettering del logo no se replica en títulos o controles; queda reservado al activo de marca.
- Títulos: semibold, alto contraste y tamaño contenido. Cuerpo: 14–16 px. Datos de tabla: 14 px como mínimo.

## Layout responsive

El shell reutilizable conserva la gramática visual de los prototipos y cambia de modo en dos cortes claros:

| Zona | Escritorio (≥ 1121 px) | Tablet (781–1120 px) | Móvil (≤ 780 px) |
|---|---|---|---|
| Navegación | Sidebar fija de 236 px, logo contrastado, grupos por módulo y perfil al pie | Rail fijo de 76 px con iconos; las etiquetas y títulos se ocultan sin perder `title`/nombre accesible | Sidebar fuera del flujo; se abre como panel superpuesto desde el botón de menú |
| Topbar | Transparente, mínimo 96 px, breadcrumb, título y acciones a la derecha | Mantiene la jerarquía del escritorio con menos controles visibles | Mínimo 92 px, menú junto al título y acciones compactas |
| Contenido | Máximo útil de 1600 px; padding de 32 px | Padding de 24–32 px; tarjetas y paneles se apilan cuando lo necesitan | Padding de 20/16 px; controles y acciones ocupan el ancho disponible |
| Tablas | Todas las columnas relevantes y acciones al final | Columnas esenciales; detalle y acciones secundarias en menú o panel | Scroll horizontal explícito o vista de detalle; nunca se comprime texto crítico |
| Formularios | Dos columnas cuando hay espacio | Una o dos columnas según el ancho útil | Una columna; campos y botones de al menos 44 px de alto |

El shell se implementa una sola vez en `src/shared/layout/app-shell.tsx`; las páginas aportan únicamente su contenido mediante rutas anidadas. Los enlaces se filtran por rol, los iconos mantienen el mismo lenguaje visual de `prototype-icons.svg` y el menú móvil conserva foco y cierre con Escape.

## Componentes base

| Componente | Decisión visual |
|---|---|
| Botón principal | Fondo `brand-500`, texto blanco, altura mínima 40 px, radio 8 px |
| Botón secundario | Fondo blanco, borde `border`, texto `ink-950` |
| Input y select | Superficie blanca, borde sutil; foco rosa con anillo visible |
| DataTable | Cabecera gris cálida muy suave, filas blancas y hover discreto |
| StatusBadge | Fondo tenue + texto oscuro del color semántico + icono o etiqueta explícita |
| Tarjeta KPI | Fondo blanco, borde sutil, cifra destacada, tendencia o contexto debajo |
| Dialog de confirmación | Título claro, consecuencia de la acción y botón destructivo diferenciado |
| Toast | Icono, título breve y detalle devuelto por `ProblemDetails` cuando aplique |

### Formato de moneda

- Mostrar dólares con el símbolo `$` y córdobas con `C$`, siempre separados del monto por un espacio: `$ 125.00` y `C$ 4,577.50`.
- Reservar `USD` y `NIO` para selectores, datos internos e integraciones; no mostrar `US$` en la interfaz.
- Expresar la tasa de cambio como `C$ 36.62 por $1`.

## Primeras pantallas a diseñar

1. **Login:** logo centrado, formulario sobrio y panel de apoyo opcional en escritorio; en tablet, una sola columna.
2. **Dashboard:** cuatro a seis KPIs, actividades/alertas y accesos rápidos. El bloque financiero solo se muestra a Admin.
3. **Productos:** filtros visibles, tabla con disponibilidad como `StatusBadge`, vista detalle en página o panel lateral.
4. **Crear venta:** flujo en secciones claras: cliente, productos, pago y entrega. Los totales siempre son informativos y provienen de API.

## Criterios de aprobación

- El logo se lee con claridad en fondo claro y oscuro.
- Ninguna acción depende únicamente del color.
- Las acciones frecuentes de Vendedor se ejecutan cómodamente en tablet.
- Las acciones sensibles de Admin piden confirmación y explican el impacto.
- El layout admite estados de carga, vacío, error y sin permiso sin romper la jerarquía visual.
