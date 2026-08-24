window.purchaseOrders = [
  {
    id: "OC-0048",
    supplier: "SOHO",
    date: "12 jul 2026",
    purchaseDate: "2026-07-12",
    status: "transit",
    label: "En tránsito",
    currency: "USD",
    merchandiseAmount: 153,
    shippingAmount: 15,
    exchangeRate: 36.62,
    packages: [
      { number: "SOHO-782190", sent: "2026-07-13", arrived: "2026-07-15", carrierId: 2, carrier: "Cargo Express", url: "https://www.cargoexpreso.com/" },
      { number: "SOHO-782191", sent: "2026-07-14", arrived: "", carrierId: 2, carrier: "Cargo Express", url: "https://www.cargoexpreso.com/" },
    ],
    received: 0,
    total: 18,
    activity: "12 jul 2026",
    comment: "Separar las blusas blancas y negras en bolsas individuales antes de enviarlas a bodega.",
    products: [
      {
        code: "SOHO25120",
        name: "Vestido satinado",
        category: "Vestidos",
        variants: [
          { color: "Azul", size: "S", quantity: 2, received: 0, unitCost: 8.5, retailPrice: 1250 },
          { color: "Azul", size: "M", quantity: 3, received: 0, unitCost: 8.5, retailPrice: 1250 },
        ],
      },
      {
        code: "SOHO25134",
        name: "Blusa de lino",
        category: "Blusas",
        variants: [
          { color: "Blanco", size: "M", quantity: 4, received: 0, unitCost: 7.2, retailPrice: 890 },
          { color: "Negro", size: "M", quantity: 3, received: 0, unitCost: 7.2, retailPrice: 890 },
        ],
      },
      {
        code: "SOHO25141",
        name: "Pantalón recto",
        category: "Pantalones",
        variants: [
          { color: "Negro", size: "M", quantity: 3, received: 0, unitCost: 10.016666, retailPrice: 1490 },
          { color: "Beige", size: "M", quantity: 3, received: 0, unitCost: 10.016666, retailPrice: 1490 },
        ],
      },
    ],
  },
  {
    id: "OC-0047",
    supplier: "Shein",
    date: "10 jul 2026",
    purchaseDate: "2026-07-10",
    status: "partial",
    label: "Recepción parcial",
    currency: "USD",
    merchandiseAmount: 98.5,
    shippingAmount: 12,
    exchangeRate: 36.62,
    packages: [
      { number: "SHE-23188", sent: "2026-07-11", arrived: "2026-07-14", carrierId: 1, carrier: "DHL", url: "https://www.dhl.com/" },
    ],
    received: 11,
    total: 16,
    activity: "14 jul 2026",
    comment: "Quedan pendientes 5 pantalones talla M; confirmar reposición con el proveedor.",
    products: [
      {
        code: "SH-11829",
        name: "Pantalón recto",
        category: "Pantalones",
        variants: [
          { color: "Negro", size: "M", quantity: 8, received: 5, unitCost: 6.15, retailPrice: 1090 },
          { color: "Beige", size: "M", quantity: 8, received: 6, unitCost: 6.16, retailPrice: 1090 },
        ],
      },
    ],
  },
  {
    id: "OC-0046",
    supplier: "Textiles Managua",
    date: "06 jul 2026",
    purchaseDate: "2026-07-06",
    status: "received",
    label: "Recibida",
    currency: "NIO",
    merchandiseAmount: 8600,
    shippingAmount: 0,
    exchangeRate: null,
    packages: [],
    received: 24,
    total: 24,
    activity: "08 jul 2026",
    comment: "Compra recibida completa y verificada contra la factura.",
    products: [
      {
        code: "TM-2406",
        name: "Camiseta básica",
        category: "Blusas",
        variants: [
          { color: "Blanco", size: "S", quantity: 8, received: 8, unitCost: 358.33, retailPrice: 690 },
          { color: "Blanco", size: "M", quantity: 8, received: 8, unitCost: 358.33, retailPrice: 690 },
          { color: "Negro", size: "M", quantity: 8, received: 8, unitCost: 358.34, retailPrice: 690 },
        ],
      },
    ],
  },
  {
    id: "OC-0045",
    supplier: "Moda Sur",
    date: "03 jul 2026",
    purchaseDate: "2026-07-03",
    status: "draft",
    label: "Borrador",
    currency: "USD",
    merchandiseAmount: 76,
    shippingAmount: 0,
    exchangeRate: 36.62,
    packages: [],
    received: 0,
    total: 9,
    activity: "03 jul 2026",
    comment: "Pendiente confirmar colores y disponibilidad antes de enviar la orden.",
    products: [
      {
        code: "MS-0319",
        name: "Falda midi",
        category: "Faldas",
        variants: [
          { color: "Negro", size: "S", quantity: 4, received: 0, unitCost: 8.44, retailPrice: 1290 },
          { color: "Oliva", size: "M", quantity: 5, received: 0, unitCost: 8.45, retailPrice: 1290 },
        ],
      },
    ],
  },
  {
    id: "OC-0044",
    supplier: "SOHO",
    date: "28 jun 2026",
    purchaseDate: "2026-06-28",
    status: "received",
    label: "Recibida",
    currency: "USD",
    merchandiseAmount: 186.2,
    shippingAmount: 18,
    exchangeRate: 36.62,
    packages: [
      { number: "SOHO-771203", sent: "2026-06-29", arrived: "2026-07-02", carrierId: 2, carrier: "Cargo Express", url: "https://www.cargoexpreso.com/" },
    ],
    received: 21,
    total: 21,
    activity: "03 jul 2026",
    comment: "Entrega completa; costos de envío ya conciliados.",
    products: [
      {
        code: "SOHO24982",
        name: "Vestido camisero",
        category: "Vestidos",
        variants: [
          { color: "Terracota", size: "S", quantity: 7, received: 7, unitCost: 8.86, retailPrice: 1350 },
          { color: "Terracota", size: "M", quantity: 7, received: 7, unitCost: 8.87, retailPrice: 1350 },
          { color: "Azul", size: "M", quantity: 7, received: 7, unitCost: 8.87, retailPrice: 1350 },
        ],
      },
    ],
  },
];

