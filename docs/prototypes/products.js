const catalog = [
  { name: "Vestido satinado", category: "Vestidos", ref: "VSAT-CRL", supplier: "Luna Textil", price: "C$ 1,250", salePrice: "C$ 990", cost: "C$ 690", image: "../../assets/catalog/coral-satin-dress.png", variants: [{ name: "Coral", sizes: ["XS", "S", "M", "L", "XL"] }, { name: "Rosa viejo", price: "C$ 1,290", salePrice: "C$ 1,050", cost: "C$ 720", sizes: ["S", "M", "L"] }] },
  { name: "Jeans rectos", category: "Pantalones", ref: "JRET-AZM", supplier: "Denim Norte", price: "C$ 1,100", cost: "C$ 620", image: "../../assets/catalog/blue-jeans.png", variants: [{ name: "Azul medio", sizes: ["28", "30", "32", "34", "36"] }, { name: "Azul oscuro", sizes: ["30", "32", "34"] }] },
  { name: "Blusa seda", category: "Blusas", ref: "BLSE-CHP", supplier: "Atelier Marea", price: "C$ 780", salePrice: "C$ 650", cost: "C$ 410", image: "../../assets/catalog/blouse-champagne.png", variants: [{ name: "Champán", sizes: ["SM", "ML"] }, { name: "Marfil", sizes: ["S", "M", "L"] }] },
  { name: "Falda recta", category: "Faldas", ref: "FREC-NGR", supplier: "Luna Textil", price: "C$ 690", cost: "C$ 350", image: "../../assets/catalog/black-skirt.png", variants: [{ name: "Negro", sizes: ["S", "M", "L"] }, { name: "Arena", sizes: ["S", "M", "L"] }] },
  { name: "Vestido midi estampado", category: "Vestidos", ref: "VMID-FLR", supplier: "Luna Textil", price: "C$ 1,380", cost: "C$ 760", image: "../../assets/catalog/coral-satin-dress.png", variants: [{ name: "Floral azul", sizes: ["S", "M", "L", "XL"] }, { name: "Floral rosa", sizes: ["S", "M", "L"] }] },
  { name: "Pantalón sastre", category: "Pantalones", ref: "PSAS-BEI", supplier: "Atelier Marea", price: "C$ 980", cost: "C$ 540", image: "../../assets/catalog/blue-jeans.png", variants: [{ name: "Beige", sizes: ["28", "30", "32", "34"] }, { name: "Negro", sizes: ["30", "32", "34", "36"] }] },
  { name: "Blusa manga globo", category: "Blusas", ref: "BMGL-OLV", supplier: "Casa Moda", price: "C$ 820", cost: "C$ 430", image: "../../assets/catalog/blouse-champagne.png", variants: [{ name: "Oliva", sizes: ["S", "M", "L"] }, { name: "Blanco", sizes: ["S", "M", "L", "XL"] }] },
  { name: "Falda plisada", category: "Faldas", ref: "FPLI-ROS", supplier: "Casa Moda", price: "C$ 740", salePrice: "C$ 590", cost: "C$ 390", image: "../../assets/catalog/black-skirt.png", active: false, variants: [{ name: "Rosa", sizes: ["S", "M", "L"] }, { name: "Azul noche", sizes: ["S", "M", "L"] }] },
  { name: "Vestido cruzado", category: "Vestidos", ref: "VCRU-VER", supplier: "Moda Sur", price: "C$ 1,190", cost: "C$ 650", image: "../../assets/catalog/coral-satin-dress.png", sold: true, variants: [{ name: "Verde", sizes: ["S", "M", "L"] }, { name: "Vino", sizes: ["S", "M", "L", "XL"] }] },
  { name: "Jeans wide leg", category: "Pantalones", ref: "JWID-CLA", supplier: "Denim Norte", price: "C$ 1,180", cost: "C$ 680", image: "../../assets/catalog/blue-jeans.png", variants: [{ name: "Azul claro", sizes: ["28", "30", "32", "34", "36"] }, { name: "Gris", sizes: ["30", "32", "34"] }] }
];

