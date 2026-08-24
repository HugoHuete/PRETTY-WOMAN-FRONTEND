const productSeed = [
  { code: 'SOHO25120', name: 'Vestido satinado', category: 'Vestidos', variants: [['Azul', 'S', 2, 8.50, 1250], ['Azul', 'M', 3, 8.50, 1250]] },
  { code: 'SOHO25134', name: 'Blusa de lino', category: 'Blusas', variants: [['Blanco', 'M', 2, 7.20, 890]] }
];
const requiredCsvHeaders = ['codigo_proveedor', 'nombre', 'subcategoria', 'color', 'talla', 'cantidad', 'costo_unitario', 'precio_venta'];
const categoryOptions = ['Vestidos', 'Blusas', 'Pantalones'];
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Única'];
const editingOrderId = new URLSearchParams(window.location.search).get('edit');
const editingOrder = window.purchaseOrders?.find(order => order.id === editingOrderId) || null;

let products = editingOrder
  ? editingOrder.products.map(product => ({
    code: product.code,
    name: product.name,
    category: product.category,
    variants: product.variants.map(variant => [variant.color, variant.size, variant.quantity, variant.unitCost, variant.retailPrice])
  }))
  : editingOrderId
    ? structuredClone(productSeed)
    : [];
let csvImportResult = null;
let csvFileText = '';
let batchAddTarget = { type: 'products', productIndex: null };
let hasUnsavedChanges = false;
let lastRemoval = null;
let undoTimer = null;
let currentValidationErrors = [];

const editors = document.querySelector('#productEditors');
const supplier = document.querySelector('#supplier');
const shipping = document.querySelector('#shipping');
const currency = document.querySelector('#currency');
const exchangeRate = document.querySelector('#exchangeRate');
const exchangeRateField = document.querySelector('#exchangeRateField');
const shippingCurrencySymbol = document.querySelector('#shippingCurrencySymbol');
const feedback = document.querySelector('#formFeedback');
const csvDialog = document.querySelector('#csvImportDialog');
const csvFile = document.querySelector('#csvFile');
const csvDropzone = document.querySelector('#csvDropzone');
const csvFileLabel = document.querySelector('#csvFileLabel');
const csvFileHelp = document.querySelector('#csvFileHelp');
const csvDelimiterStatus = document.querySelector('#csvDelimiterStatus');
const csvEmptyPreview = document.querySelector('#csvEmptyPreview');
const csvPreviewContent = document.querySelector('#csvPreviewContent');
const csvPreviewSummary = document.querySelector('#csvPreviewSummary');
const csvErrors = document.querySelector('#csvErrors');
const csvErrorTitle = document.querySelector('#csvErrorTitle');
const csvErrorRows = document.querySelector('#csvErrorRows');
const confirmCsvImport = document.querySelector('#confirmCsvImport');
const batchAddDialog = document.querySelector('#batchAddDialog');
const batchAddForm = document.querySelector('#batchAddForm');
const batchAddContext = document.querySelector('#batchAddContext');
const batchAddTitle = document.querySelector('#batchAddTitle');
const batchAddDescription = document.querySelector('#batchAddDescription');
const batchAddQuantity = document.querySelector('#batchAddQuantity');
const batchAddHelp = document.querySelector('#batchAddHelp');
const confirmBatchAdd = document.querySelector('#confirmBatchAdd');
const orderForm = document.querySelector('#orderForm');
const saveState = document.querySelector('#saveState');
const comment = document.querySelector('#comment');
const commentCount = document.querySelector('#commentCount');
const undoNotice = document.querySelector('#undoNotice');
const undoMessage = document.querySelector('#undoMessage');
const undoRemoval = document.querySelector('#undoRemoval');
const errorSummary = document.querySelector('#errorSummary');
const errorSummaryList = document.querySelector('#errorSummaryList');
const confirmPurchaseDialog = document.querySelector('#confirmPurchaseDialog');
const confirmPurchaseForm = document.querySelector('#confirmPurchaseForm');
const confirmPurchaseButton = document.querySelector('#confirmPurchase');
const replaceProductsDialog = document.querySelector('#replaceProductsDialog');
const replaceProductsForm = document.querySelector('#replaceProductsForm');

const money = value => `${currency.value === 'NIO' ? 'C$' : '$'} ${new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(value)}`;
const cordobas = value => `C$ ${new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(value)}`;
const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const normalizeKey = value => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

function productEditor(product, index) {
  const categories = categoryOptions.map(option => `<option${product.category === option ? ' selected' : ''}>${option}</option>`).join('');
  const variantCount = product.variants.length;
  const contentId = `product-content-${index}`;
  const collapsed = Boolean(product.collapsed);
  return `<article class="product-editor${collapsed ? ' is-collapsed' : ''}" data-product="${index}">
    <header class="product-editor-header">
      <div class="product-editor-main">
        <span class="product-order-label">Producto ${index + 1}</span>
        <div class="product-fields">
          <label><span>Código proveedor</span><input data-field="code" value="${escapeHtml(product.code)}" maxlength="50" autocomplete="off"></label>
          <label><span>Nombre</span><input data-field="name" value="${escapeHtml(product.name)}" maxlength="120" autocomplete="off"></label>
          <label><span>Subcategoría</span><select data-field="category" data-searchable data-search-placeholder="Buscar subcategoría…">${categories}</select></label>
        </div>
      </div>
      <div class="product-editor-actions">
        <button class="product-icon-action duplicate-product" type="button" aria-label="Duplicar producto ${index + 1}" title="Duplicar producto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" rx="2"></rect>
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
          </svg>
        </button>
        <button class="product-icon-action remove-product" type="button" aria-label="Quitar producto ${index + 1}" title="Quitar producto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path>
          </svg>
        </button>
        <button class="product-toggle" type="button" aria-expanded="${String(!collapsed)}" aria-controls="${contentId}" aria-label="${collapsed ? 'Desplegar' : 'Contraer'} producto ${index + 1}" title="${collapsed ? 'Desplegar producto' : 'Contraer producto'}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m7 10 5 5 5-5"></path>
          </svg>
        </button>
      </div>
    </header>
    <div class="product-editor-body" id="${contentId}"${collapsed ? ' hidden' : ''}>
      <div class="variants">
        ${variantCount ? product.variants.map((variant, variantIndex) => variantRow(variant, variantIndex)).join('') : '<div class="variants-empty"><strong>Este producto no tiene variantes</strong><span>Agrega al menos una para poder confirmar la compra.</span></div>'}
        <button class="add-variant" type="button"><span aria-hidden="true">+</span> Agregar variantes</button>
      </div>
    </div>
  </article>`;
}

