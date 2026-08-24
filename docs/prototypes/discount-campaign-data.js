(function exposeCampaignData(root, factory) {
  const campaignData = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = campaignData;
  }

  root.PrettyWomanCampaignData = campaignData;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createCampaignData() {
  const CAMPAIGN_STORAGE_KEY = 'pretty-woman-discount-campaigns';

  function variantsFor(baseId, labels, baseCost, basePrice) {
    return labels.map((label, index) => ({
      id: baseId * 100 + index + 1,
      label,
      cost: Number(baseCost) + index * 12,
      price: Number(basePrice) + [0, 20, -15][index % 3]
    }));
  }

  const products = [
    { id: 1, name: 'Vestido satinado', category: 'Vestidos', reference: 'VSAT-CRL', price: 1250, image: '../../assets/catalog/coral-satin-dress.png', variants: variantsFor(1, ['Talla S · Coral', 'Talla M · Coral', 'Talla L · Coral'], 690, 1250) },
    { id: 2, name: 'Jeans rectos', category: 'Pantalones', reference: 'JRET-AZM', price: 1100, image: '../../assets/catalog/blue-jeans.png', variants: variantsFor(2, ['Talla 6 · Azul medio', 'Talla 8 · Azul medio', 'Talla 10 · Azul medio'], 610, 1100) },
    { id: 3, name: 'Blusa seda', category: 'Blusas', reference: 'BLSE-CHP', price: 780, image: '../../assets/catalog/blouse-champagne.png', variants: variantsFor(3, ['Talla S · Champagne', 'Talla M · Champagne', 'Talla L · Champagne'], 420, 780) },
    { id: 4, name: 'Falda recta', category: 'Faldas', reference: 'FREC-NGR', price: 690, image: '../../assets/catalog/black-skirt.png', variants: variantsFor(4, ['Talla S · Negro', 'Talla M · Negro', 'Talla L · Negro'], 360, 690) },
    { id: 5, name: 'Vestido midi estampado', category: 'Vestidos', reference: 'VMID-FLR', price: 1380, image: '../../assets/catalog/coral-satin-dress.png', variants: variantsFor(5, ['Talla S · Floral', 'Talla M · Floral', 'Talla L · Floral'], 760, 1380) },
    { id: 6, name: 'Pantalón sastre', category: 'Pantalones', reference: 'PSAS-BEI', price: 980, image: '../../assets/catalog/blue-jeans.png', variants: variantsFor(6, ['Talla 6 · Beige', 'Talla 8 · Beige', 'Talla 10 · Beige'], 540, 980) },
    { id: 7, name: 'Blusa manga globo', category: 'Blusas', reference: 'BMGL-OLV', price: 820, image: '../../assets/catalog/blouse-champagne.png', variants: variantsFor(7, ['Talla S · Olivo', 'Talla M · Olivo', 'Talla L · Olivo'], 445, 820) },
    { id: 8, name: 'Falda plisada', category: 'Faldas', reference: 'FPLI-ROS', price: 740, image: '../../assets/catalog/black-skirt.png', variants: variantsFor(8, ['Talla S · Rosa', 'Talla M · Rosa', 'Talla L · Rosa'], 395, 740) },
    { id: 9, name: 'Vestido cruzado', category: 'Vestidos', reference: 'VCRU-VER', price: 1190, image: '../../assets/catalog/coral-satin-dress.png', variants: variantsFor(9, ['Talla S · Verde', 'Talla M · Verde', 'Talla L · Verde'], 650, 1190) },
    { id: 10, name: 'Jeans wide leg', category: 'Pantalones', reference: 'JWID-CLA', price: 1180, image: '../../assets/catalog/blue-jeans.png', variants: variantsFor(10, ['Talla 6 · Claro', 'Talla 8 · Claro', 'Talla 10 · Claro'], 635, 1180) }
  ];

  const seedCampaigns = [
    {
      id: 1,
      name: 'Verano Coral',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      enabled: true,
      createdAt: '2026-07-22T14:15:00',
      updatedAt: '2026-08-10T09:20:00',
      updatedBy: 'María Pérez',
      products: [
        { productDetailId: 1, discountTypeId: 2, discountValue: 20 },
        { productDetailId: 3, discountTypeId: 1, discountValue: 150 },
        { productDetailId: 5, discountTypeId: 3, discountValue: 1090 }
      ]
    },
    {
      id: 2,
      name: 'Fiestas Patrias',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      enabled: true,
      createdAt: '2026-08-03T11:30:00',
      updatedAt: '2026-08-03T11:30:00',
      updatedBy: 'María Pérez',
      products: [
        { productDetailId: 2, discountTypeId: 2, discountValue: 15 },
        { productDetailId: 6, discountTypeId: 2, discountValue: 10 }
      ]
    },
    {
      id: 3,
      name: 'Día de las Madres',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      enabled: true,
      createdAt: '2026-04-15T08:05:00',
      updatedAt: '2026-06-02T10:10:00',
      updatedBy: 'María Pérez',
      products: [
        { productDetailId: 1, discountTypeId: 2, discountValue: 25 },
        { productDetailId: 3, discountTypeId: 2, discountValue: 20 },
        { productDetailId: 4, discountTypeId: 1, discountValue: 100 },
        { productDetailId: 7, discountTypeId: 3, discountValue: 690 }
      ]
    },
    {
      id: 4,
      name: 'Liquidación julio',
      startDate: '2026-07-05',
      endDate: '2026-07-31',
      enabled: false,
      createdAt: '2026-07-01T16:40:00',
      updatedAt: '2026-07-20T12:00:00',
      updatedBy: 'María Pérez',
      products: [
        { productDetailId: 8, discountTypeId: 3, discountValue: 490 },
        { productDetailId: 10, discountTypeId: 1, discountValue: 200 }
      ]
    },
    {
      id: 5,
      name: 'Especial de junio',
      startDate: '2026-06-01',
      endDate: '2026-06-20',
      enabled: true,
      createdAt: '2026-05-25T10:00:00',
      updatedAt: '2026-05-25T10:00:00',
      updatedBy: 'María Pérez',
      products: [{ productDetailId: 6, discountTypeId: 2, discountValue: 12 }]
    },
    {
      id: 6,
      name: 'Fin de temporada',
      startDate: '2026-08-20',
      endDate: '2026-08-31',
      enabled: true,
      createdAt: '2026-08-07T09:15:00',
      updatedAt: '2026-08-07T09:15:00',
      updatedBy: 'María Pérez',
      products: [
        { productDetailId: 4, discountTypeId: 2, discountValue: 18 },
        { productDetailId: 9, discountTypeId: 1, discountValue: 180 }
      ]
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function normalizeRule(rule = {}) {
    const variantId = Number(rule.productVariantId) || null;
    const productId = variantId ? null : Number(rule.productId ?? rule.productDetailId) || null;
    const rawValue = rule.discountValue;
    const numericValue = Number(rawValue);

    return {
      productId,
      productVariantId: variantId,
      discountTypeId: Number(rule.discountTypeId) || 2,
      discountValue: Number.isFinite(numericValue) ? numericValue : rawValue ?? ''
    };
  }

  function normalizeCampaign(campaign = {}) {
    return {
      ...clone(campaign),
      products: (campaign.products || []).map(normalizeRule)
    };
  }

  function findVariant(variantId) {
    return products
      .map(product => ({ product, variant: (product.variants || []).find(item => item.id === Number(variantId)) }))
      .find(item => item.variant)?.variant;
  }

  function productForRule(rule) {
    if (rule?.productId) return products.find(product => product.id === Number(rule.productId));
    if (rule?.productVariantId) {
      return products.find(product => (product.variants || []).some(variant => variant.id === Number(rule.productVariantId)));
    }
    return undefined;
  }

  function variantForRule(rule) {
    return rule?.productVariantId ? findVariant(rule.productVariantId) : undefined;
  }

  function ruleTargetKey(rule) {
    return rule?.productVariantId ? `variant:${Number(rule.productVariantId)}` : `product:${Number(rule?.productId)}`;
  }

  function getCampaignStatus(campaign, today = getLocalDateString()) {
    if (!campaign.enabled) return 'disabled';
    if (campaign.startDate > today) return 'scheduled';
    if (campaign.endDate < today) return 'finished';
    return 'active';
  }

  function validateCampaign(campaign, campaigns = []) {
    const errors = [];
    const normalizedName = normalizeText(campaign.name);

    if (!normalizedName) {
      errors.push({ field: 'name', message: 'Escribe un nombre para la campaña.' });
    } else if (campaigns.some(item => item.id !== campaign.id && normalizeText(item.name) === normalizedName)) {
      errors.push({ field: 'name', message: 'Ya existe una campaña con ese nombre.' });
    }

    if (!campaign.startDate) {
      errors.push({ field: 'startDate', message: 'Selecciona la fecha inicial.' });
    }

    if (!campaign.endDate) {
      errors.push({ field: 'endDate', message: 'Selecciona la fecha final.' });
    } else if (campaign.startDate && campaign.endDate < campaign.startDate) {
      errors.push({ field: 'endDate', message: 'La fecha final no puede ser anterior a la fecha inicial.' });
    }

    if (!campaign.products?.length) {
      errors.push({ field: 'products', message: 'Agrega al menos un destino a la campaña.' });
    }

    const seenTargets = new Set();
    (campaign.products || []).forEach(rawRule => {
      const rule = normalizeRule(rawRule);
      const hasProduct = Boolean(rule.productId);
      const hasVariant = Boolean(rule.productVariantId);
      const targetKey = ruleTargetKey(rule);

      if (hasProduct === hasVariant) {
        errors.push({ field: 'products', targetKey, message: 'Cada regla debe indicar un producto completo o una variante específica.' });
      } else if (seenTargets.has(targetKey)) {
        errors.push({ field: 'products', targetKey, message: 'El destino está repetido en la campaña.' });
      } else {
        seenTargets.add(targetKey);
      }

      if (hasProduct && !productForRule(rule)) {
        errors.push({ field: 'products', targetKey, message: 'Selecciona un producto válido.' });
      }

      if (hasVariant && !variantForRule(rule)) {
        errors.push({ field: 'products', targetKey, message: 'Selecciona una variante válida.' });
      }

      const value = Number(rule.discountValue);
      if (!Number.isFinite(value) || value <= 0) {
        errors.push({ field: 'discountValue', targetKey, message: 'El valor del descuento debe ser mayor que cero.' });
      } else if (Number(rule.discountTypeId) === 2 && value > 100) {
        errors.push({ field: 'discountValue', targetKey, message: 'El porcentaje debe estar entre 0.01 y 100.' });
      }
    });

    return errors;
  }

  function filterCampaigns(campaigns, filters = {}, today = getLocalDateString()) {
    const query = normalizeText(filters.query);
    const status = filters.status || '';

    return campaigns.map(normalizeCampaign).filter(campaign => {
      const campaignStatus = getCampaignStatus(campaign, today);
      const productNames = (campaign.products || [])
        .map(rule => {
          const product = productForRule(rule);
          const variant = variantForRule(rule);
          return product ? `${product.name} ${product.reference} ${variant?.label || 'Todas las variantes'}` : '';
        })
        .join(' ');
      const searchableText = normalizeText(`${campaign.name} ${productNames}`);
      return (!query || searchableText.includes(query)) && (!status || campaignStatus === status);
    });
  }

  function loadCampaigns(storage) {
    let campaigns = seedCampaigns;

    if (storage?.getItem) {
      try {
        const stored = storage.getItem(CAMPAIGN_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) campaigns = parsed;
        }
      } catch (error) {
        campaigns = seedCampaigns;
      }
    }

    return campaigns.map(normalizeCampaign);
  }

  function saveCampaigns(storage, campaigns) {
    storage?.setItem?.(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaigns.map(normalizeCampaign)));
  }

  function upsertCampaign(campaigns, campaign) {
    const records = campaigns.map(normalizeCampaign);
    const existingIndex = records.findIndex(item => item.id === campaign.id);

    if (existingIndex >= 0) {
      records[existingIndex] = normalizeCampaign(campaign);
      return records;
    }

    const nextId = records.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1;
    records.push({ ...normalizeCampaign(campaign), id: nextId });
    return records;
  }

  function setCampaignEnabled(campaigns, campaignId, enabled) {
    return campaigns.map(normalizeCampaign).map(campaign => (
      campaign.id === campaignId ? { ...campaign, enabled: Boolean(enabled) } : campaign
    ));
  }

  return {
    CAMPAIGN_STORAGE_KEY,
    filterCampaigns,
    findVariant,
    getCampaignStatus,
    getLocalDateString,
    loadCampaigns,
    normalizeCampaign,
    normalizeRule,
    normalizeText,
    productForRule,
    products,
    ruleTargetKey,
    saveCampaigns,
    setCampaignEnabled,
    seedCampaigns,
    upsertCampaign,
    validateCampaign,
    variantForRule
  };
});
