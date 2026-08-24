const shipments = [
  {
    id: "DEL-0126",
    saleId: "V-0126",
    client: "Camila Ríos",
    phone: "+505 8632 9988",
    municipality: "Managua",
    agency: "MANDA",
    amount: 150,
    status: "sent",
    date: "Hoy · 8:52 a. m.",
    sentAt: "Hoy · 11:15 a. m.",
    address: "Las Colinas, del portón principal 2 cuadras al sur, casa 42.",
    note: "Llamar antes de llegar."
  },
  {
    id: "DEL-0125",
    saleId: "V-0125",
    client: "Sofía Gómez",
    phone: "+505 8547 1122",
    municipality: "Masaya",
    agency: "Cargo Express",
    amount: 150,
    status: "ready",
    date: "Hoy · 9:18 a. m.",
    address: "Barrio San Jerónimo, de la iglesia 1 cuadra al este.",
    note: "Entregar después de las 3:00 p. m."
  },
  {
    id: "DEL-0124",
    saleId: "V-0124",
    client: "Paola Ruiz",
    phone: "+505 8881 6677",
    municipality: "Ciudad Sandino",
    agency: "MANDA",
    amount: 120,
    status: "delivered",
    date: "18 jul 2026 · 2:20 p. m.",
    deliveredAt: "18 jul 2026 · 5:42 p. m.",
    address: "Zona 8, frente al parque central."
  },
  {
    id: "DEL-0123",
    saleId: "V-0123",
    client: "Ana Martínez",
    phone: "+505 8888 2200",
    municipality: "Managua",
    agency: "Entrega local",
    amount: 100,
    status: "pending",
    date: "17 jul 2026 · 11:38 a. m.",
    address: "Colonia Centroamérica, casa 18."
  },
  {
    id: "DEL-0122",
    saleId: "V-0122",
    client: "Laura Silva",
    phone: "+505 8722 1450",
    municipality: "Granada",
    agency: "Cargo Express",
    amount: 180,
    status: "failed",
    date: "16 jul 2026 · 9:12 a. m.",
    address: "Reparto San Juan, casa 7.",
    note: "La agencia reportó dirección incompleta."
  },
  {
    id: "DEL-0121",
    saleId: "V-0121",
    client: "María López",
    phone: "+505 8756 4321",
    municipality: "León",
    agency: "Cargo Express",
    amount: 200,
    status: "sent",
    date: "15 jul 2026 · 1:05 p. m.",
    sentAt: "16 jul 2026 · 8:10 a. m.",
    address: "San Felipe, de la catedral 2 cuadras al norte."
  },
  {
    id: "DEL-0120",
    saleId: "V-0120",
    client: "Valeria Torres",
    phone: "+505 8666 1044",
    municipality: "Managua",
    agency: "MANDA",
    amount: 150,
    status: "cancelled",
    date: "14 jul 2026 · 4:20 p. m.",
    address: "Villa Venezuela, casa 24.",
    note: "Cancelado a solicitud de la clienta."
  }
];

const statusLabels = {
  pending: "Por preparar",
  ready: "Lista para despacho",
  sent: "En tránsito",
  delivered: "Entregada",
  failed: "Entrega fallida",
  cancelled: "Cancelada"
};

