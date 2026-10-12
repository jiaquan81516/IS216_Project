// Nursing rooms listed in the Breastfeeding Mothers' Support Group (BMSG) Nursing Room
// Directory. BMSG is a charity; the listings are contributed by its members and parents, and
// BMSG does not have jurisdiction over the rooms. This is NOT government data.
//
// - Nursing room facts (type, what is available, location text, parent feedback) are copied from
//   the directory as retrieved on 2026-10-11 (page last updated 2026-04-13).
// - Coordinates and addresses are reused from the earlier hand checked OneMap lookups (OneMap,
//   Singapore Land Authority, Singapore Open Data Licence v1.0). See docs/pumping-rooms.md for
//   the entries that are not here yet and why, and for how to add one by hand.
// - Left out on purpose: the Embassy of the Republic of the Philippines in Singapore, because it
//   is not a place the public can walk into.
export const BMSG_SOURCE = Object.freeze({
  name: "Breastfeeding Mothers' Support Group, Nursing Room Directory",
  shortName: "BMSG Nursing Room Directory",
  url: "https://breastfeeding.org.sg/nursing-room-directory/",
  retrieved: "2026-10-11",
  pageUpdated: "2026-04-13",
  note: "Listings are contributed by members and parents; BMSG does not have jurisdiction over these rooms.",
});

// BMSG "What's available" items that match a key the app already filters on.
const FEATURE_OF = Object.freeze({
  "Lockable nursing cubicle(s)": "Lockable",
  "Electrical power points": "Power outlet",
  "Wash basin": "Sink",
  "Suitable for a single pram": "Stroller access",
  "Suitable for a double pram": "Stroller access",
});

const FEATURE_ORDER = ["Chair", "Power outlet", "Lockable", "Sink", "Stroller access"];

// One row per directory entry, in the order BMSG lists them. `available` is BMSG's own wording.
const ROWS = [
  {
    name: "Raffles City Shopping Centre",
    address: "252 North Bridge Road, Singapore 179103",
    lat: 1.29389,
    lng: 103.85312,
    kind: "mall",
    type: "Nursing room",
    level: "Level 3",
    available: [
      "Diaper changing station",
      "Lockable nursing cubicle(s)",
      "Wash basin",
      "Electrical power points",
      "Water dispenser",
      "Multiple nursing cubicles available",
      "Family-friendly access",
    ],
    feedback: "Spacious. Two lockable nursing rooms within the parents' room.",
  },
  {
    name: "Suntec Convention Centre",
    address: "3 Temasek Boulevard, Singapore 038983",
    lat: 1.29593,
    lng: 103.85901,
    kind: "mall",
    type: "Nursing room",
    level: 'Tower 3, Level 1 (near Toys "R" Us); Tower 3, Level 2 (near Toys "R" Us); Level 3 (beside the Concierge)',
    available: [
      "Diaper changing station",
      "Suitable for a single pram",
      "Wash basin",
      "Electrical power points",
      "Water dispenser",
      "Private room for one parent and baby",
    ],
    feedback: "Convenient for breastfeeding or expressing milk while attending events.",
  },
  {
    name: "VivoCity",
    address: "1 HarbourFront Walk, Singapore 098585",
    lat: 1.26429,
    lng: 103.8223,
    kind: "mall",
    type: "Nursing room",
    level: "Level 2",
    available: [
      "Diaper changing station",
      "Lockable nursing cubicle(s)",
      "Suitable for a double pram",
      "Wash basin",
      "Electrical power points",
      "Water dispenser",
      "Nursing area separated from changing area",
      "Multiple nursing cubicles available",
      "Family-friendly access",
    ],
    feedback: "Well ventilated and comfortable. Seating available for accompanying family members. Conveniently located beside the playground.",
  },
  {
    name: "Waterway Point",
    address: "83 Punggol Central, Singapore 828761",
    lat: 1.40648,
    lng: 103.90211,
    kind: "mall",
    type: "Nursing room",
    level: "Basement 1 to Level 2",
    available: [
      "Diaper changing station",
      "Lockable nursing cubicle(s)",
      "Suitable for a single pram",
      "Suitable for a double pram",
      "Wash basin",
      "Water dispenser",
      "Nursing area separated from changing area",
      "Multiple nursing cubicles available",
      "Family-friendly access",
    ],
    feedback: "Clean environment. Vibrant and family-friendly design. Waiting area available for accompanying family members.",
  },
  {
    name: "Parkway Parade",
    address: "80 Marine Parade Road, Singapore 449269",
    lat: 1.30107,
    lng: 103.90528,
    kind: "mall",
    type: "Nursing room",
    level: "Basement 1 (near Japan Home); Level 1 (near HOOGA); Level 2 (near 6 Elements Hair Spa); Level 3 (near Robert Piano)",
    available: [
      "Diaper changing station",
      "Lockable nursing cubicle(s)",
      "Electrical power points",
      "Water dispenser",
      "Nursing area separated from changing area",
      "Private room for one parent and baby",
      "Family-friendly access",
    ],
    feedback: "",
  },
  {
    // Takashimaya is inside Ngee Ann City, so it uses the Ngee Ann City address and point.
    name: "Takashimaya",
    address: "391 Orchard Road, Singapore 238872",
    lat: 1.30224,
    lng: 103.83518,
    kind: "mall",
    type: "Nursing room",
    level: "",
    available: [
      "Diaper changing station",
      "Lockable nursing cubicle(s)",
      "Suitable for a single pram",
      "Suitable for a double pram",
      "Wash basin",
      "Electrical power points",
      "Water dispenser",
      "Nursing area separated from changing area",
      "Private room for one parent and baby",
      "Multiple nursing cubicles available",
      "Family-friendly access",
    ],
    feedback: "Spacious, clean and well-equipped. Staff presence helps maintain the space.",
  },
];

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toRoom(row) {
  const features = [];
  const facilities = [];
  for (const item of row.available) {
    const feature = FEATURE_OF[item];
    if (feature) {
      if (!features.includes(feature)) features.push(feature);
    } else {
      facilities.push(item);
    }
  }
  features.sort((a, b) => FEATURE_ORDER.indexOf(a) - FEATURE_ORDER.indexOf(b));
  return Object.freeze({
    id: `bmsg-${slug(row.name)}`,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    kind: row.kind,
    details: row.level ? `${row.type}, ${row.level}` : row.type,
    features: Object.freeze(features),
    facilities: Object.freeze(facilities),
    feedback: row.feedback,
    source: BMSG_SOURCE.name,
    sourceUrl: BMSG_SOURCE.url,
    status: "verified",
    verifiedOn: BMSG_SOURCE.retrieved,
  });
}

export const BMSG_ROOMS = Object.freeze(ROWS.map(toRoom));
