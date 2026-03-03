import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

const renderer = new marked.Renderer();

renderer.link = ({ href, title, text }) => {
  const safeHref = String(href || "");
  const safeTitle = title ? ` title="${String(title).replace(/"/g, "&quot;")}"` : "";
  if (/^https?:\/\//i.test(safeHref)) {
    return `<a href="${safeHref}" target="_blank" rel="noopener" class="underline"${safeTitle}>${text}</a>`;
  }
  return `<a href="${safeHref}" class="underline"${safeTitle}>${text}</a>`;
};

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer
});

export function markdownToHtml(markdown) {
  return marked.parse(String(markdown || ""));
}