const statusIcons = { pending: "○", ready: "▣", sent: "↗", delivered: "✓", failed: "!", cancelled: "×" };
const rows = document.querySelector("#shipmentRows");
const tableRegion = document.querySelector("#shipmentTableRegion");
const emptyState = document.querySelector("#shipmentEmptyState");
const detail = document.querySelector("#shipmentDetail");
const search = document.querySelector("#shipmentSearch");
const agency = document.querySelector("#shipmentAgency");
const status = document.querySelector("#shipmentStatus");
const filters = document.querySelector("#shipmentFilters");
const clearFilters = document.querySelector("#clearShipmentFilters");
const resultCount = document.querySelector("#shipmentResultCount");
const paginationText = document.querySelector("#shipmentPaginationText");
const previousPage = document.querySelector("#previousShipmentPage");
const nextPage = document.querySelector("#nextShipmentPage");
const pageNumber = document.querySelector("#shipmentPageNumber");
const toast = document.querySelector("#shipmentToast");
const shipmentEditDialog = document.querySelector("#shipmentEditDialog");
const shipmentEditForm = document.querySelector("#shipmentEditForm");
const shipmentEditError = document.querySelector("#shipmentEditError");
const shipmentActionDialog = document.querySelector("#shipmentActionDialog");
const shipmentActionForm = document.querySelector("#shipmentActionForm");
const shipmentActionTitle = document.querySelector("#shipmentActionTitle");
const shipmentActionSummary = document.querySelector("#shipmentActionSummary");
const shipmentActionConfirm = document.querySelector("#shipmentActionConfirm");
const root = document.documentElement;
const themeButton = document.querySelector(".theme-button");
let selected = shipments[0];
let currentPage = 1;
const pageSize = 6;
let toastTimer;
let pendingShipmentAction;

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

const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[character]));

function filteredShipments() {
  const term = search.value.trim().toLocaleLowerCase("es");
  return shipments.filter((shipment) => {
    const haystack = [shipment.id, shipment.saleId, shipment.client, shipment.phone, shipment.municipality, shipment.agency, shipment.address]
      .join(" ")
      .toLocaleLowerCase("es");
    return (!term || haystack.includes(term)) && (!agency.value || shipment.agency === agency.value) && (!status.value || shipment.status === status.value);
  });
}

function statusBadge(shipment) {
  return `<span class="shipment-status" data-status="${shipment.status}"><span aria-hidden="true">${statusIcons[shipment.status]}</span>${statusLabels[shipment.status]}</span>`;
}

function renderSummary() {
  const count = (value) => shipments.filter((shipment) => shipment.status === value).length;
  document.querySelector("#shipmentPendingCount").textContent = count("pending");
  document.querySelector("#shipmentReadyCount").textContent = count("ready");
  document.querySelector("#shipmentSentCount").textContent = count("sent");
  document.querySelector("#shipmentDeliveredCount").textContent = count("delivered");
}

function renderPagination(total) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, pages);
  previousPage.disabled = currentPage === 1 || total === 0;
  nextPage.disabled = currentPage === pages || total === 0;
  pageNumber.textContent = currentPage;
  const start = total ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, total);
  paginationText.textContent = total ? `Mostrando ${start}–${end} de ${total} envíos` : "Mostrando 0 envíos";
}

function renderRows(filtered) {
  const start = (currentPage - 1) * pageSize;
  rows.innerHTML = filtered.slice(start, start + pageSize).map((shipment) => `
    <tr data-shipment-id="${shipment.id}" class="${selected?.id === shipment.id ? "is-selected" : ""}" tabindex="0">
      <td><span class="shipment-id">${shipment.id}</span><small>${shipment.date}</small></td>
      <td><span class="shipment-sale">${shipment.saleId}</span><strong>${escapeHTML(shipment.client)}</strong><small>${escapeHTML(shipment.phone)}</small></td>
      <td><strong>${escapeHTML(shipment.municipality)}</strong><small>Entrega a domicilio</small></td>
      <td>${escapeHTML(shipment.agency)}</td>
      <td><strong class="shipment-amount">C$ ${shipment.amount.toLocaleString("es-NI", { minimumFractionDigits: 2 })}</strong></td>
      <td>${statusBadge(shipment)}</td>
    </tr>`).join("");
}

