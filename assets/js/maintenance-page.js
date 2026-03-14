import { CONTACTS } from "./site-content.js?v=20260312a";
import { getMaintenanceMode } from "./site-settings.js?v=20260312a";

const modalRoot = document.getElementById("maintenanceContactsModal");
const modalBackdrop = document.getElementById("maintenanceContactsBackdrop");
const modalPanel = document.getElementById("maintenanceContactsPanel");
const modalCloseButtons = document.querySelectorAll("[data-maintenance-modal-close]");
const openContactsBtn = document.getElementById("openMaintenanceContactsBtn");
const contactsMount = document.getElementById("maintenanceContacts");

const visibleContacts = CONTACTS.filter((item) => ["Instagram", "Email info"].includes(item.label));

function renderContacts() {
  if (!contactsMount) return;

  contactsMount.innerHTML = visibleContacts.map((item) => `
    <a
      href="${item.href}"
      ${item.href.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}
      class="block rounded-[8px] border-2 border-black bg-white px-4 py-4 shadow-brutal transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">${item.label}</p>
      <p class="mt-2 text-base md:text-lg font-semibold break-all">${item.value}</p>
    </a>
  `).join("");
}

function getReturnUrl() {
  try {
    const from = new URL(window.location.href).searchParams.get("from");
    if (!from || !from.startsWith("/")) return "/";
    return from;
  } catch {
    return "/";
  }
}

async function syncMaintenanceState() {
  try {
    const maintenanceMode = await getMaintenanceMode();
    if (!maintenanceMode) {
      closeModal();
      window.location.replace(new URL(getReturnUrl(), window.location.origin).toString());
    }
  } catch (error) {
    console.warn("Impossibile aggiornare lo stato manutenzione in tempo reale.", error);
  }
}

function closeModal() {
  if (!modalRoot || !modalBackdrop || !modalPanel) return;
  modalRoot.classList.add("hidden");
  modalBackdrop.classList.add("opacity-0", "pointer-events-none");
  modalPanel.classList.add("translate-y-4", "opacity-0");
  document.body.classList.remove("overflow-hidden");
}

function openModal() {
  if (!modalRoot || !modalBackdrop || !modalPanel) return;
  modalRoot.classList.remove("hidden");
  requestAnimationFrame(() => {
    modalBackdrop.classList.remove("opacity-0", "pointer-events-none");
    modalPanel.classList.remove("translate-y-4", "opacity-0");
  });
  document.body.classList.add("overflow-hidden");
}

openContactsBtn?.addEventListener("click", openModal);

modalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeModal);
});

modalRoot?.addEventListener("click", (event) => {
  if (event.target === modalRoot) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalRoot && !modalRoot.classList.contains("hidden")) {
    closeModal();
  }
});

renderContacts();
syncMaintenanceState();
window.addEventListener("focus", syncMaintenanceState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncMaintenanceState();
  }
});
window.setInterval(syncMaintenanceState, 15000);
