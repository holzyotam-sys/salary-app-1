export function formatMoney(value: number): string {
  return `₪${Number(value || 0).toFixed(2)}`;
}

export function formatHoursFromMinutes(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function formatDateForInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeDisplay(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function buildLocalDateTime(
  dateString: string,
  timeString: string
): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function diffMinutes(startDate: Date, endDate: Date): number {
  return Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  );
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

export function getDayType(date: Date): "weekday" | "shabbat" {
  return isSaturday(date) ? "shabbat" : "weekday";
}

export function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

export function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}