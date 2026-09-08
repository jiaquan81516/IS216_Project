export function formatDate(value, locale) {
  return new Intl.DateTimeFormat(locale).format(new Date(value));
}
export function formatTime(value, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function getStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
