"use client";

import { useEffect, useState } from "react";

export type UserInput = {
  display_name: string;
  department_id: string;
  is_admin: boolean;
};

export type DepartmentOption = { id: string; name: string };

export default function UserForm({
  initial,
  departments,
  submitting = false,
  onSubmit,
}: {
  initial: Partial<UserInput> & { id?: string };
  departments: DepartmentOption[];
  submitting?: boolean;
  onSubmit: (data: UserInput) => void | Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [departmentId, setDepartmentId] = useState(initial.department_id ?? (departments[0]?.id ?? ""));
  const [isAdmin, setIsAdmin] = useState(Boolean(initial.is_admin));

  useEffect(() => {
    setDisplayName(initial.display_name ?? "");
    setDepartmentId(initial.department_id ?? (departments[0]?.id ?? ""));
    setIsAdmin(Boolean(initial.is_admin));
  }, [initial.display_name, initial.department_id, initial.is_admin, departments]);

  const valid = displayName.trim().length > 0 && departmentId.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ display_name: displayName.trim(), department_id: departmentId, is_admin: isAdmin });
  }

  return (
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4" />
        <span>管理者権限を付与</span>
      </label>
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

