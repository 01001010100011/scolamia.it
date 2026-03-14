import { supabase } from "./supabase-client.js?v=20260224e";

function isMissingMaintenanceColumn(error) {
  return ["42703", "PGRST204"].includes(String(error?.code || ""));
}

function normalizeSiteSettings(record) {
  return {
    id: 1,
    featuredArticleIds: Array.isArray(record?.featured_article_ids) ? record.featured_article_ids : [],
    maintenanceMode: Boolean(record?.maintenance_mode)
  };
}

export async function ensureSiteSettingsRow() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("id,featured_article_ids,maintenance_mode")
    .eq("id", 1)
    .maybeSingle();

  if (error && !isMissingMaintenanceColumn(error)) throw error;
  if (error && isMissingMaintenanceColumn(error)) {
    const fallback = await supabase
      .from("site_settings")
      .select("id,featured_article_ids")
      .eq("id", 1)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    if (fallback.data) return normalizeSiteSettings(fallback.data);

    const createdFallback = await supabase
      .from("site_settings")
      .upsert({ id: 1, featured_article_ids: [] }, { onConflict: "id" })
      .select("id,featured_article_ids")
      .single();

    if (createdFallback.error) throw createdFallback.error;
    return normalizeSiteSettings(createdFallback.data);
  }
  if (data) return normalizeSiteSettings(data);

  const { data: created, error: createError } = await supabase
    .from("site_settings")
    .upsert({ id: 1, featured_article_ids: [], maintenance_mode: false }, { onConflict: "id" })
    .select("id,featured_article_ids,maintenance_mode")
    .single();

  if (createError) throw createError;
  return normalizeSiteSettings(created);
}

export async function getSiteSettings() {
  return ensureSiteSettingsRow();
}

export async function saveSiteSettings(patch = {}) {
  const payload = {
    id: 1,
    ...(patch.featuredArticleIds ? { featured_article_ids: patch.featuredArticleIds } : {}),
    ...(typeof patch.maintenanceMode === "boolean" ? { maintenance_mode: patch.maintenanceMode } : {})
  };

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "id" })
    .select("id,featured_article_ids,maintenance_mode")
    .single();

  if (error && isMissingMaintenanceColumn(error) && typeof patch.maintenanceMode === "boolean") {
    throw new Error("La colonna maintenance_mode non e ancora presente su site_settings. Esegui il file SQL supabase/add_maintenance_mode.sql in Supabase.");
  }
  if (error) throw error;
  return normalizeSiteSettings(data);
}

export async function getMaintenanceMode() {
  const settings = await getSiteSettings();
  return settings.maintenanceMode;
}
