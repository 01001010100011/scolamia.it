(function enforceCleanUrl() {
  try {
    const { pathname, search, hash } = window.location;
    const match = pathname.match(/^\/(.+)\.html$/);
    if (!match) return;

    const base = match[1];
    const cleanPath = base === 'index' ? '/' : `/${base}/`;
    const target = `${cleanPath}${search}${hash}`;
    if (target !== `${pathname}${search}${hash}`) {
      window.location.replace(target);
    }
  } catch (_) {
    // no-op
  }
})();
