const params = new URLSearchParams(window.location.search);
const requestedId = params.get("id") || "OC-0048";
const order = window.purchaseOrders.find(item => item.id === requestedId);
const content = document.querySelector("#orderContent");
const notFound = document.querySelector("#orderNotFound");
const trackingCarriers = [
  { id: 1, name: "DHL", trackingUrl: "https://www.dhl.com/" },
  { id: 2, name: "Cargo Express", trackingUrl: "https://www.cargoexpreso.com/" },
];
const rateFormatter = new Intl.NumberFormat("es-NI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const money = (amount, currency) => `${currency === "NIO" ? "C$" : "$"} ${amount.toLocaleString(currency === "NIO" ? "es-NI" : "en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function pendingVariants(entry) {
  return entry.products.flatMap(product => product.variants
    .map(variant => ({
      product,
      variant,
      quantity: Math.max(Number(variant.quantity || 0) - Number(variant.received || 0), 0),
    }))
    .filter(item => item.quantity > 0));
}

function amountInCordobas(amount, entry) {
  return entry.currency === "USD" ? amount * entry.exchangeRate : amount;
}

function persistOrder() {
  try {
    const storedOrders = JSON.parse(localStorage.getItem("pw-purchase-orders") || "[]");
    const nextOrders = Array.isArray(storedOrders) ? storedOrders.filter(item => item.id !== order.id) : [];
    nextOrders.unshift(order);
    localStorage.setItem("pw-purchase-orders", JSON.stringify(nextOrders));
  } catch {
    // El prototipo sigue funcionando en memoria si el almacenamiento no está disponible.
  }
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)).replace(".", "")
    : "Pendiente";
}

function formatRate(value) {
  return rateFormatter.format(value);
}

function summaryMoney(amount, entry) {
  const originalAmount = money(amount, entry.currency);
  if (entry.currency !== "USD" || !entry.exchangeRate) return `<span class="cost-original">${originalAmount}</span>`;
  return `<span class="cost-original">${originalAmount}</span><small class="cost-converted">${money(amount * entry.exchangeRate, "NIO")}</small>`;
}

function badge(entry) {
  const statusClass = entry.label === "Cerrada con pérdida" ? "resolved-loss" : entry.status;
  return `<span class="order-status status-${statusClass}">${entry.label}</span>`;
}

