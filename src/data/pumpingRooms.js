// Sample data for the three pumping pages. Verified dates, parent counts, notes and
// addresses are placeholders: verify mall details before the demo.
import { ref } from "vue";

// Demo "today" (same as the Return to work page).
export const DEMO_TODAY = "2026-10-06";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parse = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// "3 Oct"
export function shortDate(iso) {
  const d = parse(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
// "Mon 28 Sep"
export function noteDate(iso) {
  const d = parse(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function daysSince(iso, today = DEMO_TODAY) {
  return Math.round((parse(today) - parse(iso)) / 86400000);
}
export function isoMinusDays(iso, days) {
  const d = parse(iso);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Feature order is the order used in lists and "Not reported" text.
export const FEATURES = [
  { key: "power", short: "power point", badge: "Power point", form: "Power point", detail: "Power points" },
  { key: "lockable", short: "lockable", badge: "Lockable", form: "Lockable door", detail: "Lockable door" },
  { key: "sink", short: "sink", badge: "Sink", form: "Sink and water", detail: "Sink and hot and cold water" },
  { key: "stroller", short: "stroller", badge: "Fits a stroller", form: "Room for a stroller", detail: "Room for a stroller" },
  { key: "fridge", short: "fridge", badge: "Fridge", form: "Fridge for milk", detail: "Fridge for milk" },
];
// Order of the rows on the detail page.
export const DETAIL_ORDER = ["power", "sink", "stroller", "lockable", "fridge"];
export const featureDef = (key) => FEATURES.find((f) => f.key === key);

export const REGIONS = ["Central", "East", "North", "West"];

// Schematic map positions are the dot centres in a 352 x 360 box.
const room = (r) => ({ notes: [], extras: "", ...r });
// f: [power, lockable, sink, stroller, fridge] as y | n | ? and counts c.
const feats = (states, counts = []) =>
  Object.fromEntries(
    FEATURES.map((f, i) => [
      f.key,
      { state: { y: "yes", n: "no", "?": "unknown" }[states[i]], count: states[i] === "?" ? 0 : (counts[i] ?? 1) },
    ]),
  );

export function createRooms() {
  return [
    room({
      id: "ion-orchard",
      name: "ION Orchard",
      region: "Central",
      address: "2 Orchard Turn, 238801",
      hours: "Open 10 AM to 10 PM.",
      levels: ["B4", "B3", "3", "4"],
      levelsLine: "Levels B4, B3, 3 and 4.",
      whereNote: "Rooms are on four levels. Look for the nursing room sign.",
      extras: "Also here: diaper and bed liner dispensers.",
      features: feats(["y", "?", "y", "y", "?"], [4, 0, 3, 2, 0]),
      status: "verified",
      verifiedOn: "2026-10-03",
      verifiedBy: 4,
      map: { x: 158, y: 168 },
      notes: [
        { id: "n1", text: "Level 4 was quiet in the early afternoon.", date: "2026-09-28", helpful: 6 },
        { id: "n2", text: "Bring a pump with a car adapter, the power points are low on the wall.", date: "2026-09-19", helpful: 3 },
        { id: "n3", text: "Room for the stroller, which made it easy.", date: "2026-09-02", helpful: 2 },
      ],
    }),
    room({
      id: "raffles-city",
      name: "Raffles City",
      region: "Central",
      address: "252 North Bridge Road, 179103",
      hours: "Open mall hours.",
      levels: ["B1", "3"],
      levelsLine: "Levels B1 and 3.",
      whereNote: "Rooms are on two levels. Look for the nursing room sign.",
      features: feats(["?", "y", "y", "n", "?"], [0, 2, 2, 1, 0]),
      status: "verified",
      verifiedOn: "2026-09-26",
      verifiedBy: 3,
      map: { x: 198, y: 238 },
      notes: [{ id: "n1", text: "The level 3 room is calmer than the basement one.", date: "2026-09-26", helpful: 2 }],
    }),
    room({
      id: "plaza-singapura",
      name: "Plaza Singapura",
      region: "Central",
      address: "68 Orchard Road, 238839",
      hours: "Open mall hours.",
      levels: ["3", "6"],
      levelsLine: "Levels 3 and 6, near the restrooms.",
      whereNote: "Rooms are on two levels, near the restrooms.",
      features: feats(["y", "y", "y", "y", "?"], [3, 2, 3, 2, 0]),
      status: "verified",
      verifiedOn: "2026-09-21",
      verifiedBy: 3,
      map: { x: 238, y: 198 },
      notes: [{ id: "n1", text: "Plenty of space and a proper changing table.", date: "2026-09-21", helpful: 4 }],
    }),
    room({
      id: "paragon",
      name: "Paragon",
      region: "Central",
      address: "290 Orchard Road, 238859",
      hours: "Open mall hours.",
      levels: ["3", "5"],
      levelsLine: "Levels 3 and 5, by the restrooms.",
      whereNote: "Rooms are on two levels, by the restrooms.",
      features: feats(["y", "y", "?", "n", "?"], [2, 1, 0, 1, 0]),
      status: "check",
      verifiedOn: "2026-08-12",
      verifiedBy: 2,
      map: { x: 128, y: 128 },
      notes: [{ id: "n1", text: "Level 5 was closed for cleaning when we visited.", date: "2026-08-12", helpful: 1 }],
    }),
    room({
      id: "vivocity",
      name: "VivoCity",
      region: "Central",
      address: "1 HarbourFront Walk, 098585",
      hours: "Open mall hours.",
      levels: ["B2", "1", "2", "3"],
      levelsLine: "Every level; the largest is on level 2 by the playground.",
      whereNote: "Every level has one. The largest is on level 2 by the playground.",
      features: feats(["y", "n", "y", "n", "?"], [4, 1, 3, 1, 0]),
      status: "verified",
      verifiedOn: "2026-09-28",
      verifiedBy: 4,
      map: { x: 148, y: 308 },
      notes: [{ id: "n1", text: "The level 2 room is big enough for two prams.", date: "2026-09-28", helpful: 5 }],
    }),
    room({
      id: "suntec-city",
      name: "Suntec City",
      region: "Central",
      address: "3 Temasek Boulevard, 038983",
      hours: "Open mall hours.",
      levels: ["3"],
      levelsLine: "Level 3, at the Kids Zone.",
      whereNote: "One room on level 3, at the Kids Zone.",
      features: feats(["?", "y", "y", "n", "?"], [0, 2, 2, 1, 0]),
      status: "check",
      verifiedOn: "2026-09-09",
      verifiedBy: 2,
      map: { x: 248, y: 268 },
      notes: [{ id: "n1", text: "Can get busy at weekends around lunch.", date: "2026-09-09", helpful: 2 }],
    }),
    room({
      id: "tampines-mall",
      name: "Tampines Mall",
      region: "East",
      address: "4 Tampines Central 5, 529510",
      hours: "Open 10 AM to 10 PM.",
      levels: ["2"],
      levelsLine: "Level 2, entry by intercom.",
      whereNote: "One room on level 2. Press the intercom to be let in.",
      features: feats(["?", "?", "y", "n", "?"], [0, 0, 2, 1, 0]),
      status: "verified",
      verifiedOn: "2026-09-30",
      verifiedBy: 2,
      map: { x: 318, y: 158 },
      notes: [{ id: "n1", text: "Staff answered the intercom quickly.", date: "2026-09-30", helpful: 3 }],
    }),
    room({
      id: "northpoint-city",
      name: "Northpoint City",
      region: "North",
      address: "1 Northpoint Drive, 768019",
      hours: "Open 10 AM to 10 PM.",
      levels: ["B2", "B1", "1", "2", "3", "4"],
      levelsLine: "Levels B2 to 4, North and South wings.",
      whereNote: "Rooms in both the North and South wings, from B2 to level 4.",
      features: feats(["y", "?", "y", "n", "?"], [3, 0, 3, 1, 0]),
      status: "verified",
      verifiedOn: "2026-10-02",
      verifiedBy: 3,
      map: { x: 168, y: 48 },
      notes: [{ id: "n1", text: "The South wing room has the better chairs.", date: "2026-10-02", helpful: 2 }],
    }),
    room({
      id: "compass-one",
      name: "Compass One",
      region: "North",
      address: "1 Sengkang Square, 545078",
      hours: "Open 10 AM to 10 PM.",
      levels: ["B1", "4"],
      levelsLine: "Level B1 and level 4.",
      whereNote: "Rooms on B1 and level 4.",
      features: feats(["?", "n", "y", "y", "?"], [0, 1, 2, 2, 0]),
      status: "verified",
      verifiedOn: "2026-09-17",
      verifiedBy: 2,
      map: { x: 308, y: 68 },
      notes: [{ id: "n1", text: "Level 4 has room for a full-size stroller.", date: "2026-09-17", helpful: 2 }],
    }),
    room({
      id: "jem",
      name: "Jem",
      region: "West",
      address: "50 Jurong Gateway Road, 608549",
      hours: "Open 10 AM to 10 PM.",
      levels: ["B1", "3", "5"],
      levelsLine: "Levels B1, 3 and 5.",
      whereNote: "Rooms on B1, level 3 and level 5.",
      features: feats(["y", "?", "n", "y", "?"], [3, 0, 1, 2, 0]),
      status: "verified",
      verifiedOn: "2026-10-05",
      verifiedBy: 3,
      map: { x: 48, y: 238 },
      notes: [{ id: "n1", text: "Level 5 was the quietest of the three.", date: "2026-10-05", helpful: 3 }],
    }),
  ];
}

// Shared, in-memory list used by all three pages.
export const rooms = ref(createRooms());

export function resetRooms() {
  rooms.value = createRooms();
}
export const getRoom = (id) => rooms.value.find((r) => r.id === id);

// Malls that can be picked on the add form. The first ten match the list; the rest are not on it yet.
const EXTRA_MALLS = [
  { name: "Funan", region: "Central", address: "107 North Bridge Road, 179105" },
  { name: "Bugis Junction", region: "Central", address: "200 Victoria Street, 188021" },
  { name: "Waterway Point", region: "North", address: "83 Punggol Central, 828761" },
  { name: "Westgate", region: "West", address: "3 Gateway Drive, 608532" },
  { name: "Century Square", region: "East", address: "2 Tampines Central 5, 529509" },
];
export function mallCatalogue() {
  const known = createRooms().map((r) => ({ name: r.name, region: r.region, address: r.address }));
  return [...known, ...EXTRA_MALLS];
}

export const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function formatLevels(levels) {
  if (!levels.length) return "No levels picked yet.";
  const word = levels.length === 1 ? "Level" : "Levels";
  const list =
    levels.length === 1
      ? levels[0]
      : `${levels.slice(0, -1).join(", ")} and ${levels[levels.length - 1]}`;
  return `${word} ${list}.`;
}

// Levels from the deepest basement up (B2, B1, 1, 2 ...).
export function sortLevels(levels) {
  const rank = (l) => (l.startsWith("B") ? -Number(l.slice(1)) : Number(l));
  return [...levels].sort((a, b) => rank(a) - rank(b));
}

// Add a new, unverified room from the add form. Returns the new room.
export function addRoom({ name, levels, states, note }) {
  const info = mallCatalogue().find((m) => m.name === name);
  let id = slugify(name);
  for (let n = 2; getRoom(id); n++) id = `${slugify(name)}-${n}`;
  const sorted = sortLevels(levels);
  const created = room({
    id,
    name,
    region: info?.region ?? "Central",
    address: info?.address ?? "",
    hours: "Open mall hours.",
    levels: sorted,
    levelsLine: formatLevels(sorted),
    whereNote: "Added by a parent. Look for the nursing room sign.",
    features: Object.fromEntries(
      FEATURES.map((f) => {
        const s = states[f.key];
        return [f.key, { state: s === "unsure" ? "unknown" : s, count: s === "unsure" ? 0 : 1 }];
      }),
    ),
    status: "unverified",
    verifiedOn: null,
    verifiedBy: 0,
    map: { x: 60 + ((rooms.value.length * 47) % 230), y: 40 + ((rooms.value.length * 83) % 280) },
    notes: note.trim() ? [{ id: "n1", text: note.trim(), date: DEMO_TODAY, helpful: 0 }] : [],
  });
  rooms.value.push(created);
  return created;
}

// Helpers shared by the list and the map.
export const yesFeatures = (r) => FEATURES.filter((f) => r.features[f.key].state === "yes");
export function notReportedText(r) {
  const names = FEATURES.filter((f) => f.key !== "stroller" && r.features[f.key].state === "unknown").map((f) => f.short);
  if (!names.length) return "";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Not reported: ${list}`;
}
export const verifiedThisMonth = (r) => r.status === "verified" && r.verifiedOn?.slice(0, 7) === DEMO_TODAY.slice(0, 7);

export const FILTERS = [
  { key: "power", label: "Power point", test: (r) => r.features.power.state === "yes" },
  { key: "lockable", label: "Lockable", test: (r) => r.features.lockable.state === "yes" },
  { key: "stroller", label: "Fits a stroller", test: (r) => r.features.stroller.state === "yes" },
  { key: "month", label: "Verified this month", test: verifiedThisMonth },
];
export function filterRooms(list, region, active) {
  return list.filter(
    (r) => (region === "All" || r.region === region) && active.every((k) => FILTERS.find((f) => f.key === k).test(r)),
  );
}

// Mei's office choices for the "Near" line and the map.
export const OFFICES = [
  { value: "Raffles Place", x: 214, y: 223 },
  { value: "Orchard", x: 150, y: 150 },
  { value: "Marina Bay", x: 262, y: 246 },
  { value: "Tampines", x: 290, y: 176 },
  { value: "Jurong Gateway", x: 76, y: 228 },
];
