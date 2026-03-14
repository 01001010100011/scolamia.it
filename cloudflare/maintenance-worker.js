const ALLOWED_EXACT_PATHS = new Set([
  "/manutenzione",
  "/manutenzione/",
  "/sitemap.xml",
  "/robots.txt",
  "/canale-whatsapp",
  "/canale-whatsapp/"
]);

function isAssetLike(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/cdn-cgi/") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".txt") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".mov") ||
    pathname.endsWith(".mp4")
  );
}

function isAllowedPath(pathname, request) {
  if (request.headers.get("x-maintenance-bypass") === "1") return true;
  if (ALLOWED_EXACT_PATHS.has(pathname)) return true;
  if (pathname === "/admin" || pathname === "/admin/") return true;
  if (pathname === "/admin-article-editor" || pathname === "/admin-article-editor/") return true;
  return isAssetLike(pathname);
}

async function fetchMaintenanceMode(env) {
  const endpoint = new URL(`${env.SUPABASE_URL}/rest/v1/site_settings`);
  endpoint.searchParams.set("select", "maintenance_mode");
  endpoint.searchParams.set("id", "eq.1");

  const response = await fetch(endpoint.toString(), {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`site_settings fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return Boolean(data?.[0]?.maintenance_mode);
}

async function renderMaintenance503(request, env) {
  const target = new URL("/manutenzione/", env.SITE_ORIGIN);
  const bypassRequest = new Request(target.toString(), request);
  const headers = new Headers(bypassRequest.headers);
  headers.set("x-maintenance-bypass", "1");

  const maintenanceResponse = await fetch(new Request(bypassRequest, { headers }));
  const body = await maintenanceResponse.text();
  const responseHeaders = new Headers(maintenanceResponse.headers);
  responseHeaders.set("cache-control", "no-store, no-cache, must-revalidate");
  responseHeaders.set("retry-after", "3600");
  responseHeaders.set("x-robots-tag", "noindex, nofollow");

  return new Response(body, {
    status: 503,
    statusText: "Service Unavailable",
    headers: responseHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (isAllowedPath(pathname, request)) {
      return fetch(request);
    }

    let maintenanceMode = false;
    try {
      maintenanceMode = await fetchMaintenanceMode(env);
    } catch (error) {
      console.warn("Maintenance worker fallback to origin:", error?.message || error);
      return fetch(request);
    }

    if (!maintenanceMode) {
      return fetch(request);
    }

    return renderMaintenance503(request, env);
  }
};