function productRows(entry) {
  const rows = entry.products.flatMap(product => {
    return product.variants.map(variant => {
      const unitCostCordobas = entry.currency === "USD"
        ? variant.unitCost * entry.exchangeRate
        : variant.unitCost;
      const pending = Math.max(variant.quantity - variant.received, 0);
      const profit = variant.retailPrice - unitCostCordobas;

      return `<tr class="${pending ? "has-pending-units" : ""}">
        <th class="product-variant-cell" scope="row">
          <strong>${escapeHtml(product.name)}</strong>
          <small><span>${escapeHtml(product.code)}</span> · ${escapeHtml(variant.color)}</small>
        </th>
        <td class="size-cell" data-label="Talla">${escapeHtml(variant.size || "—")}</td>
        <td class="quantity-cell" data-label="Compradas">${variant.quantity}</td>
        <td class="receipt-cell" data-label="Recepción">
          <strong class="${pending ? "" : "is-complete"}">${variant.received}</strong>
          <small class="${pending ? "is-pending" : "is-complete"}">${pending ? `${pending} pendientes` : "Completa"}</small>
        </td>
        <td class="money-cell" data-label="Costo compra">${money(variant.unitCost, entry.currency)}</td>
        <td class="money-cell" data-label="Costo unitario en córdobas">${money(unitCostCordobas, "NIO")}</td>
        <td class="money-cell" data-label="Precio de venta">${money(variant.retailPrice, "NIO")}</td>
        <td class="money-cell" data-label="Ganancia"><strong class="${profit < 0 ? "is-negative" : "is-positive"}">${money(profit, "NIO")}</strong></td>
      </tr>`;
    });
  }).join("");

  return `<p class="products-scroll-hint"><span aria-hidden="true">↔</span> Desliza horizontalmente para revisar todos los valores</p>
    <div class="order-products-table" role="region" aria-label="Productos, cantidades, costos y rentabilidad de la orden" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Producto y color</th>
            <th scope="col">Talla</th>
            <th scope="col">Compradas</th>
            <th scope="col">Recepción</th>
            <th scope="col">Costo compra</th>
            <th scope="col">Costo unit. C$</th>
            <th scope="col">Precio venta</th>
            <th scope="col">Ganancia</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function eventDate(value) {
  if (!value) return "Pendiente";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value;
}

function orderHistory(entry) {
  const movements = [{
    date: entry.purchaseDate,
    sort: entry.purchaseDate,
    type: "Orden creada",
    detail: `${entry.total} unidades solicitadas a ${entry.supplier}.`,
    actor: "María Pérez",
    reference: entry.id,
  }];

  entry.packages.forEach(item => {
    if (item.sent) movements.push({
      date: item.sent,
      sort: item.sent,
      type: "Envío registrado",
      detail: `${item.carrier} · número de seguimiento agregado.`,
      actor: "María Pérez",
      reference: item.number,
    });
    if (item.arrived) movements.push({
      date: item.arrived,
      sort: item.arrived,
      type: "Paquete en bodega",
      detail: `${item.carrier} confirmó la llegada del paquete.`,
      actor: "María Pérez",
      reference: item.number,
    });
  });

  if (entry.received > 0) movements.push({
    date: entry.activity,
    sort: entry.activity || entry.purchaseDate,
    type: entry.received >= entry.total ? "Recepción completada" : "Recepción registrada",
    detail: `${entry.received} de ${entry.total} unidades recibidas.`,
    actor: "María Pérez",
    reference: "Recepción",
  });

  if (entry.shortagesClosedAt) movements.push({
    date: entry.shortagesClosedAt,
    sort: entry.shortagesClosedAt,
    type: "Faltantes confirmados",
    detail: `${entry.purchaseShortages.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} unidades cerradas como no recibidas.`,
    actor: "María Pérez",
    reference: entry.purchaseShortages.map(item => item.id).join(", "),
  });

  if (entry.supplierRefund) movements.push({
    date: entry.supplierRefund.refundedAt,
    sort: entry.supplierRefund.refundedAt,
    type: Number(entry.netShortageLossNio || 0) > 0 ? "Reembolso parcial" : "Reembolso completado",
    detail: `${money(Number(entry.supplierRefund.amountNio || 0), "NIO")} recibido del proveedor.`,
    actor: "María Pérez",
    reference: entry.supplierRefund.reference || entry.supplierRefund.id,
  });

  if (entry.supplierRefundDeclinedAt) movements.push({
    date: entry.supplierRefundDeclinedAt,
    sort: entry.supplierRefundDeclinedAt,
    type: "Resolución sin reembolso",
    detail: entry.supplierRefundDeclineComments || "El proveedor confirmó que no emitirá un reembolso.",
    actor: "María Pérez",
    reference: "Resolución final",
  });

  return movements.reverse().map(item => `<tr>
    <td><time>${escapeHtml(eventDate(item.date))}</time></td>
    <td><strong>${escapeHtml(item.type)}</strong></td>
    <td>${escapeHtml(item.detail)}</td>
    <td>${escapeHtml(item.actor)}</td>
    <td><span class="history-reference">${escapeHtml(item.reference)}</span></td>
  </tr>`).join("");
}

function trackingRows(entry) {
  if (!entry.packages.length) {
    return `<div class="record-empty"><strong>Sin números de seguimiento</strong><p>Agrega uno cuando el proveedor despache la compra.</p></div>`;
  }

  const rows = entry.packages.map((item, index) => {
    const state = item.arrived ? "arrived" : "transit";
    const status = item.arrived ? "En bodega" : "En tránsito";
    const trackingLink = item.url
      ? `<a class="tracking-open-action" href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="Abrir seguimiento ${escapeHtml(item.number)} en ${escapeHtml(item.carrier)}">Abrir <span aria-hidden="true">↗</span></a>`
      : `<span class="tracking-carrier">Sin enlace</span>`;

    return `<tr>
      <th class="tracking-identity" scope="row"><strong>${escapeHtml(item.number)}</strong><small>${escapeHtml(item.carrier || "Transportista pendiente")}</small></th>
      <td><span class="tracking-status" data-state="${state}"><span aria-hidden="true"></span>${status}</span></td>
      <td><time>${formatDate(item.sent)}</time></td>
      <td><time>${formatDate(item.arrived)}</time></td>
      <td><div class="record-tracking-actions">
        ${trackingLink}
        <button type="button" data-edit-tracking="${index}">Editar</button>
        <button class="delete-tracking-action" type="button" data-delete-tracking="${index}">Eliminar</button>
      </div></td>
    </tr>`;
  }).join("");

  return `<p class="tracking-scroll-hint"><span aria-hidden="true">↔</span> Desliza horizontalmente para revisar todos los datos</p>
    <div class="tracking-table" role="region" aria-label="Números de seguimiento de la orden" tabindex="0">
      <table>
        <thead><tr><th scope="col">Seguimiento</th><th scope="col">Estado</th><th scope="col">Enviado</th><th scope="col">Llegada a bodega</th><th scope="col">Acciones</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function refundStatusLabel(status) {
  return {
    1: "Reembolso pendiente",
    2: "Reembolso parcial",
    3: "Reembolsado",
    4: "Sin reembolso",
  }[status] || "Registrado";
}

function renderShortages(entry) {
  const section = document.querySelector("#shortagesSection");
  const shortages = Array.isArray(entry.purchaseShortages) ? entry.purchaseShortages : [];
  section.hidden = !shortages.length;
  if (!shortages.length) return;

  const totalLoss = Number(entry.totalShortageLossNio || shortages.reduce((sum, item) => sum + Number(item.lossAmountNio || 0), 0));
  const totalRefund = Number(entry.totalSupplierRefundNio || entry.supplierRefund?.amountNio || 0);
  const netLoss = Number(entry.netShortageLossNio ?? Math.max(totalLoss - totalRefund, 0));
  const resolution = entry.supplierRefund
    ? (totalRefund < totalLoss ? "Reembolso parcial" : "Reembolsado")
    : entry.supplierRefundDeclinedAt
      ? "Sin reembolso"
      : "Reembolso pendiente";

  document.querySelector("#shortagesContext").textContent = `${shortages.reduce((sum, item) => sum + item.quantity, 0)} unidades confirmadas como no recibidas.`;
  document.querySelector("#shortageResolution").textContent = resolution;
  document.querySelector("#shortageResolution").dataset.state = resolution === "Reembolso pendiente"
    ? "pending"
    : resolution === "Reembolsado"
      ? "resolved"
      : "loss";
  document.querySelector("#shortageLoss").textContent = money(totalLoss, "NIO");
  document.querySelector("#supplierRefundTotal").textContent = money(totalRefund, "NIO");
  document.querySelector("#netShortageLoss").textContent = money(netLoss, "NIO");
  document.querySelector("#shortageHistory").innerHTML = shortages.map(item => `<article class="shortage-history-row">
    <div><strong>${escapeHtml(item.productName)}</strong><span>${escapeHtml(item.color)} · Talla ${escapeHtml(item.size || "—")}</span></div>
    <dl>
      <div><dt>Faltantes</dt><dd>${item.quantity}</dd></div>
      <div><dt>Pérdida</dt><dd>${money(Number(item.lossAmountNio || 0), "NIO")}</dd></div>
      <div><dt>Estado</dt><dd>${refundStatusLabel(item.refundStatus)}</dd></div>
    </dl>
  </article>`).join("");
}

function renderOrderActions(entry, pendingUnits) {
  const shortages = Array.isArray(entry.purchaseShortages) ? entry.purchaseShortages : [];
  const activePurchase = ["confirmed", "transit", "partial"].includes(entry.status);
  const canReceive = activePurchase && pendingUnits > 0 && !shortages.length;
  const canCloseShortages = canReceive;
  const unresolvedRefund = entry.status === "pending-refund"
    && Number(entry.totalShortageLossNio || 0) > 0
    && !entry.supplierRefund
    && !entry.supplierRefundDeclinedAt;
  const receiptAction = document.querySelector("#receiptAction");
  const closeAction = document.querySelector("#closeShortagesAction");
  const refundAction = document.querySelector("#registerRefundAction");
  const declineAction = document.querySelector("#declineRefundAction");
  const help = document.querySelector("#orderActionHelp");

  receiptAction.hidden = !canReceive;
  closeAction.hidden = !canCloseShortages;
  refundAction.hidden = !unresolvedRefund;
  declineAction.hidden = !unresolvedRefund;
  document.querySelector("#receiptActionLabel").textContent = entry.received > 0 ? "Registrar otra recepción" : "Registrar recepción";
  help.textContent = canCloseShortages
    ? `${pendingUnits} unidades siguen pendientes. Elige cómo continuará la orden.`
    : unresolvedRefund
      ? "Define cómo terminó la gestión de la pérdida con el proveedor."
      : "";
  document.querySelector("#orderNextActions").hidden = !canReceive && !unresolvedRefund;
}

function render() {
  if (!order) {
    content.hidden = true;
    notFound.hidden = false;
    return;
  }

  const totalAmount = order.merchandiseAmount + order.shippingAmount;
  const productUnits = order.products.reduce((sum, product) => sum + product.variants.reduce((variantSum, variant) => variantSum + variant.quantity, 0), 0);
  const variantCount = order.products.reduce((sum, product) => sum + product.variants.length, 0);

  document.title = `Pretty Woman - Orden #${order.id}`;
  document.querySelector("#orderTitle").textContent = `Orden de compra #${order.id}`;
  document.querySelector("#orderTitle").dataset.shortTitle = `Orden #${order.id}`;
  document.querySelector("#editOrder").href = `purchase-order-create.html?edit=${encodeURIComponent(order.id)}`;
  document.querySelector("#recordSupplier").textContent = order.supplier;
  document.querySelector("#recordDate").textContent = formatDate(order.purchaseDate);
  document.querySelector("#recordCurrency").textContent = order.currency === "NIO" ? "C$ — compra local" : "USD";
  const rateField = document.querySelector("#recordRateField");
  rateField.hidden = order.currency !== "USD" || !order.exchangeRate;
  document.querySelector(".order-data-grid").classList.toggle("is-local-currency", rateField.hidden);
  document.querySelector("#recordRate").textContent = order.exchangeRate ? `C$ ${formatRate(order.exchangeRate)} por $1` : "No aplica";
  document.querySelector("#recordStatus").innerHTML = badge(order);
  document.querySelector("#orderProductRows").innerHTML = productRows(order);
  document.querySelector("#trackingList").innerHTML = trackingRows(order);
  document.querySelector("#orderHistoryRows").innerHTML = orderHistory(order);
  const comment = order.comment?.trim() || "";
  document.querySelector("#commentSection").hidden = !comment;
  document.querySelector("#recordComment").textContent = comment;
  document.querySelector("#summaryProducts").textContent = order.products.length;
  document.querySelector("#summaryVariants").textContent = variantCount;
  document.querySelector("#summaryUnits").textContent = productUnits;
  document.querySelector("#merchandiseCost").innerHTML = summaryMoney(order.merchandiseAmount, order);
  document.querySelector("#shippingCost").innerHTML = summaryMoney(order.shippingAmount, order);
  document.querySelector("#totalCost").innerHTML = summaryMoney(totalAmount, order);
  const pendingUnits = Math.max(order.total - order.received, 0);
  document.querySelector("#editOrder").title = order.received > 0
    ? "Editar únicamente los datos permitidos después de iniciar la recepción"
    : "Editar datos de la orden";
  document.querySelector("#receiptAction").href = `purchase-order-receipt.html?id=${encodeURIComponent(order.id)}`;
  renderShortages(order);
  renderOrderActions(order, pendingUnits);
}

const trackingDialog = document.querySelector("#trackingDialog");
const trackingForm = document.querySelector("#trackingForm");
const deleteTrackingDialog = document.querySelector("#deleteTrackingDialog");
const shortageDialog = document.querySelector("#shortageDialog");
const shortageForm = document.querySelector("#shortageForm");
const refundDialog = document.querySelector("#refundDialog");
const refundForm = document.querySelector("#refundForm");
const declineRefundDialog = document.querySelector("#declineRefundDialog");
const declineRefundForm = document.querySelector("#declineRefundForm");
let editingTracking = null;
let deletingTracking = null;
let toastTimer = null;

function showToast(message, action) {
  const toast = document.querySelector("#orderToast");
  window.clearTimeout(toastTimer);
  toast.replaceChildren(document.createTextNode(message));
  if (action) {
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.textContent = "Deshacer";
    actionButton.addEventListener("click", () => {
      action();
      showToast("Eliminación deshecha.");
    }, { once: true });
    toast.append(actionButton);
  }
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, action ? 5000 : 2600);
}

