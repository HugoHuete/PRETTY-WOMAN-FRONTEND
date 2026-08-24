const incidents = [
  {
    id: "INC-1048", product: "Vestido satinado", ref: "VSAT-CRL", variant: "Coral · M", type: "damaged", quantity: 1,
    reportedAt: "18 jul 2026, 10:24", reporter: "María Pérez", status: "open", availabilityImpact: "No disponible", description: "La prenda presenta una costura abierta en el costado derecho. Se separó del inventario disponible para revisión."
  },
  {
    id: "INC-1047", product: "Jeans rectos", ref: "JRET-AZM", variant: "Azul medio · 30", type: "missing", quantity: 1,
    reportedAt: "17 jul 2026, 16:05", reporter: "Ana López", status: "under-review", availabilityImpact: "No disponible", description: "No se encontró la variante durante el conteo de cierre. El caso está pendiente de confirmar con el equipo de tienda."
  },
  {
    id: "INC-1046", product: "Blusa seda", ref: "BLSE-CHP", variant: "Champán · SM", type: "dirty", quantity: 2,
    reportedAt: "16 jul 2026, 14:42", reporter: "María Pérez", status: "open", availabilityImpact: "No disponible", description: "Se identificaron manchas de maquillaje después de una prueba. Las dos unidades se enviaron a limpieza."
  },
  {
    id: "INC-1045", product: "Falda recta", ref: "FREC-NGR", variant: "Negro · S", type: "repairing", quantity: 1,
    reportedAt: "15 jul 2026, 11:18", reporter: "Ana López", status: "under-review", availabilityImpact: "No disponible", description: "El cierre requiere reparación. La prenda está en revisión antes de decidir si vuelve a estar disponible."
  },
  {
    id: "INC-1044", product: "Vestido midi estampado", ref: "VMID-FLR", variant: "Floral azul · L", type: "damaged", quantity: 1,
    reportedAt: "14 jul 2026, 09:37", reporter: "María Pérez", status: "resolved", resolution: "available", availabilityImpact: "Disponible nuevamente", description: "Se ajustó un botón desprendido y la prenda volvió al inventario disponible."
  },
  {
    id: "INC-1043", product: "Pantalón sastre", ref: "PSAS-BEI", variant: "Beige · 32", type: "missing", quantity: 1,
    reportedAt: "12 jul 2026, 17:20", reporter: "María Pérez", status: "resolved", resolution: "lost", availabilityImpact: "Pérdida confirmada", description: "Después del conteo físico se confirmó que la unidad no está en la tienda."
  },
  {
    id: "INC-1042", product: "Blusa manga globo", ref: "BMGL-OLV", variant: "Oliva · M", type: "dirty", quantity: 1,
    reportedAt: "10 jul 2026, 13:10", reporter: "Ana López", status: "cancelled", resolution: "cancelled", availabilityImpact: "Incidencia cancelada", description: "La alerta se canceló después de encontrar la prenda en el área de exhibición."
  },
  {
    id: "INC-1041", product: "Falda plisada", ref: "FPLI-ROS", variant: "Rosa · S", type: "repairing", quantity: 1,
    reportedAt: "08 jul 2026, 15:48", reporter: "María Pérez", status: "resolved", resolution: "discarded", availabilityImpact: "Descartada", description: "La tela quedó dañada de forma permanente y la unidad fue retirada del inventario."
  }
];

const productCatalog = {
  "VSAT-CRL": { name: "Vestido satinado", variants: { Coral: ["S", "M", "L"] } },
  "JRET-AZM": { name: "Jeans rectos", variants: { "Azul medio": ["30", "32", "34"] } },
  "BLSE-CHP": { name: "Blusa seda", variants: { Champán: ["SM", "M"] } },
  "FREC-NGR": { name: "Falda recta", variants: { Negro: ["S", "M"] } },
  "VMID-FLR": { name: "Vestido midi estampado", variants: { "Floral azul": ["M", "L"] } }
};

const root = document.documentElement;
const themeButton = document.querySelector(".theme-button");
const filtersForm = document.querySelector("#incidentFilters");
const search = document.querySelector("#incidentSearch");
const typeFilter = document.querySelector("#incidentType");
const statusFilter = document.querySelector("#incidentStatus");
const clearFilters = document.querySelector("#clearIncidentFilters");
const rows = document.querySelector("#incidentRows");
const emptyState = document.querySelector("#incidentEmptyState");
const tableRegion = document.querySelector("#incidentTableRegion");
const resultCount = document.querySelector("#incidentResultCount");
const resultContext = document.querySelector("#incidentResultContext");
const dialog = document.querySelector("#incidentDialog");
const dialogBody = document.querySelector("#incidentDialogBody");
const newDialog = document.querySelector("#newIncidentDialog");
const newForm = document.querySelector("#newIncidentForm");
const newProductCode = document.querySelector("#newIncidentProductCode");
const newVariant = document.querySelector("#newIncidentVariant");
const newSize = document.querySelector("#newIncidentSize");
const toast = document.querySelector("#incidentToast");
let selectedIncidentId = null;
let toastTimer;

