"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type ProfileRow = { id: string; department_id: string };

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

export default function BookingForm({ onCreated }: { onCreated?: () => void }) {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const timeOptions = useMemo(buildTimeOptions, []);

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

  // Load session and user's department, and subscribe to auth changes
  useEffect(() => {
    let mounted = true;
    async function loadFromSession() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!mounted) return;
      setAuthed(!!session);
      const uid = session?.user?.id;
      if (!uid) {
        setDeptId(null);
        return;
      }
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, department_id")
        .eq("id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setError(error.message);
        return;
      }
      setDeptId((prof as ProfileRow | null)?.department_id ?? null);
    }
    loadFromSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      loadFromSession();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

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
    // Validate time ordering
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
    // Reset minimal fields
    setTitle("");
    setMemo("");
    onCreated?.();
  }

  return (
    <section className="w-full max-w-3xl mx-auto">
      <h2 className="mb-3 text-lg font-semibold">予約作成</h2>
      {!authed && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          ログインすると予約を作成できます。
        </div>
      )}
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {message && <div className="mb-3 text-sm text-green-700">{message}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:col-span-2">
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
                  className="absolute top-full left-0 z-20 mt-1 w-full max-h-64 overflow-y-auto rounded border bg-white p-2 shadow dark:bg-black space-y-1"
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
                  className="absolute top-full left-0 z-20 mt-1 w-full max-h-64 overflow-y-auto rounded border bg-white p-2 shadow dark:bg-black space-y-1"
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
        </div>
        <label className="text-sm sm:col-span-2">
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
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block">メモ（任意）</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded border px-3 py-2 min-h-24"
            placeholder="議題や資料リンクなど"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={companyWide}
            onChange={(e) => setCompanyWide(e.target.checked)}
            className="h-4 w-4"
          />
          <span>全社的な予定</span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading || !authed}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "作成中..." : "予約を作成"}
          </button>
        </div>
      </form>
    </section>
  );
}
