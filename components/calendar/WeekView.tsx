"use client";

import { type KeyboardEvent, type MouseEvent } from "react";

import {
  addDays,
  calculateSlotRange,
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  isSameDay,
  formatMinutes,
  monthDayFormatter,
  SLOT_HEIGHT_PX,
  SLOT_INTERVAL_MINUTES,
  startOfWeek,
  toDateKey,
  weekdayLabelsFull,
  WORKING_DAY_COUNT,
} from "@/lib/calendar";
import { type BookingsByDate, type ParsedBooking } from "@/types/bookings";

type WeekViewProps = {
  referenceDate: Date;
  selectedDate: Date | null;
  bookingsByDate: BookingsByDate;
  onSelectDate: (date: Date) => void;
  onBookingClick: (booking: ParsedBooking) => void;
  onCreateRequest: (date: Date) => void;
  isAuthed?: boolean;
};

export function WeekView({
  referenceDate,
  selectedDate,
  bookingsByDate,
  onSelectDate,
  onBookingClick,
  onCreateRequest,
  isAuthed = false,
}: WeekViewProps) {
  const weekStart = startOfWeek(referenceDate);
  const weekDays = Array.from({ length: WORKING_DAY_COUNT }).map((_, index) =>
    addDays(weekStart, index)
  );
  const slotCount = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_INTERVAL_MINUTES;
  const columnStyle = {
    gridTemplateRows: `repeat(${slotCount}, ${SLOT_HEIGHT_PX}px)`,
  } as const;

  const handleBookingBlockClick = (
    event: MouseEvent<HTMLDivElement>,
    booking: ParsedBooking
  ) => {
    event.stopPropagation();
    onBookingClick(booking);
  };

  const handleBookingBlockKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    booking: ParsedBooking
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onBookingClick(booking);
    }
  };

  const timeLabels = Array.from({ length: slotCount }).map((_, index) => {
    const totalMinutes = DAY_START_MINUTES + index * SLOT_INTERVAL_MINUTES;
    return formatMinutes(totalMinutes);
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm" role="grid" aria-label="週間カレンダー">
      <div className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))] text-xs font-semibold text-slate-800 border-b border-slate-200" role="row">
        <div className="px-3 py-3 text-right" role="columnheader" aria-hidden />
        {weekDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          return (
            <div
              key={day.toISOString()}
              className="px-3 py-3 text-left flex justify-center items-baseline gap-2"
              role="columnheader"
              aria-selected={isSelected || undefined}
            >
              <div className="text-slate-800">{weekdayLabelsFull[day.getDay()]}</div>
              <div
                className={isToday ? "bg-black text-white px-1 rounded text-sm" : "text-sm font-semibold"}
                suppressHydrationWarning
              >
                {monthDayFormatter.format(day)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto">
        <div className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))]">
          <div className="flex flex-col text-xs text-slate-800">
            {timeLabels.map((label, index) => (
              <div
                key={label + index}
                className="flex items-start justify-end pr-2"
                style={{ height: SLOT_HEIGHT_PX }}
                role="row"
                aria-hidden={index % 2 !== 0}
              >
                {index % 2 === 0 ? (
                  <span className={index === 0 ? "-mt-1.5 inline-block opacity-0" : "-mt-1.5 inline-block"}>{label}</span>
                ) : (
                  ""
                )}
              </div>
            ))}
          </div>
          {weekDays.map((day) => {
            const dateKey = toDateKey(day);
            const dailyBookings = bookingsByDate.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                className="relative border-l border-slate-100"
                style={{ height: slotCount * SLOT_HEIGHT_PX }}
                role="rowgroup"
              >
                {/* Bookings layer first in DOM for tab order; higher z-index */}
                <div className="absolute inset-0 grid" style={columnStyle}>
                  {dailyBookings.map((booking) => {
                    const range = calculateSlotRange(
                      booking,
                      DAY_START_MINUTES,
                      DAY_END_MINUTES,
                      SLOT_INTERVAL_MINUTES
                    );
                    if (!range) return null;
                    const durationMinutes = booking.endMinutes - booking.startMinutes;
                    const isSingleSlot = durationMinutes <= SLOT_INTERVAL_MINUTES;
                    return (
                      <div
                        key={booking.id}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => handleBookingBlockClick(event, booking)}
                        onKeyDown={(event) => handleBookingBlockKeyDown(event, booking)}
                        className={[
                          "z-10 pointer-events-auto h-full overflow-hidden rounded-md text-xs font-semibold shadow-sm outline-none transition mx-1",
                          "focus-visible:ring-2",
                          "hover:ring-2",
                          isSingleSlot ? "px-1.5 py-0.5" : "px-2 py-1",
                        ].join(" ")}
                        style={{
                          gridRow: `${range.start} / span ${range.span}`,
                          backgroundColor: booking.color,
                          color: booking.textColor,
                          height: "calc(100% - 2px)",
                        }}
                        aria-label={`${formatMinutes(booking.startMinutes)}〜${formatMinutes(booking.endMinutes)} ${booking.title}`}
                      >
                        <div className="truncate">{booking.title}</div>
                        {!isSingleSlot && (
                          <div className="text-[10px] opacity-80">
                            {formatMinutes(booking.startMinutes)}〜{formatMinutes(booking.endMinutes)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Clickable time cells: behind bookings layer, tab after bookings */}
                <div className="absolute inset-0 z-0 grid" style={columnStyle}>
                  {timeLabels.map((label, index) => (
                    <button
                      type="button"
                      key={`${dateKey}-slot-${index}`}
                      onClick={() => {
                        if (!isAuthed) return;
                        const totalMinutes = DAY_START_MINUTES + index * SLOT_INTERVAL_MINUTES;
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;
                        const slotDate = new Date(
                          day.getFullYear(),
                          day.getMonth(),
                          day.getDate(),
                          hours,
                          minutes,
                          0,
                          0
                        );
                        onSelectDate(day);
                        onCreateRequest(slotDate);
                      }}
                      className={[
                        "border-b border-slate-100 text-left outline-none transition",
                        index % 2 === 0 ? "bg-slate-50/80" : "bg-white",
                        isAuthed ? "focus-visible:bg-slate-200/80 hover:bg-slate-200/80" : "opacity-60 cursor-not-allowed pointer-events-none",
                      ].join(" ")}
                      aria-label={`${monthDayFormatter.format(day)} ${label} に予約を作成`}
                      role="gridcell"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WeekView;

