"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import AuthDialog from "./AuthDialog";

export default function Header() {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [departmentColor, setDepartmentColor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    async function load(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      setEmail(session?.user?.email ?? null);
      const uid = session?.user?.id;
      if (!uid) {
        setDisplayName(null);
        setDepartmentName(null);
        return;
      }
      // fetch profile + department name
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, is_admin, departments(name, default_color)")
        .eq("id", uid)
        .maybeSingle();
      const dn = (prof as any)?.display_name ?? null;
      const depn = (prof as any)?.departments?.name ?? null;
      const depc = (prof as any)?.departments?.default_color ?? null;
      setDisplayName(dn);
      setDepartmentName(depn);
      setDepartmentColor(typeof depc === "string" ? depc : null);
      setIsAdmin(Boolean((prof as any)?.is_admin));
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      await load(data.session);
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        load(session);
      });
      unsub = sub.subscription.unsubscribe;
    })();
    return () => {
      unsub?.();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="font-medium">会議室予約</div>
      <div className="flex items-center gap-3">
        {email ? (
          <>
            <span className="text-sm text-zinc-600 flex items-center gap-2">
              <span>{displayName ?? email}</span>
              {departmentName && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: departmentColor ?? "#e5e7eb",
                    color: chooseTextColor(departmentColor ?? "#e5e7eb"),
                    border: "1px solid rgba(0,0,0,0.1)",
                  }}
                >
                  {departmentName}
                </span>
              )}
            </span>
            {isAdmin && (
              <a
                href="/admin/departments"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                部署管理
              </a>
            )}
            <button
              onClick={signOut}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ログアウト
            </button>
          </>
        ) : (
          <AuthDialog />
        )}
      </div>
    </header>
  );
}

function chooseTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111827"; // zinc-900
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // perceived luminance (sRGB)
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 150 ? "#111827" : "#ffffff"; // dark text for light bg, else white
}
