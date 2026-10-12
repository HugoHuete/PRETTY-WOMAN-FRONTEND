import { afterEach, describe, expect, it } from "vitest";
import {
  localDateTimeInputValue,
  localDateTimeInputValueFromIso,
  utcIsoFromLocalDateTime,
} from "./loan-date-time";

const environment = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process.env;
const originalTimeZone = environment.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete environment.TZ;
  else environment.TZ = originalTimeZone;
});

describe("loan date-time helpers", () => {
  it("converts a local UTC−6 datetime to UTC ISO", () => {
    environment.TZ = "America/Managua";

    expect(utcIsoFromLocalDateTime("2026-10-11T10:30")).toBe("2026-10-11T16:30:00.000Z");
  });

  it("converts a local UTC+9 datetime to UTC ISO", () => {
    environment.TZ = "Asia/Tokyo";

    expect(utcIsoFromLocalDateTime("2026-10-11T10:30")).toBe("2026-10-11T01:30:00.000Z");
  });

  it("formats an ISO instant as a local datetime input value", () => {
    environment.TZ = "America/Managua";

    expect(localDateTimeInputValueFromIso("2026-10-11T16:30:00Z")).toBe("2026-10-11T10:30");
  });

  it("formats a Date as the local datetime input value", () => {
    environment.TZ = "America/Managua";

    expect(localDateTimeInputValue(new Date("2026-10-11T16:30:00Z"))).toBe("2026-10-11T10:30");
  });

  it("omits an empty optional datetime", () => {
    expect(utcIsoFromLocalDateTime("")).toBeUndefined();
  });
});