const stockPattern = [[4, 1, 0], [6, 0, 0], [2, 2, 1], [5, 0, 0], [3, 1, 0], [0, 1, 2], [7, 0, 0], [2, 1, 1], [0, 0, 0]];
const currencyValue = (value) => Number(value.replace(/[^\d]/g, ""));
const formatCurrency = (value) => `C$ ${new Intl.NumberFormat("es-NI").format(value)}`;
const products = catalog.flatMap((product) => product.variants.flatMap((variant, variantIndex) => variant.sizes.map((size, index) => {
  const [stockAvailable, stockReserved, stockIncidents] = stockPattern[(index + product.ref.length + variant.name.length) % stockPattern.length];
  return {
    ...product,
    variant: variant.name,
    size,
    cost: variant.cost || formatCurrency(currencyValue(product.cost) + (variantIndex * 30)),
    price: variant.price || product.price,
    salePrice: variant.salePrice ?? product.salePrice,
    available: product.sold ? 0 : stockAvailable,
    reserved: product.sold ? 0 : stockReserved,
    incidents: product.sold ? 0 : stockIncidents
  };
})));

const movementHistory = [
  { date: "2026-07-15T10:24", label: "15 jul 2026, 10:24", type: "Reserva creada", variant: "Coral", size: "XS", origin: "Disponible", destination: "Reservado", quantity: 1, direction: "out" },
  { date: "2026-07-15T09:12", label: "15 jul 2026, 09:12", type: "Reserva convertida en venta", variant: "Coral", size: "S", origin: "Reservado", destination: "Fuera del inventario", quantity: 1, direction: "out" },
  { date: "2026-07-14T16:18", label: "14 jul 2026, 16:18", type: "Recepción de compra", variant: "Rosa viejo", size: "S", origin: "Externo", destination: "Disponible", quantity: 4, direction: "in" },
  { date: "2026-07-14T11:05", label: "14 jul 2026, 11:05", type: "Reserva creada", variant: "Coral", size: "M", origin: "Disponible", destination: "Reservado", quantity: 1, direction: "out" },
  { date: "2026-07-13T15:41", label: "13 jul 2026, 15:41", type: "Reserva liberada", variant: "Rosa viejo", size: "M", origin: "Reservado", destination: "Disponible", quantity: 1, direction: "in" },
  { date: "2026-07-13T10:18", label: "13 jul 2026, 10:18", type: "Caso de inventario abierto", variant: "Coral", size: "L", origin: "Disponible", destination: "No disponible", quantity: 1, direction: "out" },
  { date: "2026-07-12T16:32", label: "12 jul 2026, 16:32", type: "Recepción de compra", variant: "Rosa viejo", size: "L", origin: "Externo", destination: "Disponible", quantity: 3, direction: "in" },
  { date: "2026-07-12T09:06", label: "12 jul 2026, 09:06", type: "Ajuste de inventario", variant: "Coral", size: "XL", origin: "No disponible", destination: "Disponible", quantity: 1, direction: "in" }
];

const rows = document.querySelector("#productRows");
const filtersForm = document.querySelector("#filters");
const search = document.querySelector("#search");
const category = document.querySelector("#category");
const availability = document.querySelector("#availability");
const clearFilters = document.querySelector("#clearFilters");
const tableView = document.querySelector("#tableView");
const gridView = document.querySelector("#gridView");
const emptyState = document.querySelector("#emptyState");
const viewButtons = [...document.querySelectorAll("[data-view]")];
const exportProducts = document.querySelector("#exportProducts");
const imagesByProduct = new Map(catalog.map((product) => [product.ref, [product.image]]));
const expandedProducts = new Set();
let currentPage = 1;
let visibleProducts = [];
let filteredCatalog = catalog;
let viewMode = "table";
let movementOrder = "desc";
let movementFilters = { type: "", variant: "", size: "" };

