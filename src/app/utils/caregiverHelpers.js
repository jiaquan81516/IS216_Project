export const CAREGIVER_ROLES = Object.freeze([
  { value: "grandparent", label: "Grandparent" },
  { value: "domestic-helper", label: "Domestic helper" },
  { value: "babysitter", label: "Babysitter" },
  { value: "childcare-provider", label: "Childcare provider" },
  { value: "trusted-caregiver", label: "Other trusted caregiver" },
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
]);

export const DEFAULT_CAREGIVER_PERMISSIONS = Object.freeze({
  grandparent: Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: true, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: true, appointments: true, napRoutine: true }),
  "domestic-helper": Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: true, appointments: false, napRoutine: true }),
  babysitter: Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: false, appointments: false, napRoutine: true }),
  "childcare-provider": Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: true, medicationInfo: false, appointments: false, napRoutine: true }),
  "trusted-caregiver": Object.freeze({ careBrief: true, careLogRead: true, careLogAdd: true, careLogEdit: false, careLogMedication: false, feedingInstructions: true, allergyInfo: false, medicationInfo: false, appointments: false, napRoutine: false }),
});

export const EMPTY_CAREGIVER_PERMISSIONS = Object.freeze(
  Object.fromEntries(CAREGIVER_PERMISSIONS.map(({ key }) => [key, false])),
);

export function caregiverPermissions(role, overrides = {}) {
  const defaults = DEFAULT_CAREGIVER_PERMISSIONS[role] ?? EMPTY_CAREGIVER_PERMISSIONS;
  return Object.fromEntries(CAREGIVER_PERMISSIONS.map(({ key }) => [key, overrides[key] === undefined ? defaults[key] === true : overrides[key] === true]));
}

export function isPrimaryParent(member = {}) {
  return member.accessLevel === "parent" || ["mum", "dad", "carer", "parent", "partner"].includes(member.role);
}
