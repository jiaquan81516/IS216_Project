export const CAREGIVER_ROLES = Object.freeze([
  { value: "grandparent", label: "Grandparent" },
  { value: "domestic-helper", label: "Domestic helper" },
  { value: "babysitter", label: "Babysitter" },
  { value: "childcare-provider", label: "Childcare provider" },
  { value: "trusted-caregiver", label: "Other trusted caregiver" },
]);

// The titles the permission switches sit under, in order.
export const PERMISSION_GROUPS = Object.freeze([
  { key: "care-log", label: "Care log", keys: ["careLogRead", "careLogAdd", "careLogEdit", "careLogMedication"] },
  { key: "instructions", label: "Care instructions", keys: ["careBrief", "feedingInstructions", "napRoutine", "allergyInfo", "medicationInfo"] },
  { key: "schedule", label: "Schedule", keys: ["appointments", "dutyView", "dutyEdit"] },
]);

export const CAREGIVER_PERMISSIONS = Object.freeze([
  { key: "careBrief", label: "View the care brief and parent contacts" },
  { key: "careLogRead", label: "View care logs" },
  { key: "careLogAdd", label: "Add care logs and notes" },
  { key: "careLogEdit", label: "Edit own care logs" },
  { key: "careLogMedication", label: "Record medication given" },
  { key: "feedingInstructions", label: "View feeding instructions" },
  { key: "allergyInfo", label: "View allergy information" },
  { key: "medicationInfo", label: "View medication instructions" },
  { key: "appointments", label: "View appointments" },
  { key: "napRoutine", label: "View nap routine" },
  { key: "dutyView", label: "View who is on duty, day and night" },
  { key: "dutyEdit", label: "Edit the day schedule" },
]);

export const DEFAULT_CAREGIVER_PERMISSIONS = Object.freeze({
  grandparent: Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: true, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: true, appointments: true, napRoutine: true, dutyView: true }),
  "domestic-helper": Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: true, appointments: false, napRoutine: true, dutyView: true }),
  babysitter: Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: false, appointments: false, napRoutine: true, dutyView: true }),
  "childcare-provider": Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: false, appointments: false, napRoutine: true, dutyView: true }),
  "trusted-caregiver": Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: false, medicationInfo: false, appointments: false, napRoutine: false, dutyView: false }),
});

export const EMPTY_CAREGIVER_PERMISSIONS = Object.freeze(
  Object.fromEntries(CAREGIVER_PERMISSIONS.map(({ key }) => [key, false])),
);

// Some permissions only make sense on top of another: editing your own logs or recording
// medication needs the right to add logs in the first place.
export const PERMISSION_NEEDS = Object.freeze({ careLogEdit: "careLogAdd", careLogMedication: "careLogAdd", dutyEdit: "dutyView" });

// What to switch on first, in words, for the hint under a locked switch.
export const PERMISSION_NEEDS_LABEL = Object.freeze({ careLogAdd: "Add care logs and notes", dutyView: "View who is on duty" });

// Switches off anything whose requirement is off, so a saved set never holds a useless combination.
export function withDependencies(permissions = {}) {
  const next = { ...permissions };
  for (const [key, needs] of Object.entries(PERMISSION_NEEDS)) if (!next[needs]) next[key] = false;
  return next;
}

export function caregiverPermissions(role, overrides = {}) {
  const defaults = DEFAULT_CAREGIVER_PERMISSIONS[role] ?? EMPTY_CAREGIVER_PERMISSIONS;
  return withDependencies(
    Object.fromEntries(CAREGIVER_PERMISSIONS.map(({ key }) => [key, overrides[key] === undefined ? defaults[key] === true : overrides[key] === true])),
  );
}

export function isPrimaryParent(member = {}) {
  // An explicit caregiver accessLevel is authoritative: a caregiver's own `role` comes from
  // CAREGIVER_ROLES (grandparent, babysitter, ...) and never collides with the parent-ish
  // strings below today, but accessLevel must still win if that ever changes, rather than
  // quietly promoting a caregiver to "primary parent" through a role-string coincidence.
  if (member.accessLevel === "caregiver") return false;
  return member.accessLevel === "parent" || ["mum", "dad", "carer", "parent", "partner"].includes(member.role);
}

// The parent contact list is stored as plain lines, "Mum: 9860 7453", so older text still reads
// fine and the caregiver's care brief shows it as it is.
export const PHONE_DIGITS = 8;
const phoneDigits = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  // A number typed/pasted with Singapore's country code ("+65 9860 7453" -> "6598607453")
  // would otherwise have its last 2 real digits truncated away instead of the prefix.
  const local = digits.length === 10 && digits.startsWith("65") ? digits.slice(2) : digits;
  return local.slice(0, PHONE_DIGITS);
};

// "98607453" becomes "9860 7453" as the person types.
export function formatPhone(value) {
  const d = phoneDigits(value);
  return d.length > 4 ? `${d.slice(0, 4)} ${d.slice(4)}` : d;
}

export function isPhoneComplete(value) {
  return phoneDigits(value).length === PHONE_DIGITS;
}

// Text to rows of { who, phone }. A line that is only a number has no name yet.
export function parseContacts(text) {
  const rows = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    const match = clean.match(/^(.*?):\s*([\d\s+-]+)$/);
    if (match) rows.push({ who: match[1].trim(), phone: formatPhone(match[2]) });
    else if (/^[\d\s+-]+$/.test(clean)) rows.push({ who: "", phone: formatPhone(clean) });
    else rows.push({ who: "", phone: "", note: clean });
  }
  return rows;
}

// Rows back to text. Rows without a number are left out, but a line that was never a number
// (an old free text note) is kept as it was.
export function serializeContacts(rows) {
  return rows
    .map((row) => (row.note ? row.note : phoneDigits(row.phone) ? `${(row.who || "Parent").trim()}: ${formatPhone(row.phone)}` : ""))
    .filter(Boolean)
    .join("\n");
}