clearFilters.insertAdjacentHTML("beforebegin", '<label class="filter-select product-size-filter">Talla <select id="size" data-searchable data-search-placeholder="Buscar talla…"><option value="">Todas</option></select></label><label class="filter-select product-supplier-filter">Proveedor <select id="supplier" data-searchable data-search-placeholder="Buscar proveedor…"><option value="">Todos</option></select></label>');
const size = document.querySelector("#size");
const supplier = document.querySelector("#supplier");
[...new Set(products.map((item) => item.size))].forEach((value) => size.add(new Option(value, value)));
[...new Set(catalog.map((item) => item.supplier))].forEach((value) => supplier.add(new Option(value, value)));

function productItems(product) {
  return products.filter((item) => item.ref === product.ref);
}

function productTotals(product) {
  return productItems(product).reduce((totals, item) => ({
    available: totals.available + item.available,
    reserved: totals.reserved + item.reserved,
    incidents: totals.incidents + item.incidents
  }), { available: 0, reserved: 0, incidents: 0 });
}

function productStatus(product) {
  const totals = productTotals(product);
  if (product.active === false) return "inactive";
  return totals.available + totals.reserved === 0 ? "sold" : "available";
}

function statusLabel(status) {
  return { available: "Disponible", sold: "Vendido", inactive: "Inactivo" }[status];
}

function priceMarkup(product) {
  return product.salePrice
    ? `<span class="price-stack"><span class="price-regular is-discounted">${product.price}</span><span class="price-offer">${product.salePrice}</span></span>`
    : `<span class="price-regular">${product.price}</span>`;
}

function variantSummary(product) {
  const items = productItems(product);
  const variants = new Set(items.map((item) => item.variant));
  const sizes = new Set(items.map((item) => item.size));
  return `${variants.size} ${variants.size === 1 ? "variante" : "variantes"} · ${sizes.size} ${sizes.size === 1 ? "talla" : "tallas"}`;
}

function compactValues(values, limit = 4) {
  const uniqueValues = [...new Set(values)];
  const visibleValues = uniqueValues.slice(0, limit).join(" · ");
  const remaining = uniqueValues.length - limit;
  return remaining > 0 ? `${visibleValues} · +${remaining}` : visibleValues;
}

function detailRowsMarkup(product) {
  return productItems(product).map((item) => `
    <tr>
      <td><strong>${item.variant}</strong></td>
      <td class="size">${item.size}</td>
      <td><span class="variant-cost">${item.cost}</span></td>
      <td>${priceMarkup(item)}</td>
      <td><span class="quantity ${item.available ? "available" : "zero"}">${item.available}</span></td>
      <td><span class="quantity reserved">${item.reserved}</span></td>
      <td><span class="incident-count${item.incidents ? " is-open" : ""}">${item.incidents}</span></td>
      <td><button class="detail-row-action" type="button" data-detail-action="movements" data-ref="${item.ref}" data-variant="${item.variant}" data-size="${item.size}">Ver movimientos</button></td>
    </tr>
  `).join("");
}

