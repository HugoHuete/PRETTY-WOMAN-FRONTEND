const receiptParams = new URLSearchParams(window.location.search);
const withoutTracking = receiptParams.get('scenario') === 'sin-tracking';
const requestedOrderId = receiptParams.get('id') || 'OC-0048';
const sourceOrder = window.purchaseOrders?.find(order => order.id === requestedOrderId);
const receiptOrder = withoutTracking
  ? { id: 'OC-0049', supplier: 'Moda Sur', pending: 9, currency: 'USD', hasTracking: false, packages: [] }
  : sourceOrder
    ? {
      id: sourceOrder.id,
      supplier: sourceOrder.supplier,
      pending: Math.max(sourceOrder.total - sourceOrder.received, 0),
      currency: sourceOrder.currency === 'NIO' ? 'C$' : sourceOrder.currency,
      hasTracking: sourceOrder.packages.length > 0,
      packages: sourceOrder.packages,
    }
    : { id: 'OC-0048', supplier: 'SOHO', pending: 18, currency: 'USD', hasTracking: true, packages: [] };

const receiptProducts = sourceOrder
  ? sourceOrder.products.map(product => ({
    name: product.name,
    code: product.code,
    variants: product.variants.map(variant => {
      const pending = Math.max(variant.quantity - variant.received, 0);
      return [`${variant.color} · ${variant.size}`, variant.quantity, variant.received, pending, 0, false, 1];
    }),
  }))
  : [
    { name: 'Vestido satinado', code: 'SOHO25120', variants: [['Azul · S', 2, 0, 2, 2, false, 1], ['Azul · M', 3, 0, 3, 3, false, 1], ['Azul · L', 2, 0, 2, 0, false, 1]] },
    { name: 'Blusa de lino', code: 'SOHO25134', variants: [['Blanco · S', 2, 0, 2, 2, false, 1], ['Blanco · M', 3, 0, 3, 0, false, 1], ['Blanco · L', 2, 0, 2, 0, false, 1]] },
  ];

const packageList = document.querySelector('#packageList');
if (receiptOrder.hasTracking && receiptOrder.packages.length) {
  packageList.innerHTML = receiptOrder.packages.map((item, index) => `<div class="package-row"><label class="package-select"><input class="package-check" type="checkbox" ${index === 0 ? 'checked' : ''}><strong>${escapeHtml(item.number)}</strong></label><span class="package-fields"><label><span>Peso <small>(lb)</small></span><input class="package-weight" type="number" inputmode="decimal" min="0" step="0.01" ${index === 0 ? 'value="0.00"' : 'disabled'}></label><label><span>Envío <small>(USD)</small></span><span class="currency-input"><span aria-hidden="true">$</span><input class="package-shipping" type="number" inputmode="decimal" min="0" step="0.01" ${index === 0 ? 'value="0.00"' : 'disabled'} aria-label="Envío en USD"></span></label></span></div>`).join('');
}
const productArea = document.querySelector('#receiptProducts');
const packageChecks = [...document.querySelectorAll('.package-check')];
const directShipping = document.querySelector('#directShipping');
const directShippingCost = document.querySelector('#directShippingCost');
const feedback = document.querySelector('#receiptFeedback');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function productMarkup(product, index) {
  return product.variants.map((variant, variantIndex) => {
    const [color = '—', size = '—'] = String(variant[0]).split(' · ');
    const surplus = Math.max(0, variant[4] - variant[3]);
    return `<tr class="receipt-row ${surplus ? 'has-surplus' : ''}">
      <th class="receipt-product-cell" scope="row" data-label="Producto y color">
        <strong>${escapeHtml(product.name)}</strong>
        <small><span>${escapeHtml(product.code)}</span> · ${escapeHtml(color)}</small>
      </th>
      <td class="receipt-size-cell" data-label="Talla">${escapeHtml(size)}</td>
      <td data-label="Compradas">${variant[1]}</td>
      <td data-label="Recibidas">${variant[2]}</td>
      <td class="pending-count" data-label="Pendientes">${variant[3]}</td>
      <td data-label="Factor de envío">
        <label class="weight-control"><span class="sr-only">Factor de envío de ${escapeHtml(product.name)}, ${escapeHtml(variant[0])}</span><input class="product-weight" data-product="${index}" data-variant="${variantIndex}" type="number" inputmode="decimal" min="0" step="0.01" value="${variant[6]}"></label>
      </td>
      <td data-label="Recibir ahora">
        <label class="receive-control"><span class="sr-only">Cantidad a recibir de ${escapeHtml(product.name)}, ${escapeHtml(variant[0])}</span><input class="receive-now" data-product="${index}" data-variant="${variantIndex}" type="number" min="0" ${variant[5] ? '' : `max="${variant[3]}"`} value="${variant[4]}"></label>
      </td>
      <td data-label="Sobrante">
        <label class="surplus-control"><input class="allow-surplus" data-product="${index}" data-variant="${variantIndex}" type="checkbox" ${variant[5] ? 'checked' : ''}><span>Permitir</span>${surplus ? `<small class="surplus-note">${surplus} adicional${surplus === 1 ? '' : 'es'}</small>` : ''}</label>
      </td>
    </tr>`;
  }).join('');
}

function selectedUnits() {
  return receiptProducts.reduce((sum, product) => sum + product.variants.reduce((subtotal, variant) => subtotal + (Number(variant[4]) || 0), 0), 0);
}

