const {
  loadCampaigns,
  normalizeRule,
  normalizeText,
  productForRule,
  products,
  saveCampaigns,
  setCampaignEnabled,
  upsertCampaign,
  validateCampaign
} = PrettyWomanCampaignData;

const campaignMode = document.body.dataset.campaignMode;
const isEditMode = campaignMode === 'edit';
const query = new URLSearchParams(location.search);
const requestedId = Number(query.get('id')) || 3;
const form = document.querySelector('#campaignForm');
const nameInput = document.querySelector('#campaignName');
const startDateInput = document.querySelector('#campaignStartDate');
const endDateInput = document.querySelector('#campaignEndDate');
const enabledInput = document.querySelector('#campaignEnabled');
const productContainer = document.querySelector('#campaignProducts');
const validationSummary = document.querySelector('#campaignValidationSummary');
const validationItems = document.querySelector('#campaignValidationItems');
const productDialog = document.querySelector('#productSelectorDialog');
const productSearch = document.querySelector('#productSelectorSearch');
const productCategoryFilter = document.querySelector('#productSelectorCategory');
const productList = document.querySelector('#productSelectorList');
const toast = document.querySelector('#campaignToast');
const disableButton = document.querySelector('#disableCampaign');
const disableDialog = document.querySelector('#disableCampaignDialog');
const collapseProductsButton = document.querySelector('#collapseCampaignProducts');
const csvDialog = document.querySelector('#campaignCsvImportDialog');
const csvFile = document.querySelector('#campaignCsvFile');
const csvDropzone = document.querySelector('#campaignCsvDropzone');
const csvFileLabel = document.querySelector('#campaignCsvFileLabel');
const csvFileHelp = document.querySelector('#campaignCsvFileHelp');
const csvPreview = document.querySelector('#campaignCsvPreview');
const csvPreviewSummary = document.querySelector('#campaignCsvPreviewSummary');
const csvErrors = document.querySelector('#campaignCsvErrors');
const csvErrorRows = document.querySelector('#campaignCsvErrorRows');
const csvConfirmButton = document.querySelector('#confirmCampaignCsvImport');
let campaigns = loadCampaigns(localStorage);
let existingCampaign = isEditMode ? campaigns.find(campaign => campaign.id === requestedId) : null;
let selectedRules = existingCampaign ? existingCampaign.products.map(normalizeRule) : [];
let expandedProducts = new Set();
let variantSelectionState = new Map();
let selectorSelection = new Set();
let inlineVariantErrors = new Set();
let lastDialogTrigger = null;
let csvImportResult = null;
let pendingEnabledState = null;

