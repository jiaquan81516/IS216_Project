// Looks up coordinates and addresses for the BMSG nursing room places that are not yet in
// src/app/data/bmsgRooms.js, using OpenStreetMap Nominatim, and prints rows to review.
// Run on a computer with internet access: node scripts/lookup-bmsg-coords.mjs
// Nominatim asks for at most one request per second and a real User-Agent; this script waits
// 1.2 seconds between requests. Coordinates are from OpenStreetMap contributors (ODbL).
// Always check each result against the venue's own address before adding it to bmsgRooms.js.

const PLACES = [
  "Alexandra Retail Centre Singapore",
  "Buangkok Square Singapore",
  "Forum The Shopping Mall Singapore",
  "IMM Building Jurong East Singapore",
  "Orchard Central Singapore",
  "Paragon Shopping Centre Orchard Road Singapore",
  "The Star Vista Singapore",
  "United Square Shopping Mall Singapore",
  "Institute of Mental Health Buangkok Singapore",
  "Ng Teng Fong General Hospital Singapore",
  "Serangoon Polyclinic Singapore",
  "Church of the Holy Cross Singapore",
  "Pusara Aman Mosque Singapore",
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const query of PLACES) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=2&countrycodes=sg&q=" +
    encodeURIComponent(query);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "NurtureTrack-student-project (IS216)" } });
    const rows = await res.json();
    console.log(`\n${query}`);
    if (!rows.length) console.log("  no result");
    for (const r of rows) {
      const a = r.address || {};
      const street = [a.house_number, a.road].filter(Boolean).join(" ");
      console.log(
        `  lat ${Number(r.lat).toFixed(5)}, lng ${Number(r.lon).toFixed(5)} | ${r.display_name}` +
          (street ? ` | street: ${street}` : "") +
          (a.postcode ? ` | postcode: ${a.postcode}` : ""),
      );
    }
  } catch (error) {
    console.log(`\n${query}\n  failed: ${error.message}`);
  }
  await wait(1200);
}
