import { escapeHtml } from "./supabase-client.js?v=20260224e";

function createTokenStore() {
  const store = [];
  return {
    stash(value) {
      const token = `%%MD_TOKEN_${store.length}%%`;
      store.push(value);
      return token;
    },
    restore(text) {
      return text.replace(/%%MD_TOKEN_(\d+)%%/g, (_, idx) => store[Number(idx)] || "");
    }
  };
}

function parseInline(markdown) {
  const tokens = createTokenStore();
  let text = escapeHtml(markdown);

  text = text.replace(/`([^`]+)`/g, (_, code) => tokens.stash(`<code>${code}</code>`));

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) => tokens.stash(`<a href="${url}" target="_blank" rel="noopener" class="underline">${label}</a>`)
  );

  text = text.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "<strong>$2</strong>");
  text = text.replace(/(^|[^\w])(\*|_)(?=\S)([\s\S]*?\S)\2(?!\w)/g, "$1<em>$3</em>");

  return tokens.restore(text);
}

export function markdownToHtml(markdown) {
  const input = String(markdown || "").replace(/\r\n?/g, "\n");
  const lines = input.split("\n");
  const out = [];
  let inCode = false;
  let listType = "";

  const closeList = () => {
    if (listType) out.push(`</${listType}>`);
    listType = "";
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      closeList();
      if (!inCode) {
        out.push("<pre><code>");
      } else {
        out.push("</code></pre>");
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      out.push("<hr>");
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${parseInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      closeList();
      out.push(`<blockquote><p>${parseInline(trimmed.replace(/^>\s+/, ""))}</p></blockquote>`);
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${parseInline(ul[1])}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${parseInline(ol[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${parseInline(trimmed)}</p>`);
  }

  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}
