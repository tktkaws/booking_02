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
  const [companyColor, setCompanyColor] = useState<string | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});

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
      if (!abort) setCompanyColor(typeof col === "string" ? col : null);
      // current user's overrides (optional)
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("color_settings")
        .eq("id", uid)
        .maybeSingle();
      const cs = (prof as any)?.color_settings as Record<string, any> | undefined;
      const map = (cs?.tag_colors as Record<string, string> | undefined) ?? {};
      if (!abort) setColorOverrides(map);
    })();
    return () => {
      abort = true;
    };
  }, [open, supabase]);

  if (!row) return null;

  const tagColor = row.is_companywide
    ? companyColor ?? "#e5e7eb"
    : colorOverrides[row.department_id] ?? (row.departments?.default_color ?? "#e5e7eb");

  return (
    <dialog ref={dialogRef} className="rounded-lg p-0 w-full max-w-lg m-auto backdrop:bg-black/40">
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{row.title}</div>
            <div className="text-sm text-zinc-600">
              {fmtDate(row.start_at)} {fmtTime(row.start_at)} — {fmtTime(row.end_at)}
            </div>
          </div>
          <div>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
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

