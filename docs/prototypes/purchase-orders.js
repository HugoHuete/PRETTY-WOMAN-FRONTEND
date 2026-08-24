const sourceOrders = Array.isArray(window.purchaseOrders) ? window.purchaseOrders : [];
const rows = document.querySelector("#orderRows");
const table = document.querySelector("#ordersTable");
const tableRegion = document.querySelector("#ordersList");
const filters = document.querySelector("#orderFilters");
const dateFrom = document.querySelector("#orderDateFrom");
const dateTo = document.querySelector("#orderDateTo");
const dateError = document.querySelector("#orderDateError");
const status = document.querySelector("#orderStatus");
const supplier = document.querySelector("#orderSupplier");
const sort = document.querySelector("#orderSort");
const clearFilters = document.querySelector("#clearOrderFilters");
const empty = document.querySelector("#orderEmpty");
const emptyTitle = document.querySelector("#orderEmptyTitle");
const emptyDescription = document.querySelector("#orderEmptyDescription");
const clearEmptyFilters = document.querySelector("#clearEmptyFilters");
const loading = document.querySelector("#orderLoading");
const errorState = document.querySelector("#orderError");
const forbiddenState = document.querySelector("#orderForbidden");
const pagination = document.querySelector("#ordersPagination");
const paginationText = document.querySelector("#orderPaginationText");
const pageButtons = document.querySelector("#orderPageButtons");
const previousPage = document.querySelector("#previousOrderPage");
const nextPage = document.querySelector("#nextOrderPage");
const pageSize = 7;
const demoState = new URLSearchParams(window.location.search).get("state");
let currentPage = 1;

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const cordobas = amount => `C$ ${amount.toLocaleString("es-NI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const amountInCordobas = (amount, order) => (
  order.currency === "NIO" ? amount : amount * order.exchangeRate
);

const totalInCordobas = order => amountInCordobas(
  order.merchandiseAmount + order.shippingAmount,
  order,
);

const badge = order => {
  const statusClass = order.label === "Cerrada con pérdida" ? "resolved-loss" : order.status;
  return `<span class="order-status status-${escapeHtml(statusClass)}">${escapeHtml(order.label)}</span>`;
};

function setVisibleState(state) {
  loading.hidden = state !== "loading";
  errorState.hidden = state !== "error";
  forbiddenState.hidden = state !== "forbidden";
  table.hidden = state !== "table";
  empty.hidden = state !== "empty";
  pagination.hidden = state !== "table";
  tableRegion.setAttribute("aria-busy", String(state === "loading"));
}

function renderPagination(total) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  const first = total ? (currentPage - 1) * pageSize + 1 : 0;
  const last = Math.min(currentPage * pageSize, total);

  paginationText.textContent = total
    ? `Mostrando ${first}–${last} de ${total} órdenes`
    : "Mostrando 0 órdenes";
  previousPage.disabled = currentPage === 1 || total === 0;
  nextPage.disabled = currentPage === pageCount || total === 0;
  pageButtons.innerHTML = total ? Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === currentPage ? "is-page" : ""}" type="button" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ""} aria-label="Página ${page}">${page}</button>`;
  }).join("") : "";

  pageButtons.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      currentPage = Number(button.dataset.page);
      render();
      tableRegion.focus({ preventScroll: true });
    });
  });
}

function filterOrders(orders) {
  return orders.filter(order => {
    return (!dateFrom.value || order.purchaseDate >= dateFrom.value)
      && (!dateTo.value || order.purchaseDate <= dateTo.value)
      && (!status.value || order.status === status.value)
      && (!supplier.value || order.supplier === supplier.value);
  });
}

function sortOrders(orders) {
  const sorted = [...orders];
  const recentFirst = (a, b) => b.purchaseDate.localeCompare(a.purchaseDate);
  if (sort.value === "oldest") return sorted.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  if (sort.value === "total-desc") return sorted.sort((a, b) => totalInCordobas(b) - totalInCordobas(a));
  if (sort.value === "total-asc") return sorted.sort((a, b) => totalInCordobas(a) - totalInCordobas(b));
  return sorted.sort(recentFirst);
}

