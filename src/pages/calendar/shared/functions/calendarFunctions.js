export function groupEntriesByDate(entries) {
  return entries.reduce((groups, entry) => {
    const date = entry.date;
    return { ...groups, [date]: [...(groups[date] ?? []), entry] };
  }, {});
}
