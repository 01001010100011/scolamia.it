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
  return `${parts.days} giorni ${parts.hours} ore ${parts.minutes} minuti`;
}

export function formatTargetDate(targetAt) {
  const date = toDate(targetAt);
  if (!date) return "";
  return date.toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}
