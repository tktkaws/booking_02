"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BookingForm from "@/components/BookingForm";
import BookingsTable from "@/components/BookingsTable";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import CalendarShell from "@/components/calendar/CalendarShell";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [formResetKey, setFormResetKey] = useState(0);
  const [authed, setAuthed] = useState(false);
  // カレンダーから渡される初期値
  const [initDate, setInitDate] = useState<string | null>(null);
  const [initStartHHMM, setInitStartHHMM] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setAuthed(Boolean(data.session));
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthed(Boolean(session));
      });
      unsub = sub.subscription.unsubscribe;
    })();
    return () => {
      unsub?.();
    };
  }, [supabase]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setFormResetKey((key) => key + 1);
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, []);

  const onCreated = useMemo(
    () => () => {
      setRefreshKey((k) => k + 1);
      dialogRef.current?.close();
    },
    []
  );

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto w-full max-w-5xl p-6 bg-white dark:bg-black">
        <div className="mb-4 flex items-center justify-between">
          {authed && (
            <button
              type="button"
              className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
              onClick={() => dialogRef.current?.showModal()}
            >
              予約を作成
            </button>
          )}
        </div>

        {/* カレンダー（月/週/リスト） */}
        <CalendarShell
          isAuthed={authed}
          onCreateRequest={(date) => {
            // 初期値を計算し、フォームに渡す
            const yyyy = String(date.getFullYear());
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const dd = String(date.getDate()).padStart(2, "0");
            const hh = String(date.getHours()).padStart(2, "0");
            const min = Math.floor(date.getMinutes() / 15) * 15; // 15分刻みに丸め
            const mi = String(min).padStart(2, "0");
            const hhmm = `${hh}:${mi}`;
            setInitDate(`${yyyy}-${mm}-${dd}`);
            setInitStartHHMM(hhmm === "00:00" ? "09:00" : hhmm);
            dialogRef.current?.showModal();
          }}
        />

        {/* リスト表示はカレンダーのトグルから切り替え可 */}

        <dialog
          ref={dialogRef}
          className="rounded-lg p-0 w-full max-w-4xl h-[80vh] m-auto overflow-y-auto backdrop:bg-black/40"
          onClick={(e) => {
            if (e.target === dialogRef.current) dialogRef.current?.close();
          }}
        >
          <form method="dialog">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold">新規予約</h2>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="閉じる"
                className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>
          </form>
          <div className="px-4 py-4">
            <BookingForm
              key={formResetKey}
              onCreated={onCreated}
              initialDate={initDate}
              initialStartTime={initStartHHMM}
            />
          </div>
        </dialog>
      </main>
    </div>
  );
}
