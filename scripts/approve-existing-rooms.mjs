// Run once, in a trusted terminal with the server's Firebase environment variables:
//   node --env-file=.env scripts/approve-existing-rooms.mjs
// Marks every room saved before approval existed as approved, so parents keep seeing it.
// Rooms that already have an approval value are left alone.
import process from "node:process";

const { db } = await import("../api/_lib/admin.js");
const snapshot = await db.collection("pumpingRooms").get();
const missing = snapshot.docs.filter((doc) => !doc.data().approval);
for (let i = 0; i < missing.length; i += 400) {
  const batch = db.batch();
  for (const doc of missing.slice(i, i + 400)) batch.update(doc.ref, { approval: "approved" });
  await batch.commit();
}
console.log(`Approved ${missing.length} existing room(s). ${snapshot.size - missing.length} already had a decision.`);
process.exit(0);
