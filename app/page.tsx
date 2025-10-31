"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import BookingForm from "@/components/BookingForm";
import BookingsTable from "@/components/BookingsTable";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

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
          <div className="flex items-center gap-3">
            <Image className="dark:invert" src="/next.svg" alt="logo" width={80} height={16} />
            <h1 className="text-xl font-semibold">ホーム</h1>
          </div>
          <button
            type="button"
            className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
            onClick={() => dialogRef.current?.showModal()}
          >
            予約を作成
          </button>
        </div>

        <BookingsTable refreshKey={refreshKey} />

        <dialog ref={dialogRef} className="rounded-lg p-0 w-full max-w-xl backdrop:bg-black/40">
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
            <BookingForm onCreated={onCreated} />
          </div>
        </dialog>
      </main>
    </div>
  );
}
