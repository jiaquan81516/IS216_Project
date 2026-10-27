// Children's emergency service shown in the app: KK Women's and Children's Hospital only.
// Each entry was checked against the hospital's own web page on RETRIEVED_AT. Addresses and
// coordinates come from the OneMap public search API (Singapore Land Authority, Singapore Open
// Data Licence). A phone number is only included when the hospital's own page lists one for the
// service; none of these pages did, so phone is null and the card shows no Call link.
//
// Not listed on purpose (see docs/kids-care.md): NUH, by choice, to keep one clear place to go.
// Singapore General Hospital, Ng Teng Fong General Hospital and Sengkang General Hospital say on
// their own pages that they have no paediatric facilities and send children to KKH or NUH. Changi General Hospital, Khoo Teck Puat Hospital,
// Tan Tock Seng Hospital and Woodlands Health did not state a paediatric emergency service on the
// pages checked, so they are left out rather than guessed.

export const RETRIEVED_AT = "2026-10-11";

export const KIDS_EMERGENCY_NUMBERS = Object.freeze({
  ambulance: "995",
  nonEmergencyAmbulance: "1777",
});

export const KIDS_EMERGENCY = Object.freeze([
  {
    id: "er-kkh",
    name: "KK Women's and Children's Hospital Children's Emergency",
    address: "100 Bukit Timah Road, Basement 1, Children's Tower, Singapore 229899",
    postal: "229899",
    lat: 1.310490074290648,
    lng: 103.8468133216193,
    phone: null,
    kind: "emergency",
    type: "Children's emergency",
    note: "Treats all acute paediatric emergencies, medical, surgical and trauma. The hospital page does not list opening hours, so check before you travel.",
    sourceName: "KKH",
    sourceUrl: "https://www.kkh.com.sg/our-specialties/childrens-emergency",
    retrievedAt: RETRIEVED_AT,
  },
]);