function escapeHTML(value = '') {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function formatMoney(value) {
  return `C$ ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function variantPrice(product, variant) {
  return Number.isFinite(Number(variant?.price)) ? Number(variant.price) : Number(product?.price) || 0;
}

function variantCost(product, variant) {
  return Number.isFinite(Number(variant?.cost)) ? Number(variant.cost) : variantPrice(product, variant) * .58;
}

function calculateCampaignPrice(currentPrice, discountTypeId, discountValue) {
  const price = Number(currentPrice) || 0;
  const value = Number(discountValue) || 0;
  if (Number(discountTypeId) === 1) return Math.max(0, price - value);
  if (Number(discountTypeId) === 3) return Math.max(0, value);
  return Math.max(0, price * (1 - value / 100));
}

function updateCollapseProductsAction(groups = groupRulesByProduct()) {
  if (!collapseProductsButton) return;
  const allCollapsed = groups.length === 0 || groups.every(group => !expandedProducts.has(group.productId));
  const action = allCollapsed ? 'Expandir todos' : 'Contraer todos';
  const actionLabel = collapseProductsButton.querySelector('[data-collapse-label]') || collapseProductsButton.querySelector('.action-icon + span');
  if (actionLabel) actionLabel.textContent = action;
  collapseProductsButton.setAttribute('aria-label', action);
  collapseProductsButton.disabled = groups.length === 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2800);
}

function allVariantIds(product) {
  return (product?.variants || []).map(variant => Number(variant.id));
}

function groupRulesByProduct(rules = selectedRules) {
  const groups = new Map();

  rules.forEach(rule => {
    const product = productForRule(rule);
    if (!product) return;

    if (!groups.has(product.id)) {
      groups.set(product.id, { productId: product.id, product, rules: [], variantIds: [] });
    }

    const group = groups.get(product.id);
    group.rules.push(rule);
    if (rule.productVariantId && !group.variantIds.includes(Number(rule.productVariantId))) {
      group.variantIds.push(Number(rule.productVariantId));
    }
  });

  return [...groups.values()];
}

function groupForProduct(productId) {
  return groupRulesByProduct().find(group => group.productId === Number(productId));
}

function selectedVariantIds(group) {
  if (variantSelectionState.has(group.productId)) {
    return [...variantSelectionState.get(group.productId)];
  }

  const hasProductRule = group.rules.some(rule => rule.productId && !rule.productVariantId);
  return hasProductRule ? allVariantIds(group.product) : [...group.variantIds];
}

function groupConfig(group) {
  const rule = group.rules[0] || {};
  return {
    discountTypeId: Number(rule.discountTypeId) || 2,
    discountValue: rule.discountValue ?? 10
  };
}

function productIdFromTargetKey(targetKey) {
  const [kind, rawId] = String(targetKey || '').split(':');
  const id = Number(rawId);
  if (kind === 'product') return id;
  if (kind === 'variant') return productForRule({ productVariantId: id })?.id;
  return undefined;
}

function rulesForProductGroup(group) {
  const variantIds = selectedVariantIds(group);
  const config = groupConfig(group);
  const allIds = allVariantIds(group.product);

  if (!variantIds.length) return [];
  if (variantIds.length === allIds.length) {
    return [{ productId: group.productId, productVariantId: null, ...config }];
  }

  return variantIds.map(productVariantId => ({ productId: null, productVariantId, ...config }));
}

function currentCampaign() {
  return {
    id: existingCampaign?.id ?? null,
    name: nameInput.value.trim(),
    startDate: startDateInput.value,
    endDate: endDateInput.value,
    enabled: enabledInput.checked,
    createdAt: existingCampaign?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'María Pérez',
    products: groupRulesByProduct().flatMap(rulesForProductGroup)
  };
}

function updateFormState() {
  if (!disableButton) return;
  disableButton.hidden = !isEditMode;
  disableButton.textContent = enabledInput.checked ? 'Deshabilitar campaña' : 'Habilitar campaña';
  disableButton.setAttribute('aria-label', disableButton.textContent);
}

function valueUnit(typeId) {
  return Number(typeId) === 2 ? '%' : 'C$';
}

function syncGroupDiscount(group, key, value) {
  group.rules.forEach(rule => {
    rule[key] = key === 'discountTypeId' ? Number(value) : value;
  });
}

function updateGroupScope(group) {
  const row = productContainer.querySelector(`[data-product-group="${group.productId}"]`);
  if (!row) return;

  const selected = selectedVariantIds(group);
  const total = allVariantIds(group.product).length;
  const scopeLabel = row.querySelector('[data-scope-label]');
  const scopeButton = row.querySelector('[data-toggle-variants]');
  const error = row.querySelector('[data-variant-error]');

  scopeLabel.textContent = selected.length === total
    ? 'Todas las variantes'
    : `${selected.length} ${selected.length === 1 ? 'variante seleccionada' : 'variantes seleccionadas'}`;
  scopeButton.textContent = expandedProducts.has(group.productId) ? 'Ocultar variantes' : 'Ver variantes';
  scopeButton.setAttribute('aria-expanded', String(expandedProducts.has(group.productId)));
  if (error) error.textContent = inlineVariantErrors.has(group.productId)
    ? 'Selecciona al menos una variante o restaura todas las variantes.'
    : '';
}

function renderVariantTable(group) {
  const config = groupConfig(group);
  const selected = new Set(selectedVariantIds(group));
  const rows = group.product.variants.map(variant => {
    const variantId = `campaign-${group.productId}-variant-${variant.id}`;
    const checked = selected.has(Number(variant.id));
    const currentPrice = variantPrice(group.product, variant);
    const newPrice = calculateCampaignPrice(currentPrice, config.discountTypeId, config.discountValue);
    const gain = newPrice - variantCost(group.product, variant);
    return `<tr class="campaign-variant-row${checked ? ' is-selected' : ''}" data-variant-row="${variant.id}">
      <td class="campaign-variant-select"><label for="${variantId}"><span class="sr-only">Aplicar a ${escapeHTML(variant.label)}</span><input id="${variantId}" type="checkbox" value="${variant.id}" data-variant-checkbox ${checked ? 'checked' : ''} /></label></td>
      <th scope="row"><label for="${variantId}">${escapeHTML(variant.label)}</label></th>
      <td>${formatMoney(variantCost(group.product, variant))}</td>
      <td>${formatMoney(currentPrice)}</td>
      <td data-variant-metric="new-price">${formatMoney(newPrice)}</td>
      <td class="${gain < 0 ? 'is-negative' : ''}" data-variant-metric="gain"><span>${formatMoney(gain)}</span>${gain < 0 ? '<small>Pérdida estimada</small>' : '<small>Ganancia estimada</small>'}</td>
    </tr>`;
  }).join('');

  return `<div class="campaign-variant-table-wrap"><table class="campaign-variant-table" aria-label="Variantes de ${escapeHTML(group.product.name)}"><thead><tr><th scope="col">Selección</th><th scope="col">Variante</th><th scope="col">Costo unitario</th><th scope="col">Precio actual</th><th scope="col">Nuevo precio</th><th scope="col">Ganancia estimada</th></tr></thead><tbody>${rows}</tbody></table><p class="field-error campaign-variant-error" data-variant-error role="alert">${inlineVariantErrors.has(group.productId) ? 'Selecciona al menos una variante o restaura todas las variantes.' : ''}</p></div>`;
}

function updateVariantMetrics(group) {
  const row = productContainer.querySelector(`[data-product-group="${group.productId}"]`);
  if (!row) return;
  const config = groupConfig(group);
  row.querySelectorAll('[data-variant-row]').forEach(variantRow => {
    const variant = group.product.variants.find(item => Number(item.id) === Number(variantRow.dataset.variantRow));
    if (!variant) return;
    const currentPrice = variantPrice(group.product, variant);
    const newPrice = calculateCampaignPrice(currentPrice, config.discountTypeId, config.discountValue);
    const gain = newPrice - variantCost(group.product, variant);
    const priceOutput = variantRow.querySelector('[data-variant-metric="new-price"]');
    const gainOutput = variantRow.querySelector('[data-variant-metric="gain"]');
    if (priceOutput) priceOutput.textContent = formatMoney(newPrice);
    if (gainOutput) {
      gainOutput.classList.toggle('is-negative', gain < 0);
      gainOutput.innerHTML = `<span>${formatMoney(gain)}</span><small>${gain < 0 ? 'Pérdida estimada' : 'Ganancia estimada'}</small>`;
    }
  });
}

function renderProducts() {
  const groups = groupRulesByProduct();
  if (!groups.length) {
    productContainer.innerHTML = '<div class="campaign-products-placeholder"><span aria-hidden="true">◇</span><strong>No hay productos agregados</strong><p>Agrega uno o varios productos y luego ajusta sus variantes si lo necesitas.</p></div>';
    updateFormState();
    updateCollapseProductsAction(groups);
    return;
  }

  productContainer.innerHTML = `<div class="campaign-product-columns" aria-hidden="true"><span>PRODUCTO</span><span>VARIANTES</span><span>TIPO</span><span>VALOR</span><span></span></div>${groups.map(group => {
    const product = group.product;
    const selected = selectedVariantIds(group);
    const total = allVariantIds(product).length;
    const config = groupConfig(group);
    const unit = valueUnit(config.discountTypeId);
    const groupId = `campaign-product-${product.id}`;
    const expanded = expandedProducts.has(product.id);
    const scopeLabel = selected.length === total
      ? 'Todas las variantes'
      : `${selected.length} ${selected.length === 1 ? 'variante seleccionada' : 'variantes seleccionadas'}`;
    const targetDescription = `${product.name}, ${scopeLabel}`;

    return `<article class="campaign-product-group" data-product-group="${product.id}">
      <div class="campaign-product-rule" data-group-row="${product.id}">
        <div class="campaign-product-identity"><img src="${product.image}" alt="" /><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.reference)} · ${formatMoney(product.price)}</small></span></div>
        <div class="campaign-product-scope"><small class="campaign-rule-scope" data-scope-label>${escapeHTML(scopeLabel)}</small><button class="campaign-variants-toggle" data-toggle-variants type="button" aria-expanded="${expanded}" aria-controls="${groupId}-variants">${expanded ? 'Ocultar variantes' : 'Ver variantes'}</button></div>
        <label><span class="sr-only">Tipo de descuento para ${escapeHTML(targetDescription)}</span><select data-rule="type"><option value="1" ${config.discountTypeId === 1 ? 'selected' : ''}>Monto fijo</option><option value="2" ${config.discountTypeId === 2 ? 'selected' : ''}>Porcentaje</option><option value="3" ${config.discountTypeId === 3 ? 'selected' : ''}>Precio final</option></select></label>
        <label class="campaign-value-field"><span class="sr-only">Valor del descuento para ${escapeHTML(targetDescription)}</span><span class="campaign-value-wrap ${unit === '%' ? 'is-percent' : ''}"><span aria-hidden="true">${unit}</span><input data-rule="value" type="number" min="0.01" step="0.01" value="${escapeHTML(config.discountValue)}" /></span><small class="field-error" data-group-error></small></label>
        <button class="campaign-remove-product" type="button" data-remove-product aria-label="Quitar ${escapeHTML(product.name)}">×</button>
      </div>
      <div class="campaign-variant-panel" id="${groupId}-variants" data-variant-panel ${expanded ? '' : 'hidden'}>${renderVariantTable(group)}</div>
    </article>`;
  }).join('')}`;

  productContainer.querySelectorAll('[data-product-group]').forEach(row => {
    const productId = Number(row.dataset.productGroup);
    const group = groups.find(item => item.productId === productId);
    const panel = row.querySelector('[data-variant-panel]');
    const toggle = row.querySelector('[data-toggle-variants]');

    toggle.addEventListener('click', () => {
      const isExpanded = expandedProducts.has(productId);
      if (isExpanded) expandedProducts.delete(productId);
      else expandedProducts.add(productId);
      panel.hidden = isExpanded;
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      toggle.textContent = isExpanded ? 'Ocultar variantes' : 'Ver variantes';
    });

    row.querySelector('[data-rule="type"]').addEventListener('change', event => {
      syncGroupDiscount(group, 'discountTypeId', event.target.value);
      clearValidation();
      updateVariantMetrics(group);
      updateFormState();
    });
    row.querySelector('[data-rule="value"]').addEventListener('input', event => {
      syncGroupDiscount(group, 'discountValue', event.target.value);
      clearValidation();
      updateVariantMetrics(group);
    });
    row.querySelector('[data-remove-product]').addEventListener('click', () => {
      selectedRules = selectedRules.filter(rule => productForRule(rule)?.id !== productId);
      variantSelectionState.delete(productId);
      expandedProducts.delete(productId);
      inlineVariantErrors.delete(productId);
      clearValidation();
      renderProducts();
      showToast('Producto retirado de la campaña.');
    });
    row.querySelectorAll('[data-variant-checkbox]').forEach(control => {
      control.addEventListener('change', () => {
        const selectedIds = [...panel.querySelectorAll('[data-variant-checkbox]:checked')].map(input => Number(input.value));
        variantSelectionState.set(productId, new Set(selectedIds));
        if (!selectedIds.length) inlineVariantErrors.add(productId);
        else inlineVariantErrors.delete(productId);
        updateGroupScope(group);
        const variantRow = control.closest('[data-variant-row]');
        variantRow?.classList.toggle('is-selected', control.checked);
        clearValidation();
        updateFormState();
      });
    });
  });
  updateFormState();
  updateCollapseProductsAction(groups);
}

function selectorMatches(product, queryText, category) {
  const searchable = product.reference || '';
  const matchesSearch = !queryText || normalizeText(searchable).includes(normalizeText(queryText));
  return matchesSearch && (!category || product.category === category);
}

function renderProductSelector() {
  const visibleProducts = products.filter(product => selectorMatches(product, productSearch.value, productCategoryFilter?.value));
  if (!visibleProducts.length) {
    productList.innerHTML = '<p class="product-selector-empty">No encontramos productos con esa búsqueda.</p>';
  } else {
    productList.innerHTML = visibleProducts.map(product => {
      const included = Boolean(groupForProduct(product.id));
      const checked = included || selectorSelection.has(product.id);
      const inputId = `selector-product-${product.id}`;
      return `<label class="product-selector-item ${included ? 'is-included' : ''}" for="${inputId}"><input id="${inputId}" type="checkbox" value="${product.id}" data-selector-product ${checked ? 'checked' : ''} ${included ? 'disabled' : ''} /><img src="${product.image}" alt="" /><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.reference)} · ${formatMoney(product.price)}</small></span><span>${included ? 'Incluido' : 'Producto completo'}</span></label>`;
    }).join('');
  }

  productList.querySelectorAll('[data-selector-product]').forEach(control => {
    control.addEventListener('change', () => {
      const productId = Number(control.value);
      if (control.checked) selectorSelection.add(productId);
      else selectorSelection.delete(productId);
      updateProductSelectorCount();
    });
  });
  updateProductSelectorCount();
}

function updateProductSelectorCount() {
  const count = selectorSelection.size;
  document.querySelector('#productSelectorCount').textContent = `${count} ${count === 1 ? 'producto por agregar' : 'productos por agregar'}`;
  document.querySelector('#confirmProductSelection').disabled = count === 0;
}

function parseDelimitedCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < String(text || '').length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function normalizedCsvHeader(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function discountTypeFromCsv(value) {
  const normalized = normalizedCsvHeader(value);
  if (normalized === '1' || normalized === 'montofijo' || normalized === 'monto') return 1;
  if (normalized === '2' || normalized === 'porcentaje' || normalized === 'percent') return 2;
  if (normalized === '3' || normalized === 'preciofinal' || normalized === 'precio') return 3;
  return null;
}

function numericCsvValue(value) {
  const normalized = String(value ?? '').trim().replace(/[^0-9,.-]/g, '');
  if (!normalized) return NaN;
  const decimal = normalized.includes(',') && !normalized.includes('.')
    ? normalized.replace(',', '.')
    : normalized.replace(/,/g, '');
  return Number(decimal);
}

function parseCampaignCsv(text, delimiter = ',') {
  const matrix = parseDelimitedCsv(text, delimiter);
  const errors = [];
  if (!matrix.length) return { rows: [], errors: [{ line: 1, message: 'El archivo está vacío.' }] };

  const aliases = {
    productId: ['productid', 'product', 'product_id', 'productoid', 'productod', 'productocodigo', 'producto'],
    productVariantId: ['productvariantid', 'variantid', 'variant_id', 'varianteid', 'variante_id', 'variant'],
    discountTypeId: ['discounttype', 'discounttypeid', 'discount_type', 'tipodescuento', 'tipo_descuento', 'tipo'],
    discountValue: ['discountvalue', 'discount_value', 'valordescuento', 'valor_descuento', 'valor']
  };
  const headerKeys = matrix[0].map(normalizedCsvHeader);
  const findIndex = key => headerKeys.findIndex(header => aliases[key].some(alias => normalizedCsvHeader(alias) === header));
  const indexes = Object.fromEntries(Object.keys(aliases).map(key => [key, findIndex(key)]));

  Object.entries(indexes).forEach(([key, index]) => {
    if (index < 0) errors.push({ line: 1, message: `Falta la columna ${key === 'productId' ? 'ProductId' : key === 'productVariantId' ? 'ProductVariantId' : key === 'discountTypeId' ? 'DiscountType' : 'DiscountValue'}.` });
  });
  if (errors.length) return { rows: [], errors };

  const rows = matrix.slice(1).map((values, index) => ({
    line: index + 2,
    productId: Number(values[indexes.productId]) || null,
    productVariantId: Number(values[indexes.productVariantId]) || null,
    discountTypeId: discountTypeFromCsv(values[indexes.discountTypeId]),
    discountValue: numericCsvValue(values[indexes.discountValue])
  }));
  return { rows, errors: validateCampaignImport(rows) };
}

function validateCampaignImport(rows) {
  const errors = [];
  const seenTargets = new Set();
  rows.forEach(row => {
    let product = row.productId ? products.find(item => item.id === row.productId) : null;
    const variant = row.productVariantId ? products.flatMap(item => item.variants.map(itemVariant => ({ product: item, variant: itemVariant }))).find(item => item.variant.id === row.productVariantId) : null;
    if (row.productVariantId && !variant) {
      errors.push({ line: row.line, message: `La variante ${row.productVariantId} no existe.` });
    }
    if (row.productId && !product) {
      errors.push({ line: row.line, message: `El producto ${row.productId} no existe.` });
    }
    if (variant && product && variant.product.id !== product.id) {
      errors.push({ line: row.line, message: 'La variante no pertenece al producto indicado.' });
    }
    if (!product && variant) product = variant.product;
    if (!product && !variant && !row.productId && !row.productVariantId) errors.push({ line: row.line, message: 'Indica un ProductId válido o una variante válida.' });
    if (!row.discountTypeId) errors.push({ line: row.line, message: 'Usa Monto fijo, Porcentaje o Precio final.' });
    if (!Number.isFinite(row.discountValue) || row.discountValue <= 0) errors.push({ line: row.line, message: 'El valor debe ser mayor que cero.' });
    if (row.discountTypeId === 2 && row.discountValue > 100) errors.push({ line: row.line, message: 'El porcentaje no puede ser mayor que 100.' });
    if (product || variant) {
      const targetKey = row.productVariantId ? `variant:${row.productVariantId}` : `product:${product.id}`;
      if (seenTargets.has(targetKey)) errors.push({ line: row.line, message: 'El destino está repetido en el archivo.' });
      seenTargets.add(targetKey);
    }
  });
  return errors;
}

function renderCsvPreview(result) {
  if (!csvPreview || !csvPreviewSummary || !csvErrors || !csvErrorRows || !csvConfirmButton) return;
  const rows = result.rows || [];
  const errors = result.errors || [];
  csvPreview.innerHTML = rows.length
    ? `<strong>${rows.length} ${rows.length === 1 ? 'fila lista para revisar' : 'filas listas para revisar'}</strong><span>${errors.length ? 'Hay correcciones pendientes antes de importar.' : 'La estructura y los destinos son válidos.'}</span>`
    : '<strong>No encontramos filas para importar</strong><span>Revisa el encabezado y vuelve a seleccionar el archivo.</span>';
  csvPreviewSummary.hidden = false;
  csvPreviewSummary.innerHTML = `<span><strong>${rows.length}</strong> filas</span><span><strong>${errors.length}</strong> ${errors.length === 1 ? 'error' : 'errores'}</span>`;
  csvErrors.hidden = errors.length === 0;
  csvErrorRows.innerHTML = errors.map(error => `<tr><td>${error.line}</td><td>${escapeHTML(error.message)}</td></tr>`).join('');
  csvConfirmButton.disabled = rows.length === 0 || errors.length > 0;
}

function resetCsvImport() {
  csvImportResult = null;
  if (csvFile) csvFile.value = '';
  if (csvFileLabel) csvFileLabel.textContent = 'Seleccionar archivo CSV';
  if (csvFileHelp) csvFileHelp.textContent = 'También puedes arrastrarlo aquí · Máximo 1 MB';
  if (csvPreview) csvPreview.innerHTML = '<strong>Aún no hay un archivo seleccionado</strong><span>Al cargarlo verás el resumen y cualquier fila que necesite corrección.</span>';
  if (csvPreviewSummary) csvPreviewSummary.hidden = true;
  if (csvErrors) csvErrors.hidden = true;
  if (csvErrorRows) csvErrorRows.innerHTML = '';
  if (csvConfirmButton) csvConfirmButton.disabled = true;
}

function loadCampaignCsvFile(file) {
  if (!file || !csvFileLabel || !csvFileHelp) return;
  csvFileLabel.textContent = file.name;
  csvFileHelp.textContent = `${Math.round(file.size / 1024)} KB · CSV listo para revisar`;
  file.text().then(text => {
    const delimiter = document.querySelector('input[name="campaignCsvDelimiter"]:checked')?.value || ',';
    csvImportResult = parseCampaignCsv(text, delimiter);
    renderCsvPreview(csvImportResult);
  });
}

function downloadCampaignTemplate() {
  const delimiter = document.querySelector('input[name="campaignCsvDelimiter"]:checked')?.value || ',';
  const content = [`ProductId${delimiter}ProductVariantId${delimiter}DiscountType${delimiter}DiscountValue`, `1${delimiter}${delimiter}Porcentaje${delimiter}20`, `3${delimiter}301${delimiter}Monto fijo${delimiter}150`].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = 'plantilla-campanas.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function openCampaignCsvImport() {
  if (!csvDialog) return;
  lastDialogTrigger = document.activeElement;
  resetCsvImport();
  csvDialog.showModal();
  csvFile?.focus();
}

function closeCampaignCsvImport() {
  if (!csvDialog) return;
  csvDialog.close();
  lastDialogTrigger?.focus();
}

function applyCampaignCsvImport() {
  if (!csvImportResult?.rows?.length || csvImportResult.errors?.length) return;
  const importedRules = csvImportResult.rows.map(row => ({
    productId: row.productVariantId ? null : row.productId || productForRule({ productVariantId: row.productVariantId })?.id,
    productVariantId: row.productVariantId || null,
    discountTypeId: row.discountTypeId,
    discountValue: row.discountValue
  }));
  const mode = document.querySelector('input[name="campaignCsvMode"]:checked')?.value || 'combine';
  if (mode === 'replace') {
    selectedRules = importedRules;
    variantSelectionState.clear();
  } else {
    const existingTargets = new Set(selectedRules.map(rule => rule.productVariantId ? `variant:${rule.productVariantId}` : `product:${rule.productId}`));
    selectedRules = [...selectedRules, ...importedRules.filter(rule => {
      const key = rule.productVariantId ? `variant:${rule.productVariantId}` : `product:${rule.productId}`;
      if (existingTargets.has(key)) return false;
      existingTargets.add(key);
      return true;
    })];
  }
  importedRules.forEach(rule => {
    if (rule.productVariantId) expandedProducts.add(productForRule(rule)?.id);
  });
  clearValidation();
  renderProducts();
  closeCampaignCsvImport();
  showToast(`${importedRules.length} ${importedRules.length === 1 ? 'destino importado' : 'destinos importados'}.`);
}

function openProductSelector() {
  lastDialogTrigger = document.activeElement;
  selectorSelection = new Set();
  productSearch.value = '';
  if (productCategoryFilter) productCategoryFilter.value = '';
  renderProductSelector();
  productDialog.showModal();
  productSearch.focus();
}

function closeDialog(dialog) {
  dialog.close();
  lastDialogTrigger?.focus();
}

function clearValidation() {
  validationSummary.hidden = true;
  validationItems.innerHTML = '';
  document.querySelectorAll('.field-error').forEach(error => {
    if (!error.matches('[data-variant-error]')) error.textContent = '';
  });
  document.querySelectorAll('[aria-invalid="true"]').forEach(input => input.removeAttribute('aria-invalid'));
}

function renderValidation(errors) {
  clearValidation();
  if (!errors.length) return;

  validationItems.innerHTML = [...new Set(errors.map(error => error.message))].map(message => `<li>${escapeHTML(message)}</li>`).join('');
  validationSummary.hidden = false;
  const fieldTargets = {
    name: [nameInput, document.querySelector('#campaignNameError')],
    startDate: [startDateInput, document.querySelector('#campaignStartDateError')],
    endDate: [endDateInput, document.querySelector('#campaignEndDateError')],
    products: [document.querySelector('#openProductSelector'), document.querySelector('#campaignProductsError')]
  };

  errors.forEach(error => {
    if (error.field === 'discountValue' && error.targetKey) {
      const productId = productIdFromTargetKey(error.targetKey);
      const row = productContainer.querySelector(`[data-product-group="${productId}"]`);
      const input = row?.querySelector('[data-rule="value"]');
      const message = row?.querySelector('[data-group-error]');
      input?.setAttribute('aria-invalid', 'true');
      if (message) message.textContent = error.message;
      return;
    }
    const [input, message] = fieldTargets[error.field] || [];
    input?.setAttribute('aria-invalid', 'true');
    if (message) message.textContent = error.message;
  });

  const firstError = errors[0];
  const firstInput = firstError.targetKey && firstError.field === 'discountValue'
    ? productContainer.querySelector(`[data-product-group="${productIdFromTargetKey(firstError.targetKey)}"] [data-rule="value"]`)
    : fieldTargets[firstError.field]?.[0];
  validationSummary.focus();
  window.setTimeout(() => firstInput?.focus(), 80);
}

function groupErrors() {
  return groupRulesByProduct().filter(group => selectedVariantIds(group).length === 0).map(group => ({
    field: 'products',
    message: `Selecciona al menos una variante para ${group.product.name}.`
  }));
}

function initializeForm() {
  if (!isEditMode) {
    enabledInput.checked = true;
    renderProducts();
    return;
  }

  if (!existingCampaign) {
    validationSummary.hidden = false;
    validationSummary.querySelector('strong').textContent = 'No encontramos esta campaña';
    validationSummary.querySelector('p').textContent = 'Vuelve al historial y abre una campaña disponible.';
    validationItems.innerHTML = '';
    form.querySelectorAll('input, select, button').forEach(control => { control.disabled = true; });
    return;
  }

  nameInput.value = existingCampaign.name;
  startDateInput.value = existingCampaign.startDate;
  endDateInput.value = existingCampaign.endDate;
  enabledInput.checked = existingCampaign.enabled;
  document.title = `Pretty Woman - ${existingCampaign.name}`;
  renderProducts();
}

form.addEventListener('input', () => {
  clearValidation();
  updateFormState();
});
form.addEventListener('change', () => {
  clearValidation();
  updateFormState();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const campaign = currentCampaign();
  const errors = [...groupErrors(), ...validateCampaign(campaign, campaigns)];
  renderValidation(errors);
  if (errors.length) {
    groupRulesByProduct().forEach(group => {
      if (!selectedVariantIds(group).length) {
        expandedProducts.add(group.productId);
        inlineVariantErrors.add(group.productId);
      }
    });
    renderProducts();
    return;
  }

  campaigns = upsertCampaign(campaigns, campaign);
  saveCampaigns(localStorage, campaigns);
  location.href = `discount-campaigns.html?saved=${isEditMode ? 'updated' : 'created'}`;
});

document.querySelector('#openProductSelector').addEventListener('click', openProductSelector);
document.querySelector('#closeProductSelector').addEventListener('click', () => closeDialog(productDialog));
document.querySelector('#cancelProductSelection').addEventListener('click', () => closeDialog(productDialog));
productSearch.addEventListener('input', renderProductSelector);
productCategoryFilter?.addEventListener('change', renderProductSelector);
document.querySelector('#confirmProductSelection').addEventListener('click', () => {
  const additions = [...selectorSelection].map(productId => ({
    productId,
    productVariantId: null,
    discountTypeId: 2,
    discountValue: 10
  }));

  selectedRules = [...selectedRules, ...additions];
  clearValidation();
  renderProducts();
  closeDialog(productDialog);
  showToast(`${additions.length} ${additions.length === 1 ? 'producto agregado' : 'productos agregados'}.`);
});

collapseProductsButton?.addEventListener('click', () => {
  const groups = groupRulesByProduct();
  const allCollapsed = groups.length > 0 && groups.every(group => !expandedProducts.has(group.productId));
  expandedProducts = allCollapsed ? new Set(groups.map(group => group.productId)) : new Set();
  renderProducts();
});

document.querySelector('#openCampaignCsvImport')?.addEventListener('click', openCampaignCsvImport);
document.querySelector('#closeCampaignCsvImport')?.addEventListener('click', closeCampaignCsvImport);
document.querySelector('#cancelCampaignCsvImport')?.addEventListener('click', closeCampaignCsvImport);
document.querySelector('#downloadCampaignCsvTemplate')?.addEventListener('click', downloadCampaignTemplate);
csvFile?.addEventListener('change', event => loadCampaignCsvFile(event.target.files?.[0]));
csvDropzone?.addEventListener('dragover', event => {
  event.preventDefault();
  csvDropzone.classList.add('is-dragging');
});
csvDropzone?.addEventListener('dragleave', () => csvDropzone.classList.remove('is-dragging'));
csvDropzone?.addEventListener('drop', event => {
  event.preventDefault();
  csvDropzone.classList.remove('is-dragging');
  loadCampaignCsvFile(event.dataTransfer.files?.[0]);
});
document.querySelectorAll('input[name="campaignCsvDelimiter"]').forEach(control => control.addEventListener('change', () => {
  if (csvFile?.files?.[0]) loadCampaignCsvFile(csvFile.files[0]);
}));
csvConfirmButton?.addEventListener('click', applyCampaignCsvImport);

if (disableButton && disableDialog) {
  disableButton.addEventListener('click', () => {
    pendingEnabledState = !enabledInput.checked;
    const enabling = pendingEnabledState;
    document.querySelector('#disableCampaignTitle').textContent = enabling ? 'Habilitar campaña' : 'Deshabilitar campaña';
    document.querySelector('#disableCampaignDescription').textContent = enabling
      ? 'El descuento podrá aplicarse nuevamente durante la vigencia configurada.'
      : 'El descuento dejará de aplicarse de inmediato. La campaña permanecerá en el historial y podrás habilitarla nuevamente desde este editor.';
    document.querySelector('#cancelDisableCampaign').textContent = enabling ? 'Conservar deshabilitada' : 'Conservar habilitada';
    document.querySelector('#confirmDisableCampaign').textContent = enabling ? 'Habilitar' : 'Deshabilitar';
    document.querySelector('.campaign-confirm-icon').textContent = enabling ? '✓' : '⊘';
    lastDialogTrigger = disableButton;
    disableDialog.showModal();
    document.querySelector('#cancelDisableCampaign').focus();
  });
  document.querySelector('#closeDisableCampaign').addEventListener('click', () => closeDialog(disableDialog));
  document.querySelector('#cancelDisableCampaign').addEventListener('click', () => closeDialog(disableDialog));
  document.querySelector('#confirmDisableCampaign').addEventListener('click', () => {
    campaigns = setCampaignEnabled(campaigns, existingCampaign.id, pendingEnabledState);
    saveCampaigns(localStorage, campaigns);
    location.href = `discount-campaigns.html?saved=${pendingEnabledState ? 'enabled' : 'disabled'}`;
  });
}

[productDialog, disableDialog].filter(Boolean).forEach(dialog => dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeDialog(dialog);
}));

initializeForm();
