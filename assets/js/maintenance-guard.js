import { getMaintenanceMode } from "./site-settings.js?v=20260312a";

const ALLOWED_PATHS = [
  "/manutenzione/",
  "/canale-whatsapp/"
];

const ALLOWED_PREFIXES = [
  "/admin/",
  "/admin-article-editor/"
];

function normalizePath(pathname) {
  const raw = String(pathname || "/").trim();
  if (!raw) return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function isAllowedPath(pathname) {
  const normalized = normalizePath(pathname);
  if (ALLOWED_PATHS.includes(normalized)) return true;
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function runMaintenanceGuard() {
  const currentPath = normalizePath(window.location.pathname);
  if (isAllowedPath(currentPath)) {
    delete document.documentElement.dataset.maintenanceGuard;
    return;
  }

  try {
    const maintenanceMode = await getMaintenanceMode();
    if (!maintenanceMode) {
      delete document.documentElement.dataset.maintenanceGuard;
      return;
    }

    const targetUrl = new URL("/manutenzione/", window.location.origin);
    if (currentPath && currentPath !== "/") {
      targetUrl.searchParams.set("from", currentPath.replace(/\/$/, ""));
    }
    window.location.replace(targetUrl.toString());
    return;
  } catch (error) {
    console.warn("Maintenance guard non disponibile, continuo normalmente.", error);
  }

  delete document.documentElement.dataset.maintenanceGuard;
}

runMaintenanceGuard();