function renderShipmentDetail() {
  if (!selected) {
    detail.innerHTML = `<div class="shipment-detail-empty"><span aria-hidden="true">↗</span><strong>Selecciona un envío</strong><p>Aquí verás el destino y el siguiente paso.</p></div>`;
    return;
  }
  const action = selected.status === "ready"
    ? `<button class="detail-primary" type="button" id="markShipmentSent">Marcar como enviada</button>`
    : selected.status === "sent"
      ? `<button class="detail-primary" type="button" id="markShipmentDelivered">Marcar como entregada</button>`
      : selected.status === "failed"
        ? `<button class="detail-primary" type="button" id="retryShipment">Reintentar entrega</button>`
        : "";
  const transitActions = selected.status === "sent"
    ? `<details class="shipment-exception-actions"><summary><span class="shipment-exception-icon" aria-hidden="true">!</span><span class="shipment-exception-label"><strong>Acciones del envío</strong><small>Falla o cancelación</small></span><span class="shipment-exception-chevron" aria-hidden="true"></span></summary><div class="shipment-exception-menu" aria-label="Acciones del envío"><button class="detail-secondary detail-danger" type="button" id="markShipmentFailed">Registrar entrega fallida</button><button class="detail-secondary detail-danger" type="button" id="cancelShipment">Cancelar envío</button></div></details>`
    : "";
  detail.innerHTML = `
    <header class="shipment-detail-header">
      <div><p>Detalle de envío</p><h2>${selected.id}</h2><span>${selected.saleId} · ${escapeHTML(selected.client)}</span></div>
      ${statusBadge(selected)}
    </header>
    <section class="shipment-detail-section shipment-destination"><div class="shipment-detail-section-heading"><h3>Destino</h3><a href="tel:${escapeHTML(selected.phone)}">${escapeHTML(selected.phone)}</a></div><strong>${escapeHTML(selected.municipality)}</strong><p>${escapeHTML(selected.address)}</p><small>${escapeHTML(selected.agency)} · C$ ${selected.amount.toLocaleString("es-NI", { minimumFractionDigits: 2 })}</small></section>
    ${selected.note ? `<p class="shipment-note"><strong>Nota</strong>${escapeHTML(selected.note)}</p>` : ""}
    ${selected.statusReason ? `<p class="shipment-status-note"><strong>${selected.status === "failed" ? "Motivo de la falla" : "Motivo de cancelación"}</strong>${escapeHTML(selected.statusReason)}</p>` : ""}
    <div class="shipment-detail-actions">${action}<div class="shipment-detail-links"><button class="detail-secondary" type="button" id="editShipment">Editar envío</button><a class="detail-secondary" href="sales.html">Ver venta ${selected.saleId}</a></div>${transitActions}</div>`;
  detail.querySelector("#markShipmentSent")?.addEventListener("click", () => updateShipmentStatus("sent", "El envío quedó marcado como enviado."));
  detail.querySelector("#markShipmentDelivered")?.addEventListener("click", () => updateShipmentStatus("delivered", "Entrega registrada correctamente."));
  detail.querySelector("#retryShipment")?.addEventListener("click", () => { selected.statusReason = undefined; updateShipmentStatus("ready", "El envío volvió a quedar listo para despacho."); });
  detail.querySelector("#editShipment")?.addEventListener("click", openShipmentEdit);
  detail.querySelector("#markShipmentFailed")?.addEventListener("click", () => openShipmentAction("failed"));
  detail.querySelector("#cancelShipment")?.addEventListener("click", () => openShipmentAction("cancelled"));
}

function openShipmentAction(action) {
  if (!selected || selected.status !== "sent") return;
  pendingShipmentAction = action;
  shipmentActionForm.reset();
  const isFailure = action === "failed";
  shipmentActionTitle.textContent = isFailure ? "Registrar entrega fallida" : "Cancelar envío";
  shipmentActionSummary.textContent = isFailure
    ? "La entrega dejará de estar en tránsito. Podrás reintentarla después de corregir los datos."
    : "El envío dejará de estar en tránsito y la venta permanecerá activa.";
  shipmentActionConfirm.textContent = isFailure ? "Registrar falla" : "Cancelar envío";
  shipmentActionDialog.showModal();
  shipmentActionConfirm.focus();
}

function closeShipmentAction() {
  shipmentActionDialog.close();
  pendingShipmentAction = undefined;
}

