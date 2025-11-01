"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UserProfileDialog from "@/components/UserProfileDialog";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import AuthDialog from "./AuthDialog";

export default function Header() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [departmentColor, setDepartmentColor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const loadProfile = useCallback(
    async (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    ) => {
      setEmail(session?.user?.email ?? null);
      const uid = session?.user?.id;
      if (!uid) {
        setDisplayName(null);
        setDepartmentName(null);
        setDepartmentColor(null);
        setIsAdmin(false);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "display_name, is_admin, department_id, color_settings, departments(name, default_color)"
        )
        .eq("id", uid)
        .maybeSingle();
      const dn = (prof as any)?.display_name ?? null;
      const depn = (prof as any)?.departments?.name ?? null;
      const depc = (prof as any)?.departments?.default_color ?? null;
      const depId = (prof as any)?.department_id as string | undefined;
      const cs = (prof as any)?.color_settings as Record<string, any> | undefined;
      setDisplayName(dn);
      setDepartmentName(depn);
      const overrideMap = (cs?.tag_colors as Record<string, string> | undefined) ?? undefined;
      const override = depId && overrideMap ? overrideMap[depId] : undefined;
      setDepartmentColor(override ?? (typeof depc === "string" ? depc : null));
      setIsAdmin(Boolean((prof as any)?.is_admin));
    },
    [supabase]
  );

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      await loadProfile(data.session);
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        loadProfile(session);
      });
      unsub = sub.subscription.unsubscribe;
    })();
    return () => {
      unsub?.();
    };
  }, [loadProfile, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="font-medium">
        <Link href="/" className="hover:opacity-80">
          会議室予約
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {email ? (
          <>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="text-sm text-zinc-700 dark:text-zinc-200 flex items-center gap-2 rounded-md border px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span>{displayName ?? email}</span>
              {departmentName && (
                <span
                  className="inline-flex items-center rounded px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: departmentColor ?? "#e5e7eb",
                    color: chooseTextColor(departmentColor ?? "#e5e7eb"),
                    border: "1px solid rgba(0,0,0,0.1)",
                  }}
                >
                  {departmentName}
                </span>
              )}
            </button>
            {isAdmin && (
              <>
                <a
                  href="/admin/departments"
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  部署管理
                </a>
                <a
                  href="/admin/users"
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ユーザー管理
                </a>
              </>
            )}
            <button
              onClick={signOut}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ログアウト
            </button>
            <UserProfileDialog
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              onSaved={async () => {
                const { data } = await supabase.auth.getSession();
                await loadProfile(data.session);
              }}
            />
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