function refreshTracking() {
  document.querySelector("#trackingList").innerHTML = trackingRows(order);
  document.querySelector("#orderHistoryRows").innerHTML = orderHistory(order);
}

function openShortages() {
  const pending = pendingVariants(order);
  const pendingTotal = pending.reduce((sum, item) => sum + item.quantity, 0);
  const estimatedLoss = pending.reduce((sum, item) => sum + amountInCordobas(item.variant.unitCost * item.quantity, order), 0);
  const groupedPending = pending.reduce((groups, item) => {
    const productKey = item.product.id || item.product.code || item.product.name;
    const existingGroup = groups.find(group => group.key === productKey);
    if (existingGroup) existingGroup.items.push(item);
    else groups.push({ key: productKey, product: item.product, items: [item] });
    return groups;
  }, []);
  const closedAtField = shortageForm.elements.closedAt;
  const minimumDate = order.purchaseDate || today();
  const maximumDate = today();
  shortageForm.reset();
  closedAtField.min = minimumDate;
  closedAtField.max = maximumDate;
  closedAtField.value = maximumDate;
  closedAtField.setCustomValidity("");
  document.querySelector("#shortageDateHelp").textContent = `Puedes elegir una fecha entre ${formatDate(minimumDate)} y hoy.`;
  document.querySelector("#shortageDateError").hidden = true;
  document.querySelector("#shortageSubmitStatus").hidden = true;
  document.querySelector("#shortageReview").innerHTML = groupedPending.map(group => `<article class="shortage-product-group">
    <header class="shortage-product-heading">
      <strong>${escapeHtml(group.product.name)}</strong>
      <span>${group.items.length} ${group.items.length === 1 ? "variante" : "variantes"}</span>
    </header>
    <div class="shortage-variant-list">
      ${group.items.map(item => `<div class="shortage-variant-row">
        <div class="shortage-variant-name"><span>${escapeHtml(item.variant.color)}</span><small>Talla ${escapeHtml(item.variant.size || "—")}</small></div>
        <dl>
          <div><dt>Faltantes</dt><dd>${item.quantity}</dd></div>
          <div><dt>Pérdida estimada</dt><dd>${money(amountInCordobas(item.variant.unitCost * item.quantity, order), "NIO")}</dd></div>
        </dl>
      </div>`).join("")}
    </div>
  </article>`).join("");
  document.querySelector("#shortageDialogUnitCount").textContent = pendingTotal;
  document.querySelector("#shortageDialogEstimatedLoss").textContent = money(estimatedLoss, "NIO");
  document.querySelector("#shortageReviewCount").textContent = `${groupedPending.length} ${groupedPending.length === 1 ? "producto" : "productos"} · ${pending.length} ${pending.length === 1 ? "variante" : "variantes"}`;
  setShortageSubmitting(false);
  shortageDialog.returnValue = "";
  shortageDialog.showModal();
  document.querySelector("#shortageDialogTitle").focus({ preventScroll: true });
}