const additionalPurchaseOrders = [
  { id: "OC-0043", templateId: "OC-0046", supplier: "Textiles Managua", date: "25 jun 2026", purchaseDate: "2026-06-25", status: "received", label: "Recibida", currency: "NIO", merchandiseAmount: 7200, shippingAmount: 350, exchangeRate: null },
  { id: "OC-0042", templateId: "OC-0048", supplier: "Shein", date: "21 jun 2026", purchaseDate: "2026-06-21", status: "transit", label: "En tránsito", currency: "USD", merchandiseAmount: 132.4, shippingAmount: 16, exchangeRate: 36.62 },
  { id: "OC-0041", templateId: "OC-0047", supplier: "Moda Sur", date: "18 jun 2026", purchaseDate: "2026-06-18", status: "partial", label: "Recepción parcial", currency: "USD", merchandiseAmount: 84.75, shippingAmount: 9.5, exchangeRate: 36.62 },
  { id: "OC-0040", templateId: "OC-0044", supplier: "SOHO", date: "14 jun 2026", purchaseDate: "2026-06-14", status: "received", label: "Recibida", currency: "USD", merchandiseAmount: 211, shippingAmount: 22, exchangeRate: 36.62 },
  { id: "OC-0039", templateId: "OC-0046", supplier: "Textiles Managua", date: "09 jun 2026", purchaseDate: "2026-06-09", status: "received", label: "Recibida", currency: "NIO", merchandiseAmount: 9450, shippingAmount: 450, exchangeRate: null },
  { id: "OC-0038", templateId: "OC-0045", supplier: "Shein", date: "04 jun 2026", purchaseDate: "2026-06-04", status: "draft", label: "Borrador", currency: "USD", merchandiseAmount: 67.9, shippingAmount: 8, exchangeRate: 36.62 },
  { id: "OC-0037", templateId: "OC-0048", supplier: "SOHO", date: "30 may 2026", purchaseDate: "2026-05-30", status: "transit", label: "En tránsito", currency: "USD", merchandiseAmount: 175.5, shippingAmount: 17, exchangeRate: 36.62 },
  { id: "OC-0036", templateId: "OC-0044", supplier: "Moda Sur", date: "24 may 2026", purchaseDate: "2026-05-24", status: "received", label: "Recibida", currency: "USD", merchandiseAmount: 102.25, shippingAmount: 12, exchangeRate: 36.62 },
  { id: "OC-0035", templateId: "OC-0047", supplier: "Textiles Managua", date: "18 may 2026", purchaseDate: "2026-05-18", status: "partial", label: "Recepción parcial", currency: "NIO", merchandiseAmount: 6800, shippingAmount: 300, exchangeRate: null },
  { id: "OC-0034", templateId: "OC-0044", supplier: "Shein", date: "11 may 2026", purchaseDate: "2026-05-11", status: "received", label: "Recibida", currency: "USD", merchandiseAmount: 149.95, shippingAmount: 15, exchangeRate: 36.62 },
];

additionalPurchaseOrders.forEach(seed => {
  const template = window.purchaseOrders.find(order => order.id === seed.templateId);
  const products = template.products.map(product => ({
    ...product,
    variants: product.variants.map(variant => {
      const received = seed.status === "received"
        ? variant.quantity
        : seed.status === "partial"
          ? Math.floor(variant.quantity / 2)
          : 0;
      return { ...variant, received };
    }),
  }));
  const total = products.reduce((sum, product) => (
    sum + product.variants.reduce((variantSum, variant) => variantSum + variant.quantity, 0)
  ), 0);
  const received = products.reduce((sum, product) => (
    sum + product.variants.reduce((variantSum, variant) => variantSum + variant.received, 0)
  ), 0);

  window.purchaseOrders.push({
    ...template,
    ...seed,
    packages: seed.status === "transit" ? template.packages.map(packageItem => ({ ...packageItem })) : [],
    products,
    received,
    total,
    activity: seed.date,
    comment: "Orden de demostración agregada para visualizar la navegación paginada.",
  });
});

try {
  const storedPurchaseOrders = JSON.parse(localStorage.getItem("pw-purchase-orders") || "[]");
  if (Array.isArray(storedPurchaseOrders)) {
    storedPurchaseOrders.slice().reverse().forEach(storedOrder => {
      const existingIndex = window.purchaseOrders.findIndex(order => order.id === storedOrder.id);
      if (existingIndex >= 0) window.purchaseOrders.splice(existingIndex, 1);
      window.purchaseOrders.unshift(storedOrder);
    });
  }
} catch {
  // The static seed remains available when browser storage cannot be read.
}