function variantRow(variant, index) {
  const sizes = sizeOptions.map(option => `<option value="${escapeHtml(option)}"${variant[1] === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
  return `<div class="variant-row" data-variant="${index}">
    <div class="variant-group variant-identity-group">
      <span class="variant-group-title">Variante</span>
      <div class="variant-group-fields variant-identity-fields">
        <label class="variant-color"><span>Color (opcional)</span><input data-variant-field="0" value="${escapeHtml(variant[0])}" maxlength="50" autocomplete="off"></label>
        <label class="variant-size"><span>Talla</span><select data-variant-field="1" data-searchable data-search-placeholder="Buscar talla…">${sizes}</select></label>
        <label class="variant-quantity"><span>Cantidad</span><input data-variant-field="2" type="number" min="1" max="9999" step="1" value="${escapeHtml(variant[2])}"></label>
      </div>
    </div>
    <div class="variant-group variant-cost-group">
      <span class="variant-group-title">Costo</span>
      <div class="variant-group-fields variant-cost-fields">
        <label class="variant-cost"><span>Costo compra</span><span class="money-input variant-money-input"><span class="unit-cost-symbol" aria-hidden="true">$</span><input data-variant-field="3" type="number" min="0.01" step="0.01" value="${Number(variant[3]).toFixed(2)}" aria-label="Costo unitario en moneda de compra"></span></label>
        <label class="calculated-field variant-cost-nio"><span>Equivalente C$</span><output data-calculated-field="unit-cost-nio">C$ 0.00</output></label>
      </div>
    </div>
    <div class="variant-group variant-sale-group">
      <span class="variant-group-title">Venta</span>
      <div class="variant-group-fields variant-sale-fields">
        <label class="variant-sale-price"><span>Precio venta</span><span class="money-input variant-money-input"><span aria-hidden="true">C$</span><input data-variant-field="4" type="number" min="0.01" step="0.01" value="${escapeHtml(variant[4])}" aria-label="Precio de venta en córdobas"></span></label>
        <label class="calculated-field variant-profit"><span>Margen estimado</span><output data-calculated-field="profit">C$ 0.00</output></label>
      </div>
    </div>
    <div class="variant-actions">
      <button class="duplicate-variant" type="button" aria-label="Duplicar variante ${index + 1}" title="Duplicar variante"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg></button>
      <button class="remove-variant" type="button" aria-label="Quitar variante ${index + 1}" title="Quitar variante"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path></svg></button>
    </div>
  </div>`;
}

function render() {
  editors.innerHTML = products.length
    ? products.map(productEditor).join('')
    : `<div class="products-empty-state">
      <span aria-hidden="true">+</span>
      <div><strong>Agrega el primer producto</strong><p>Captura manualmente o importa un CSV para preparar la compra.</p></div>
      <button class="secondary-action empty-add-product" type="button">Agregar producto</button>
    </div>`;
  updateSummary();
  updateCollapseAction();
}

function emptyProduct() {
  return { code: '', name: '', category: 'Vestidos', variants: [['', 'S', 1, 0, 0]], collapsed: false };
}

function emptyVariant() {
  return ['', 'S', 1, 0, 0];
}

function setDirty(dirty = true) {
  hasUnsavedChanges = dirty;
  saveState.textContent = dirty ? 'Cambios sin guardar' : 'Sin cambios pendientes';
  saveState.classList.toggle('is-dirty', dirty);
}

function updateCommentCount() {
  commentCount.textContent = `${comment.value.length} de ${comment.maxLength} caracteres`;
}

function updateCollapseAction() {
  const collapseButton = document.querySelector('#collapseProducts');
  const allCollapsed = products.length > 0 && products.every(product => product.collapsed);
  const action = allCollapsed ? 'Expandir todos' : 'Contraer todos';
  collapseButton.querySelector('[data-collapse-label]').textContent = action;
  collapseButton.setAttribute('aria-label', action);
  collapseButton.disabled = !products.length;
}

function clearValidation() {
  orderForm.querySelectorAll('[aria-invalid="true"]').forEach(control => {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-errormessage');
  });
  orderForm.querySelectorAll('.field-error').forEach(field => field.classList.remove('field-error'));
  orderForm.querySelectorAll('.pretty-select.is-invalid').forEach(select => select.classList.remove('is-invalid'));
  orderForm.querySelectorAll('.inline-error').forEach(error => error.remove());
  orderForm.querySelectorAll('.variants-empty.is-error').forEach(empty => empty.classList.remove('is-error'));
  feedback.classList.remove('is-error');
  errorSummary.hidden = true;
  errorSummaryList.replaceChildren();
  currentValidationErrors = [];
}

function addFieldError(control, message) {
  if (!control || control.getAttribute('aria-invalid') === 'true') return;
  control.setAttribute('aria-invalid', 'true');
  const field = control.closest('label');
  field?.classList.add('field-error');
  if (control.matches('select')) control.nextElementSibling?.classList.add('is-invalid');
  const error = document.createElement('small');
  error.className = 'inline-error';
  error.id = `field-error-${crypto.randomUUID()}`;
  error.setAttribute('role', 'alert');
  error.textContent = message;
  field?.append(error);
  control.setAttribute('aria-errormessage', error.id);
}

function validateOrder({ focus = true, announce = true } = {}) {
  clearValidation();
  const errors = [];
  const registerError = (control, message) => {
    addFieldError(control, message);
    errors.push({ control, message });
  };
  if (!supplier.value) registerError(supplier, 'Selecciona un proveedor.');
  if (currency.value === 'USD' && (!Number.isFinite(Number(exchangeRate.value)) || Number(exchangeRate.value) <= 0)) {
    registerError(exchangeRate, 'Ingresa una tasa mayor que cero.');
  }
  if (!Number.isFinite(Number(shipping.value)) || Number(shipping.value) < 0) {
    registerError(shipping, 'Ingresa cero o un costo válido.');
  }
  if (!products.length) {
    errors.push({ control: document.querySelector('#addProduct'), message: 'Agrega al menos un producto.' });
  }

  products.forEach((product, productIndex) => {
    const editor = editors.querySelector(`[data-product="${productIndex}"]`);
    const codeInput = editor?.querySelector('[data-field="code"]');
    const nameInput = editor?.querySelector('[data-field="name"]');
    const categorySelect = editor?.querySelector('[data-field="category"]');
    if (!product.code.trim()) registerError(codeInput, 'Ingresa el código del proveedor.');
    if (!product.name.trim()) registerError(nameInput, 'Ingresa el nombre del producto.');
    if (!categoryOptions.includes(product.category)) registerError(categorySelect, 'Selecciona una subcategoría válida.');
    if (!product.variants.length) {
      errors.push({ control: editor?.querySelector('.add-variant'), message: 'Agrega al menos una variante.' });
      editor?.querySelector('.variants-empty')?.classList.add('is-error');
    }

    const variantKeys = new Set();
    product.variants.forEach((variant, variantIndex) => {
      const row = editor?.querySelector(`[data-variant="${variantIndex}"]`);
      const fields = [...(row?.querySelectorAll('[data-variant-field]') || [])];
      const color = String(variant[0]).trim();
      const size = String(variant[1]);
      const quantity = Number(variant[2]);
      const unitCost = Number(variant[3]);
      const salePrice = Number(variant[4]);
      if (!sizeOptions.includes(size)) registerError(fields[1], 'Selecciona una talla válida.');
      if (!Number.isInteger(quantity) || quantity <= 0) registerError(fields[2], 'Usa un entero mayor que cero.');
      if (!Number.isFinite(unitCost) || unitCost <= 0) registerError(fields[3], 'Ingresa un costo mayor que cero.');
      if (!Number.isFinite(salePrice) || salePrice <= 0) registerError(fields[4], 'Ingresa un precio mayor que cero.');
      const variantKey = `${normalizeKey(color)}|${size}`;
      if (variantKeys.has(variantKey)) {
        registerError(color ? fields[0] : fields[1], 'Esta combinación de color y talla está repetida.');
      }
      variantKeys.add(variantKey);
    });
  });

  if (!errors.length) return true;
  currentValidationErrors = errors;
  errorSummary.hidden = false;
  errorSummaryList.innerHTML = errors.map((error, index) => `<li><button type="button" data-error-index="${index}">${escapeHtml(error.message)}</button></li>`).join('');
  const firstError = errors[0];
  const productEditorElement = firstError.control?.closest('.product-editor');
  if (productEditorElement) products[Number(productEditorElement.dataset.product)].collapsed = false;
  productEditorElement?.classList.remove('is-collapsed');
  const productBody = productEditorElement?.querySelector('.product-editor-body');
  if (productBody) productBody.hidden = false;
  if (focus) {
    firstError.control?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstError.control?.focus({ preventScroll: true });
  }
  if (announce) {
    feedback.classList.add('is-error');
    feedback.textContent = `${errors.length} ${errors.length === 1 ? 'dato necesita' : 'datos necesitan'} atención. Corrige los campos señalados antes de revisar la compra.`;
  }
  return false;
}

function showUndo(message, removal) {
  window.clearTimeout(undoTimer);
  lastRemoval = removal;
  undoMessage.textContent = message;
  undoNotice.hidden = false;
  undoTimer = window.setTimeout(() => {
    undoNotice.hidden = true;
    lastRemoval = null;
  }, 20000);
}

function closeUndo() {
  window.clearTimeout(undoTimer);
  undoNotice.hidden = true;
  lastRemoval = null;
}

function normalizedBatchQuantity() {
  const maximum = Number(batchAddQuantity.max);
  const quantity = Math.round(Number(batchAddQuantity.value) || 1);
  return Math.min(Math.max(quantity, 1), maximum);
}

function updateBatchAddDialog() {
  const quantity = normalizedBatchQuantity();
  const isProductBatch = batchAddTarget.type === 'products';
  batchAddQuantity.value = quantity;
  confirmBatchAdd.textContent = isProductBatch
    ? `Agregar ${quantity} ${quantity === 1 ? 'producto' : 'productos'}`
    : `Agregar ${quantity} ${quantity === 1 ? 'variante' : 'variantes'}`;
}

function openBatchAddDialog(type, productIndex = null) {
  const isProductBatch = type === 'products';
  const product = products[productIndex];
  batchAddTarget = { type, productIndex };
  batchAddQuantity.value = 1;
  batchAddQuantity.max = isProductBatch ? 50 : 100;
  batchAddContext.textContent = isProductBatch ? 'Productos de la orden' : product.name || 'Producto sin nombre';
  batchAddTitle.textContent = isProductBatch ? 'Agregar productos' : 'Agregar variantes';
  batchAddDescription.textContent = isProductBatch
    ? 'Crea varios productos vacíos para completarlos en la orden.'
    : 'Crea varias filas de color, talla, cantidad y precios para este producto.';
  batchAddHelp.textContent = isProductBatch
    ? 'Puedes agregar hasta 50 productos a la vez. Para cargas mayores, usa el CSV.'
    : 'Puedes agregar hasta 100 variantes a la vez.';
  updateBatchAddDialog();
  batchAddDialog.showModal();
  requestAnimationFrame(() => {
    batchAddQuantity.focus();
    batchAddQuantity.select();
  });
}

function orderTotals() {
  const units = products.reduce((sum, product) => sum + product.variants.reduce((subtotal, variant) => subtotal + (Number(variant[2]) || 0), 0), 0);
  const variants = products.reduce((sum, product) => sum + product.variants.length, 0);
  const merchandise = products.reduce((sum, product) => sum + product.variants.reduce((subtotal, variant) => subtotal + (Number(variant[2]) || 0) * (Number(variant[3]) || 0), 0), 0);
  const delivery = Number(shipping.value) || 0;
  return { units, variants, merchandise, delivery, total: merchandise + delivery };
}

function updateSummary() {
  const { units, variants, merchandise, delivery, total } = orderTotals();
  const purchaseCurrencySymbol = currency.value === 'NIO' ? 'C$' : '$';
  const rate = currency.value === 'NIO' ? 1 : Number(exchangeRate.value) || 0;
  exchangeRateField.hidden = currency.value === 'NIO';
  shippingCurrencySymbol.textContent = purchaseCurrencySymbol;
  document.querySelectorAll('.unit-cost-symbol').forEach(symbol => {
    symbol.textContent = purchaseCurrencySymbol;
  });
  editors.querySelectorAll('.variant-row').forEach(row => {
    const product = products[row.closest('.product-editor').dataset.product];
    const variant = product.variants[row.dataset.variant];
    const unitCostNio = (Number(variant[3]) || 0) * rate;
    const profit = (Number(variant[4]) || 0) - unitCostNio;
    const unitCostOutput = row.querySelector('[data-calculated-field="unit-cost-nio"]');
    const profitOutput = row.querySelector('[data-calculated-field="profit"]');
    unitCostOutput.textContent = cordobas(unitCostNio);
    profitOutput.textContent = cordobas(profit);
    profitOutput.classList.toggle('is-negative', profit < 0);
  });
  document.querySelector('#summaryProducts').textContent = products.length;
  document.querySelector('#summaryVariants').textContent = variants;
  document.querySelector('#summaryUnits').textContent = units;
  document.querySelector('#summaryMerchandise').textContent = money(merchandise);
  document.querySelector('#summaryShipping').textContent = money(delivery);
  document.querySelector('#summaryTotal').textContent = money(total);
  document.querySelector('#tabletSummaryTotal').textContent = money(total);
  document.querySelector('#tabletSummaryMeta').textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'} · ${units} ${units === 1 ? 'unidad' : 'unidades'}`;
}

function selectedCsvDelimiter() {
  return document.querySelector('[name="csvDelimiter"]:checked').value;
}

function csvDelimiterName(delimiter) {
  return delimiter === ';' ? 'punto y coma (;)' : 'coma (,)';
}

function parseCsv(text, delimiter = ',') {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index];
    if (character === '"') {
      if (quoted && cleanText[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && cleanText[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some(cell => cell.trim())) rows.push(row);
  return { rows, malformed: quoted };
}

function detectCsvDelimiter(text) {
  const candidates = [',', ';'].map(delimiter => {
    const parsed = parseCsv(text, delimiter);
    const headers = (parsed.rows[0] || []).map(normalizeKey);
    return {
      delimiter,
      headerMatches: requiredCsvHeaders.filter(header => headers.includes(header)).length,
      columnCount: headers.length
    };
  });
  candidates.sort((first, second) => second.headerMatches - first.headerMatches || second.columnCount - first.columnCount);
  return candidates[0].headerMatches ? candidates[0].delimiter : selectedCsvDelimiter();
}

function parseLocalizedNumber(value) {
  let normalized = String(value).trim().replace(/(?:US\$|C\$|\s)/gi, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replaceAll('.', '').replace(',', '.');
    } else {
      normalized = normalized.replaceAll(',', '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  return Number(normalized);
}

function buildCsvImport(text, delimiter = ',') {
  const parsed = parseCsv(text, delimiter);
  const errors = [];
  if (parsed.malformed) errors.push({ row: null, field: 'Archivo', message: 'Hay una comilla sin cerrar.' });
  if (!parsed.rows.length) return { products: [], errors: [{ row: null, field: 'Archivo', message: 'El archivo está vacío.' }] };

  const headers = parsed.rows[0].map(normalizeKey);
  const missingHeaders = requiredCsvHeaders.filter(header => !headers.includes(header));
  if (missingHeaders.length) {
    errors.push({ row: 1, field: 'Encabezados', message: `Faltan columnas: ${missingHeaders.join(', ')}.` });
    return { products: [], errors };
  }

  const headerIndex = Object.fromEntries(requiredCsvHeaders.map(header => [header, headers.indexOf(header)]));
  const groupedProducts = new Map();
  const variantKeys = new Set();
  let unitCount = 0;

  parsed.rows.slice(1).forEach((cells, dataIndex) => {
    const rowNumber = dataIndex + 2;
    const cell = header => (cells[headerIndex[header]] || '').trim();
    const code = cell('codigo_proveedor');
    const name = cell('nombre');
    const rawCategory = cell('subcategoria');
    const color = cell('color');
    const rawSize = cell('talla').toUpperCase();
    const quantity = parseLocalizedNumber(cell('cantidad'));
    const unitCost = parseLocalizedNumber(cell('costo_unitario'));
    const salePrice = parseLocalizedNumber(cell('precio_venta'));
    const category = categoryOptions.find(option => normalizeKey(option) === normalizeKey(rawCategory));
    const size = sizeOptions.find(option => normalizeKey(option) === normalizeKey(rawSize));
    const rowErrors = [];

    if (!code) rowErrors.push({ field: 'Código', message: 'Es obligatorio.' });
    if (!name) rowErrors.push({ field: 'Nombre', message: 'Es obligatorio.' });
    if (!category) rowErrors.push({ field: 'Subcategoría', message: `“${rawCategory || 'Vacía'}” no es válida.` });
    if (!size) rowErrors.push({ field: 'Talla', message: `“${rawSize || 'Vacía'}” no es válida.` });
    if (!Number.isInteger(quantity) || quantity <= 0) rowErrors.push({ field: 'Cantidad', message: 'Debe ser un entero mayor que cero.' });
    if (!Number.isFinite(unitCost) || unitCost <= 0) rowErrors.push({ field: 'Costo unitario', message: 'Debe ser mayor que cero.' });
    if (!Number.isFinite(salePrice) || salePrice <= 0) rowErrors.push({ field: 'Precio de venta', message: 'Debe ser mayor que cero.' });
    if (code.length > 50) rowErrors.push({ field: 'Código', message: 'Supera el máximo de 50 caracteres.' });
    if (name.length > 120) rowErrors.push({ field: 'Nombre', message: 'Supera el máximo de 120 caracteres.' });
    if (color.length > 50) rowErrors.push({ field: 'Color', message: 'Supera el máximo de 50 caracteres.' });

    if (rowErrors.length) {
      errors.push(...rowErrors.map(error => ({ row: rowNumber, ...error })));
      return;
    }

    const productKey = normalizeKey(code);
    const variantKey = `${productKey}|${normalizeKey(color)}|${size}`;
    if (variantKeys.has(variantKey)) {
      errors.push({ row: rowNumber, field: 'Color / talla', message: `La variante ${color} / ${size} está duplicada para ${code}.` });
      return;
    }
    variantKeys.add(variantKey);

    const existingProduct = groupedProducts.get(productKey);
    if (existingProduct && (normalizeKey(existingProduct.name) !== normalizeKey(name) || normalizeKey(existingProduct.category) !== normalizeKey(category))) {
      errors.push({ row: rowNumber, field: 'Código', message: `${code} se repite con otro nombre o subcategoría.` });
      return;
    }

    if (!existingProduct) {
      groupedProducts.set(productKey, {
        code,
        name,
        category,
        variants: [],
        sourceRow: rowNumber,
        variantRows: []
      });
    }
    const product = groupedProducts.get(productKey);
    product.variants.push([color, size, quantity, unitCost, salePrice]);
    product.variantRows.push(rowNumber);
    unitCount += quantity;
  });

  if (parsed.rows.length === 1) errors.push({ row: null, field: 'Archivo', message: 'Contiene encabezados, pero no tiene productos.' });
  return { products: [...groupedProducts.values()], errors, rowCount: parsed.rows.length - 1, unitCount };
}

function validateCombination(importedProducts) {
  const errors = [];
  importedProducts.forEach(importedProduct => {
    const currentProduct = products.find(product => normalizeKey(product.code) === normalizeKey(importedProduct.code));
    if (!currentProduct) return;
    if (normalizeKey(currentProduct.name) !== normalizeKey(importedProduct.name) || normalizeKey(currentProduct.category) !== normalizeKey(importedProduct.category)) {
      errors.push({ row: importedProduct.sourceRow, field: 'Código', message: `${importedProduct.code} ya existe en la orden con otro nombre o subcategoría.` });
      return;
    }
    importedProduct.variants.forEach((variant, index) => {
      const duplicate = currentProduct.variants.some(currentVariant => normalizeKey(currentVariant[0]) === normalizeKey(variant[0]) && currentVariant[1] === variant[1]);
      if (duplicate) errors.push({ row: importedProduct.variantRows[index], field: 'Color / talla', message: `${importedProduct.code} ya contiene la variante ${variant[0]} / ${variant[1]} en la orden.` });
    });
  });
  return errors;
}

function cleanImportedProducts(importedProducts) {
  return importedProducts.map(product => ({
    code: product.code,
    name: product.name,
    category: product.category,
    variants: structuredClone(product.variants)
  }));
}

function combineProducts(importedProducts) {
  const combined = structuredClone(products);
  cleanImportedProducts(importedProducts).forEach(importedProduct => {
    const currentProduct = combined.find(product => normalizeKey(product.code) === normalizeKey(importedProduct.code));
    if (currentProduct) currentProduct.variants.push(...importedProduct.variants);
    else combined.push(importedProduct);
  });
  return combined;
}

function renderCsvPreview() {
  const mode = document.querySelector('[name="csvImportMode"]:checked').value;
  confirmCsvImport.textContent = mode === 'replace' ? 'Revisar reemplazo' : 'Combinar productos';
  if (!csvImportResult) {
    csvEmptyPreview.hidden = false;
    csvPreviewContent.hidden = true;
    confirmCsvImport.disabled = true;
    return;
  }

  const combinationErrors = mode === 'combine' && !csvImportResult.errors.length
    ? validateCombination(csvImportResult.products)
    : [];
  const errors = [...csvImportResult.errors, ...combinationErrors];
  const productCount = csvImportResult.products.length;
  const variantCount = csvImportResult.products.reduce((sum, product) => sum + product.variants.length, 0);
  const unitCount = csvImportResult.products.reduce((sum, product) => sum + product.variants.reduce((subtotal, variant) => subtotal + variant[2], 0), 0);
  const productLabel = productCount === 1 ? 'producto' : 'productos';
  const variantLabel = variantCount === 1 ? 'variante' : 'variantes';
  const unitLabel = unitCount === 1 ? 'unidad' : 'unidades';

  csvEmptyPreview.hidden = true;
  csvPreviewContent.hidden = false;
  csvPreviewSummary.innerHTML = errors.length
    ? '<span class="csv-preview-state is-error" aria-hidden="true">!</span><div><strong>No se puede importar todavía</strong><span>Revisa los problemas encontrados en el archivo.</span></div>'
    : `<span class="csv-preview-state is-ready" aria-hidden="true">✓</span><div><strong>Archivo listo para importar</strong><span>${productCount} ${productLabel} · ${variantCount} ${variantLabel} · ${unitCount} ${unitLabel}</span></div>`;
  csvErrors.hidden = !errors.length;
  confirmCsvImport.disabled = Boolean(errors.length);

  if (errors.length) {
    csvErrorTitle.textContent = `${errors.length} ${errors.length === 1 ? 'problema encontrado' : 'problemas encontrados'}`;
    const visibleErrors = errors.slice(0, 8);
    csvErrorRows.innerHTML = visibleErrors.map(error => `<tr><td>${error.row || '—'}</td><td>${escapeHtml(error.field || 'Archivo')}</td><td>${escapeHtml(error.message)}</td></tr>`).join('');
    if (errors.length > visibleErrors.length) csvErrorRows.insertAdjacentHTML('beforeend', `<tr><td colspan="3">Y ${errors.length - visibleErrors.length} problemas más.</td></tr>`);
  }
}

function importedCounts(importedProducts) {
  return {
    products: importedProducts.length,
    variants: importedProducts.reduce((sum, product) => sum + product.variants.length, 0),
    units: importedProducts.reduce((sum, product) => sum + product.variants.reduce((subtotal, variant) => subtotal + Number(variant[2] || 0), 0), 0)
  };
}

function applyCsvImport(mode) {
  const previousProducts = structuredClone(products);
  products = mode === 'replace'
    ? cleanImportedProducts(csvImportResult.products)
    : combineProducts(csvImportResult.products);
  const importedCount = csvImportResult.products.length;
  render();
  setDirty();
  feedback.classList.remove('is-error');
  feedback.textContent = `${importedCount} ${importedCount === 1 ? 'producto importado' : 'productos importados'} desde el CSV. Revisa la compra antes de confirmarla.`;
  if (mode === 'replace' && previousProducts.length) {
    showUndo('Se reemplazaron los productos de la orden.', {
      type: 'csv-replace',
      value: previousProducts
    });
  }
  document.querySelector('.items-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCsvImport() {
  csvFile.value = '';
  csvFileText = '';
  csvImportResult = null;
  csvFileLabel.textContent = 'Seleccionar archivo CSV';
  csvFileHelp.textContent = 'También puedes arrastrarlo aquí · Máximo 1 MB';
  csvDropzone.classList.remove('has-file');
  document.querySelector('[name="csvImportMode"][value="combine"]').checked = true;
  document.querySelector('[name="csvDelimiter"][value=","]').checked = true;
  csvDelimiterStatus.textContent = 'Lo detectaremos automáticamente al cargar el archivo.';
  renderCsvPreview();
}

async function processCsvFile(file) {
  if (!file) return;
  csvFileText = '';
  csvFileLabel.textContent = file.name;
  csvFileHelp.textContent = file.size < 1024
    ? `${new Intl.NumberFormat('es-NI').format(file.size)} bytes · Listo para validar`
    : `${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 1 }).format(file.size / 1024)} KB · Listo para validar`;
  csvDropzone.classList.add('has-file');

  if (!file.name.toLowerCase().endsWith('.csv')) {
    csvImportResult = { products: [], errors: [{ row: null, message: 'Selecciona un archivo con extensión .csv.' }] };
    renderCsvPreview();
    return;
  }
  if (file.size > 1024 * 1024) {
    csvImportResult = { products: [], errors: [{ row: null, message: 'El archivo supera el límite de 1 MB.' }] };
    renderCsvPreview();
    return;
  }

  try {
    csvFileText = await file.text();
    const detectedDelimiter = detectCsvDelimiter(csvFileText);
    document.querySelector(`[name="csvDelimiter"][value="${detectedDelimiter}"]`).checked = true;
    csvDelimiterStatus.textContent = `Detectamos ${csvDelimiterName(detectedDelimiter)}. Puedes cambiarlo si el archivo usa otro.`;
    csvImportResult = buildCsvImport(csvFileText, selectedCsvDelimiter());
  } catch {
    csvFileText = '';
    csvImportResult = { products: [], errors: [{ row: null, message: 'No fue posible leer el archivo. Verifica que sea un CSV UTF-8.' }] };
  }
  renderCsvPreview();
}

function updateEditorValue(event) {
  const editor = event.target.closest('.product-editor');
  if (!editor || !event.target.matches('[data-field], [data-variant-field]')) return;
  const product = products[editor.dataset.product];
  if (event.target.dataset.field) product[event.target.dataset.field] = event.target.value;
  const row = event.target.closest('.variant-row');
  if (row) {
    product.variants[row.dataset.variant][event.target.dataset.variantField] = event.target.value;
  }
  event.target.removeAttribute('aria-invalid');
  event.target.closest('label')?.classList.remove('field-error');
  event.target.closest('label')?.querySelector('.inline-error')?.remove();
  updateSummary();
  setDirty();
}

editors.addEventListener('input', updateEditorValue);
editors.addEventListener('change', updateEditorValue);

editors.addEventListener('click', event => {
  if (event.target.closest('.empty-add-product')) {
    openBatchAddDialog('products');
    return;
  }
  const editor = event.target.closest('.product-editor');
  if (!editor) return;
  const productIndex = Number(editor.dataset.product);
  const product = products[productIndex];
  if (event.target.closest('.product-toggle')) {
    product.collapsed = !product.collapsed;
    editor.classList.toggle('is-collapsed', product.collapsed);
    const body = editor.querySelector('.product-editor-body');
    body.hidden = product.collapsed;
    const toggle = event.target.closest('.product-toggle');
    toggle.setAttribute('aria-expanded', String(!product.collapsed));
    toggle.setAttribute('aria-label', `${product.collapsed ? 'Desplegar' : 'Contraer'} producto ${productIndex + 1}`);
    toggle.setAttribute('title', product.collapsed ? 'Desplegar producto' : 'Contraer producto');
    updateCollapseAction();
    return;
  }
  if (event.target.closest('.duplicate-product')) {
    const duplicate = structuredClone(product);
    duplicate.code = '';
    duplicate.name = `${product.name} (copia)`;
    duplicate.collapsed = false;
    products.splice(productIndex + 1, 0, duplicate);
    render();
    setDirty();
    editors.children[productIndex + 1].querySelector('[data-field="code"]').focus();
    return;
  }
  if (event.target.closest('.remove-product')) {
    const [removedProduct] = products.splice(productIndex, 1);
    render();
    setDirty();
    showUndo(`Se quitó ${removedProduct.name || `el producto ${productIndex + 1}`}.`, {
      type: 'product',
      index: productIndex,
      value: removedProduct
    });
    return;
  }
  if (event.target.closest('.add-variant')) {
    openBatchAddDialog('variants', productIndex);
    return;
  }
  const row = event.target.closest('.variant-row');
  if (row && event.target.closest('.duplicate-variant')) {
    const variantIndex = Number(row.dataset.variant);
    product.variants.splice(variantIndex + 1, 0, structuredClone(product.variants[variantIndex]));
    render();
    setDirty();
    editors.children[productIndex].querySelector(`[data-variant="${variantIndex + 1}"] [data-variant-field="0"]`).focus();
    return;
  }
  if (row && event.target.closest('.remove-variant')) {
    const variantIndex = Number(row.dataset.variant);
    const [removedVariant] = product.variants.splice(variantIndex, 1);
    render();
    setDirty();
    showUndo(`Se quitó una variante de ${product.name || `producto ${productIndex + 1}`}.`, {
      type: 'variant',
      productIndex,
      index: variantIndex,
      value: removedVariant
    });
  }
});

document.querySelector('#addProduct').addEventListener('click', () => {
  openBatchAddDialog('products');
});

batchAddQuantity.addEventListener('input', updateBatchAddDialog);
batchAddQuantity.addEventListener('change', updateBatchAddDialog);
document.querySelector('#decreaseBatchQuantity').addEventListener('click', () => {
  batchAddQuantity.value = normalizedBatchQuantity() - 1;
  updateBatchAddDialog();
});
document.querySelector('#increaseBatchQuantity').addEventListener('click', () => {
  batchAddQuantity.value = normalizedBatchQuantity() + 1;
  updateBatchAddDialog();
});
document.querySelector('#closeBatchAdd').addEventListener('click', () => batchAddDialog.close());
document.querySelector('#cancelBatchAdd').addEventListener('click', () => batchAddDialog.close());
batchAddForm.addEventListener('submit', event => {
  event.preventDefault();
  const quantity = normalizedBatchQuantity();
  if (batchAddTarget.type === 'products') {
    const firstNewIndex = products.length;
    products.push(...Array.from({ length: quantity }, emptyProduct));
    render();
    setDirty();
    batchAddDialog.close();
    feedback.textContent = `${quantity} ${quantity === 1 ? 'producto agregado' : 'productos agregados'}. Completa sus datos antes de crear la orden.`;
    editors.children[firstNewIndex].querySelector('[data-field="code"]').focus();
    return;
  }

  const product = products[batchAddTarget.productIndex];
  if (!product) return;
  const firstNewVariantIndex = product.variants.length;
  product.variants.push(...Array.from({ length: quantity }, emptyVariant));
  render();
  setDirty();
  batchAddDialog.close();
  feedback.textContent = `${quantity} ${quantity === 1 ? 'variante agregada' : 'variantes agregadas'} a ${product.name || 'este producto'}.`;
  const productEditorElement = editors.children[batchAddTarget.productIndex];
  productEditorElement.querySelector(`[data-variant="${firstNewVariantIndex}"] [data-variant-field="0"]`).focus();
});

document.querySelector('#openCsvImport').addEventListener('click', () => {
  resetCsvImport();
  csvDialog.showModal();
});
document.querySelector('#closeCsvImport').addEventListener('click', () => csvDialog.close());
document.querySelector('#cancelCsvImport').addEventListener('click', () => csvDialog.close());
csvFile.addEventListener('change', () => processCsvFile(csvFile.files[0]));
document.querySelectorAll('[name="csvImportMode"]').forEach(option => option.addEventListener('change', renderCsvPreview));
document.querySelectorAll('[name="csvDelimiter"]').forEach(option => option.addEventListener('change', () => {
  csvDelimiterStatus.textContent = csvFileText
    ? `Usando ${csvDelimiterName(selectedCsvDelimiter())} para leer este archivo.`
    : `La plantilla se descargará usando ${csvDelimiterName(selectedCsvDelimiter())}.`;
  if (!csvFileText) return;
  csvImportResult = buildCsvImport(csvFileText, selectedCsvDelimiter());
  renderCsvPreview();
}));

['dragenter', 'dragover'].forEach(eventName => {
  csvDropzone.addEventListener(eventName, event => {
    event.preventDefault();
    csvDropzone.classList.add('is-dragging');
  });
});
['dragleave', 'drop'].forEach(eventName => {
  csvDropzone.addEventListener(eventName, event => {
    event.preventDefault();
    csvDropzone.classList.remove('is-dragging');
  });
});
csvDropzone.addEventListener('drop', event => processCsvFile(event.dataTransfer.files[0]));

document.querySelector('#downloadCsvTemplate').addEventListener('click', () => {
  const delimiter = selectedCsvDelimiter();
  const templateRows = [
    ['codigo_proveedor', 'nombre', 'subcategoria', 'color', 'talla', 'cantidad', 'costo_unitario', 'precio_venta'],
    ['SOHO25120', 'Vestido satinado', 'Vestidos', 'Azul', 'S', '2', '8.50', '1250'],
    ['SOHO25120', 'Vestido satinado', 'Vestidos', 'Azul', 'M', '3', '8.50', '1250']
  ];
  const template = `\uFEFF${templateRows.map(row => row.join(delimiter)).join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla-productos-orden.csv';
  link.click();
  URL.revokeObjectURL(url);
});

confirmCsvImport.addEventListener('click', () => {
  if (!csvImportResult || confirmCsvImport.disabled) return;
  const mode = document.querySelector('[name="csvImportMode"]:checked').value;
  csvDialog.close();
  if (mode === 'replace' && products.length) {
    const current = importedCounts(products);
    const incoming = importedCounts(csvImportResult.products);
    document.querySelector('#replaceProductsDescription').textContent = `Esta importación quitará ${current.products} ${current.products === 1 ? 'producto capturado' : 'productos capturados'} y sus ${current.variants} ${current.variants === 1 ? 'variante' : 'variantes'}.`;
    document.querySelector('#replacementImpact').innerHTML = `<div><span>Actual</span><strong>${current.products} productos · ${current.variants} variantes · ${current.units} unidades</strong></div><span aria-hidden="true">→</span><div><span>Después de importar</span><strong>${incoming.products} productos · ${incoming.variants} variantes · ${incoming.units} unidades</strong></div>`;
    replaceProductsDialog.showModal();
    return;
  }
  applyCsvImport(mode);
});

document.querySelector('#closeReplaceProducts').addEventListener('click', () => replaceProductsDialog.close());
document.querySelector('#cancelReplaceProducts').addEventListener('click', () => replaceProductsDialog.close());
replaceProductsForm.addEventListener('submit', event => {
  event.preventDefault();
  replaceProductsDialog.close();
  applyCsvImport('replace');
});

[shipping, currency, exchangeRate].forEach(control => {
  control.addEventListener('input', () => {
    updateSummary();
    setDirty();
  });
  control.addEventListener('change', () => {
    updateSummary();
    setDirty();
  });
});

supplier.addEventListener('change', () => {
  if (!supplier.value) return;
  currency.value = supplier.value === 'Textiles Managua' ? 'NIO' : 'USD';
  updateSummary();
  setDirty();
});

orderForm.addEventListener('input', event => {
  if (event.target === comment) updateCommentCount();
  if (!event.target.closest('#productEditors') && ![shipping, currency, exchangeRate].includes(event.target)) setDirty();
});

orderForm.addEventListener('change', event => {
  if (!event.target.closest('#productEditors') && ![shipping, currency, exchangeRate].includes(event.target)) setDirty();
});

errorSummary.addEventListener('click', event => {
  const button = event.target.closest('[data-error-index]');
  if (!button) return;
  const error = currentValidationErrors[Number(button.dataset.errorIndex)];
  error?.control?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  error?.control?.focus({ preventScroll: true });
});

function populatePurchaseReview() {
  const totals = orderTotals();
  document.querySelector('#confirmSupplier').textContent = document.querySelector('#supplier').value;
  document.querySelector('#confirmCurrency').textContent = currency.value === 'NIO' ? 'C$ — compra local' : 'USD';
  document.querySelector('#confirmProducts').textContent = products.length;
  document.querySelector('#confirmVariants').textContent = totals.variants;
  document.querySelector('#confirmUnits').textContent = totals.units;
  document.querySelector('#confirmMerchandise').textContent = money(totals.merchandise);
  document.querySelector('#confirmShipping').textContent = money(totals.delivery);
  document.querySelector('#confirmTotal').textContent = money(totals.total);
  document.querySelector('#confirmRateContext').innerHTML = currency.value === 'USD'
    ? `<span>Tasa aplicada</span><strong>C$ ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(exchangeRate.value))} por US$1</strong><small>Total estimado en córdobas: ${cordobas(totals.total * Number(exchangeRate.value))}</small>`
    : '<span>Compra local</span><strong>Todos los costos están registrados en córdobas.</strong>';
}

function nextOrderId() {
  const ids = (window.purchaseOrders || []).map(order => Number(order.id.match(/\d+/)?.[0] || 0));
  const stored = JSON.parse(localStorage.getItem('pw-purchase-orders') || '[]');
  stored.forEach(order => ids.push(Number(order.id?.match(/\d+/)?.[0] || 0)));
  return `OC-${String(Math.max(0, ...ids) + 1).padStart(4, '0')}`;
}

function confirmedOrderRecord() {
  const totals = orderTotals();
  const id = editingOrderId || nextOrderId();
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    supplier: document.querySelector('#supplier').value,
    date: editingOrder?.date || new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${today}T12:00:00`)).replace('.', ''),
    purchaseDate: editingOrder?.purchaseDate || today,
    status: editingOrder?.status || 'confirmed',
    label: editingOrder?.label || 'Confirmada',
    currency: currency.value,
    merchandiseAmount: totals.merchandise,
    shippingAmount: totals.delivery,
    exchangeRate: currency.value === 'USD' ? Number(exchangeRate.value) : null,
    packages: structuredClone(editingOrder?.packages || []),
    received: Math.min(editingOrder?.received || 0, totals.units),
    total: totals.units,
    activity: editingOrder ? 'Actualizada hoy' : 'Confirmada hoy',
    comment: comment.value.trim(),
    products: products.map(product => ({
      code: product.code.trim(),
      name: product.name.trim(),
      category: product.category,
      variants: product.variants.map(variant => ({
        color: String(variant[0]).trim(),
        size: String(variant[1]),
        quantity: Number(variant[2]),
        received: 0,
        unitCost: Number(variant[3]),
        retailPrice: Number(variant[4])
      }))
    }))
  };
}

orderForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateOrder()) return;
  populatePurchaseReview();
  confirmPurchaseDialog.showModal();
  requestAnimationFrame(() => document.querySelector('#backToOrder').focus());
});

