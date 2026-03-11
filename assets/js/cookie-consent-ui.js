(function () {
  const api = window.ScolaCookieConsent;
  if (!api) return;

  const ANALYTICS_PURPOSE_HINTS = [
    "analytics",
    "analit",
    "statistic",
    "statist",
    "google analytics",
    "misurazione",
    "measurement"
  ];

  const PAGE_IS_COOKIE_POLICY = window.location.pathname.replace(/\/+$/, "") === "/cookie";
  const modalId = "cookiePreferencesModal";
  const bannerId = "cookieConsentBanner";
  let previousFocus = null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getStoredMeta() {
    return api.readStoredMeta() || api.getUnknownMeta();
  }

  function createShell() {
    if (document.getElementById("cookieConsentRoot")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="cookieConsentRoot">
        <div id="cookieConsentBackdrop" class="cookie-consent-backdrop hidden" aria-hidden="true"></div>
        <section id="${bannerId}" class="cookie-consent-banner hidden" role="dialog" aria-modal="true" aria-labelledby="cookieBannerTitle">
          <div class="cookie-consent-banner__card">
            <div class="cookie-consent-banner__eyebrow">Privacy e statistiche</div>
            <h2 id="cookieBannerTitle" class="headline cookie-consent-banner__title">La tua privacy, le tue scelte</h2>
            <p class="cookie-consent-banner__text">Usiamo cookie tecnici necessari per il funzionamento del sito e, con il tuo consenso, cookie statistici per capire come viene utilizzato il sito e migliorare i contenuti tramite Google Analytics.</p>
            <p class="cookie-consent-banner__subtext">Puoi accettare tutti i cookie, rifiutare quelli non necessari oppure scegliere le tue preferenze.</p>
            <div class="cookie-consent-banner__actions">
              <button type="button" class="cookie-consent-btn cookie-consent-btn--primary" data-cookie-action="accept-all">Accetta tutti</button>
              <button type="button" class="cookie-consent-btn cookie-consent-btn--secondary" data-cookie-action="reject-non-necessary">Rifiuta non necessari</button>
            </div>
            <button type="button" class="cookie-consent-link" data-cookie-action="open-preferences">Personalizza</button>
            <p class="cookie-consent-banner__note">Potrai modificare la tua scelta in qualsiasi momento dal link 'Preferenze cookie' che trovi in fondo al sito.</p>
          </div>
        </section>

        <section id="${modalId}" class="cookie-preferences-modal hidden" role="dialog" aria-modal="true" aria-labelledby="cookiePreferencesTitle" aria-describedby="cookiePreferencesIntro">
          <div class="cookie-preferences-modal__panel">
            <div class="cookie-preferences-modal__header">
              <div>
                <p class="cookie-consent-banner__eyebrow">Gestione del consenso</p>
                <h2 id="cookiePreferencesTitle" class="headline cookie-preferences-modal__title">Preferenze cookie</h2>
              </div>
              <button type="button" class="cookie-preferences-modal__close" data-cookie-action="close-preferences" aria-label="Chiudi preferenze cookie">×</button>
            </div>
            <p id="cookiePreferencesIntro" class="cookie-preferences-modal__intro">Puoi scegliere quali cookie autorizzare. I cookie necessari sono sempre attivi perché servono al corretto funzionamento del sito. I cookie statistici ci aiutano a migliorare il sito.</p>

            <div class="cookie-preferences-group">
              <div class="cookie-preferences-group__copy">
                <h3>Cookie necessari</h3>
                <p>Servono al funzionamento tecnico del sito e alla memorizzazione delle preferenze.</p>
              </div>
              <div class="cookie-preferences-group__control is-locked" aria-label="Cookie necessari sempre attivi">
                <span>Sempre attivi</span>
              </div>
            </div>

            <div class="cookie-preferences-group">
              <div class="cookie-preferences-group__copy">
                <h3>Cookie statistici</h3>
                <p>Ci permettono di raccogliere statistiche aggregate sull’utilizzo del sito tramite Google Analytics.</p>
              </div>
              <label class="cookie-toggle" for="cookieAnalyticsToggle">
                <span class="sr-only">Consenti cookie statistici</span>
                <input id="cookieAnalyticsToggle" type="checkbox" />
                <span class="cookie-toggle__track" aria-hidden="true"></span>
                <span class="cookie-toggle__label">Consenti cookie statistici</span>
              </label>
            </div>

            <div class="cookie-preferences-modal__actions">
              <button type="button" class="cookie-consent-btn cookie-consent-btn--secondary" data-cookie-action="save-preferences">Salva preferenze</button>
              <button type="button" class="cookie-consent-btn cookie-consent-btn--primary" data-cookie-action="accept-all">Accetta tutti</button>
              <button type="button" class="cookie-consent-btn cookie-consent-btn--ghost" data-cookie-action="reject-non-necessary">Rifiuta non necessari</button>
            </div>
          </div>
        </section>
      </div>
      `
    );
  }

  function getBanner() {
    return document.getElementById(bannerId);
  }

  function getModal() {
    return document.getElementById(modalId);
  }

  function getBackdrop() {
    return document.getElementById("cookieConsentBackdrop");
  }

  function getAnalyticsToggle() {
    return document.getElementById("cookieAnalyticsToggle");
  }

  function setBackdropVisible(visible) {
    const backdrop = getBackdrop();
    if (!backdrop) return;
    backdrop.classList.toggle("hidden", !visible);
    backdrop.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function openPreferences() {
    createShell();
    const banner = getBanner();
    const modal = getModal();
    const toggle = getAnalyticsToggle();
    const stored = getStoredMeta();

    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (toggle) toggle.checked = Boolean(stored.choices.analytics);

    banner?.classList.add("hidden");
    modal?.classList.remove("hidden");
    setBackdropVisible(true);

    const focusTarget = modal?.querySelector('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusTarget instanceof HTMLElement) focusTarget.focus();
  }

  function closePreferences() {
    const modal = getModal();
    const stored = api.readStoredMeta();
    modal?.classList.add("hidden");
    setBackdropVisible(false);

    if (!stored) {
      getBanner()?.classList.remove("hidden");
      setBackdropVisible(true);
    }

    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  function showBanner() {
    createShell();
    const banner = getBanner();
    if (!banner) return;
    banner.classList.remove("hidden");
    getModal()?.classList.add("hidden");
    setBackdropVisible(true);
  }

  function hideBanner() {
    getBanner()?.classList.add("hidden");
    if (getModal()?.classList.contains("hidden")) {
      setBackdropVisible(false);
    }
  }

  function inferAnalyticsPurposeIds() {
    const purposes = window.zaraz?.consent?.purposes || {};
    const entries = Object.entries(purposes);
    if (!entries.length) return [];

    return entries
      .filter(([id, purpose]) => {
        const haystack = `${id} ${purpose?.name || ""} ${purpose?.description || ""}`.toLowerCase();
        return ANALYTICS_PURPOSE_HINTS.some((hint) => haystack.includes(hint));
      })
      .map(([id]) => id);
  }

  function syncAnalyticsPurposeConsent(enabled) {
    const apply = () => {
      const consentApi = window.zaraz?.consent;
      if (!consentApi || typeof consentApi.set !== "function") return;
      const purposeIds = inferAnalyticsPurposeIds();
      if (!purposeIds.length) return;
      const payload = Object.fromEntries(purposeIds.map((id) => [id, Boolean(enabled)]));
      consentApi.set(payload);
      if (enabled && typeof consentApi.sendQueuedEvents === "function") {
        consentApi.sendQueuedEvents();
      }
    };

    if (window.zaraz?.consent?.APIReady) {
      apply();
      return;
    }

    document.addEventListener("zarazConsentAPIReady", apply, { once: true });
  }

  function persistAndApply(status, analyticsEnabled) {
    const meta = api.buildConsentMeta(status, {
      necessary: true,
      analytics: analyticsEnabled
    });

    api.saveMeta(meta);
    api.applyGoogleConsent(meta.choices, "update");
    syncAnalyticsPurposeConsent(meta.choices.analytics);
    hideBanner();
    closePreferences();
  }

  function handleAction(action) {
    if (action === "accept-all") {
      persistAndApply("accepted_all", true);
      return;
    }

    if (action === "reject-non-necessary") {
      persistAndApply("rejected_non_necessary", false);
      return;
    }

    if (action === "open-preferences") {
      openPreferences();
      return;
    }

    if (action === "close-preferences") {
      closePreferences();
      return;
    }

    if (action === "save-preferences") {
      const toggle = getAnalyticsToggle();
      persistAndApply("customized", Boolean(toggle?.checked));
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const actionEl = event.target.closest("[data-cookie-action]");
      if (actionEl) {
        event.preventDefault();
        handleAction(actionEl.getAttribute("data-cookie-action"));
        return;
      }

      const preferencesTrigger = event.target.closest("[data-cookie-preferences-trigger]");
      if (preferencesTrigger) {
        event.preventDefault();
        openPreferences();
      }
    });

    document.addEventListener("keydown", (event) => {
      const modal = getModal();
      if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
        closePreferences();
      }
    });

    window.addEventListener("scola-cookie-preferences:open", openPreferences);
  }

  function maybeShowBanner() {
    const stored = api.readStoredMeta();
    if (!stored) {
      showBanner();
      return;
    }

    hideBanner();
    api.applyGoogleConsent(stored.choices, "update");
    syncAnalyticsPurposeConsent(Boolean(stored.choices.analytics));
  }

  function enhanceCookiePolicyPage() {
    if (!PAGE_IS_COOKIE_POLICY) return;
    const trigger = document.querySelector("[data-cookie-policy-open]");
    if (!trigger) return;
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openPreferences();
    });
  }

  function init() {
    createShell();
    bindEvents();
    enhanceCookiePolicyPage();
    maybeShowBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
