export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

/** Server-side date formatting for emails and CSV, in the configured time zone. */
export function formatDateTime(d: Date | null | undefined, timeZone = APP_TIMEZONE): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** "2026-10-12 18:30:05" in the configured time zone; spreadsheet-friendly. */
export function formatCsvDate(d: Date | null | undefined, timeZone = APP_TIMEZONE): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}
