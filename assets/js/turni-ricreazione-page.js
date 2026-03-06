import { initRecreationTool, renderRecreationToolSection } from "./recreation-tool.js?v=20260307c";

const container = document.getElementById("recreationStandaloneContainer");

async function bootstrap() {
  if (!container) return;
  container.innerHTML = renderRecreationToolSection({
    hideTitle: true,
    introClass: "mt-2 text-base font-bold"
  });
  await initRecreationTool(null, { force: true, mountId: "recreationToolMount" });
}

bootstrap();
