// SAMPLE DATA. These two rooms are placeholders from the team design until the database
// exists. Addresses and verification status are not confirmed. Rooms added by a user are
// stored separately (src/v3/stores/rooms.js) and listed after these.
export const SAMPLE_ROOMS = Object.freeze([
  {
    id: "sample-smu-library",
    name: "SMU Library Nursing Room",
    address: "70 Stamford Road, Singapore 178901",
    features: ["Chair", "Power outlet", "Lockable"],
    status: "verified",
    verifiedDaysAgo: 4,
  },
  {
    id: "sample-raffles-city",
    name: "Raffles City Family Room",
    address: "252 North Bridge Road, Singapore 179103",
    features: ["Chair", "Sink"],
    status: "needs verification",
    verifiedDaysAgo: null,
  },
]);

// Feature chips used to filter the list, and the longer set offered in the add form.
export const FILTER_FEATURES = Object.freeze(["Chair", "Power outlet", "Lockable", "Sink"]);
export const FORM_FEATURES = Object.freeze(["Chair", "Power outlet", "Lockable", "Sink", "Stroller access"]);
