function toDate(targetAt) {
  const date = new Date(targetAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDiffMs(targetAt) {
  const date = toDate(targetAt);
  if (!date) return null;
  return date.getTime() - Date.now();
}

export function getRemainingParts(targetAt) {
  const diff = getDiffMs(targetAt);
  if (diff === null) return null;
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

export function getRemainingTotals(targetAt) {
  const diff = getDiffMs(targetAt);
  if (diff === null) return null;
  if (diff <= 0) return null;

  return {
    hoursTotal: Math.floor(diff / 3600000),
    minutesTotal: Math.floor(diff / 60000),
    secondsTotal: Math.floor(diff / 1000)
  };
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