function productRowMarkup(product) {
  const totals = productTotals(product);
  const status = productStatus(product);
  const expanded = expandedProducts.has(product.ref);
  return `
    <tr class="product-row" data-ref="${product.ref}">
      <td>
        <span class="product-cell">
          <button class="expand-product" type="button" aria-expanded="${expanded}" aria-label="${expanded ? "Ocultar" : "Mostrar"} variantes de ${product.name}"><span aria-hidden="true">›</span></button>
          <img src="${product.image}" alt="" />
          <span><strong>${product.name}</strong><small>${product.category} · ${product.supplier}</small></span>
        </span>
      </td>
      <td><span class="product-reference">${product.ref}</span></td>
      <td><button class="variant-summary" type="button" aria-expanded="${expanded}">${variantSummary(product)}</button></td>
      <td>${priceMarkup(product)}</td>
      <td><span class="quantity ${totals.available ? "available" : "zero"}">${totals.available}</span></td>
      <td><span class="quantity reserved">${totals.reserved}</span></td>
      <td><span class="product-status is-${status}">${statusLabel(status)}</span></td>
      <td>
        <details class="row-menu">
          <summary aria-label="Acciones para ${product.name}">⋮</summary>
          <div class="row-menu-items">
            <button type="button" data-action="edit">Editar producto</button>
            <button type="button" data-action="stock">Ajustar existencias</button>
            <button type="button" data-action="movements">Ver movimientos</button>
            <button type="button" data-action="gallery">Gestionar imágenes</button>
            <button type="button" data-action="toggle-active">${status === "inactive" ? "Activar" : "Desactivar"}</button>
          </div>
        </details>
      </td>
    </tr>
    ${expanded ? `<tr class="variant-detail-row"><td colspan="8"><div class="variant-panel"><div class="variant-table-wrap"><table><caption class="sr-only">Disponibilidad por variante de ${product.name}</caption><thead><tr><th>Variante</th><th>Talla</th><th>Costo</th><th>Precio</th><th>Disponible</th><th>Reservado</th><th>Incidencias</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${detailRowsMarkup(product)}</tbody></table></div></div></td></tr>` : ""}
  `;
}

function productCardMarkup(product) {
  const totals = productTotals(product);
  const status = productStatus(product);
  const items = productItems(product);
  const colors = compactValues(items.map((item) => item.variant), 3);
  const sizes = compactValues(items.map((item) => item.size), 4);
  return `
    <article class="product-card is-${status}" data-ref="${product.ref}">
      <button type="button" class="product-card-open" data-product-ref="${product.ref}" aria-label="Ver detalle de ${product.name}">
        <span class="product-card-image">
          <img src="${product.image}" alt="${product.name}" />
          <span class="product-status is-${status}">${statusLabel(status)}</span>
        </span>
        <span class="product-card-body">
          <span class="product-card-context">${product.category} · ${product.supplier}</span>
          <span class="product-card-heading"><strong>${product.name}</strong><span class="product-card-price">${priceMarkup(product)}</span></span>
          <span class="product-reference">${product.ref}</span>
          <span class="product-card-attributes">
            <span><small>Colores</small><strong>${colors}</strong></span>
            <span><small>Tallas</small><strong>${sizes}</strong></span>
          </span>
          <span class="product-card-stock"><strong class="${totals.available ? "available" : "zero"}">${totals.available} disponibles</strong><span aria-hidden="true">·</span><strong class="reserved">${totals.reserved} reservados</strong></span>
        </span>
      </button>
      <details class="card-menu">
        <summary aria-label="Acciones para ${product.name}">⋮</summary>
        <div class="row-menu-items">
          <button type="button" data-action="edit">Editar producto</button>
          <button type="button" data-action="stock">Ajustar existencias</button>
          <button type="button" data-action="movements">Ver movimientos</button>
          <button type="button" data-action="gallery">Gestionar imágenes</button>
          <button type="button" data-action="toggle-active">${status === "inactive" ? "Activar" : "Desactivar"}</button>
        </div>
      </details>
    </article>
  `;
}

function renderPagination(pageCount, start, visibleCount, total) {
  const pagination = document.querySelector(".pagination");
  const first = total ? start + 1 : 0;
  const last = start + visibleCount;
  const pageButtons = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === currentPage ? "is-page" : ""}" type="button" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
  }).join("");
  pagination.innerHTML = `<p>Mostrando ${first}-${last} de ${total} productos</p><div class="page-controls"><button id="previousPage" type="button" ${currentPage === 1 ? "disabled" : ""} aria-label="Página anterior">‹</button><div class="page-numbers" aria-label="Páginas">${pageButtons}</div><button id="nextPage" type="button" ${currentPage === pageCount ? "disabled" : ""} aria-label="Página siguiente">›</button></div>`;
  document.querySelector("#previousPage").addEventListener("click", () => { currentPage -= 1; render(); });
  document.querySelector("#nextPage").addEventListener("click", () => { currentPage += 1; render(); });
  pagination.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
    currentPage = Number(button.dataset.page);
    render();
  }));
}

