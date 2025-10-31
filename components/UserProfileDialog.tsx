"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Department = { id: string; name: string; default_color: string };

export default function UserProfileDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  // form fields
  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [colorText, setColorText] = useState("#64748b");
  const [colorPick, setColorPick] = useState("#64748b");
  const [colorMap, setColorMap] = useState<Record<string, string>>({});

  // open/close
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // load depts + profile
  useEffect(() => {
    if (!open) return;
    let abort = false;
    (async () => {
      setError(null);
      // departments
      const { data: depts, error: dErr } = await supabase
        .from("departments")
        .select("id, name, default_color")
        .order("name");
      if (abort) return;
      if (dErr) {
        setError(dErr.message);
        return;
      }
      setDepartments((depts as Department[]) ?? []);

      // profile
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("display_name, department_id, color_settings")
        .eq("id", uid)
        .maybeSingle();
      if (pErr) {
        setError(pErr.message);
        return;
      }
      const dn = (prof as any)?.display_name ?? "";
      const dep = (prof as any)?.department_id ?? (depts?.[0]?.id ?? "");
      const cs = ((prof as any)?.color_settings as Record<string, any>) ?? {};
      const tagColors = (cs?.tag_colors as Record<string, string> | undefined) ?? {};
      setColorMap(tagColors);
      const override = tagColors[dep];
      const normalized = normalizeColor(override ?? findDeptColor(dep, (depts as Department[]) ?? []));
      setDisplayName(dn);
      setDepartmentId(dep);
      setColorText(normalized);
      setColorPick(normalized);
    })();
    return () => {
      abort = true;
    };
  }, [open, supabase]);

  function findDeptColor(id: string, list: Department[]): string {
    const f = list.find((d) => d.id === id);
    return f?.default_color ?? "#64748b";
  }

  function normalizeColor(v: string): string {
    if (!v) return "#64748b";
    const s = v.trim();
    if (/^#([0-9a-fA-F]{6})$/.test(s)) return s.toLowerCase();
    if (/^#([0-9a-fA-F]{3})$/.test(s)) {
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return "#64748b";
  }

  function handleTextColor(v: string) {
    setColorText(v);
    const ok = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim());
    if (ok) setColorPick(normalizeColor(v));
  }
  function handlePickColor(v: string) {
    setColorPick(v);
    setColorText(v);
  }
  function handleDeptChange(id: string) {
    setDepartmentId(id);
    const override = colorMap[id];
    const fallback = findDeptColor(id, departments);
    const color = normalizeColor(override ?? fallback);
    setColorText(color);
    setColorPick(color);
  }

  function resetToDefault() {
    if (!departmentId) return;
    const fallback = findDeptColor(departmentId, departments);
    const next = { ...colorMap };
    delete next[departmentId];
    setColorMap(next);
    const color = normalizeColor(fallback);
    setColorText(color);
    setColorPick(color);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      setLoading(false);
      setError("ログインが必要です");
      return;
    }
    const color = normalizeColor(colorText);
    const nextMap = { ...colorMap, [departmentId]: color };
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        department_id: departmentId,
        color_settings: { tag_colors: nextMap },
      })
      .eq("id", uid);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // broadcast update to listeners
    window.dispatchEvent(new CustomEvent("profile-updated"));
    onSaved?.();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="rounded-lg p-0 w-full max-w-lg m-auto backdrop:bg-black/40">
      <form method="dialog">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">ユーザー情報を編集</h2>
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
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block">氏名</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">部署</span>
            <select
              required
              value={departmentId}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <section className="pt-2">
            <h3 className="mb-2 text-sm font-medium">部署ごとのカラー設定</h3>
            <div className="grid grid-cols-12 border rounded overflow-hidden">
              <div className="contents bg-zinc-50 dark:bg-zinc-900 text-sm font-medium">
                <div className="col-span-6 p-2 border-b">部署名</div>
                <div className="col-span-6 p-2 border-b">カラー</div>
              </div>
              {departments.length === 0 ? (
                <div className="col-span-12 p-3 text-sm text-zinc-600">部署がありません</div>
              ) : (
                departments.map((d) => {
                  const effective = normalizeColor(colorMap[d.id] ?? d.default_color);
                  return (
                    <div key={d.id} className="contents text-sm">
                      <div className="col-span-6 p-2 border-t flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded border"
                          style={{ backgroundColor: effective }}
                          aria-label={`カラー ${effective}`}
                        />
                        <span>{d.name}</span>
                      </div>
                      <div className="col-span-6 p-2 border-t">
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={effective}
                            onChange={(e) => {
                              const v = normalizeColor(e.target.value);
                              setColorMap((m) => ({ ...m, [d.id]: v }));
                              if (d.id === departmentId) {
                                setColorPick(v);
                                setColorText(v);
                              }
                            }}
                            className="h-9 w-14 cursor-pointer rounded border px-1"
                          />
                          <input
                            type="text"
                            value={effective}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(val.trim())) {
                                const v = normalizeColor(val);
                                setColorMap((m) => ({ ...m, [d.id]: v }));
                                if (d.id === departmentId) {
                                  setColorPick(v);
                                  setColorText(v);
                                }
                              }
                            }}
                            className="w-32 rounded border px-2 py-1 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setColorMap((m) => {
                                const n = { ...m };
                                delete n[d.id];
                                return n;
                              });
                              const v = normalizeColor(d.default_color);
                              if (d.id === departmentId) {
                                setColorPick(v);
                                setColorText(v);
                              }
                            }}
                            className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            デフォルト
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