document.querySelector('#closeConfirmPurchase').addEventListener('click', () => confirmPurchaseDialog.close());
document.querySelector('#backToOrder').addEventListener('click', () => confirmPurchaseDialog.close());
confirmPurchaseForm.addEventListener('submit', event => {
  event.preventDefault();
  if (confirmPurchaseButton.disabled) return;
  confirmPurchaseButton.disabled = true;
  confirmPurchaseButton.textContent = 'Confirmando compra…';
  try {
    const record = confirmedOrderRecord();
    const stored = JSON.parse(localStorage.getItem('pw-purchase-orders') || '[]').filter(order => order.id !== record.id);
    stored.unshift(record);
    localStorage.setItem('pw-purchase-orders', JSON.stringify(stored));
    setDirty(false);
    window.location.assign(`purchase-order-detail.html?id=${encodeURIComponent(record.id)}&${editingOrderId ? 'updated' : 'created'}=1`);
  } catch {
    confirmPurchaseButton.disabled = false;
    confirmPurchaseButton.textContent = 'Intentar confirmar de nuevo';
    const warning = confirmPurchaseDialog.querySelector('.confirmation-warning');
    warning.classList.add('is-error');
    warning.querySelector('strong').textContent = 'No pudimos confirmar la compra.';
    warning.querySelector('span').textContent = 'La información sigue intacta. Revisa el almacenamiento del navegador e inténtalo nuevamente.';
    warning.setAttribute('role', 'alert');
    warning.focus?.();
  }
});

