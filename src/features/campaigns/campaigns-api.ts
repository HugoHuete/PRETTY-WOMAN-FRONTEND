export type DiscountType = 1 | 2 | 3;

export type CampaignFormInput = {
  name: string;
  startDate: string;
  endDate: string;
};

export type CampaignLineInput = {
  key: string;
  productId?: number;
  productPresentationId?: number;
  label: string;
  detail: string;
  discountTypeId: DiscountType;
  discountValue: number;
};

export type CampaignTargetRequest = {
  productId: number | null;
  productPresentationId: number | null;
  discountTypeId: DiscountType;
  discountValue: number;
};

export type CampaignRequest = CampaignFormInput & {
  startDate: string;
  endDate: string;
  targets: CampaignTargetRequest[];
};

export type CampaignImportRow = {
  rowNumber: number;
  productCode: number;
  productPresentationId: number | null;
  discountTypeId: DiscountType;
  discountValue: number;
};

export type CsvParseResult = {
  rows: CampaignImportRow[];
  errors: string[];
};

export type CampaignCsvDelimiter = "," | ";";

const campaignCsvHeaders = ["productCode", "productPresentationId", "discountTypeId", "discountValue"] as const;

function toUtcDate(value: string, endOfDay = false) {
  return `${value}T${endOfDay ? "23:59:59.000" : "00:00:00.000"}Z`;
}

export function buildCampaignPayload(values: CampaignFormInput, lines: CampaignLineInput[]): CampaignRequest {
  return {
    name: values.name.trim(),
    startDate: toUtcDate(values.startDate),
    endDate: toUtcDate(values.endDate, true),
    targets: lines.map((line) => ({
      productId: line.productId ?? null,
      productPresentationId: line.productPresentationId ?? null,
      discountTypeId: line.discountTypeId,
      discountValue: line.discountValue,
    })),
  };
}

function parseCsvRecords(text: string, delimiter: CampaignCsvDelimiter) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      record.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      record.push(field.trim());
      if (record.some((value) => value !== "")) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || record.length) {
    record.push(field.trim());
    if (record.some((value) => value !== "")) records.push(record);
  }
  return records;
}

function parseInteger(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export function parseCampaignCsv(text: string, delimiter: CampaignCsvDelimiter = ";"): CsvParseResult {
  const records = parseCsvRecords(text, delimiter);
  const expectedHeaders = [...campaignCsvHeaders];
  if (!records.length || records[0].map((value) => value.replace(/^\uFEFF/, "")).join(delimiter) !== expectedHeaders.join(delimiter)) {
    return { rows: [], errors: [`El CSV debe tener los encabezados: ${expectedHeaders.join(delimiter)}.`] };
  }

  const rows: CampaignImportRow[] = [];
  const errors: string[] = [];
  records.slice(1).forEach((record, index) => {
    const rowNumber = index + 2;
    const productCode = parseInteger(record[0] ?? "");
    const presentationValue = record[1] ?? "";
    const productPresentationId = presentationValue === "" ? null : parseInteger(presentationValue);
    const discountTypeId = parseInteger(record[2] ?? "");
    const discountValue = Number(record[3] ?? "");
    const rowErrors: string[] = [];

    if (productCode === null) rowErrors.push(`Fila ${rowNumber}: productCode debe ser un entero.`);
    if (presentationValue !== "" && productPresentationId === null) rowErrors.push(`Fila ${rowNumber}: productPresentationId debe ser un entero o quedar vacío.`);
    if (discountTypeId !== 1 && discountTypeId !== 2 && discountTypeId !== 3) rowErrors.push(`Fila ${rowNumber}: discountTypeId debe ser 1, 2 o 3.`);
    if (!Number.isFinite(discountValue) || discountValue <= 0) rowErrors.push(`Fila ${rowNumber}: discountValue debe ser un número mayor que cero.`);
    if (discountValue > 9999999999) rowErrors.push(`Fila ${rowNumber}: discountValue no puede ser mayor que 9999999999.`);
    if (discountTypeId === 2 && discountValue > 100) rowErrors.push(`Fila ${rowNumber}: el porcentaje no puede ser mayor que 100.`);

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }
    rows.push({ rowNumber, productCode: productCode as number, productPresentationId, discountTypeId: discountTypeId as DiscountType, discountValue });
  });

  if (records.length === 1) errors.push("El CSV debe contener al menos una fila de datos.");
  return { rows: errors.length ? [] : rows, errors };
}

export function buildCampaignCsvTemplate(delimiter: CampaignCsvDelimiter = ";") {
  return `${campaignCsvHeaders.join(delimiter)}\n`;
}