function setShortageSubmitting(isSubmitting) {
  const confirmButton = document.querySelector("#confirmShortagesAction");
  shortageForm.setAttribute("aria-busy", String(isSubmitting));
  shortageForm.querySelectorAll("button").forEach(button => { button.disabled = isSubmitting; });
  confirmButton.textContent = isSubmitting ? "Cerrando recepción…" : "Cerrar recepción";
}

function validateShortageDate() {
  const field = shortageForm.elements.closedAt;
  const error = document.querySelector("#shortageDateError");
  let message = "";
  if (!field.value) message = "Selecciona la fecha en que se cerrará la recepción.";
  else if (field.value < field.min) message = `La fecha no puede ser anterior a la compra (${formatDate(field.min)}).`;
  else if (field.value > field.max) message = "La fecha no puede ser posterior a hoy.";
  field.setCustomValidity(message);
  error.textContent = message;
  error.hidden = !message;
  if (message) field.focus();
  return !message;
}

function closeReceptionWithShortages(shortageDate) {
  const pending = pendingVariants(order);
  if (!pending.length) return;
  const shortages = pending.map((item, index) => {
    const lossAmountNio = amountInCordobas(item.variant.unitCost * item.quantity, order);
    return {
      id: `${order.id}-F${index + 1}`,
      productId: item.product.id || item.product.code,
      productName: item.product.name,
      color: item.variant.color,
      size: item.variant.size,
      quantity: item.quantity,
      lossAmountNio,
      shortageDate,
      refundStatus: 1,
    };
  });
  const totalLoss = shortages.reduce((sum, item) => sum + item.lossAmountNio, 0);
  order.purchaseShortages = shortages;
  order.shortagesClosedAt = shortageDate;
  order.totalShortageLossNio = totalLoss;
  order.totalSupplierRefundNio = 0;
  order.netShortageLossNio = totalLoss;
  order.status = totalLoss > 0 ? "pending-refund" : "received";
  order.label = totalLoss > 0 ? "Reembolso pendiente" : "Cerrada con faltantes";
  persistOrder();
  render();
  shortageDialog.close("closed");
  showToast(`${shortages.reduce((sum, item) => sum + item.quantity, 0)} unidades cerradas como faltantes.`);
  window.setTimeout(() => document.querySelector("#shortagesSection").focus({ preventScroll: true }));
}