function render() {
  const term = search.value.trim().toLocaleLowerCase("es");
  const hasFilters = Boolean(term || category.value || availability.value || size.value || supplier.value);
  clearFilters.hidden = !hasFilters;
  filteredCatalog = catalog.filter((product) => {
    const items = productItems(product);
    const searchable = `${product.name} ${product.ref} ${product.category} ${product.supplier} ${items.map((item) => item.size).join(" ")}`.toLocaleLowerCase("es");
    return searchable.includes(term)
      && (!category.value || product.category === category.value)
      && (!availability.value || productStatus(product) === availability.value)
      && (!size.value || items.some((item) => item.size === size.value))
      && (!supplier.value || product.supplier === supplier.value);
  });
  const pageSize = viewMode === "grid" ? 8 : 15;
  const pageCount = Math.max(1, Math.ceil(filteredCatalog.length / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * pageSize;
  visibleProducts = filteredCatalog.slice(start, start + pageSize);
  tableView.hidden = viewMode !== "table" || filteredCatalog.length === 0;
  gridView.hidden = viewMode !== "grid" || filteredCatalog.length === 0;
  emptyState.hidden = filteredCatalog.length !== 0;
  viewButtons.forEach((button) => {
    const active = button.dataset.view === viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelector("#resultCount").textContent = `${filteredCatalog.length} ${filteredCatalog.length === 1 ? "producto" : "productos"}`;
  rows.innerHTML = viewMode === "table" ? visibleProducts.map(productRowMarkup).join("") : "";
  gridView.innerHTML = viewMode === "grid" ? visibleProducts.map(productCardMarkup).join("") : "";
  rows.querySelectorAll(".row-menu").forEach((menu) => menu.addEventListener("toggle", () => {
    if (menu.open) rows.querySelectorAll(".row-menu[open]").forEach((other) => { if (other !== menu) other.open = false; });
  }));
  gridView.querySelectorAll(".card-menu").forEach((menu) => menu.addEventListener("toggle", () => {
    if (menu.open) gridView.querySelectorAll(".card-menu[open]").forEach((other) => { if (other !== menu) other.open = false; });
  }));
  renderPagination(pageCount, start, visibleProducts.length, filteredCatalog.length);
}

function exportFilteredProducts() {
  const exportRows = filteredCatalog.map((product) => {
    const totals = productTotals(product);
    return {
      name: product.name,
      ref: product.ref,
      category: product.category,
      supplier: product.supplier,
      variantCount: productItems(product).length,
      price: product.salePrice || product.price,
      available: totals.available,
      reserved: totals.reserved,
      status: statusLabel(productStatus(product))
    };
  });
  const blob = new Blob([ProductsExport.buildCsv(exportRows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "productos.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clear() {
  filtersForm.reset();
  currentPage = 1;
  render();
  search.focus();
}

search.addEventListener("input", () => { currentPage = 1; render(); });
[category, availability, size, supplier].forEach((control) => control.addEventListener("change", () => { currentPage = 1; render(); }));
clearFilters.addEventListener("click", (event) => { event.preventDefault(); clear(); });
document.querySelector("#emptyClear").addEventListener("click", clear);
viewButtons.forEach((button) => button.addEventListener("click", () => {
  viewMode = button.dataset.view;
  currentPage = 1;
  render();
}));
exportProducts.addEventListener("click", exportFilteredProducts);

rows.addEventListener("click", (event) => {
  const detailAction = event.target.closest("[data-detail-action]");
  if (detailAction) {
    const item = products.find((entry) => entry.ref === detailAction.dataset.ref && entry.variant === detailAction.dataset.variant && entry.size === detailAction.dataset.size);
    openDialog(item, detailAction.dataset.detailAction);
    return;
  }
  const row = event.target.closest(".product-row");
  if (!row) return;
  const product = catalog.find((entry) => entry.ref === row.dataset.ref);
  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.dataset.action === "toggle-active") {
      product.active = product.active === false;
      render();
    } else {
      openDialog(product, action.dataset.action);
    }
    return;
  }
  if (event.target.closest(".expand-product, .variant-summary")) {
    expandedProducts.has(product.ref) ? expandedProducts.delete(product.ref) : expandedProducts.add(product.ref);
    render();
  }
});

gridView.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) {
    const card = action.closest(".product-card");
    const product = catalog.find((entry) => entry.ref === card.dataset.ref);
    if (action.dataset.action === "toggle-active") {
      product.active = product.active === false;
      render();
    } else {
      openDialog(product, action.dataset.action);
    }
    return;
  }
  const button = event.target.closest("[data-product-ref]");
  if (!button) return;
  openDialog(catalog.find((product) => product.ref === button.dataset.productRef), "details");
});

const root = document.documentElement;
const themeButton = document.querySelector(".theme-button");
function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.querySelector(".theme-label").textContent = dark ? "Modo claro" : "Modo oscuro";
  localStorage.setItem("pw-theme", theme);
}
setTheme(localStorage.getItem("pw-theme") || "light");
themeButton.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));

