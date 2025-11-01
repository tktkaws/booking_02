"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  department_id: string;
  color_settings?: Record<string, unknown>;
};

type DayBooking = {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  is_companywide: boolean;
  department_id: string;
  departments?: { name: string; default_color?: string | null } | null;
};

function buildTimeOptions(): string[] {
  const opts: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 18 && m > 0) break; // 18:00 まで
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push(`${hh}:${mm}`);
    }
  }
  return opts;
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
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
  const safe = hex || "#e5e7eb";
  const m = /^#?([0-9a-f]{6})$/i.exec(safe.trim());
  if (!m) return "#111827";
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 150 ? "#111827" : "#ffffff";
}

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${formatTime(start)}-${formatTime(end)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function resolveTagColor(
  booking: DayBooking,
  colorOverrides: Record<string, string>,
  companyOverride: string | null,
  companyDefault: string | null
): string {
  if (booking.is_companywide) {
    return companyOverride ?? companyDefault ?? "#e5e7eb";
  }
  const override = colorOverrides[booking.department_id];
  const fallback = booking.departments?.default_color ?? "#e5e7eb";
  return override ?? fallback ?? "#e5e7eb";
}

export default function BookingForm({ onCreated }: { onCreated?: () => void }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const timeOptions = useMemo(() => buildTimeOptions(), []);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:15");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [companyWide, setCompanyWide] = useState(false);
  const [showStartChoices, setShowStartChoices] = useState(false);
  const [showEndChoices, setShowEndChoices] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [companyOverride, setCompanyOverride] = useState<string | null>(null);
  const [companyDefault, setCompanyDefault] = useState<string | null>(null);
  const [dateBookings, setDateBookings] = useState<DayBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setAuthed(Boolean(session));
    const uid = session?.user?.id;
    if (!uid) {
      setDeptId(null);
      setColorOverrides({});
      setCompanyOverride(null);
      return;
    }
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("id, department_id, color_settings")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      setError(error.message);
      return;
    }
    const profile = prof as ProfileRow | null;
    setDeptId(profile?.department_id ?? null);
    const settings = profile?.color_settings as Record<string, unknown> | undefined;
    const tagMap = (settings?.tag_colors as Record<string, string> | undefined) ?? {};
    const normalized: Record<string, string> = {};
    Object.entries(tagMap).forEach(([key, value]) => {
      const norm = normalizeColor(value);
      if (norm) normalized[key] = norm;
    });
    setColorOverrides(normalized);
    setCompanyOverride(normalizeColor(settings?.company_color));
  }, [supabase]);

  useEffect(() => {
    let active = true;
    (async () => {
      await refreshProfile();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      refreshProfile();
    });
    const onProfileUpdated = () => {
      if (!active) return;
      refreshProfile();
    };
    window.addEventListener("profile-updated", onProfileUpdated as EventListener);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("profile-updated", onProfileUpdated as EventListener);
    };
  }, [refreshProfile, supabase]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      const { data } = await supabase.from("settings").select("company_color").maybeSingle();
      if (cancelled) return;
      const color = normalizeColor((data as { company_color?: string } | null)?.company_color);
      setCompanyDefault(color);
    }
    loadSettings();
    const onSettingsUpdated = () => {
      if (!cancelled) loadSettings();
    };
    window.addEventListener("settings-updated", onSettingsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("settings-updated", onSettingsUpdated);
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    async function load(dateKey: string | null) {
      if (!dateKey) {
        if (!cancelled) {
          setBookingsLoading(false);
          setBookingsError(null);
          setDateBookings([]);
        }
        return;
      }
      setBookingsLoading(true);
      setBookingsError(null);
      const dayStart = new Date(`${dateKey}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const { data, error } = await supabase
        .from("bookings")
        .select("id, title, start_at, end_at, is_companywide, department_id, departments(name, default_color)")
        .gte("start_at", dayStart.toISOString())
        .lt("start_at", dayEnd.toISOString())
        .order("start_at", { ascending: true });
      if (cancelled) return;
      setBookingsLoading(false);
      if (error) {
        setBookingsError(error.message);
        setDateBookings([]);
        return;
      }
      setDateBookings((data as DayBooking[]) ?? []);
    }
    load(date);
    const handleUpdated = () => {
      load(date);
    };
    window.addEventListener("bookings-updated", handleUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("bookings-updated", handleUpdated as EventListener);
    };
  }, [date, supabase]);

  function composeIso(dateStr: string, timeStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
    return dt.toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!authed) {
      setError("ログインが必要です");
      return;
    }
    if (!deptId) {
      setError("プロフィールに部署が設定されていません");
      return;
    }
    if (!date || !startTime || !endTime || !title) {
      setError("必須項目を入力してください");
      return;
    }
    const startIdx = timeOptions.indexOf(startTime);
    const endIdx = timeOptions.indexOf(endTime);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      setError("終了時刻は開始時刻より後を選択してください");
      return;
    }
    const startISO = composeIso(date, startTime);
    const endISO = composeIso(date, endTime);

    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      setLoading(false);
      setError("ログインセッションが見つかりません");
      return;
    }

    const { error: insErr } = await supabase.from("bookings").insert({
      title,
      description: memo,
      start_at: startISO,
      end_at: endISO,
      is_companywide: companyWide,
      department_id: deptId,
      created_by: uid,
    });
    setLoading(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setMessage("予約を作成しました");
    setTitle("");
    setMemo("");
    window.dispatchEvent(new CustomEvent("bookings-updated"));
    onCreated?.();
  }

  return (
    <section className="w-full max-w-4xl mx-auto">
      <h2 className="mb-3 text-lg font-semibold">予約作成</h2>
      {!authed && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          ログインすると予約を作成できます。
        </div>
      )}
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {message && <div className="mb-3 text-sm text-green-700">{message}</div>}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="text-sm">
            <span className="mb-1 block">日付（必須）</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block">開始時間（必須）</span>
            <div className="relative">
              <button
                type="button"
                className="w-full rounded border px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                aria-haspopup="listbox"
                aria-expanded={showStartChoices}
                onClick={() => {
                  setShowStartChoices((v) => !v);
                  setShowEndChoices(false);
                }}
              >
                {startTime}
              </button>
              {showStartChoices && (
                <div
                  role="radiogroup"
                  aria-label="開始時間"
                  className="absolute top-full left-0 z-20 mt-1 w-full max-h-64 space-y-1 overflow-y-auto rounded border bg-white p-2 shadow dark:bg-black"
                >
                  {timeOptions.map((t) => {
                    const selected = t === startTime;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setStartTime(t);
                          setShowStartChoices(false);
                        }}
                        className={
                          "w-full rounded border px-3 py-2 text-left transition-colors " +
                          (selected
                            ? "bg-black text-white dark:bg-white dark:text-black border-black"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                        }
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="text-sm">
            <span className="mb-1 block">終了時間（必須）</span>
            <div className="relative">
              <button
                type="button"
                className="w-full rounded border px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                aria-haspopup="listbox"
                aria-expanded={showEndChoices}
                onClick={() => {
                  setShowEndChoices((v) => !v);
                  setShowStartChoices(false);
                }}
              >
                {endTime}
              </button>
              {showEndChoices && (
                <div
                  role="radiogroup"
                  aria-label="終了時間"
                  className="absolute top-full left-0 z-20 mt-1 w-full max-h-64 space-y-1 overflow-y-auto rounded border bg-white p-2 shadow dark:bg-black"
                >
                  {timeOptions.map((t) => {
                    const selected = t === endTime;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setEndTime(t);
                          setShowEndChoices(false);
                        }}
                        className={
                          "w-full rounded border px-3 py-2 text-left transition-colors " +
                          (selected
                            ? "bg-black text-white dark:bg-white dark:text-black border-black"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                        }
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <label className="text-sm">
            <span className="mb-1 block">タイトル（必須）</span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="打合せ など"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">メモ（任意）</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded border px-3 py-2 min-h-24"
              placeholder="議題や資料リンクなど"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={companyWide}
              onChange={(e) => setCompanyWide(e.target.checked)}
              className="h-4 w-4"
            />
            <span>全社的な予定</span>
          </label>
          <button
            type="submit"
            disabled={loading || !authed}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "作成中..." : "予約を作成"}
          </button>
        </form>
        <aside className="rounded border bg-zinc-50/70 px-3 py-3 text-sm dark:bg-zinc-900/40">
          <h3 className="mb-2 text-sm font-medium">選択日の予約</h3>
          {!date ? (
            <p className="text-xs text-zinc-500">日付を選ぶと同日の予約が表示されます。</p>
          ) : bookingsLoading ? (
            <p className="text-xs text-zinc-500">読み込み中...</p>
          ) : bookingsError ? (
            <p className="text-xs text-red-600">{bookingsError}</p>
          ) : dateBookings.length === 0 ? (
            <p className="text-xs text-zinc-500">該当する予約はありません。</p>
          ) : (
            <ul className="space-y-2">
              {dateBookings.map((b) => {
                const color = resolveTagColor(b, colorOverrides, companyOverride, companyDefault);
                return (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded border bg-white px-3 py-2 shadow-sm dark:bg-black"
                  >
                    <div className="w-20 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {formatRange(b.start_at, b.end_at)}
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
    </section>
  );
}
