"use client";

import { useEffect, useMemo, useState } from "react";

export type DepartmentInput = {
  name: string;
  default_color: string;
};

export default function DepartmentForm({
  initial,
  onSubmit,
  submitting = false,
}: {
  initial?: Partial<DepartmentInput>;
  onSubmit: (data: DepartmentInput) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const initialColor = useMemo(
    () => normalizeColor(initial?.default_color ?? "#64748b"),
    [initial?.default_color]
  );
  const [colorText, setColorText] = useState(initialColor);
  const [colorPick, setColorPick] = useState(initialColor);

  useEffect(() => {
    setName(initial?.name ?? "");
    const nc = normalizeColor(initial?.default_color ?? "#64748b");
    setColorText(nc);
    setColorPick(nc);
  }, [initial?.name, initial?.default_color]);

  function normalizeColor(v: string): string {
    if (!v) return "#64748b";
    const s = v.trim();
    if (/^#([0-9a-fA-F]{6})$/.test(s)) return s.toLowerCase();
    if (/^#([0-9a-fA-F]{3})$/.test(s)) {
      // expand shorthand #abc -> #aabbcc
      const r = s[1];
      const g = s[2];
      const b = s[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return "#64748b";
  }

  function handleTextChange(v: string) {
    setColorText(v);
    const valid = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim());
    if (valid) setColorPick(normalizeColor(v));
  }

  function handlePickChange(v: string) {
    setColorPick(v);
    setColorText(v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const color = normalizeColor(colorText);
    await onSubmit({ name: name.trim(), default_color: color });
  }

  const valid = name.trim().length > 0 && /^#([0-9a-fA-F]{6})$/.test(normalizeColor(colorText));

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block">部署名</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block">カラー（カラーピッカー）</span>
          <input
            type="color"
            value={colorPick}
            onChange={(e) => handlePickChange(e.target.value)}
            className="h-10 w-20 cursor-pointer rounded border px-1"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">カラー（テキスト #rrggbb）</span>
          <input
            type="text"
            value={colorText}
            onChange={(e) => handleTextChange(e.target.value)}
            className="w-full rounded border px-3 py-2 font-mono"
            placeholder="#64748b"
          />
        </label>
      </div>
      <div>
        <button
          type="submit"
          disabled={!valid || submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

