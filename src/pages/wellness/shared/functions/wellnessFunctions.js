export function sortEntriesNewestFirst(entries) {
  return [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
}
