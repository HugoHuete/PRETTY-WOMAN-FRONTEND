(function registerProductsExport(global) {
  const headers = ["Producto", "Referencia", "Categoría", "Proveedor", "Variantes", "Precio", "Disponible", "Reservado", "Estado"];

  function escapeCell(value) {
    const cell = String(value ?? "");
    return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
  }

  function buildCsv(products) {
    const rows = products.map((product) => [
      product.name,
      product.ref,
      product.category,
      product.supplier,
      product.variantCount,
      product.price,
      product.available,
      product.reserved,
      product.status
    ]);
    return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
  }

  global.ProductsExport = { buildCsv };
})(typeof globalThis === "undefined" ? window : globalThis);
