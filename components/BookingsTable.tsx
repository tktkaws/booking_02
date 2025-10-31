"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Row = {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  is_companywide: boolean;
  departments?: { name: string; default_color?: string | null } | null;
};

export default function BookingsTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("bookings")
        .select("id, title, start_at, end_at, is_companywide, departments(name, default_color)")
        .order("start_at", { ascending: true });
      if (abort) return;
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setRows((data as Row[]) ?? []);
    })();
    return () => {
      abort = true;
    };
  }, [supabase, refreshKey]);

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString();
  }
  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <section className="w-full max-w-5xl mx-auto">
      <h2 className="mb-3 text-lg font-semibold">予約一覧</h2>
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-12 border rounded overflow-hidden">
        <div className="contents bg-zinc-50 dark:bg-zinc-900 text-sm font-medium">
          <div className="col-span-3 p-2 border-b">日付</div>
          <div className="col-span-2 p-2 border-b">開始</div>
          <div className="col-span-2 p-2 border-b">終了</div>
          <div className="col-span-3 p-2 border-b">タイトル</div>
          <div className="col-span-2 p-2 border-b">部署</div>
        </div>
        {loading ? (
          <div className="col-span-12 p-3 text-sm">読み込み中...</div>
        ) : rows.length === 0 ? (
          <div className="col-span-12 p-3 text-sm text-zinc-600">予約はありません</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="contents text-sm">
              <div className="col-span-3 p-2 border-t">{fmtDate(r.start_at)}</div>
              <div className="col-span-2 p-2 border-t">{fmtTime(r.start_at)}</div>
              <div className="col-span-2 p-2 border-t">{fmtTime(r.end_at)}</div>
              <div className="col-span-3 p-2 border-t">
                {r.title}
                {r.is_companywide && (
                  <span className="ml-2 inline-block rounded bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                    全社
                  </span>
                )}
              </div>
              <div className="col-span-2 p-2 border-t">
                {r.departments?.name ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: r.departments?.default_color ?? "#e5e7eb",
                      color: chooseTextColor(r.departments?.default_color ?? "#e5e7eb"),
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    {r.departments.name}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
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