function renderRows(orders) {
  rows.innerHTML = orders.map(order => {
    const merchandiseCordobas = amountInCordobas(order.merchandiseAmount, order);
    const shippingCordobas = amountInCordobas(order.shippingAmount, order);
    const totalCordobas = totalInCordobas(order);
    const detailUrl = `purchase-order-detail.html?id=${encodeURIComponent(order.id)}`;
    return `<tr>
      <td data-label="Orden y proveedor"><a class="order-number" href="${detailUrl}">#${escapeHtml(order.id)}</a><strong class="order-supplier">${escapeHtml(order.supplier)}</strong></td>
      <td data-label="Fecha"><time datetime="${escapeHtml(order.purchaseDate)}">${escapeHtml(order.date)}</time></td>
      <td data-label="Monto (C$)" class="order-money order-amount"><strong>${cordobas(merchandiseCordobas)}</strong></td>
      <td data-label="Costo envío (C$)" class="order-money order-shipping"><strong>${cordobas(shippingCordobas)}</strong></td>
      <td data-label="Total (C$)" class="order-money order-total"><strong>${cordobas(totalCordobas)}</strong></td>
      <td data-label="Estado"><div class="order-state-cell">${badge(order)}</div></td>
      <td class="order-row-action"><a class="order-detail-link" href="${detailUrl}" aria-label="Ver detalle de la orden ${escapeHtml(order.id)}">Ver detalle</a></td>
    </tr>`;
  }).join("");
}

function renderEmpty(reason) {
  if (reason === "invalid-date") {
    emptyTitle.textContent = "Corrige el rango de fechas";
    emptyDescription.textContent = "La fecha inicial debe ser igual o anterior a la fecha final.";
    clearEmptyFilters.textContent = "Restablecer fechas";
  } else if (!sourceOrders.length || demoState === "empty") {
    emptyTitle.textContent = "Aún no hay órdenes de compra";
    emptyDescription.textContent = "Crea la primera orden para comenzar a dar seguimiento a tus compras.";
    clearEmptyFilters.textContent = "Crear primera orden";
  } else {
    emptyTitle.textContent = "No hay órdenes que coincidan";
    emptyDescription.textContent = "Prueba con otros filtros o restablece los valores.";
    clearEmptyFilters.textContent = "Limpiar filtros";
  }
  setVisibleState("empty");
}

function render() {
  const hasActiveFilters = Boolean(dateFrom.value || dateTo.value || status.value || supplier.value || sort.value !== "recent");
  clearFilters.hidden = !hasActiveFilters;

  if (demoState === "loading") {
    setVisibleState("loading");
    return;
  }
  if (demoState === "error") {
    setVisibleState("error");
    return;
  }
  if (demoState === "forbidden") {
    setVisibleState("forbidden");
    return;
  }

  const invalidDateRange = dateFrom.value && dateTo.value && dateFrom.value > dateTo.value;
  dateError.hidden = !invalidDateRange;
  dateFrom.toggleAttribute("aria-invalid", invalidDateRange);
  dateTo.toggleAttribute("aria-invalid", invalidDateRange);
  if (invalidDateRange) {
    renderPagination(0);
    renderEmpty("invalid-date");
    return;
  }

  const availableOrders = demoState === "empty" ? [] : sourceOrders;
  const filtered = sortOrders(filterOrders(availableOrders));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (!visible.length) {
    renderPagination(0);
    renderEmpty("filtered");
    return;
  }

  renderRows(visible);
  setVisibleState("table");
  renderPagination(filtered.length);
}

function resetPageAndRender() {
  currentPage = 1;
  render();
}

function resetFilters() {
  filters.reset();
  currentPage = 1;
  window.setTimeout(() => {
    render();
    const supplierTrigger = supplier.nextElementSibling?.querySelector(".pretty-select__trigger");
    (supplierTrigger || supplier).focus();
  });
}

[dateFrom, dateTo, status, supplier, sort].forEach(control => control.addEventListener("change", resetPageAndRender));

previousPage.addEventListener("click", () => {
  currentPage -= 1;
  render();
});

nextPage.addEventListener("click", () => {
  currentPage += 1;
  render();
});

clearFilters.addEventListener("click", event => {
  event.preventDefault();
  resetFilters();
});

clearEmptyFilters.addEventListener("click", () => {
  if (!sourceOrders.length || demoState === "empty") {
    window.location.href = "purchase-order-create.html";
    return;
  }
  resetFilters();
});

document.querySelector("#retryOrders").addEventListener("click", () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url);
  window.location.reload();
});

const root = document.documentElement;
const themeButton = document.querySelector(".theme-button");

function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  themeButton.querySelector(".theme-label").textContent = dark ? "Modo claro" : "Modo oscuro";
  localStorage.setItem("pw-theme", theme);
}

setTheme(localStorage.getItem("pw-theme") || "light");
themeButton.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
render();
