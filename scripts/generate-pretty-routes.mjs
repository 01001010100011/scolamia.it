import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const ROUTES = [
  { source: "agenda.html", route: "agenda" },
  { source: "agenda-detail.html", route: "agenda-detail" },
  { source: "archivio.html", route: "archivio" },
  { source: "article.html", route: "article" },
  { source: "contatti.html", route: "contatti" },
  { source: "countdown.html", route: "countdown" },
  { source: "countdown-detail.html", route: "countdown-detail" },
  { source: "turni-ricreazione.html", route: "turni-ricreazione" },
  { source: "ricerca.html", route: "ricerca" },
  { source: "admin.html", route: "admin" },
  { source: "admin-article-editor.html", route: "admin-article-editor" }
];

async function copyRoute({ source, route }) {
  const sourcePath = path.join(ROOT, source);
  const targetDir = path.join(ROOT, route);
  const targetPath = path.join(targetDir, "index.html");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function main() {
  for (const item of ROUTES) {
    await copyRoute(item);
  }
  console.log("Pretty routes generated");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
