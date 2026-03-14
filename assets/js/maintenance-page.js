import { CONTACTS } from "./site-content.js?v=20260312a";

const contactsMount = document.getElementById("maintenanceContacts");

if (contactsMount) {
  contactsMount.innerHTML = CONTACTS.map((item) => `
    <a
      href="${item.href}"
      ${item.href.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}
      class="block border-2 border-black bg-white px-4 py-3 shadow-brutal transition-transform hover:-translate-y-0.5"
    >
      <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">${item.label}</p>
      <p class="mt-1 text-base md:text-lg font-semibold break-all">${item.value}</p>
    </a>
  `).join("");
}
