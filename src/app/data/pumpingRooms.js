// SEED DATA for the pumping room directory. The real directory is the Firestore collection
// `pumpingRooms` (see src/app/api/rooms.js). These two rooms are shown only while that
// collection is empty, so a new deployment is not a blank page. They are placeholders from
// the team design: the addresses and the verification status are NOT confirmed, and they
// cannot be confirmed or flagged because they are not database rows.
export const SEED_ROOMS = Object.freeze([
  {
    id: "seed-smu-library",
    name: "SMU Library Nursing Room",
    address: "70 Stamford Road, Singapore 178901",
    features: ["Chair", "Power outlet", "Lockable"],
    status: "verified",
    verifiedDaysAgo: 4,
    seed: true,
  },
  {
    id: "seed-raffles-city",
    name: "Raffles City Family Room",
    address: "252 North Bridge Road, Singapore 179103",
    features: ["Chair", "Sink"],
    status: "needs verification",
    verifiedDaysAgo: null,
    seed: true,
  },
]);

// The two seed rooms have no coordinates. These come from OneMap (SMU Li Ka Shing Library,
// Raffles City) so they can sit on the map as examples. The Raffles City seed is dropped
// when the BMSG Raffles City room covers it.
export const SEED_COORDS = Object.freeze({
  "seed-smu-library": { lat: 1.29666, lng: 103.8501 },
  "seed-raffles-city": { lat: 1.29389, lng: 103.85312 },
});

// Kept under the old name so nothing that imported it has to change.
export const SAMPLE_ROOMS = SEED_ROOMS;

// Feature chips used to filter the list, and the longer set offered in the add form.
export const FILTER_FEATURES = Object.freeze(["Chair", "Power outlet", "Lockable", "Sink"]);
export const FORM_FEATURES = Object.freeze(["Chair", "Power outlet", "Lockable", "Sink", "Stroller access"]);
