export type PurchaseOrderCsvOption = { id: number; name: string };

export type ImportedPurchaseOrderProduct = {
  supplierProductCode: string;
  name: string;
  subcategoryId: number;
  presentations: Array<{
    name: string;
    variants: Array<{
      sizeId: number;
      quantity: string;
      unitCost: string;
    }>;
  }>;
};

export type PurchaseOrderCsvResult = {
  products: ImportedPurchaseOrderProduct[];
  errors: string[];
  rowCount: number;
  validRowCount: number;
};

export type PurchaseOrderCsvDelimiter = "," | ";";

const requiredColumns = [
  "codigoProveedor",
  "nombre",
  "subcategoria",
  "presentacion",
  "talla",
  "cantidad",
  "costoUnitario",
] as const;

const columnLabels: Record<string, string> = {
  codigoProveedor: "codigoProveedor",
  nombre: "nombre",
  subcategoria: "subcategoria",
  presentacion: "presentacion",
  talla: "talla",
  cantidad: "cantidad",
  costoUnitario: "costoUnitario",
};

const columnAliases: Record<string, (typeof requiredColumns)[number]> = {
  codigoproveedor: "codigoProveedor",
  suppliercode: "codigoProveedor",
  nombre: "nombre",
  producto: "nombre",
  productname: "nombre",
  subcategoria: "subcategoria",
  presentacion: "presentacion",
  talla: "talla",
  size: "talla",
  cantidad: "cantidad",
  quantity: "cantidad",
  costounitario: "costoUnitario",
  unitcost: "costoUnitario",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseRows(text: string, delimiter: PurchaseOrderCsvDelimiter) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) return { rows, unterminatedQuote: true };

  if (value.length || row.length) {
    row.push(value.replace(/\r$/, ""));
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return { rows, unterminatedQuote: false };
}

function parseNumber(value: string) {
  const compact = value.trim().replace(/\s/g, "");
  if (!compact) return Number.NaN;
  const normalized = compact.includes(",") && compact.includes(".")
    ? compact.replace(/,/g, "")
    : compact.replace(",", ".");
  return Number(normalized);
}

function optionByName(options: PurchaseOrderCsvOption[], value: string) {
  const normalizedValue = normalize(value);
  return options.find((option) => normalize(option.name) === normalizedValue);
}

export function parsePurchaseOrderCsv(
  text: string,
  catalog: { subcategories: PurchaseOrderCsvOption[]; sizes: PurchaseOrderCsvOption[] },
  delimiter: PurchaseOrderCsvDelimiter = ",",
): PurchaseOrderCsvResult {
  const parsedRows = parseRows(text.replace(/^\uFEFF/, ""), delimiter);
  if (parsedRows.unterminatedQuote) {
    return {
      products: [],
      errors: ["El archivo CSV contiene un campo entre comillas sin cerrar."],
      rowCount: parsedRows.rows.length,
      validRowCount: 0,
    };
  }
  const rows = parsedRows.rows;
  if (!rows.length) {
    return { products: [], errors: ["El archivo CSV está vacío."], rowCount: 0, validRowCount: 0 };
  }

  const headerIndexes = new Map<string, number>();
  rows[0].forEach((header, index) => {
    const column = columnAliases[normalize(header)];
    if (column && !headerIndexes.has(column)) headerIndexes.set(column, index);
  });
  const missingColumns = requiredColumns.filter((column) => !headerIndexes.has(column));
  if (missingColumns.length) {
    return {
      products: [],
      errors: [`Faltan columnas requeridas: ${missingColumns.map((column) => columnLabels[column]).join(", ")}.`],
      rowCount: Math.max(0, rows.length - 1),
      validRowCount: 0,
    };
  }
  if (rows.length === 1) {
    return {
      products: [],
      errors: ["El archivo CSV no contiene filas de productos."],
      rowCount: 0,
      validRowCount: 0,
    };
  }

  const products: ImportedPurchaseOrderProduct[] = [];
  const productIndexes = new Map<string, number>();
  const productDefinitions = new Map<string, { name: string; subcategory: string }>();
  const errors: string[] = [];
  const seenVariants = new Set<string>();
  let validRowCount = 0;

  rows.slice(1).forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const getValue = (column: (typeof requiredColumns)[number]) => row[headerIndexes.get(column) ?? -1]?.trim() ?? "";
    const code = getValue("codigoProveedor");
    const name = getValue("nombre");
    const subcategoryName = getValue("subcategoria");
    const presentationName = getValue("presentacion");
    const sizeName = getValue("talla");
    const quantityValue = getValue("cantidad");
    const unitCostValue = getValue("costoUnitario");
    const rowErrors: string[] = [];
    const subcategory = optionByName(catalog.subcategories, subcategoryName);
    const size = optionByName(catalog.sizes, sizeName);
    const quantity = parseNumber(quantityValue);
    const unitCost = parseNumber(unitCostValue);

    if (!code) rowErrors.push("el código del proveedor está vacío");
    if (!name) rowErrors.push("el nombre está vacío");
    if (!subcategoryName) rowErrors.push("la subcategoría está vacía");
    else if (!subcategory) rowErrors.push(`la subcategoría "${subcategoryName}" no existe en el catálogo`);
    if (presentationName.length > 50) rowErrors.push("el nombre de la presentación no puede tener más de 50 caracteres");
    if (!sizeName) rowErrors.push("la talla está vacía");
    else if (!size) rowErrors.push(`la talla "${sizeName}" no existe en el catálogo`);
    if (!Number.isInteger(quantity) || quantity <= 0) rowErrors.push("la cantidad debe ser un entero mayor que cero");
    if (!Number.isFinite(unitCost) || unitCost <= 0) rowErrors.push("el costo unitario debe ser mayor que cero");

    const codeKey = normalize(code);
    const productDefinition = productDefinitions.get(codeKey);
    const currentDefinition = { name: normalize(name), subcategory: normalize(subcategoryName) };
    if (codeKey && productDefinition && (productDefinition.name !== currentDefinition.name || productDefinition.subcategory !== currentDefinition.subcategory)) {
      rowErrors.push(`el código del proveedor "${code}" no puede tener nombres o subcategorías diferentes en el mismo archivo`);
    } else if (codeKey && !productDefinition) {
      productDefinitions.set(codeKey, currentDefinition);
    }

    const productKey = `${normalize(code)}|${normalize(name)}|${subcategory?.id ?? subcategoryName}`;
    const presentationKey = `${productKey}|${normalize(presentationName)}`;
    const variantKey = `${presentationKey}|${size?.id ?? sizeName}`;
    if (!rowErrors.length && seenVariants.has(variantKey)) rowErrors.push("la talla está repetida en la misma presentación");

    if (rowErrors.length) {
      const detail = rowErrors.join("; ");
      errors.push(`Fila ${line}: ${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`);
      return;
    }

    seenVariants.add(variantKey);
    validRowCount += 1;
    let productIndex = productIndexes.get(productKey);
    if (productIndex === undefined) {
      productIndex = products.length;
      productIndexes.set(productKey, productIndex);
      products.push({ supplierProductCode: code, name, subcategoryId: subcategory!.id, presentations: [] });
    }

    const product = products[productIndex];
    let presentation = product.presentations.find((item) => normalize(item.name) === normalize(presentationName));
    if (!presentation) {
      presentation = { name: presentationName, variants: [] };
      product.presentations.push(presentation);
    }
    presentation.variants.push({ sizeId: size!.id, quantity: String(quantity), unitCost: String(unitCost) });
  });

  return { products, errors, rowCount: rows.length - 1, validRowCount };
}