function saveShipmentAction(event) {
  event.preventDefault();
  if (!selected || selected.status !== "sent" || !pendingShipmentAction) return;
  const isFailure = pendingShipmentAction === "failed";
  const nextStatus = pendingShipmentAction;
  selected.statusReason = undefined;
  closeShipmentAction();
  updateShipmentStatus(nextStatus, isFailure ? "La entrega fue registrada como fallida." : "El envío fue cancelado.");
}

function openShipmentEdit() {
  if (!selected) return;
  shipmentEditForm.elements.code.value = selected.id;
  shipmentEditForm.elements.client.value = selected.client;
  shipmentEditForm.elements.agency.value = selected.agency;
  shipmentEditForm.elements.municipality.value = selected.municipality;
  shipmentEditForm.elements.amount.value = selected.amount.toFixed(2);
  shipmentEditForm.elements.address.value = selected.address;
  shipmentEditError.hidden = true;
  shipmentEditDialog.showModal();
  shipmentEditForm.elements.code.focus();
}

function closeShipmentEdit() {
  shipmentEditDialog.close();
}

function saveShipmentEdit(event) {
  event.preventDefault();
  if (!selected || !shipmentEditForm.reportValidity()) return;
  const fields = shipmentEditForm.elements;
  const code = fields.code.value.trim().toUpperCase();
  const amount = Number(fields.amount.value);
  const duplicateCode = shipments.some((shipment) => shipment !== selected && shipment.id === code);
  if (duplicateCode) {
    shipmentEditError.textContent = "Ya existe un envío con ese código.";
    shipmentEditError.hidden = false;
    fields.code.focus();
    return;
  }
  if (!Number.isFinite(amount) || amount < 0) {
    shipmentEditError.textContent = "El costo de envío debe ser cero o mayor.";
    shipmentEditError.hidden = false;
    fields.amount.focus();
    return;
  }
  selected.id = code;
  selected.client = fields.client.value.trim();
  selected.agency = fields.agency.value;
  selected.municipality = fields.municipality.value;
  selected.amount = amount;
  selected.address = fields.address.value.trim();
  closeShipmentEdit();
  render();
  showToast("Cambios del envío guardados.");
}

function render() {
  const filtered = filteredShipments();
  clearFilters.hidden = !(search.value || agency.value || status.value);
  if (!filtered.some((shipment) => shipment.id === selected?.id)) selected = filtered[0] || null;
  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "envío" : "envíos"}`;
  tableRegion.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length > 0;
  renderRows(filtered);
  renderPagination(filtered.length);
  renderShipmentDetail();
  renderSummary();
}

function updateShipmentStatus(nextStatus, message) {
  if (!selected) return;
  selected.status = nextStatus;
  if (nextStatus === "sent") selected.sentAt = "Hoy · ahora";
  if (nextStatus === "delivered") selected.deliveredAt = "Hoy · ahora";
  render();
  showToast(message);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
}

function selectShipment(id) {
  selected = shipments.find((shipment) => shipment.id === id) || selected;
  render();
}

rows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-shipment-id]");
  if (row) selectShipment(row.dataset.shipmentId);
});
rows.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-shipment-id]");
  if (!row) return;
  event.preventDefault();
  selectShipment(row.dataset.shipmentId);
});
filters.addEventListener("input", () => { currentPage = 1; render(); });
filters.addEventListener("change", () => { currentPage = 1; render(); });
filters.addEventListener("reset", () => window.setTimeout(() => { currentPage = 1; render(); }, 0));
document.querySelector("#emptyShipmentClear").addEventListener("click", () => clearFilters.click());
previousPage.addEventListener("click", () => { currentPage -= 1; render(); });
nextPage.addEventListener("click", () => { currentPage += 1; render(); });
shipmentEditForm.addEventListener("submit", saveShipmentEdit);
document.querySelectorAll("[data-close-shipment-edit]").forEach((button) => button.addEventListener("click", closeShipmentEdit));
shipmentActionForm.addEventListener("submit", saveShipmentAction);
document.querySelectorAll("[data-close-shipment-action]").forEach((button) => button.addEventListener("click", closeShipmentAction));

render();