function openRefund() {
  const totalLoss = Number(order.totalShortageLossNio || 0);
  refundForm.reset();
  refundForm.elements.amountNio.max = totalLoss.toFixed(2);
  refundForm.elements.refundedAt.value = today();
  document.querySelector("#refundableLoss").textContent = money(totalLoss, "NIO");
  document.querySelector("#refundAmountHelp").textContent = `Monto máximo: ${money(totalLoss, "NIO")}.`;
  updateRefundPreview();
  refundDialog.returnValue = "";
  refundDialog.showModal();
  document.querySelector("#refundDialogTitle").focus({ preventScroll: true });
}

function openDeclineRefund() {
  const shortageUnits = (order.purchaseShortages || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  declineRefundForm.reset();
  document.querySelector("#declineRefundUnits").textContent = shortageUnits;
  document.querySelector("#declineRefundLoss").textContent = money(Number(order.totalShortageLossNio || 0), "NIO");
  declineRefundDialog.returnValue = "";
  declineRefundDialog.showModal();
  document.querySelector("#declineRefundTitle").focus({ preventScroll: true });
}

function openTracking(index) {
  editingTracking = index;
  const item = index === null ? { number: "", carrierId: "", sent: "", arrived: "" } : order.packages[index];
  const carrier = trackingCarriers.find(option => option.id === Number(item.carrierId) || option.name === item.carrier);
  document.querySelector("#trackingDialogTitle").textContent = index === null ? "Agregar número de seguimiento" : "Editar número de seguimiento";
  trackingForm.reset();
  trackingForm.elements.number.value = item.number || "";
  trackingForm.elements.carrierId.value = carrier ? String(carrier.id) : "";
  trackingForm.elements.sent.value = item.sent || "";
  trackingForm.elements.arrived.value = item.arrived || "";
  trackingDialog.returnValue = "";
  trackingDialog.showModal();
  trackingForm.elements.number.focus();
}

document.querySelector("#addTracking").addEventListener("click", () => openTracking(null));
document.querySelector("#closeShortagesAction").addEventListener("click", openShortages);
document.querySelector("#registerRefundAction").addEventListener("click", openRefund);
document.querySelector("#declineRefundAction").addEventListener("click", openDeclineRefund);
document.querySelector("#trackingList").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-tracking]");
  if (editButton) {
    openTracking(Number(editButton.dataset.editTracking));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-tracking]");
  if (!deleteButton) return;
  deletingTracking = Number(deleteButton.dataset.deleteTracking);
  const tracking = order.packages[deletingTracking];
  document.querySelector("#deleteTrackingMessage").textContent = `¿Deseas eliminar el número de seguimiento ${tracking.number}? Podrás deshacerlo durante unos segundos.`;
  deleteTrackingDialog.returnValue = "";
  deleteTrackingDialog.showModal();
  deleteTrackingDialog.querySelector('[value="cancel"]').focus();
});