function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  themeButton.querySelector(".theme-label").textContent = dark ? "Modo claro" : "Modo oscuro";
  localStorage.setItem("pw-theme", theme);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function rowMarkup(incident) {
  const statusLabel = IncidentLogic.statusLabels[incident.status];
  const typeLabel = IncidentLogic.typeLabels[incident.type];
  return `<tr data-incident-id="${escapeHtml(incident.id)}">
    <td><span class="incident-id">${escapeHtml(incident.id)}</span><span class="incident-date">${escapeHtml(incident.reporter)}</span></td>
    <td><span class="incident-product"><strong>${escapeHtml(incident.product)}</strong><small>${escapeHtml(incident.ref)} · ${escapeHtml(incident.variant)}</small></span></td>
    <td><span class="incident-type" data-type="${escapeHtml(incident.type)}">${escapeHtml(typeLabel)}</span></td>
    <td><span class="incident-quantity">${incident.quantity}</span></td>
    <td><span class="incident-date">${escapeHtml(incident.reportedAt)}</span></td>
    <td><span class="incident-status" data-status="${escapeHtml(incident.status)}">${escapeHtml(statusLabel)}</span></td>
    <td><button class="incident-row-action" type="button" data-incident-action="open" data-incident-id="${escapeHtml(incident.id)}">Ver detalle</button></td>
  </tr>`;
}

function render() {
  const visible = IncidentLogic.filter(incidents, { search: search.value, type: typeFilter.value, status: statusFilter.value });
  const hasFilters = Boolean(search.value.trim() || typeFilter.value || statusFilter.value);
  clearFilters.hidden = !hasFilters;
  resultCount.textContent = pluralize(visible.length, "incidencia");
  resultContext.textContent = visible.length === 1 ? " encontrada" : " encontradas";
  rows.innerHTML = visible.map(rowMarkup).join("");
  tableRegion.hidden = visible.length === 0;
  emptyState.hidden = visible.length !== 0;
  document.querySelector("#incidentPaginationText").textContent = visible.length ? `Mostrando ${visible.length} incidencias` : "Mostrando 0 incidencias";
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function incidentById(id) {
  return incidents.find((incident) => incident.id === id);
}

function detailMarkup(incident) {
  const blocked = incident.status === "open" || incident.status === "under-review";
  const resolution = blocked ? `<form class="incident-resolution" id="incidentResolutionForm"><label>Resultado<select id="incidentResolution" required><option value="available">Disponible nuevamente</option><option value="discarded">Descartar prenda</option><option value="lost">Confirmar pérdida</option></select></label><div class="incident-resolution-actions"><button class="danger-dialog-action" type="button" data-resolution="cancelled">Cancelar incidencia</button><button class="primary-action" type="submit">Guardar resolución</button></div></form>` : `<p class="dialog-note"><span aria-hidden="true">✓</span> ${escapeHtml(incident.availabilityImpact)}. Este resultado queda en el historial de inventario.</p>`;
  return `<div class="incident-detail-heading"><strong>${escapeHtml(incident.product)}</strong><span>${escapeHtml(incident.ref)} · ${escapeHtml(incident.variant)}</span></div><dl class="incident-detail-grid"><div><dt>Tipo</dt><dd>${escapeHtml(IncidentLogic.typeLabels[incident.type])}</dd></div><div><dt>Cantidad afectada</dt><dd>${incident.quantity}</dd></div><div><dt>Estado</dt><dd><span class="incident-status" data-status="${escapeHtml(incident.status)}">${escapeHtml(IncidentLogic.statusLabels[incident.status])}</span></dd></div><div><dt>Reportada</dt><dd>${escapeHtml(incident.reportedAt)}</dd></div><div><dt>Registró</dt><dd>${escapeHtml(incident.reporter)}</dd></div><div><dt>Disponibilidad</dt><dd>${escapeHtml(incident.availabilityImpact)}</dd></div></dl><p class="incident-description">${escapeHtml(incident.description)}</p>${resolution}`;
}

function openIncidentDetail(id) {
  const incident = incidentById(id);
  if (!incident) return;
  selectedIncidentId = id;
  document.querySelector("#incidentDialogKicker").textContent = incident.id;
  document.querySelector("#incidentDialogTitle").textContent = "Detalle de incidencia";
  dialogBody.innerHTML = detailMarkup(incident);
  dialog.showModal();
}

function closeDialog(target) {
  target.close();
  selectedIncidentId = null;
}

function resetIncidentVariantFields() {
  newVariant.innerHTML = '<option value="">Escribe un código primero</option>';
  newVariant.disabled = true;
  newSize.innerHTML = '<option value="">Selecciona una variante</option>';
  newSize.disabled = true;
}

function updateIncidentProductOptions() {
  const code = newProductCode.value.trim().toUpperCase();
  const product = productCatalog[code];
  resetIncidentVariantFields();
  if (!product) return;
  newVariant.innerHTML = '<option value="">Selecciona una variante</option>';
  Object.keys(product.variants).forEach((variant) => {
    newVariant.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(variant)}">${escapeHtml(variant)}</option>`);
  });
  newVariant.disabled = false;
}

