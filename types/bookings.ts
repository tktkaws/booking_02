export type ViewType = "month" | "week" | "list";

export type Booking = {
  id: string | number;
  title: string;
  departmentId: string;
  ownerUserId?: string;
  start: string; // ISO 8601 (e.g., 2025-09-01T10:00:00+09:00)
  end: string;   // ISO 8601
  isCompanyWide?: boolean;
  description?: string | null;
};

export type ParsedBooking = Booking & {
  departmentName?: string;
  ownerName?: string;
  color: string;
  textColor: string;
  startDate: Date;
  endDate: Date;
  startDateKey: string; // YYYY-MM-DD
  endDateKey: string;   // YYYY-MM-DD
  startMinutes: number; // minutes from 00:00
  endMinutes: number;   // minutes from 00:00
};

export type BookingsByDate = Map<string, ParsedBooking[]>;

export type Department = {
  id: string;
  name: string;
  default_color?: string | null;
};

export type User = {
  id: string;
  department_id: string;
  display_name: string;
  role?: "admin" | "member";
};

