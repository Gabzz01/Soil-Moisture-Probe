export function parseInfluxTime(value: string): Date {
  const s = value.trim();
  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
}

export function formatLocalDateTime(value: string | number | Date): string {
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : parseInfluxTime(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function toLocalMs(value: string): number {
  return parseInfluxTime(value).getTime();
}
