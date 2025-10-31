"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import DepartmentForm, { type DepartmentInput } from "@/components/DepartmentForm";

type Dept = {
  id: string;
  name: string;
  default_color: string;
  created_at: string;
};

export default function DepartmentsAdminPage() {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Dept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editRow, setEditRow] = useState<Dept | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // settings: company_color
  const [companyColorText, setCompanyColorText] = useState<string>("#64748b");
  const [companyColorPick, setCompanyColorPick] = useState<string>("#64748b");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const openCreate = useCallback(() => {
    setEditRow(null);
    dialogRef.current?.showModal();
  }, []);
  const openEdit = useCallback((row: Dept) => {
    setEditRow(row);
    dialogRef.current?.showModal();
  }, []);
  const closeDialog = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    let abort = false;
    (async () => {
      // check admin
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        setIsAdmin(false);
        return;
      }
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", uid)
        .maybeSingle();
      if (error) {
        setError(error.message);
        setIsAdmin(false);
        return;
      }
      const admin = Boolean((prof as any)?.is_admin);
      setIsAdmin(admin);
      if (!admin) return;

      setLoading(true);
      const { data: depts, error: dErr } = await supabase
        .from("departments")
        .select("id, name, default_color, created_at")
        .order("created_at", { ascending: true });
      if (abort) return;
      setLoading(false);
      if (dErr) {
        setError(dErr.message);
        return;
      }
      setRows((depts as Dept[]) ?? []);

      // Load settings (company_color)
      const { data: setting, error: sErr } = await supabase
        .from("settings")
        .select("company_color")
        .maybeSingle();
      if (sErr) {
        // settings may be empty; ignore error if no rows
      }
      const color = (setting as any)?.company_color as string | undefined;
      if (color && /^#([0-9a-fA-F]{6})$/.test(color.trim())) {
        setCompanyColorText(color);
        setCompanyColorPick(color);
      } else {
        setCompanyColorText("#64748b");
        setCompanyColorPick("#64748b");
      }
      setSettingsLoaded(true);
    })();
    return () => {
      abort = true;
    };
  }, [supabase]);

  async function refresh() {
    const { data: depts, error } = await supabase
      .from("departments")
      .select("id, name, default_color, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      return;
    }
    setRows((depts as Dept[]) ?? []);
  }

  async function handleSubmit(input: DepartmentInput) {
    setSubmitting(true);
    setError(null);
    if (editRow) {
      const { error } = await supabase
        .from("departments")
        .update({ name: input.name, default_color: input.default_color })
        .eq("id", editRow.id);
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({ name: input.name, default_color: input.default_color });
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
    }
    await refresh();
    closeDialog();
  }

  async function handleDelete(id: string) {
    if (!confirm("削除してよろしいですか？\n（この操作は元に戻せません）")) return;
    setSubmitting(true);
    const { error } = await supabase.from("departments").delete().eq("id", id);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
  }

  function normalizeColor(v: string): string {
    const s = (v || "").trim();
    if (/^#([0-9a-fA-F]{6})$/.test(s)) return s.toLowerCase();
    if (/^#([0-9a-fA-F]{3})$/.test(s)) {
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return "#64748b";
  }

  async function saveCompanyColor() {
    setSubmitting(true);
    setError(null);
    const color = normalizeColor(companyColorText);
    // Ensure single row: delete all, then insert one
    const { error: delErr } = await supabase.from("settings").delete().neq("company_color", null);
    if (delErr) {
      setSubmitting(false);
      setError(delErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("settings").insert({ company_color: color });
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setCompanyColorText(color);
    setCompanyColorPick(color);
    // notify listeners (e.g., bookings list) to refresh
    window.dispatchEvent(new CustomEvent("settings-updated"));
  }

  if (isAdmin === null) {
    return <div className="p-6 text-sm">確認中...</div>;
  }
  if (!isAdmin) {
    return <div className="p-6 text-sm text-red-600">権限がありません</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-4xl p-6 bg-white dark:bg-black">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">部署管理</h1>
          <button
            className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
            onClick={openCreate}
          >
            新規作成
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <section>
          <div className="grid grid-cols-12 border rounded overflow-hidden">
            <div className="contents bg-zinc-50 dark:bg-zinc-900 text-sm font-medium">
              <div className="col-span-6 p-2 border-b">部署名</div>
              <div className="col-span-4 p-2 border-b">カラー</div>
              <div className="col-span-2 p-2 border-b">操作</div>
            </div>
            {loading ? (
              <div className="col-span-12 p-3 text-sm">読み込み中...</div>
            ) : rows.length === 0 ? (
              <div className="col-span-12 p-3 text-sm text-zinc-600">部署がありません</div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="contents text-sm">
                  <div className="col-span-6 p-2 border-t">{r.name}</div>
                  <div className="col-span-4 p-2 border-t">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded border"
                        style={{ backgroundColor: r.default_color }}
                        aria-label={`カラー ${r.default_color}`}
                      />
                      <span className="font-mono">{r.default_color}</span>
                    </div>
                  </div>
                  <div className="col-span-2 p-2 border-t">
                    <div className="flex gap-2">
                      <button
                        className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => openEdit(r)}
                      >
                        編集
                      </button>
                      <button
                        className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => handleDelete(r.id)}
                        disabled={submitting}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold">全社タグのカラー設定</h2>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm inline-flex items-center gap-2">
              <span>カラー</span>
              <input
                type="color"
                value={companyColorPick}
                onChange={(e) => {
                  setCompanyColorPick(e.target.value);
                  setCompanyColorText(e.target.value);
                }}
                className="h-10 w-20 cursor-pointer rounded border px-1"
              />
            </label>
            <input
              type="text"
              value={companyColorText}
              onChange={(e) => {
                const v = e.target.value;
                setCompanyColorText(v);
                if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim())) {
                  const n = normalizeColor(v);
                  setCompanyColorPick(n);
                }
              }}
              className="w-40 rounded border px-3 py-2 font-mono text-sm"
              placeholder="#64748b"
            />
            <button
              type="button"
              onClick={saveCompanyColor}
              disabled={!settingsLoaded || submitting}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "保存中..." : "保存"}
            </button>
          </div>
        </section>

        <dialog ref={dialogRef} className="rounded-lg p-0 w-full max-w-lg m-auto backdrop:bg-black/40">
          <form method="dialog">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold">{editRow ? "部署を編集" : "部署を作成"}</h2>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
          </form>
          <div className="px-4 py-4">
            <DepartmentForm
              initial={editRow ?? undefined}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </div>
        </dialog>
      </main>
    </div>
  );
}