trackingDialog.addEventListener("close", () => {
  if (trackingDialog.returnValue !== "save") return;
  const formValues = Object.fromEntries(new FormData(trackingForm));
  const carrier = trackingCarriers.find(option => option.id === Number(formValues.carrierId));
  if (!carrier) return;
  const updated = {
    number: String(formValues.number || "").trim(),
    carrierId: carrier.id,
    carrier: carrier.name,
    sent: String(formValues.sent || ""),
    arrived: String(formValues.arrived || ""),
    url: carrier.trackingUrl,
  };
  if (editingTracking === null) order.packages.push(updated);
  else order.packages[editingTracking] = updated;
  persistOrder();
  refreshTracking();
  showToast(editingTracking === null ? "Número de seguimiento agregado." : "Número de seguimiento actualizado.");
});

deleteTrackingDialog.addEventListener("close", () => {
  if (deleteTrackingDialog.returnValue !== "delete" || deletingTracking === null) {
    deletingTracking = null;
    return;
  }

  const deletedIndex = deletingTracking;
  const [deletedTracking] = order.packages.splice(deletedIndex, 1);
  deletingTracking = null;
  persistOrder();
  refreshTracking();
  showToast(`Número ${deletedTracking.number} eliminado.`, () => {
    order.packages.splice(deletedIndex, 0, deletedTracking);
    persistOrder();
    refreshTracking();
  });
});

