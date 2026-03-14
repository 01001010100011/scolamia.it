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

function getMaintenanceReturnPath() {
  try {
    const from = new URL(window.location.href).searchParams.get("from");
    if (!from || !from.startsWith("/")) return "/";
    return from;
  } catch {
    return "/";
  }
}

async function runMaintenanceGuard() {
  const currentPath = normalizePath(window.location.pathname);

  try {
    const maintenanceMode = await getMaintenanceMode();
    if (currentPath === "/manutenzione/") {
      if (maintenanceMode) {
        delete document.documentElement.dataset.maintenanceGuard;
        return;
      }

      window.location.replace(new URL(getMaintenanceReturnPath(), window.location.origin).toString());
      return;
    }

    if (isAllowedPath(currentPath)) {
      delete document.documentElement.dataset.maintenanceGuard;
      return;
    }

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
