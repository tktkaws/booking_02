"use client";

import { type MouseEvent, type KeyboardEvent } from "react";

import {
  addDays,
  endOfMonth,
  endOfWorkWeek,
  isSameDay,
  isWeekday,
  formatMinutes,
  startOfMonth,
  startOfWeek,
  stripTime,
  toDateKey,
  weekdayLabelsFull,
  WORKING_DAY_INDICES,
} from "@/lib/calendar";
import { type BookingsByDate, type ParsedBooking } from "@/types/bookings";

type MonthViewProps = {
  focusDate: Date;
  selectedDate: Date | null;
  bookingsByDate: BookingsByDate;
  onSelectDate: (date: Date) => void;
  onCreateRequest: (date: Date) => void;
  onBookingClick: (booking: ParsedBooking) => void;
  isAuthed?: boolean;
};

export function MonthView({
  focusDate,
  selectedDate,
  bookingsByDate,
  onSelectDate,
  onCreateRequest,
  onBookingClick,
  isAuthed = false,
}: MonthViewProps) {
  const monthStart = startOfMonth(focusDate);
  const monthEnd = endOfMonth(focusDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWorkWeek(monthEnd);
  const today = stripTime(new Date());

  const calendarDays: Date[] = [];
  for (let cursor = calendarStart; cursor <= calendarEnd; cursor = addDays(cursor, 1)) {
    if (isWeekday(cursor)) calendarDays.push(cursor);
  }

  const handleDayClick = (date: Date) => {
    onSelectDate(date);
    if (isAuthed) onCreateRequest(date);
  };

  const handleBookingClick = (booking: ParsedBooking) => {
    onBookingClick(booking);
  };

  const handleBookingBadgeClick = (
    event: MouseEvent<HTMLButtonElement>,
    booking: ParsedBooking
  ) => {
    event.stopPropagation();
    handleBookingClick(booking);
  };

  const handleCellKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const cols = WORKING_DAY_INDICES.length; // 5
    let nextIndex: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
        nextIndex = Math.max(0, index - 1);
        break;
      case "ArrowRight":
        nextIndex = Math.min(calendarDays.length - 1, index + 1);
        break;
      case "ArrowUp":
        nextIndex = Math.max(0, index - cols);
        break;
      case "ArrowDown":
        nextIndex = Math.min(calendarDays.length - 1, index + cols);
        break;
      case "Home": {
        const rowStart = index - (index % cols);
        nextIndex = rowStart;
        break;
      }
      case "End": {
        const rowStart = index - (index % cols);
        nextIndex = Math.min(rowStart + (cols - 1), calendarDays.length - 1);
        break;
      }
      case "Enter":
      case "N":
      case "n": {
        e.preventDefault();
        const date = calendarDays[index];
        onSelectDate(date);
        if (isAuthed) onCreateRequest(date);
        return;
      }
      default:
        return;
    }
    if (nextIndex !== null && nextIndex !== index) {
      e.preventDefault();
      const el = document.getElementById(`month-cell-${nextIndex}`) as HTMLButtonElement | null;
      el?.focus();
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" role="grid" aria-label="月間カレンダー">
      <div className="grid grid-cols-5 text-center text-xs font-semibold text-slate-800 border-b border-slate-200" role="row">
        {WORKING_DAY_INDICES.map((weekday) => (
          <div key={weekday} className="px-2 py-3" role="columnheader">
            {weekdayLabelsFull[weekday]}
          </div>
        ))}
      </div>
      <div className="relative max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto">
        <div className="grid grid-cols-5 gap-px bg-slate-200 p-px">
          {calendarDays.map((cellDate, index) => {
            const isCurrentMonth = cellDate.getMonth() === focusDate.getMonth();
            const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false;
            const isToday = isSameDay(cellDate, today);
            const dateKey = toDateKey(cellDate);
            const dailyBookings = bookingsByDate.get(dateKey) ?? [];

            const cellBase = [
              "grid grid-rows-[2rem_1fr] min-h-32 bg-white text-left transition shadow-sm outline-none",
              !isCurrentMonth ? "bg-slate-50 text-slate-800" : "",
              isSelected ? "ring-2 ring-blue-500" : "",
            ].filter(Boolean).join(" ");

            return (
              <div key={dateKey + index} className={cellBase} role="row" aria-selected={isSelected || undefined}>
                {/* 全面：当日用予約作成ボタン（カレンダーセル全体に被せる） */}
                <button
                  id={`month-cell-${index}`}
                  onClick={() => handleDayClick(cellDate)}
                  onKeyDown={(e) => handleCellKeyDown(e, index)}
                  disabled={!isAuthed}
                  className={[
                    "row-span-full col-span-full grid justify-start w-full h-full rounded-none outline-none",
                    isAuthed ? "focus-visible:bg-slate-100/80 hover:bg-slate-100/80" : "opacity-60 cursor-not-allowed pointer-events-none",
                  ].join(" ")}
                  aria-label={`${cellDate.getDate()}日の予約を作成`}
                  role="gridcell"
                  aria-current={isToday ? "date" : undefined}
                >
                  {/* 日付ラベル（上部は空ける） */}
                  <div className="text-sm font-bold m-1">
                    <span className={isToday ? "bg-black text-white px-1 rounded" : undefined}>
                      {cellDate.getDate()}
                    </span>
                  </div>
                </button>

                {/* 前面：日付ラベルを避けて予約ボタンを配置 */}
                <ul className="row-start-2 col-span-full h-fit my-1 mx-1 space-y-1">
                  {dailyBookings.map((booking) => (
                    <li key={booking.id}>
                      <button
                        onClick={(event) => handleBookingBadgeClick(event, booking)}
                        className="relative z-10 w-full truncate rounded-md px-2 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 hover:ring-2 text-left"
                        style={{ backgroundColor: booking.color, color: booking.textColor }}
                        title={booking.title}
                        aria-label={`${formatMinutes(booking.startMinutes)} ${booking.title}`}
                      >
                        <span className="mr-1 text-[10px] opacity-80">
                          {formatMinutes(booking.startMinutes)}
                        </span>
                        <span className="truncate align-middle">{booking.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MonthView;