shortageForm.elements.closedAt.addEventListener("input", validateShortageDate);

shortageForm.addEventListener("submit", event => {
  if (event.submitter?.value !== "close") return;
  event.preventDefault();
  if (!validateShortageDate()) {
    shortageForm.reportValidity();
    return;
  }
  const status = document.querySelector("#shortageSubmitStatus");
  status.hidden = true;
  setShortageSubmitting(true);
  window.requestAnimationFrame(() => {
    try {
      closeReceptionWithShortages(shortageForm.elements.closedAt.value);
    } catch {
      setShortageSubmitting(false);
      status.textContent = "No pudimos cerrar la recepción. Revisa los datos e inténtalo de nuevo.";
      status.hidden = false;
      document.querySelector("#confirmShortagesAction").focus();
    }
  });
});

shortageDialog.addEventListener("close", () => {
  setShortageSubmitting(false);
});

function updateRefundPreview() {
  const totalLoss = Number(order?.totalShortageLossNio || 0);
  const amountField = refundForm.elements.amountNio;
  const amountNio = Math.max(Number(amountField.value || 0), 0);
  const partial = amountNio > 0 && amountNio < totalLoss;
  const confirmation = document.querySelector("#partialRefundConfirmation");
  const netLoss = Math.max(totalLoss - amountNio, 0);
  const exceedsLoss = amountNio > totalLoss;
  const validAmount = amountNio > 0 && amountNio <= totalLoss;
  const amountHelp = document.querySelector("#refundAmountHelp");
  amountField.setCustomValidity(exceedsLoss ? "El monto no puede superar la pérdida registrada." : "");
  amountHelp.textContent = exceedsLoss
    ? `Reduce el monto a ${money(totalLoss, "NIO")} o menos.`
    : `Monto máximo: ${money(totalLoss, "NIO")}.`;
  amountHelp.dataset.state = exceedsLoss ? "error" : "help";
  document.querySelector("#refundPreviewAmount").textContent = money(amountNio, "NIO");
  document.querySelector("#refundNetPreview").textContent = money(netLoss, "NIO");
  document.querySelector("#refundNetResult").dataset.state = !exceedsLoss && netLoss === 0 ? "settled" : "loss";
  confirmation.hidden = !partial;
  refundForm.elements.confirmPartial.required = partial;
  if (!partial) refundForm.elements.confirmPartial.checked = false;
  document.querySelector("#saveRefundAction").disabled = !validAmount || (partial && !refundForm.elements.confirmPartial.checked);
}

