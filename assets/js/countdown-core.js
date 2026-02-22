function toDate(targetAt) {
  const date = new Date(targetAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRemainingParts(targetAt) {
  const date = toDate(targetAt);
  if (!date) return null;

  const diff = date.getTime() - Date.now();
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

export function formatCountdown(targetAt) {
  const parts = getRemainingParts(targetAt);
  if (!parts) return "Evento concluso";
  return `${parts.days} giorni ${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}:${String(parts.seconds).padStart(2, "0")}`;
}

export function formatTargetDate(targetAt) {
  const date = toDate(targetAt);
  if (!date) return "";
  return date.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

