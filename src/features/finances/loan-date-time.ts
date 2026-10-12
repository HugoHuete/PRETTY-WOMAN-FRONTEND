function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateTimeInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeInputValueFromIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : localDateTimeInputValue(date);
}

export function utcIsoFromLocalDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}