refundForm.elements.amountNio.addEventListener("input", updateRefundPreview);
refundForm.elements.confirmPartial.addEventListener("change", updateRefundPreview);

refundDialog.addEventListener("close", () => {
  if (refundDialog.returnValue !== "save") return;
  const formData = new FormData(refundForm);
  const amountNio = Number(formData.get("amountNio"));
  const totalLoss = Number(order.totalShortageLossNio || 0);
  if (!amountNio || amountNio > totalLoss) return;
  order.supplierRefund = {
    id: `${order.id}-R1`,
    amountNio,
    refundedAt: String(formData.get("refundedAt") || today()),
    reference: String(formData.get("reference") || "").trim() || null,
    comments: String(formData.get("comments") || "").trim() || null,
  };
  order.totalSupplierRefundNio = amountNio;
  order.netShortageLossNio = Math.max(totalLoss - amountNio, 0);
  order.purchaseShortages.forEach(item => { item.refundStatus = amountNio < totalLoss ? 2 : 3; });
  order.status = "received";
  order.label = amountNio < totalLoss ? "Cerrada con pérdida" : "Cerrada con faltantes";
  persistOrder();
  render();
  showToast("Reembolso del proveedor registrado.");
});

declineRefundDialog.addEventListener("close", () => {
  if (declineRefundDialog.returnValue !== "decline") return;
  const formData = new FormData(declineRefundForm);
  order.supplierRefundDeclinedAt = today();
  order.supplierRefundDeclineComments = String(formData.get("comments") || "").trim() || null;
  order.purchaseShortages.forEach(item => { item.refundStatus = 4; });
  order.status = "received";
  order.label = "Cerrada con pérdida";
  persistOrder();
  render();
  showToast("La orden quedó resuelta sin reembolso.");
});

const root = document.documentElement;
const themeButton = document.querySelector(".theme-button");

function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  themeButton.querySelector(".theme-label").textContent = dark ? "Modo claro" : "Modo oscuro";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#171416" : "#f8f6f7";
  localStorage.setItem("pw-theme", theme);
}

setTheme(localStorage.getItem("pw-theme") || "light");
themeButton.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
render();
if (order && params.get("created") === "1") {
  showToast(`Compra ${order.id} confirmada. Ya puedes registrar seguimiento o recepción.`);
  window.history.replaceState({}, "", `purchase-order-detail.html?id=${encodeURIComponent(order.id)}`);
} else if (order && params.get("updated") === "1") {
  showToast(`Cambios guardados en la orden ${order.id}.`);
  window.history.replaceState({}, "", `purchase-order-detail.html?id=${encodeURIComponent(order.id)}`);
}
