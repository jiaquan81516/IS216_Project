// Remembers where each tab bar's underline last was. A tab that opens another page (Support to
// Pumping rooms) builds a new tab bar there, which starts its underline from this place and
// glides to the chosen tab instead of appearing under it.
export const lastInk = new Map(); // idBase -> { left, width }
