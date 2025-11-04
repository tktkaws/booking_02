"use client";

import { type ViewType } from "@/types/bookings";
import { monthDayFormatter, monthFormatter, startOfWeek, endOfWorkWeek } from "@/lib/calendar";

type CalendarHeaderProps = {
  view: ViewType; // month | week | list
  referenceDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: ViewType) => void;
  liveMessage?: string;
};

export default function CalendarHeader({
  view,
  referenceDate,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  liveMessage,
}: CalendarHeaderProps) {
  const label = view === "month" ? monthFormatter.format(referenceDate) : formatWeekRange(referenceDate);
  return (
    <div className="mb-3 flex items-center justify-between">
      {view !== "list" ? (
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={onPrev} aria-label="前へ">◀</button>
          <div className="min-w-40 text-sm font-semibold" aria-live="off">{label}</div>
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={onNext} aria-label="次へ">▶</button>
          <button type="button" className="ml-2 rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={onToday}>今日</button>
        </div>
      ) : <div />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={["rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800", view === "month" ? "bg-zinc-100 dark:bg-zinc-800" : ""].join(" ")}
          onClick={() => onViewChange("month")}
          aria-pressed={view === "month"}
        >
          月
        </button>
        <button
          type="button"
          className={["rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800", view === "week" ? "bg-zinc-100 dark:bg-zinc-800" : ""].join(" ")}
          onClick={() => onViewChange("week")}
          aria-pressed={view === "week"}
        >
          週
        </button>
        <button
          type="button"
          className={["rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800", view === "list" ? "bg-zinc-100 dark:bg-zinc-800" : ""].join(" ")}
          onClick={() => onViewChange("list")}
          aria-pressed={view === "list"}
        >
          リスト
        </button>
      </div>
      {/* ライブリージョン: 操作結果の告知 */}
      <div className="sr-only" aria-live="polite" role="status">{liveMessage}</div>
    </div>
  );
}

function formatWeekRange(referenceDate: Date) {
  const start = startOfWeek(referenceDate);
  const end = endOfWorkWeek(referenceDate);
  const startLabel = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`;
  const endLabel = monthDayFormatter.format(end);
  return `${startLabel}〜${endLabel}`;
}
