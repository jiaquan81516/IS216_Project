// A Firestore Timestamp as "27 Oct 2026", or "" when there is none yet.
export function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date ? date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "";
}
