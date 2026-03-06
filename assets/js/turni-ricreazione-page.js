import { initRecreationTool, renderRecreationToolSection } from "./recreation-tool.js?v=20260307a";

const container = document.getElementById("recreationStandaloneContainer");

async function bootstrap() {
  if (!container) return;
  container.innerHTML = renderRecreationToolSection();
  await initRecreationTool(null, { force: true, mountId: "recreationToolMount" });
}

bootstrap();
