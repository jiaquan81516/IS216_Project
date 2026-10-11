// Pure helpers for the pumping room directory.

const query = (room) => encodeURIComponent(`${room.name}, ${room.address}`);

export function mapEmbedUrl(room) {
  return "https://www.google.com/maps?q=" + query(room) + "&output=embed";
}

export function mapOpenUrl(room) {
  return "https://www.google.com/maps/search/?api=1&query=" + query(room);
}

export function calendarUrl(room) {
  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
    encodeURIComponent(`Pumping at ${room.name}`) +
    "&location=" +
    encodeURIComponent(room.address) +
    "&details=" +
    encodeURIComponent("Planned visit from NurtureTrack")
  );
}

export function statusText(room) {
  if (room.status !== "verified") return "Needs verification";
  const d = room.verifiedDaysAgo;
  if (d === 0) return "Verified today";
  if (d === 1) return "Verified 1 day ago";
  return `Verified ${d ?? 0} days ago`;
}

// status: "all" | "verified" | "needs verification". Features combine with AND.
export function filterRooms(rooms, { status = "all", features = [], search = "" } = {}) {
  const q = String(search).trim().toLowerCase();
  return rooms.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!features.every((f) => r.features.includes(f))) return false;
    if (q && !`${r.name} ${r.address}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