const productDialog = document.querySelector("#productDialog");
const dialogTitle = document.querySelector("#dialogTitle");
const dialogKicker = document.querySelector("#dialogKicker");
const dialogContent = document.querySelector("#dialogContent");
let dialogItem;
let dialogAction;

function galleryMarkup(product) {
  const images = imagesByProduct.get(product.ref) || [];
  const figures = images.map((image, index) => `<figure><img src="${image}" alt="${product.name}${index ? `, imagen ${index + 1}` : ", portada"}"><figcaption><strong>${index ? `Imagen ${index + 1}` : "Portada actual"}</strong><button type="button" class="text-action" data-delete-image="${index}">Eliminar</button></figcaption></figure>`).join("");
  return `<div class="gallery-toolbar"><p>Las imágenes pertenecen al producto completo, no a cada talla.</p><strong>${images.length} ${images.length === 1 ? "imagen" : "imágenes"}</strong></div><div class="image-gallery">${figures || '<p class="gallery-empty">Aún no hay imágenes. Sube la primera para que aparezca en el catálogo.</p>'}<label class="upload-tile"><span aria-hidden="true">＋</span>Subir imágenes<input type="file" accept="image/*" multiple aria-label="Subir imágenes de ${product.name}"></label></div>`;
}

function movementsMarkup(item) {
  const isProductHistory = !item.variant;
  const scopedMovements = movementHistory.map((movement) => isProductHistory ? movement : { ...movement, variant: item.variant, size: item.size });
  const filteredMovements = scopedMovements.filter((movement) => (
    (!movementFilters.type || movement.type === movementFilters.type)
    && (!movementFilters.variant || movement.variant === movementFilters.variant)
    && (!movementFilters.size || movement.size === movementFilters.size)
  ));
  const sorted = [...filteredMovements].sort((a, b) => movementOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const rowsMarkup = sorted.map((movement) => `<tr><td>${movement.label}</td><td><strong class="movement-type">${movement.type}</strong></td><td>${movement.variant}</td><td class="size">${movement.size}</td><td>${movement.origin}</td><td>${movement.destination}</td><td class="movement-${movement.direction}">${movement.direction === "in" ? "+" : "−"}${movement.quantity}</td></tr>`).join("");
  const direction = movementOrder === "desc" ? "↓" : "↑";
  const orderLabel = movementOrder === "desc" ? "más reciente primero" : "más antiguo primero";
  const types = [...new Set(movementHistory.map((movement) => movement.type))];
  const variants = [...new Set(movementHistory.map((movement) => movement.variant))];
  const sizes = [...new Set(movementHistory.map((movement) => movement.size))];
  const optionMarkup = (values, selected) => values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`).join("");
  const filtersMarkup = isProductHistory ? `<form class="movement-filters" id="movementFilters"><label>Tipo de movimiento<select name="type"><option value="">Todos</option>${optionMarkup(types, movementFilters.type)}</select></label><label>Color<select name="variant"><option value="">Todos</option>${optionMarkup(variants, movementFilters.variant)}</select></label><label>Talla<select name="size"><option value="">Todas</option>${optionMarkup(sizes, movementFilters.size)}</select></label></form>` : "";
  const intro = isProductHistory
    ? `Historial de todas las variantes. ${filteredMovements.length} ${filteredMovements.length === 1 ? "movimiento" : "movimientos"}.`
    : `Historial de color ${item.variant}, talla ${item.size}. ${filteredMovements.length} ${filteredMovements.length === 1 ? "movimiento" : "movimientos"}.`;
  const emptyMarkup = '<tr><td class="movement-empty" colspan="7">No hay movimientos que coincidan con estos filtros.</td></tr>';
  return `<p class="dialog-intro">${intro}</p>${filtersMarkup}<div class="movement-table-wrap"><table class="movement-table"><thead><tr><th aria-sort="${movementOrder === "desc" ? "descending" : "ascending"}"><button class="movement-sort" type="button" data-sort-movements aria-label="Ordenar fecha: ${orderLabel}">Fecha <span aria-hidden="true">${direction}</span></button></th><th>Tipo</th><th>Color</th><th>Talla</th><th>Origen</th><th>Destino</th><th>Cantidad</th></tr></thead><tbody>${rowsMarkup || emptyMarkup}</tbody></table></div>`;
}

function productDetailsMarkup(product) {
  const totals = productTotals(product);
  return `<div class="product-detail-summary"><img src="${product.image}" alt="${product.name}"><div><span>${product.category}</span><strong>${product.salePrice || product.price}</strong>${product.salePrice ? `<small>Precio regular ${product.price}</small>` : ""}<dl><div><dt>Disponible</dt><dd class="${totals.available ? "available" : "zero"}">${totals.available}</dd></div><div><dt>Reservado</dt><dd class="reserved">${totals.reserved}</dd></div><div><dt>Estado</dt><dd>${statusLabel(productStatus(product))}</dd></div></dl></div></div><div class="product-size-heading"><div><h3>Disponibilidad por variante</h3><p>${variantSummary(product)}.</p></div><button type="button" class="detail-row-action" data-dialog-action="gallery">Gestionar imágenes</button></div><div class="movement-table-wrap product-size-table"><table class="movement-table"><thead><tr><th>Variante</th><th>Talla</th><th>Costo</th><th>Precio</th><th>Disponible</th><th>Reservado</th><th>Incidencias</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${detailRowsMarkup(product)}</tbody></table></div>`;
}

function editProductMarkup(product) {
  return `<form class="product-form" id="editProductForm"><label>Nombre<input name="name" value="${product.name}" required></label><label>Referencia<input name="ref" value="${product.ref}" disabled></label><label>Categoría<select name="category"><option ${product.category === "Vestidos" ? "selected" : ""}>Vestidos</option><option ${product.category === "Pantalones" ? "selected" : ""}>Pantalones</option><option ${product.category === "Blusas" ? "selected" : ""}>Blusas</option><option ${product.category === "Faldas" ? "selected" : ""}>Faldas</option></select></label><label>Proveedor<input name="supplier" value="${product.supplier}" required></label><div class="dialog-form-actions"><button type="button" class="secondary-dialog-action" data-close-dialog>Cancelar</button><button type="submit">Guardar cambios</button></div></form>`;
}

function stockAdjustmentMarkup(product) {
  const options = productItems(product).map((item, index) => `<option value="${index}">${item.variant} · Talla ${item.size} · ${item.available} disponibles</option>`).join("");
  return `<form class="product-form" id="stockAdjustmentForm"><p class="dialog-intro">Registra una corrección puntual en las existencias de una variante.</p><label>Variante y talla<select name="itemIndex">${options}</select></label><label>Cantidad a sumar o restar<input name="quantity" type="number" value="1" required></label><label>Motivo<select name="reason"><option>Corrección de conteo</option><option>Devolución</option><option>Merma</option></select></label><div class="dialog-form-actions"><button type="button" class="secondary-dialog-action" data-close-dialog>Cancelar</button><button type="submit">Aplicar ajuste</button></div></form>`;
}

function openDialog(item, action) {
  const product = item.variants ? item : catalog.find((entry) => entry.ref === item.ref);
  dialogItem = action === "movements" ? item : product;
  dialogAction = action;
  productDialog.classList.toggle("is-gallery", action === "gallery");
  productDialog.classList.toggle("is-details", action === "details");
  productDialog.classList.toggle("is-movements", action === "movements");
  if (action === "movements") movementFilters = { type: "", variant: "", size: "" };
  dialogKicker.textContent = `${product.name} · ${product.ref}`;
  const titles = { gallery: "Imágenes del producto", details: "Detalle del producto", movements: "Movimientos de inventario", edit: "Editar producto", stock: "Ajustar existencias" };
  dialogTitle.textContent = titles[action];
  const content = { gallery: galleryMarkup, details: productDetailsMarkup, movements: movementsMarkup, edit: editProductMarkup, stock: stockAdjustmentMarkup };
  dialogContent.innerHTML = content[action](dialogItem);
  if (!productDialog.open) productDialog.showModal();
}

document.querySelector(".dialog-close").addEventListener("click", () => productDialog.close());
dialogContent.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-dialog]")) {
    productDialog.close();
    return;
  }
  const dialogLink = event.target.closest("[data-dialog-action]");
  if (dialogLink) {
    openDialog(dialogItem, dialogLink.dataset.dialogAction);
    return;
  }
  const detailAction = event.target.closest("[data-detail-action]");
  if (detailAction) {
    const item = products.find((entry) => entry.ref === detailAction.dataset.ref && entry.variant === detailAction.dataset.variant && entry.size === detailAction.dataset.size);
    openDialog(item, detailAction.dataset.detailAction);
    return;
  }
  const sort = event.target.closest("[data-sort-movements]");
  if (sort) {
    movementOrder = movementOrder === "desc" ? "asc" : "desc";
    dialogContent.innerHTML = movementsMarkup(dialogItem);
    return;
  }
  const remove = event.target.closest("[data-delete-image]");
  if (!remove) return;
  const images = imagesByProduct.get(dialogItem.ref);
  images.splice(Number(remove.dataset.deleteImage), 1);
  dialogContent.innerHTML = galleryMarkup(dialogItem);
});

dialogContent.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  if (dialogAction === "edit") {
    dialogItem.name = data.get("name").trim();
    dialogItem.category = data.get("category");
    dialogItem.supplier = data.get("supplier").trim();
    productItems(dialogItem).forEach((item) => {
      item.name = dialogItem.name;
      item.category = dialogItem.category;
      item.supplier = dialogItem.supplier;
    });
  }
  if (dialogAction === "stock") {
    const item = productItems(dialogItem)[Number(data.get("itemIndex"))];
    item.available = Math.max(0, item.available + Number(data.get("quantity")));
  }
  productDialog.close();
  render();
});

dialogContent.addEventListener("change", (event) => {
  if (event.target.closest("#movementFilters")) {
    const data = new FormData(event.target.form);
    movementFilters = { type: data.get("type"), variant: data.get("variant"), size: data.get("size") };
    dialogContent.innerHTML = movementsMarkup(dialogItem);
    return;
  }
  if (!event.target.matches('input[type="file"]') || !event.target.files.length) return;
  const images = imagesByProduct.get(dialogItem.ref);
  Promise.all([...event.target.files].map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.readAsDataURL(file);
  }))).then((newImages) => {
    images.push(...newImages);
    dialogContent.innerHTML = galleryMarkup(dialogItem);
  });
});

render();
