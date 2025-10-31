"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import UserForm, { type DepartmentOption, type UserInput } from "@/components/UserForm";

type ProfileRow = {
  id: string;
  display_name: string;
  is_admin: boolean;
  department_id: string;
  created_at: string;
  departments?: { name: string } | null;
};

export default function UsersAdminPage() {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editRow, setEditRow] = useState<ProfileRow | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const openEdit = useCallback((row: ProfileRow) => {
    setEditRow(row);
    dialogRef.current?.showModal();
  }, []);
  const closeDialog = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    let abort = false;
    (async () => {
      // admin check
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

      // preload departments
      const { data: depts, error: dErr } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (dErr) {
        setError(dErr.message);
        return;
      }
      setDepartments((depts as DepartmentOption[]) ?? []);

      setLoading(true);
      const { data: users, error: uErr } = await supabase
        .from("profiles")
        .select("id, display_name, is_admin, department_id, created_at, departments(name)")
        .order("created_at", { ascending: true });
      if (abort) return;
      setLoading(false);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      setRows((users as ProfileRow[]) ?? []);
    })();
    return () => {
      abort = true;
    };
  }, [supabase]);

  async function refresh() {
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, display_name, is_admin, department_id, created_at, departments(name)")
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      return;
    }
    setRows((users as ProfileRow[]) ?? []);
  }

  async function handleSubmit(input: UserInput) {
    if (!editRow) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: input.display_name,
        department_id: input.department_id,
        is_admin: input.is_admin,
      })
      .eq("id", editRow.id);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
    closeDialog();
  }

  if (isAdmin === null) return <div className="p-6 text-sm">確認中...</div>;
  if (!isAdmin) return <div className="p-6 text-sm text-red-600">権限がありません</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-5xl p-6 bg-white dark:bg-black">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">ユーザー管理</h1>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <section>
          <div className="grid grid-cols-12 border rounded overflow-hidden">
            <div className="contents bg-zinc-50 dark:bg-zinc-900 text-sm font-medium">
              <div className="col-span-4 p-2 border-b">氏名</div>
              <div className="col-span-4 p-2 border-b">部署</div>
              <div className="col-span-2 p-2 border-b">管理者</div>
              <div className="col-span-2 p-2 border-b">操作</div>
            </div>
            {loading ? (
              <div className="col-span-12 p-3 text-sm">読み込み中...</div>
            ) : rows.length === 0 ? (
              <div className="col-span-12 p-3 text-sm text-zinc-600">ユーザーがいません</div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="contents text-sm">
                  <div className="col-span-4 p-2 border-t">{r.display_name}</div>
                  <div className="col-span-4 p-2 border-t">{r.departments?.name ?? ""}</div>
                  <div className="col-span-2 p-2 border-t">{r.is_admin ? "はい" : "いいえ"}</div>
                  <div className="col-span-2 p-2 border-t">
                    <button
                      className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => openEdit(r)}
                    >
                      編集
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <dialog ref={dialogRef} className="rounded-lg p-0 w-full max-w-lg m-auto backdrop:bg-black/40">
          <form method="dialog">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold">ユーザーを編集</h2>
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
            {editRow && (
              <UserForm
                initial={{
                  id: editRow.id,
                  display_name: editRow.display_name,
                  department_id: editRow.department_id,
                  is_admin: editRow.is_admin,
                }}
                departments={departments}
                submitting={submitting}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        </dialog>
      </main>
    </div>
  );
}