function updateIncidentSizeOptions() {
  const code = newProductCode.value.trim().toUpperCase();
  const product = productCatalog[code];
  const sizes = product?.variants[newVariant.value] ?? [];
  newSize.innerHTML = sizes.length ? '<option value="">Selecciona una talla</option>' : '<option value="">Selecciona una variante</option>';
  sizes.forEach((size) => {
    newSize.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`);
  });
  newSize.disabled = sizes.length === 0;
}

function registerIncident(event) {
  event.preventDefault();
  const productRef = newProductCode.value.trim().toUpperCase();
  const variantName = newVariant.value;
  const size = newSize.value;
  const type = document.querySelector("#newIncidentType").value;
  const quantity = Number(document.querySelector("#newIncidentQuantity").value);
  const description = document.querySelector("#newIncidentDescription").value.trim();
  const error = document.querySelector("#newIncidentError");
  if (!productCatalog[productRef] || !variantName || !size || !quantity || !description) {
    error.hidden = false;
    error.textContent = "Completa código de producto, variante, talla, cantidad y descripción.";
    return;
  }
  error.hidden = true;
  const nextNumber = 1049 + incidents.length - 8;
  incidents.unshift({ id: `INC-${nextNumber}`, product: productCatalog[productRef].name, ref: productRef, variant: `${variantName} · ${size}`, type, quantity, reportedAt: "22 ago 2026, ahora", reporter: "María Pérez", status: "open", availabilityImpact: "No disponible", description });
  newForm.reset();
  resetIncidentVariantFields();
  closeDialog(newDialog);
  render();
  showToast("Incidencia registrada y disponibilidad actualizada.");
}

function applyResolution(resolution) {
  const incident = incidentById(selectedIncidentId);
  if (!incident) return;
  const next = IncidentLogic.resolve(incident, resolution);
  Object.assign(incident, next);
  closeDialog(dialog);
  render();
  showToast(resolution === "cancelled" ? "Incidencia cancelada." : "Resolución guardada en el historial.");
}

setTheme(localStorage.getItem("pw-theme") || "light");
themeButton.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
filtersForm.addEventListener("input", render);
filtersForm.addEventListener("change", render);
filtersForm.addEventListener("reset", () => setTimeout(render));
document.querySelector("#emptyIncidentClear").addEventListener("click", () => { filtersForm.reset(); render(); });
rows.addEventListener("click", (event) => {
  const action = event.target.closest("[data-incident-action]");
  const row = event.target.closest("tr[data-incident-id]");
  if (action || row) openIncidentDetail(action?.dataset.incidentId || row.dataset.incidentId);
});
document.querySelector("#openIncidentDialog").addEventListener("click", () => newDialog.showModal());
document.querySelector("#closeIncidentDialog").addEventListener("click", () => closeDialog(dialog));
document.querySelector("#closeNewIncidentDialog").addEventListener("click", () => closeDialog(newDialog));
document.querySelector("#cancelNewIncident").addEventListener("click", () => closeDialog(newDialog));
newProductCode.addEventListener("input", updateIncidentProductOptions);
newVariant.addEventListener("change", updateIncidentSizeOptions);
newForm.addEventListener("submit", registerIncident);
dialogBody.addEventListener("submit", (event) => { if (event.target.id === "incidentResolutionForm") { event.preventDefault(); applyResolution(document.querySelector("#incidentResolution").value); } });
dialogBody.addEventListener("click", (event) => { const button = event.target.closest("[data-resolution]"); if (button) applyResolution(button.dataset.resolution); });
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
newDialog.addEventListener("click", (event) => { if (event.target === newDialog) closeDialog(newDialog); });
resetIncidentVariantFields();
render();
