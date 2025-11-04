import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

function normalizeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function useCompanyColors() {
  const supabase = useMemo(getBrowserSupabaseClient, []);
  const [companyDefault, setCompanyDefault] = useState<string | null>(null);
  const [companyOverride, setCompanyOverride] = useState<string | null>(null);
  const [tagOverrides, setTagOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let abort = false;
    async function loadSettings() {
      const { data: setting } = await supabase.from("settings").select("company_color").maybeSingle();
      const col = (setting as any)?.company_color as string | undefined;
      if (!abort) setCompanyDefault(normalizeColor(col ?? null));
    }
    async function loadProfileOverride() {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        if (!abort) {
          setCompanyOverride(null);
          setTagOverrides({});
        }
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("color_settings")
        .eq("id", uid)
        .maybeSingle();
      const cs = (prof as any)?.color_settings as Record<string, any> | undefined;
      const override = normalizeColor((cs?.company_color as string | null | undefined) ?? null);
      const tagMap = (cs?.tag_colors as Record<string, string> | undefined) ?? {};
      const normalized: Record<string, string> = {};
      Object.entries(tagMap).forEach(([key, value]) => {
        const norm = normalizeColor(value);
        if (norm) normalized[key] = norm;
      });
      if (!abort) {
        setCompanyOverride(override);
        setTagOverrides(normalized);
      }
    }

    // 初回ロード
    loadSettings();
    loadProfileOverride();

    // 設定/プロフィールの更新イベントにフック
    const onSettingsUpdated = () => loadSettings();
    const onProfileUpdated = () => loadProfileOverride();
    window.addEventListener("settings-updated", onSettingsUpdated as EventListener);
    window.addEventListener("profile-updated", onProfileUpdated as EventListener);

    return () => {
      abort = true;
      window.removeEventListener("settings-updated", onSettingsUpdated as EventListener);
      window.removeEventListener("profile-updated", onProfileUpdated as EventListener);
    };
  }, [supabase]);

  return { companyDefault, companyOverride, tagOverrides } as const;
}
