// HAND PICKED STARTER LIST of well known Singapore shopping malls. This is NOT a government
// dataset. No official open dataset of Singapore malls with nursing or lactation rooms could be
// found (see docs/pumping-rooms.md), so these 23 malls were chosen by hand.
//
// Coordinates and addresses come from the OneMap public search API
// (https://www.onemap.gov.sg/api/common/elastic/search, Singapore Land Authority, Singapore
// Open Data Licence v1.0), looked up on 2026-10-11. Being a mall does NOT prove it has a
// pumping or nursing room, so every entry here is shown as "Mall, nursing room not confirmed"
// and is never marked verified.
export const MALLS_SOURCE = Object.freeze({
  name: "Hand picked starter list of Singapore malls, coordinates from OneMap",
  url: "https://www.onemap.gov.sg/",
  licence: "Singapore Open Data Licence v1.0 (OneMap coordinates)",
  retrieved: "2026-10-11",
});

export const FALLBACK_MALLS = Object.freeze([
  { name: "Raffles City Shopping Centre", address: "252 North Bridge Road, Singapore 179103", lat: 1.29389, lng: 103.85312 },
  { name: "Suntec City Mall", address: "3 Temasek Boulevard, Singapore 038983", lat: 1.29593, lng: 103.85901 },
  { name: "Marina Square", address: "6 Raffles Boulevard, Singapore 039594", lat: 1.29186, lng: 103.85858 },
  { name: "ION Orchard", address: "2 Orchard Turn, Singapore 238801", lat: 1.30398, lng: 103.83203 },
  { name: "Ngee Ann City", address: "391 Orchard Road, Singapore 238872", lat: 1.30224, lng: 103.83518 },
  { name: "Plaza Singapura", address: "68 Orchard Road, Singapore 238839", lat: 1.30075, lng: 103.84505 },
  { name: "Funan", address: "107 North Bridge Road, Singapore 179105", lat: 1.29135, lng: 103.84999 },
  { name: "City Square Mall", address: "180 Kitchener Road, Singapore 208539", lat: 1.31142, lng: 103.85662 },
  { name: "Bugis Junction", address: "200 Victoria Street, Singapore 188021", lat: 1.29911, lng: 103.85541 },
  { name: "Great World", address: "1 Kim Seng Promenade, Singapore 237994", lat: 1.29342, lng: 103.83202 },
  { name: "Tiong Bahru Plaza", address: "302 Tiong Bahru Road, Singapore 168732", lat: 1.28646, lng: 103.82702 },
  { name: "VivoCity", address: "1 HarbourFront Walk, Singapore 098585", lat: 1.26429, lng: 103.8223 },
  { name: "JEM", address: "50 Jurong Gateway Road, Singapore 608549", lat: 1.33329, lng: 103.74328 },
  { name: "Jurong Point", address: "1 Jurong West Central 2, Singapore 648886", lat: 1.33945, lng: 103.70669 },
  { name: "Causeway Point", address: "1 Woodlands Square, Singapore 738099", lat: 1.43607, lng: 103.78598 },
  { name: "Northpoint City", address: "1 Northpoint Drive, Singapore 768019", lat: 1.4279, lng: 103.83618 },
  { name: "AMK Hub", address: "53 Ang Mo Kio Avenue 3, Singapore 569933", lat: 1.36939, lng: 103.84848 },
  { name: "NEX", address: "23 Serangoon Central, Singapore 556083", lat: 1.35077, lng: 103.8723 },
  { name: "Paya Lebar Quarter", address: "10 Paya Lebar Road, Singapore 409057", lat: 1.31771, lng: 103.89341 },
  { name: "Parkway Parade", address: "80 Marine Parade Road, Singapore 449269", lat: 1.30107, lng: 103.90528 },
  { name: "Bedok Mall", address: "311 New Upper Changi Road, Singapore 467360", lat: 1.32474, lng: 103.92926 },
  { name: "Tampines Mall", address: "4 Tampines Central 5, Singapore 529510", lat: 1.35253, lng: 103.9447 },
  { name: "Waterway Point", address: "83 Punggol Central, Singapore 828761", lat: 1.40648, lng: 103.90211 },
]);

// The two seed rooms in src/app/data/pumpingRooms.js have no coordinates. These come from
// OneMap (SMU Li Ka Shing Library, Raffles City) so they can sit on the map as examples.
export const SEED_COORDS = Object.freeze({
  "seed-smu-library": { lat: 1.29666, lng: 103.8501 },
  "seed-raffles-city": { lat: 1.29389, lng: 103.85312 },
});
