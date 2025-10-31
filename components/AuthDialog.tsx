"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

type Department = { id: string; name: string };

export default function AuthDialog() {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup-only fields
  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // Open/close dialog
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Load departments for signup
  useEffect(() => {
    if (mode !== "signup") return;
    let ignore = false;
    (async () => {
      const { data, error } = await supabase.from("departments").select("id,name").order("name");
      if (ignore) return;
      if (error) {
        setError(error.message);
        return;
      }
      setDepartments(data ?? []);
      if (data && data.length && !departmentId) setDepartmentId(data[0].id);
    })();
    return () => {
      ignore = true;
    };
  }, [mode, supabase, departmentId]);

  async function ensureProfile() {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return;
    const uid = user.id;
    // 存在チェック
    const { data: existing, error: selErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", uid)
      .limit(1)
      .maybeSingle();
    if (selErr) return;
    if (existing) return;
    const meta = user.user_metadata as { display_name?: string; department_id?: string };
    const dn = meta?.display_name || displayName || "";
    const dep = meta?.department_id || departmentId || "";
    if (!dn || !dep) return;
    await supabase.from("profiles").insert({ id: uid, display_name: dn, department_id: dep });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // 初回ログイン時にプロフィールが無ければ作成（ユーザーメタから）
    await ensureProfile();
    setMessage("ログインしました");
    setTimeout(() => setOpen(false), 400);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, department_id: departmentId },
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // If email confirmations are disabled, a session may be returned and we can proceed.
    const session = data.session;
    if (!session) {
      setLoading(false);
      setMessage("サインアップしました。メール確認後にログインしてください（初回ログイン時にプロフィールを作成します）。");
      return;
    }
    // Insert profile row for the user
    const userId = data.user?.id;
    if (userId) {
      const { error: upError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          display_name: displayName,
          department_id: departmentId,
        },
        { onConflict: "id" }
      );
      if (upError) {
        setLoading(false);
        setError(`プロフィール作成に失敗: ${upError.message}`);
        return;
      }
    }
    setLoading(false);
    setMessage("サインアップしてログインしました");
    setTimeout(() => setOpen(false), 400);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  return (
    <>
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => setOpen(true)}
      >
        ログイン
      </button>

      <dialog ref={dialogRef} className="rounded-lg p-0 w-full max-w-md backdrop:bg-black/40">
        <form method="dialog">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">{mode === "login" ? "ログイン" : "サインアップ"}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>
        </form>

        <div className="px-4 py-3 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {message && <div className="text-sm text-green-700">{message}</div>}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block">メールアドレス</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block">パスワード</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {loading ? "処理中..." : "ログイン"}
              </button>

              <div className="text-sm text-zinc-600">
                アカウントをお持ちでない方は {" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => switchMode("signup")}
                >
                  サインアップ
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block">メールアドレス</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block">パスワード</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
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
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {loading ? "処理中..." : "サインアップしてログイン"}
              </button>

              <div className="text-sm text-zinc-600">
                すでにアカウントをお持ちの方は {" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => switchMode("login")}
                >
                  ログイン
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
