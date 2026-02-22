export const FEATURED_COUNTDOWN_SLUG = "termine-lezioni";

export const FALLBACK_COUNTDOWN_EVENTS = [
  { slug: "inizio-lezioni-2025", title: "Inizio lezioni", target_at: "2025-09-15T00:00:00+02:00", featured: false, active: true },
  { slug: "immacolata-2025", title: "Immacolata Concezione", target_at: "2025-12-08T00:00:00+01:00", featured: false, active: true },
  { slug: "inizio-vacanze-natale-2025", title: "Inizio vacanze di Natale", target_at: "2025-12-22T00:00:00+01:00", featured: false, active: true },
  { slug: "fine-vacanze-natale-2026", title: "Fine vacanze di Natale", target_at: "2026-01-06T23:59:59+01:00", featured: false, active: true },
  { slug: "inizio-vacanze-pasquali-2026", title: "Inizio vacanze pasquali", target_at: "2026-04-02T00:00:00+02:00", featured: false, active: true },
  { slug: "fine-vacanze-pasquali-2026", title: "Fine vacanze pasquali", target_at: "2026-04-07T23:59:59+02:00", featured: false, active: true },
  { slug: "festa-lavoro-2026", title: "Festa del Lavoro", target_at: "2026-05-01T00:00:00+02:00", featured: false, active: true },
  { slug: "ponte-1-giugno-2026", title: "1 giugno 2026", target_at: "2026-06-01T00:00:00+02:00", featured: false, active: true },
  { slug: "festa-repubblica-2026", title: "Festa della Repubblica", target_at: "2026-06-02T00:00:00+02:00", featured: false, active: true },
  { slug: "termine-lezioni", title: "Fine della scuola", target_at: "2026-06-08T00:00:00+02:00", featured: true, active: true }
];

export function onlyFutureEvents(events) {
  const now = Date.now();
  return events.filter((event) => {
    const date = new Date(event.target_at);
    return !Number.isNaN(date.getTime()) && date.getTime() > now;
  });
}

export function sortCountdownEvents(events) {
  const sorted = [...events].sort((a, b) => new Date(a.target_at).getTime() - new Date(b.target_at).getTime());
  const featuredIndex = sorted.findIndex((event) => event.slug === FEATURED_COUNTDOWN_SLUG || event.featured);
  if (featuredIndex > 0) {
    const [featured] = sorted.splice(featuredIndex, 1);
    sorted.unshift(featured);
  }
  return sorted;
}

