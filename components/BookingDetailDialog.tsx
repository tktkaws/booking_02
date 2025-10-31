"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export type BookingRow = {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_companywide: boolean;
  department_id: string;
  departments?: { name: string; default_color?: string | null } | null;
};

export default function BookingDetailDialog({
  row,
  onClose,
}: {
  row: BookingRow | null;
  onClose: () => void;
}) {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [companyOverride, setCompanyOverride] = useState<string | null>(null);
  const [companyDefault, setCompanyDefault] = useState<string | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // edit form fields
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:15");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [companyWide, setCompanyWide] = useState(false);
  const timeList = useMemo(buildTimeOptions, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setSaving(true);
    setError(null);
    if (!date || !startTime || !endTime || !title) {
      setSaving(false);
      setError("必須項目を入力してください");
      return;
    }
    const startIdx = timeList.indexOf(startTime);
    const endIdx = timeList.indexOf(endTime);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      setSaving(false);
      setError("終了は開始より後にしてください");
      return;
    }
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

  async function onDelete() {
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

  const open = !!row;

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let abort = false;
    (async () => {
      // settings color
      const { data: setting } = await supabase.from("settings").select("company_color").maybeSingle();
      const col = (setting as any)?.company_color as string | undefined;
      if (!abort) setCompanyDefault(normalizeColor(col ?? null));
      // current user's overrides and permission check
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
      const override = normalizeColor((cs?.company_color as string | null | undefined) ?? null);
      if (!abort) {
        setColorOverrides(map);
        setCompanyOverride(override);
      }

      const myDept = (prof as any)?.department_id as string | undefined;
      const admin = Boolean((prof as any)?.is_admin);
      if (!abort) setCanEdit(Boolean(admin || (row && myDept && row.department_id === myDept)));
    })();
    return () => {
      abort = true;
    };
  }, [open, row, supabase]);

  useEffect(() => {
    if (!row) return;
    // initialize edit fields from row
    const d = new Date(row.start_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDate(dateStr);
    setStartTime(toHHMM(row.start_at));
    setEndTime(toHHMM(row.end_at));
    setTitle(row.title);
    setMemo(row.description ?? "");
    setCompanyWide(row.is_companywide);
    setEditMode(false);
    setError(null);
  }, [row]);

  if (!row) return null;

  const tagColor = row.is_companywide
    ? companyOverride ?? companyDefault ?? "#e5e7eb"
    : colorOverrides[row.department_id] ?? (row.departments?.default_color ?? "#e5e7eb");

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg p-0 w-full max-w-lg m-auto backdrop:bg-black/40"
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
      <div className="px-4 py-4 space-y-3">
        {!editMode ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{row.title}</div>
                <div className="text-sm text-zinc-600">
                  {fmtDate(row.start_at)} {fmtTime(row.start_at)} — {fmtTime(row.end_at)}
                </div>
              </div>
              <div>
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
              </div>
            </div>
            {row.description ? (
              <div className="whitespace-pre-wrap text-sm">{row.description}</div>
            ) : (
              <div className="text-sm text-zinc-500">メモはありません</div>
            )}
            {canEdit && (
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  削除
                </button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block">日付</span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block">開始</span>
                <select
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                >
                  {timeList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block">終了</span>
                <select
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                >
                  {timeList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
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
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}

// component-scoped handlers are defined within the component scope above
