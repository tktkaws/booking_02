"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import BookingsTable from "@/components/BookingsTable";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import { addDays, addMonths, stripTime, startOfMonth, endOfMonth, startOfWeek, endOfWorkWeek, toDateKey } from "@/lib/calendar";
import { type BookingsByDate, type ParsedBooking, type ViewType } from "@/types/bookings";
import type { BookingWithDepartment } from "@/types/booking";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCompanyColors } from "@/lib/hooks/useCompanyColors";

type CalendarShellProps = {
  bookingsByDate?: BookingsByDate;
  isAuthed?: boolean;
  onCreateRequest?: (date: Date) => void;
  onBookingClick?: (booking: ParsedBooking) => void;
};

export default function CalendarShell({
  bookingsByDate: externalBookings,
  isAuthed = false,
  onCreateRequest,
  onBookingClick,
}: CalendarShellProps) {
  const [view, setView] = useState<ViewType>("month");
  const [referenceDate, setReferenceDate] = useState(stripTime(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [liveMessage, setLiveMessage] = useState<string>("");
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [internalBookings, setInternalBookings] = useState<BookingsByDate>(new Map());
  const bookingsByDate = useMemo(() => externalBookings ?? internalBookings, [externalBookings, internalBookings]);
  const [detailRow, setDetailRow] = useState<BookingWithDepartment | null>(null);
  const { companyOverride, companyDefault, tagOverrides } = useCompanyColors();
  const [reloadKey, setReloadKey] = useState(0);
  // List view filters
  const [listFrom, setListFrom] = useState<string>(() => toDateInputValue(new Date()));
  const [listTo, setListTo] = useState<string>("");
  const [onlyEditable, setOnlyEditable] = useState<boolean>(false);

  const announce = (msg: string) => setLiveMessage(msg);

  const handlePrev = () => {
    if (view === "month") {
      const next = addMonths(referenceDate, -1);
      setReferenceDate(next);
      announce(`${next.getFullYear()}年${next.getMonth() + 1}月に移動`);
    } else {
      const next = addDays(referenceDate, -7);
      setReferenceDate(next);
      announce(`週ビュー ${formatYMD(next)} へ移動`);
    }
  };
  const handleNext = () => {
    if (view === "month") {
      const next = addMonths(referenceDate, 1);
      setReferenceDate(next);
      announce(`${next.getFullYear()}年${next.getMonth() + 1}月に移動`);
    } else {
      const next = addDays(referenceDate, 7);
      setReferenceDate(next);
      announce(`週ビュー ${formatYMD(next)} へ移動`);
    }
  };
  const handleToday = () => {
    const today = stripTime(new Date());
    setReferenceDate(today);
    announce(`今日に移動`);
  };
  const handleViewChange = (v: ViewType) => {
    setView(v);
    const msg = v === "month" ? "月間ビューに切り替え" : v === "week" ? "週間ビューに切り替え" : "リストビューに切り替え";
    announce(msg);
  };

  const handleCreateRequest = (date: Date) => {
    onCreateRequest?.(date);
  };
  const handleBookingClick = async (booking: ParsedBooking) => {
    onBookingClick?.(booking);
    // fetch full row and open dialog
    const { data, error } = await supabase
      .from("bookings")
      .select("id, title, description, start_at, end_at, is_companywide, department_id, departments(name, default_color)")
      .eq("id", booking.id)
      .maybeSingle();
    if (error) return;
    setDetailRow((data as unknown as BookingWithDepartment) ?? null);
  };

  // 可視範囲の予約を取得し、ParsedBookingに正規化して日付ごとにグルーピング
  useEffect(() => {
    let abort = false;
    const { from, to } = computeRange(referenceDate, view);
    (async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, title, description, start_at, end_at, is_companywide, department_id, departments(name, default_color)"
        )
        .lt("start_at", to.toISOString())
        .gt("end_at", from.toISOString())
        .order("start_at", { ascending: true });
      if (abort) return;
      if (error) {
        // エラー時は空で表示（テーブル側にエラー出すため無言）
        setInternalBookings(new Map());
        return;
      }
      const rows = (data as any[]) ?? [];
      const parsed = rows.map((r) => toParsedBooking(r, companyOverride, companyDefault, tagOverrides));
      setInternalBookings(groupByDate(parsed));
    })();
    return () => {
      abort = true;
    };
  }, [referenceDate, view, supabase, companyOverride, companyDefault, tagOverrides, reloadKey]);

  // 色設定は useCompanyColors に委譲（イベントで自動更新）

  // 予約更新イベントで再取得
  useEffect(() => {
    const onUpdated = () => setReloadKey((k) => k + 1);
    window.addEventListener("bookings-updated", onUpdated);
    return () => window.removeEventListener("bookings-updated", onUpdated);
  }, []);

  return (
    <section>
      <CalendarHeader
        view={view}
        referenceDate={referenceDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
        liveMessage={liveMessage}
      />
      {view === "month" ? (
        <MonthView
          focusDate={referenceDate}
          selectedDate={selectedDate}
          bookingsByDate={bookingsByDate}
          onSelectDate={setSelectedDate}
          onCreateRequest={handleCreateRequest}
          onBookingClick={handleBookingClick}
          isAuthed={isAuthed}
        />
      ) : view === "week" ? (
        <WeekView
          referenceDate={referenceDate}
          selectedDate={selectedDate}
          bookingsByDate={bookingsByDate}
          onSelectDate={setSelectedDate}
          onBookingClick={handleBookingClick}
          onCreateRequest={handleCreateRequest}
          isAuthed={isAuthed}
        />
      ) : (
        <div>
          <ListFilters
            from={listFrom}
            to={listTo}
            onlyEditable={onlyEditable}
            onChange={(next) => {
              if (typeof next.from !== "undefined") setListFrom(next.from ?? "");
              if (typeof next.to !== "undefined") setListTo(next.to ?? "");
              if (typeof next.onlyEditable !== "undefined") setOnlyEditable(Boolean(next.onlyEditable));
            }}
            onReset={() => {
              setListFrom(toDateInputValue(new Date()));
              setListTo("");
              setOnlyEditable(false);
            }}
          />
          <BookingsTable fromDate={listFrom || null} toDate={listTo || null} onlyEditable={onlyEditable} />
        </div>
      )}

      <BookingDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
    </section>
  );
}

function formatYMD(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function computeRange(referenceDate: Date, view: Exclude<ViewType, "list">) {
  if (view === "month") {
    const ms = startOfMonth(referenceDate);
    const me = endOfMonth(referenceDate);
    const from = startOfWeek(ms);
    const to = endOfWorkWeek(me);
    // include end of day
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  const from = startOfWeek(referenceDate);
  const to = endOfWorkWeek(referenceDate);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function toParsedBooking(
  row: any,
  companyOverride: string | null,
  companyDefault: string | null,
  tagOverrides?: Record<string, string>
): ParsedBooking {
  const start = new Date(row.start_at);
  const end = new Date(row.end_at);
  const companyColor = companyOverride ?? companyDefault ?? "#e5e7eb";
  const deptOverride = tagOverrides?.[row.department_id];
  const baseDeptColor = deptOverride ?? row.departments?.default_color;
  const color = normalizeColor(row.is_companywide ? companyColor : baseDeptColor) ?? "#e5e7eb";
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    departmentId: row.department_id,
    ownerUserId: undefined,
    start: row.start_at,
    end: row.end_at,
    isCompanyWide: Boolean(row.is_companywide),
    departmentName: row.departments?.name,
    ownerName: undefined,
    color,
    textColor: chooseTextColor(color),
    startDate: start,
    endDate: end,
    startDateKey: toDateKey(start),
    endDateKey: toDateKey(end),
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    endMinutes: end.getHours() * 60 + end.getMinutes(),
  };
}

function groupByDate(bookings: ParsedBooking[]): BookingsByDate {
  const map: BookingsByDate = new Map();
  for (const b of bookings) {
    const key = toDateKey(b.startDate);
    const arr = map.get(key) ?? [];
    arr.push(b);
    map.set(key, arr);
  }
  return map;
}

function normalizeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function chooseTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111827";
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 150 ? "#111827" : "#ffffff";
}

// ---------- List Filters UI ----------
function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ListFiltersProps = {
  from: string;
  to: string;
  onlyEditable: boolean;
  onChange: (next: { from?: string | null; to?: string | null; onlyEditable?: boolean }) => void;
  onReset: () => void;
};

function ListFilters({ from, to, onlyEditable, onChange, onReset }: ListFiltersProps) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="リストフィルター">
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-zinc-600">開始日</span>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value })}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-zinc-600">終了日</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ to: e.target.value })}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyEditable}
          onChange={(e) => onChange({ onlyEditable: e.target.checked })}
          className="h-4 w-4"
        />
        <span>編集可能のみ</span>
      </label>
      <button
        type="button"
        onClick={onReset}
        className="rounded border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        リセット
      </button>
    </form>
  );
}
