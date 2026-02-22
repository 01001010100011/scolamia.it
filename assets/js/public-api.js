import { supabase } from "./supabase-client.js";

export const CONTACTS = [
  { label: "Redazione studenti", value: "redazione.studenti@scolamia-demo.it", href: "mailto:redazione.studenti@scolamia-demo.it" },
  { label: "Supporto tecnico", value: "supporto.tech@scolamia-demo.it", href: "mailto:supporto.tech@scolamia-demo.it" },
  { label: "Segreteria", value: "segreteria@scolamia-demo.it", href: "mailto:segreteria@scolamia-demo.it" },
  { label: "Instagram", value: "@scolamia_demo", href: "https://instagram.com/scolamia_demo" }
];

export async function getPublishedArticles() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,category,excerpt,content,image_url,published,created_at,updated_at,attachments")
    .eq("published", true)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getArticleById(id, includeUnpublished = false) {
  let query = supabase
    .from("articles")
    .select("id,title,category,excerpt,content,image_url,published,created_at,updated_at,attachments")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (!includeUnpublished) {
    query = query.eq("published", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || null;
}

export async function getFeaturedArticleIds() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("featured_article_ids")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return Array.isArray(data?.featured_article_ids) ? data.featured_article_ids : [];
}

export async function getAgendaEvents() {
  const { data, error } = await supabase
    .from("agenda_events")
    .select("id,title,category,date,description,created_at,updated_at")
    .order("date", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCountdownEvents() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("school_events")
    .select("slug,title,target_at,featured,active")
    .eq("active", true)
    .not("slug", "like", "fine-%")
    .gte("target_at", nowIso)
    .order("target_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCountdownEventBySlug(slug) {
  const { data, error } = await supabase
    .from("school_events")
    .select("slug,title,target_at,featured,active")
    .eq("slug", slug)
    .eq("active", true)
    .not("slug", "like", "fine-%")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function countdownDateTokens(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const longParts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).formatToParts(date);

  const numericParts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).formatToParts(date);

  const day = longParts.find((part) => part.type === "day")?.value || "";
  const monthLong = longParts.find((part) => part.type === "month")?.value || "";
  const year = longParts.find((part) => part.type === "year")?.value || "";
  const monthNum = numericParts.find((part) => part.type === "month")?.value || "";

  const dd = day.padStart(2, "0");
  const mm = monthNum.padStart(2, "0");

  return [
    `${dd}/${mm}/${year}`,
    `${day}/${monthNum}/${year}`,
    `${day} ${monthLong} ${year}`,
    `${day} ${monthLong}`
  ].join(" ");
}

export function queryMatches(text, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(text).includes(normalizedQuery);
}

export function dateTokens(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${value} ${date.toLocaleDateString("it-IT")} ${date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}`;
}
