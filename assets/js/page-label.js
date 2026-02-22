function inferPageLabel() {
  const fromBody = document.body?.dataset?.pageTitle?.trim();
  if (fromBody) return fromBody;

  const fromTitle = document.title.split("-")[0]?.trim();
  if (fromTitle) return fromTitle;

  const path = window.location.pathname.split("/").pop() || "index.html";
  const map = {
    "index.html": "Home",
    "archivio.html": "Articoli",
    "agenda.html": "Agenda",
    "contatti.html": "Contatti",
    "ricerca.html": "Ricerca",
    "article.html": "Articolo",
    "countdown.html": "Countdown",
    "countdown-detail.html": "Countdown",
    "admin.html": "Admin"
  };
  return map[path] || "Pagina";
}

const label = inferPageLabel();
document.querySelectorAll("[data-page-label]").forEach((node) => {
  node.textContent = label;
});
