import type { BookingWithDepartment } from "@/types/booking";

export type ReservationField = "date" | "startTime" | "endTime" | "range" | "overlap" | "weekday";

export interface ValidationError {
  field: ReservationField;
  message: string;
}

export interface ReservationInput {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  bookingId?: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const WEEKEND_DAYS = new Set([0, 6]); // Sunday, Saturday

export function validateReservation(
  input: ReservationInput,
  existing: BookingWithDepartment[],
): ValidationResult {
  const errors: ValidationError[] = [];
  const { date, startTime, endTime, bookingId } = input;

  if (!date) {
    errors.push({ field: "date", message: "日付を入力してください" });
  }
  if (!startTime) {
    errors.push({ field: "startTime", message: "開始時間を選択してください" });
  }
  if (!endTime) {
    errors.push({ field: "endTime", message: "終了時間を選択してください" });
  }

  if (!date || !startTime || !endTime) {
    return { valid: false, errors };
  }

  const start = combine(date, startTime);
  const end = combine(date, endTime);

  if (!start || !end) {
    errors.push({ field: "range", message: "時間の形式が不正です" });
    return { valid: false, errors };
  }

  if (start >= end) {
    errors.push({ field: "range", message: "終了時間は開始時間より後に設定してください" });
  }

  if (WEEKEND_DAYS.has(start.getDay())) {
    errors.push({ field: "weekday", message: "予約は平日のみ選択できます" });
  }

  for (const booking of existing) {
    if (bookingId && booking.id === bookingId) continue;
    const bookingStart = new Date(booking.start_at);
    const bookingEnd = new Date(booking.end_at);
    const overlaps = start < bookingEnd && end > bookingStart;
    if (overlaps) {
      errors.push({ field: "overlap", message: "他の予約と時間が重複しています" });
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

function combine(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  return new Date(`${date}T${time}:00`);
}
