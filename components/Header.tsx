"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import AuthDialog from "./AuthDialog";

export default function Header() {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);

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
        .select("display_name, departments(name)")
        .eq("id", uid)
        .maybeSingle();
      const dn = (prof as any)?.display_name ?? null;
      const depn = (prof as any)?.departments?.name ?? null;
      setDisplayName(dn);
      setDepartmentName(depn);
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
            <span className="text-sm text-zinc-600">
              {displayName ?? email}
              {departmentName ? `（${departmentName}）` : ""}
            </span>
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
