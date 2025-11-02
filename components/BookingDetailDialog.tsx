"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { useDayBookings } from "@/lib/hooks/useDayBookings";
import { validateReservation, type ValidationError } from "@/lib/validation/reservation";
import type { BookingWithDepartment } from "@/types/booking";

interface BookingDetailDialogProps {
  row: BookingWithDepartment | null;
  onClose: () => void;
}

export default function BookingDetailDialog({ row, onClose }: BookingDetailDialogProps) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [companyOverride, setCompanyOverride] = useState<string | null>(null);
  const [companyDefault, setCompanyDefault] = useState<string | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [companyWide, setCompanyWide] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const timeOptions = useMemo(() => buildTimeOptions(), []);
  const startIndex = useMemo(() => timeOptions.indexOf(startTime), [startTime, timeOptions]);
  const endOptions = useMemo(() => {
    if (startIndex === -1) return timeOptions;
    return timeOptions.filter((option) => timeOptions.indexOf(option) > startIndex);
  }, [startIndex, timeOptions]);

  const { bookings: dayBookings, loading: dayLoading, error: dayError } = useDayBookings(date || null, {
    excludeId: row?.id ?? null,
  });

  const open = !!row;

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (!row) return;
    const startDate = new Date(row.start_at);
    const formattedDate = formatDate(startDate);
    setDate(formattedDate);
    setStartTime(toHHMM(row.start_at));
    setEndTime(toHHMM(row.end_at));
    setTitle(row.title);
    setMemo(row.description ?? "");
    setCompanyWide(row.is_companywide);
    setEditMode(false);
    setError(null);
    setValidationErrors([]);
  }, [row]);

  useEffect(() => {
    if (!editMode) return;
    if (startIndex === -1) return;
    const defaultEndIndex = Math.min(startIndex + 4, timeOptions.length - 1);
    const defaultEnd = timeOptions[defaultEndIndex];
    setEndTime((prev) => {
      if (!prev) return defaultEnd;
      const prevIndex = timeOptions.indexOf(prev);
      if (prevIndex === -1 || prevIndex <= startIndex) {
        return defaultEnd;
      }
      return prev;
    });
  }, [editMode, startIndex, timeOptions]);

  useEffect(() => {
    if (!open) return;
    let abort = false;
    (async () => {
      const { data: setting } = await supabase.from("settings").select("company_color").maybeSingle();
      const col = (setting as any)?.company_color as string | undefined;
      if (!abort) setCompanyDefault(normalizeColor(col ?? null));

      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        if (!abort) setCanEdit(false);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("color_settings, department_id, is_admin")
        .eq("id", uid)
        .maybeSingle();
      const cs = (prof as any)?.color_settings as Record<string, any> | undefined;
      const map = (cs?.tag_colors as Record<string, string> | undefined) ?? {};
      const normalized: Record<string, string> = {};
      Object.entries(map).forEach(([key, value]) => {
        const norm = normalizeColor(value);
        if (norm) normalized[key] = norm;
      });
      const override = normalizeColor((cs?.company_color as string | null | undefined) ?? null);
      if (!abort) {
        setColorOverrides(normalized);
        setCompanyOverride(override);
      }

      const myDept = (prof as any)?.department_id as string | undefined;
      const admin = Boolean((prof as any)?.is_admin);
      if (!abort && row) {
        setCanEdit(Boolean(admin || (myDept && row.department_id === myDept)));
      }
    })();
    return () => {
      abort = true;
    };
  }, [open, row, supabase]);

  useEffect(() => {
    if (!editMode) {
      setValidationErrors([]);
      return;
    }
    const result = validateReservation(
      { date: date || null, startTime: startTime || null, endTime: endTime || null, bookingId: row?.id ?? null },
      dayBookings
    );
    setValidationErrors(result.errors);
  }, [date, startTime, endTime, dayBookings, editMode, row?.id]);

  if (!row) return null;

  const tagColor = resolveTagColor(row, colorOverrides, companyOverride, companyDefault);
  const hasErrors = validationErrors.length > 0;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    const result = validateReservation(
      { date: date || null, startTime: startTime || null, endTime: endTime || null, bookingId: row.id },
      dayBookings
    );
    setValidationErrors(result.errors);
    if (!result.valid) return;

    setSaving(true);
    setError(null);
    const startISO = composeIso(date, startTime);
    const endISO = composeIso(date, endTime);
    const { error } = await supabase
      .from("bookings")
      .update({
        title,
        description: memo,
        start_at: startISO,
        end_at: endISO,
        is_companywide: companyWide,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.dispatchEvent(new CustomEvent("bookings-updated"));
    onClose();
  }

  async function handleDelete() {
    if (!row) return;
    if (!confirm("この予約を削除します。よろしいですか？")) return;
    setSaving(true);
    const { error } = await supabase.from("bookings").delete().eq("id", row.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.dispatchEvent(new CustomEvent("bookings-updated"));
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg p-0 w-full max-w-4xl m-auto backdrop:bg-black/40"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form method="dialog">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">予約詳細</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      </form>
      <div className="px-4 py-4">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
          <div className="space-y-4">
            {!editMode ? (
              <div className="space-y-4">
                <section>
                  <span className="mb-1 block text-xs font-medium text-zinc-500">タイトル</span>
                  <div className="rounded border px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.title}
                  </div>
                </section>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-zinc-500">日付</span>
                    <div className="rounded border px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                      {fmtDate(row.start_at)}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-zinc-500">時間</span>
                    <div className="rounded border px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                      {fmtTime(row.start_at)} — {fmtTime(row.end_at)}
                    </div>
                  </div>
                </section>
                <section>
                  <span className="mb-1 block text-xs font-medium text-zinc-500">部署</span>
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: tagColor,
                      color: chooseTextColor(tagColor),
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    {row.is_companywide ? "全社" : row.departments?.name ?? ""}
                  </span>
                </section>
                <section>
                  <span className="mb-1 block text-xs font-medium text-zinc-500">メモ</span>
                  {row.description ? (
                    <div className="whitespace-pre-wrap rounded border px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                      {row.description}
                    </div>
                  ) : (
                    <div className="rounded border px-3 py-2 text-sm text-zinc-500">メモはありません</div>
                  )}
                </section>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-3" aria-describedby="detail-reservation-errors">
                {error && <div className="text-sm text-red-600">{error}</div>}
                <label className="block text-sm">
                  <span className="mb-1 block">タイトル</span>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block">日付</span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                    aria-invalid={hasError(validationErrors, "date") || hasError(validationErrors, "weekday")}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block">開始</span>
                  <select
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                    aria-invalid={hasError(validationErrors, "startTime")}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block">終了</span>
                  <select
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                    aria-invalid={hasError(validationErrors, "endTime") || hasError(validationErrors, "range")}
                  >
                    {endOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block">メモ</span>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full rounded border px-3 py-2 min-h-24"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={companyWide}
                    onChange={(e) => setCompanyWide(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>全社</span>
                </label>
                <div id="detail-reservation-errors" aria-live="polite" className="space-y-1 text-xs text-red-600">
                  {validationErrors.map((err, idx) => (
                    <p key={`${err.field}-${idx}`}>{err.message}</p>
                  ))}
                  {dayError && <p>{dayError}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving || hasErrors || dayLoading}
                    className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </div>
          <aside className="rounded border bg-zinc-50/70 px-3 py-3 text-sm dark:bg-zinc-900/40">
            <h3 className="mb-2 text-sm font-medium">同日の予約</h3>
            {!date ? (
              <p className="text-xs text-zinc-500">日付を選ぶと同日の予約が表示されます。</p>
            ) : dayLoading ? (
              <p className="text-xs text-zinc-500">読み込み中...</p>
            ) : dayError ? (
              <p className="text-xs text-red-600">{dayError}</p>
            ) : dayBookings.length === 0 ? (
              <p className="text-xs text-zinc-500">該当する予約はありません。</p>
            ) : (
              <ul className="space-y-2">
                {dayBookings.map((b) => {
                  const color = resolveTagColor(b, colorOverrides, companyOverride, companyDefault);
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 rounded border bg-white px-3 py-2 shadow-sm dark:bg-black"
                    >
                      <div className="w-20 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {fmtTime(b.start_at)}-{fmtTime(b.end_at)}
                      </div>
                      <div className="flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {b.title}
                      </div>
                      <span
                        className="inline-flex items-center rounded px-2 py-0.5 text-[11px]"
                        style={{
                          backgroundColor: color,
                          color: chooseTextColor(color),
                          border: "1px solid rgba(0,0,0,0.1)",
                        }}
                      >
                        {b.is_companywide ? "全社" : b.departments?.name ?? ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </dialog>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

function buildTimeOptions(): string[] {
  const opts: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 18 && m > 0) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push(`${hh}:${mm}`);
    }
  }
  return opts;
}

function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function composeIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveTagColor(
  booking: BookingWithDepartment,
  overrides: Record<string, string>,
  companyOverride: string | null,
  companyDefault: string | null
): string {
  if (booking.is_companywide) {
    return companyOverride ?? companyDefault ?? "#e5e7eb";
  }
  const override = overrides[booking.department_id];
  return override ?? booking.departments?.default_color ?? "#e5e7eb";
}

function hasError(errors: ValidationError[], field: ValidationError["field"]): boolean {
  return errors.some((err) => err.field === field);
}