document.querySelector('#collapseProducts').addEventListener('click', () => {
  const shouldCollapse = !products.every(product => product.collapsed);
  products.forEach(product => {
    product.collapsed = shouldCollapse;
  });
  render();
});

undoRemoval.addEventListener('click', () => {
  if (!lastRemoval) return;
  if (lastRemoval.type === 'product') {
    products.splice(lastRemoval.index, 0, lastRemoval.value);
  } else if (lastRemoval.type === 'variant') {
    const product = products[lastRemoval.productIndex];
    product?.variants.splice(lastRemoval.index, 0, lastRemoval.value);
  } else if (lastRemoval.type === 'csv-replace') {
    products = structuredClone(lastRemoval.value);
  }
  closeUndo();
  render();
  setDirty();
  feedback.classList.remove('is-error');
  feedback.textContent = 'Se restauró el elemento eliminado.';
});

document.querySelector('#dismissUndo').addEventListener('click', closeUndo);
window.addEventListener('beforeunload', event => {
  if (!hasUnsavedChanges) return;
  event.preventDefault();
  event.returnValue = '';
});

document.querySelector('#orderFormBack').addEventListener('click', event => {
  if (!hasUnsavedChanges) return;
  if (!window.confirm('Hay cambios sin guardar. ¿Deseas salir de la orden?')) event.preventDefault();
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

if (editingOrderId) {
  const detailUrl = `purchase-order-detail.html?id=${encodeURIComponent(editingOrderId)}`;
  const backLink = document.querySelector('#orderFormBack');
  document.title = 'Pretty Woman - Editar orden';
  document.querySelector('h1').textContent = 'Editar orden';
  backLink.href = detailUrl;
  backLink.setAttribute('aria-label', `Regresar al detalle de la orden ${editingOrderId}`);
  backLink.querySelector('.crumb-label').textContent = 'Regresar al detalle';
  document.querySelectorAll('.submit-order').forEach(button => {
    button.textContent = 'Revisar cambios';
  });
}

if (editingOrder) {
  supplier.value = editingOrder.supplier;
  currency.value = editingOrder.currency;
  exchangeRate.value = editingOrder.exchangeRate || '';
  shipping.value = Number(editingOrder.shippingAmount || 0).toFixed(2);
  comment.value = editingOrder.comment || '';
  document.querySelector('#confirmPurchaseTitle').textContent = 'Revisar y guardar cambios';
  document.querySelector('#confirmPurchaseDescription').textContent = 'Comprueba los datos principales antes de actualizar la orden. Los seguimientos y recepciones existentes se conservarán.';
  confirmPurchaseButton.textContent = 'Guardar cambios';
  document.querySelector('.confirmation-warning strong').textContent = 'Esta acción actualiza la orden.';
  document.querySelector('.confirmation-warning span').textContent = 'Los cambios quedarán visibles inmediatamente en el detalle de la orden.';
}

render();
updateCommentCount();
setDirty(false);