function updateSummary() {
  let surplus = 0;
  receiptProducts.forEach(product => {
    product.variants.forEach(variant => {
      surplus += Math.max(0, (Number(variant[4]) || 0) - variant[3]);
    });
  });

  const selected = packageChecks.filter(box => box.checked);
  const units = selectedUnits();

  document.querySelector('#unitCount').textContent = units;
  document.querySelector('#surplusCount').textContent = surplus;
  document.querySelector('#packageCount').textContent = `${selected.length} de ${packageChecks.length}`;
  const orderOutcome = units >= receiptOrder.pending
    ? 'La orden quedará recibida por completo.'
    : 'La orden pasará a recepción parcial.';
  document.querySelector('#confirmationText').textContent = `${units} ${units === 1 ? 'unidad quedará' : 'unidades quedarán'} disponible${units === 1 ? '' : 's'} para venta.${surplus ? ` Incluye ${surplus} sobrante${surplus === 1 ? '' : 's'} autorizado${surplus === 1 ? '' : 's'}.` : ''} ${orderOutcome}`;
}

function configureOrderScenario() {
  document.querySelector('#receiptBackLink').innerHTML = `<span aria-hidden="true">←</span> Regresar a orden #${escapeHtml(receiptOrder.id)}`;
  document.querySelector('#receiptBackLink').href = `purchase-order-detail.html?id=${encodeURIComponent(receiptOrder.id)}`;
  packageList.hidden = !receiptOrder.hasTracking;
  directShipping.hidden = receiptOrder.hasTracking;
  document.querySelector('#packageCountRow').hidden = !receiptOrder.hasTracking;
}

function render() {
  productArea.innerHTML = `<p class="receipt-scroll-hint"><span aria-hidden="true">↔</span> Desliza horizontalmente para revisar todas las columnas</p>
    <div class="receipt-products-table" role="region" aria-label="Prendas y cantidades de esta recepción" tabindex="0">
      <table>
        <thead><tr><th scope="col">Producto y color</th><th scope="col">Talla</th><th scope="col">Compradas</th><th scope="col">Recibidas</th><th scope="col">Pendientes</th><th scope="col">Factor envío</th><th scope="col">Recibir ahora</th><th scope="col">Sobrante</th></tr></thead>
        <tbody>${receiptProducts.map(productMarkup).join('')}</tbody>
      </table>
    </div>`;
  updateSummary();
}

function showError(message) {
  feedback.classList.add('is-error');
  feedback.setAttribute('role', 'alert');
  feedback.textContent = message;
}

productArea.addEventListener('input', event => {
  const quantity = event.target.closest('.receive-now');
  const weight = event.target.closest('.product-weight');
  if (quantity) {
    const variant = receiptProducts[quantity.dataset.product].variants[quantity.dataset.variant];
    const amount = Math.max(0, Number(quantity.value) || 0);
    variant[4] = variant[5] ? amount : Math.min(variant[3], amount);
    quantity.value = variant[4];
    quantity.closest('.receipt-row').classList.toggle('has-surplus', variant[5] && variant[4] > variant[3]);
  }
  if (weight) {
    const variant = receiptProducts[weight.dataset.product].variants[weight.dataset.variant];
    variant[6] = Math.max(0, Number(weight.value) || 0);
    weight.value = variant[6];
  }
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  updateSummary();
});

productArea.addEventListener('change', event => {
  const toggle = event.target.closest('.allow-surplus');
  if (!toggle) return;
  const variant = receiptProducts[toggle.dataset.product].variants[toggle.dataset.variant];
  variant[5] = toggle.checked;
  if (!variant[5] && variant[4] > variant[3]) variant[4] = variant[3];
  render();
});

packageChecks.forEach(box => box.addEventListener('change', () => {
  const row = box.closest('.package-row');
  row.querySelectorAll('.package-weight,.package-shipping').forEach(input => { input.disabled = !box.checked; });
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  updateSummary();
}));

document.querySelectorAll('.package-shipping').forEach(input => input.addEventListener('input', updateSummary));
directShippingCost.addEventListener('input', updateSummary);

document.querySelector('#fillPendingAction').addEventListener('click', () => {
  receiptProducts.forEach(product => product.variants.forEach(variant => {
    variant[4] = variant[3];
  }));
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  render();
});

document.querySelector('#receiptForm').addEventListener('submit', event => {
  event.preventDefault();
  const units = selectedUnits();
  if (!units) return showError('Indica al menos una prenda para recibir.');
  if (receiptOrder.hasTracking && !packageChecks.some(box => box.checked)) return showError('Selecciona al menos un tracking recibido para registrar esta recepción.');
  if (!receiptOrder.hasTracking && Number(directShippingCost.value) < 0) return showError('El costo de envío no puede ser negativo.');
  feedback.classList.remove('is-error');
  feedback.setAttribute('role', 'status');
  feedback.innerHTML = `Recepción confirmada. <a href="purchase-order-detail.html?id=${encodeURIComponent(receiptOrder.id)}">Volver al detalle actualizado de la orden</a>.`;
});

const root = document.documentElement;
const themeButton = document.querySelector('.theme-button');
function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.querySelector('.theme-label').textContent = dark ? 'Modo claro' : 'Modo oscuro';
  localStorage.setItem('pw-theme', theme);
}

setTheme(localStorage.getItem('pw-theme') || 'light');
themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
configureOrderScenario();
render();
