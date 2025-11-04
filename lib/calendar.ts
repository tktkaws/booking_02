import { type ParsedBooking } from "@/types/bookings";

export const weekdayLabelsFull = ["日", "月", "火", "水", "木", "金", "土"] as const;
export const WORKING_DAY_INDICES = [1, 2, 3, 4, 5] as const;
export const WORKING_DAY_COUNT = WORKING_DAY_INDICES.length;

export const SLOT_INTERVAL_MINUTES = 15;
export const DAY_START_MINUTES = 9 * 60;
export const DAY_END_MINUTES = 18 * 60;
export const SLOT_HEIGHT_PX = 28;

export const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
});

export const monthDayFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});

export const fullDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

export function stripTime(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

export function addDays(date: Date, amount: number) {
  const cloned = new Date(date);
  cloned.setDate(cloned.getDate() + amount);
  return stripTime(cloned);
}

export function addMonths(date: Date, amount: number) {
  const cloned = new Date(date);
  cloned.setMonth(cloned.getMonth() + amount);
  return stripTime(cloned);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfWeek(date: Date) {
  const cloned = stripTime(date);
  const day = cloned.getDay();
  const diff = (day + 6) % 7; // Monday-start
  return addDays(cloned, -diff);
}

export function endOfWorkWeek(date: Date) {
  const cloned = stripTime(date);
  const day = cloned.getDay();
  if (day === 6) return addDays(cloned, -1); // Sat -> Fri
  if (day === 0) return addDays(cloned, -2); // Sun -> Fri
  return addDays(cloned, 5 - day); // Mon(1)..Fri(5) -> Fri
}

export function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return stripTime(new Date(year, (month ?? 1) - 1, day ?? 1));
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}`;
}

export type SlotRange = {
  start: number;
  span: number;
};

export function calculateSlotRange(
  booking: ParsedBooking,
  startMinutes: number,
  endMinutes: number,
  slotMinutes: number
): SlotRange | null {
  const start = Math.max(booking.startMinutes, startMinutes);
  const end = Math.min(booking.endMinutes, endMinutes);
  if (end <= start) return null;
  const startIndex = Math.floor((start - startMinutes) / slotMinutes) + 1;
  const endIndex = Math.ceil((end - startMinutes) / slotMinutes) + 1;
  return { start: startIndex, span: Math.max(endIndex - startIndex, 1) };
}

export function generateTimeSlots(
  startHour: number,
  endHour: number,
  intervalMinutes: number
) {
  const slots: string[] = [];
  for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += intervalMinutes) {
    slots.push(formatMinutes(minutes));
  }
  return slots;
}

export const TIME_SLOTS = generateTimeSlots(9, 18, SLOT_INTERVAL_MINUTES);

