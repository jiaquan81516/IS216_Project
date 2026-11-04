import { describe, it, expect } from "vitest";
import {
  CAREGIVER_ROLES, PERMISSION_GROUPS, CAREGIVER_PERMISSIONS, DEFAULT_CAREGIVER_PERMISSIONS,
  EMPTY_CAREGIVER_PERMISSIONS, PERMISSION_NEEDS, PERMISSION_NEEDS_LABEL,
  withDependencies, caregiverPermissions, isPrimaryParent,
  PHONE_DIGITS, formatPhone, isPhoneComplete, parseContacts, serializeContacts,
} from "@/app/utils/caregiverHelpers";

describe("static lists", () => {
  it("CAREGIVER_ROLES has 5 frozen entries", () => {
    expect(Object.isFrozen(CAREGIVER_ROLES)).toBe(true);
    expect(CAREGIVER_ROLES).toHaveLength(5);
  });

  it("every DEFAULT_CAREGIVER_PERMISSIONS key is a real CAREGIVER_PERMISSIONS key (a role may simply omit a key, which caregiverPermissions then reads as false)", () => {
    const keys = new Set(CAREGIVER_PERMISSIONS.map((p) => p.key));
    for (const role of Object.keys(DEFAULT_CAREGIVER_PERMISSIONS)) {
      for (const key of Object.keys(DEFAULT_CAREGIVER_PERMISSIONS[role])) expect(keys.has(key)).toBe(true);
    }
  });

  it("every CAREGIVER_ROLES value has a matching DEFAULT_CAREGIVER_PERMISSIONS entry", () => {
    for (const { value } of CAREGIVER_ROLES) expect(DEFAULT_CAREGIVER_PERMISSIONS[value]).toBeTruthy();
  });

  it("every PERMISSION_GROUPS key maps to a real CAREGIVER_PERMISSIONS key", () => {
    const keys = new Set(CAREGIVER_PERMISSIONS.map((p) => p.key));
    for (const group of PERMISSION_GROUPS) for (const k of group.keys) expect(keys.has(k)).toBe(true);
  });

  it("EMPTY_CAREGIVER_PERMISSIONS is all false and covers every key", () => {
    for (const { key } of CAREGIVER_PERMISSIONS) expect(EMPTY_CAREGIVER_PERMISSIONS[key]).toBe(false);
  });

  it("every PERMISSION_NEEDS dependency target is itself a real permission key", () => {
    const keys = new Set(CAREGIVER_PERMISSIONS.map((p) => p.key));
    for (const need of Object.values(PERMISSION_NEEDS)) expect(keys.has(need)).toBe(true);
  });

  it("every need named in PERMISSION_NEEDS has a human label", () => {
    for (const need of Object.values(PERMISSION_NEEDS)) expect(PERMISSION_NEEDS_LABEL[need]).toBeTruthy();
  });
});

describe("withDependencies", () => {
  it("turns off a dependent permission when its requirement is off", () => {
    const out = withDependencies({ careLogAdd: false, careLogEdit: true, careLogMedication: true, dutyView: true, dutyEdit: true });
    expect(out.careLogEdit).toBe(false);
    expect(out.careLogMedication).toBe(false);
    expect(out.dutyEdit).toBe(true); // dutyView is on, so dutyEdit may stay on
  });

  it("turns off dutyEdit when dutyView is off", () => {
    const out = withDependencies({ dutyView: false, dutyEdit: true });
    expect(out.dutyEdit).toBe(false);
  });

  it("leaves everything alone when every requirement is already satisfied", () => {
    const input = { careLogAdd: true, careLogEdit: true, careLogMedication: true, dutyView: true, dutyEdit: true };
    expect(withDependencies(input)).toEqual(input);
  });

  it("does not mutate the input object", () => {
    const input = { careLogAdd: false, careLogEdit: true };
    const copy = { ...input };
    withDependencies(input);
    expect(input).toEqual(copy);
  });

  it("treats a missing requirement key as off (falsy), so the dependent is also forced off", () => {
    expect(withDependencies({ careLogEdit: true }).careLogEdit).toBe(false);
  });
});

describe("caregiverPermissions", () => {
  it("uses the role's defaults when no overrides are given", () => {
    const out = caregiverPermissions("grandparent");
    expect(out.careBrief).toBe(true);
    expect(out.medicationInfo).toBe(true);
    expect(out.appointments).toBe(true);
  });

  it("falls back to EMPTY permissions for an unknown role", () => {
    const out = caregiverPermissions("unknown-role");
    for (const { key } of CAREGIVER_PERMISSIONS) expect(out[key]).toBe(false);
  });

  it("an explicit override replaces the role default for that key", () => {
    const out = caregiverPermissions("babysitter", { careLogMedication: true, careLogAdd: true });
    expect(out.careLogMedication).toBe(true);
  });

  it("enforces dependencies even on the overridden result", () => {
    // trusted-caregiver defaults careLogAdd to true; override it off and medication should follow.
    const out = caregiverPermissions("trusted-caregiver", { careLogAdd: false, careLogMedication: true });
    expect(out.careLogMedication).toBe(false);
  });

  it("coerces a non-boolean override value to a strict boolean", () => {
    const out = caregiverPermissions("babysitter", { careLogAdd: 1, careBrief: 0 });
    expect(out.careLogAdd).toBe(false); // 1 !== true, so this override reads as false
    expect(out.careBrief).toBe(false);
  });
});

describe("isPrimaryParent", () => {
  it("is true when accessLevel is 'parent', regardless of role", () => {
    expect(isPrimaryParent({ accessLevel: "parent", role: "babysitter" })).toBe(true);
  });

  it("is true for known parent-ish role strings when accessLevel is absent", () => {
    for (const role of ["mum", "dad", "carer", "parent", "partner"]) {
      expect(isPrimaryParent({ role })).toBe(true);
    }
  });

  it("is false for a caregiver accessLevel even if role happens to collide", () => {
    expect(isPrimaryParent({ accessLevel: "caregiver", role: "mum" })).toBe(false);
  });

  it("is false for an unrelated role with no accessLevel", () => {
    expect(isPrimaryParent({ role: "grandparent" })).toBe(false);
    expect(isPrimaryParent({})).toBe(false);
    expect(isPrimaryParent()).toBe(false);
  });
});

describe("formatPhone / isPhoneComplete", () => {
  it("formats 8 digits as 'XXXX XXXX'", () => {
    expect(formatPhone("98607453")).toBe("9860 7453");
  });

  it("strips non-digit characters first", () => {
    expect(formatPhone("+65 9860-7453")).toBe("9860 7453"); // country code digits get truncated to 8
  });

  it("truncates to PHONE_DIGITS (8) digits", () => {
    expect(PHONE_DIGITS).toBe(8);
    expect(formatPhone("986074531234")).toBe("9860 7453");
  });

  it("leaves 4 or fewer digits unspaced", () => {
    expect(formatPhone("986")).toBe("986");
    expect(formatPhone("9860")).toBe("9860");
  });

  it("isPhoneComplete requires exactly 8 digits", () => {
    expect(isPhoneComplete("98607453")).toBe(true);
    expect(isPhoneComplete("9860745")).toBe(false);
    expect(isPhoneComplete("")).toBe(false);
    expect(isPhoneComplete(null)).toBe(false);
  });
});

describe("parseContacts", () => {
  it("parses a 'Name: number' line", () => {
    expect(parseContacts("Mum: 9860 7453")).toEqual([{ who: "Mum", phone: "9860 7453" }]);
  });

  it("parses several lines", () => {
    const rows = parseContacts("Mum: 98607453\nDad: 91234567");
    expect(rows).toEqual([{ who: "Mum", phone: "9860 7453" }, { who: "Dad", phone: "9123 4567" }]);
  });

  it("parses a bare number with no name", () => {
    expect(parseContacts("98607453")).toEqual([{ who: "", phone: "9860 7453" }]);
  });

  it("keeps free-text notes (no colon+number pattern) as a note row", () => {
    expect(parseContacts("Call the clinic directly")).toEqual([{ who: "", phone: "", note: "Call the clinic directly" }]);
  });

  it("skips blank lines", () => {
    expect(parseContacts("Mum: 98607453\n\n\nDad: 91234567")).toHaveLength(2);
  });

  it("trims whitespace around name and line", () => {
    expect(parseContacts("  Mum :  9860 7453  ")).toEqual([{ who: "Mum", phone: "9860 7453" }]);
  });

  it("returns [] for empty input", () => {
    expect(parseContacts("")).toEqual([]);
    expect(parseContacts(undefined)).toEqual([]);
  });

  it("handles a name that itself contains punctuation before the final colon", () => {
    expect(parseContacts("Dr. Tan: 98607453")).toEqual([{ who: "Dr. Tan", phone: "9860 7453" }]);
  });
});

describe("serializeContacts", () => {
  it("writes a 'Name: number' line for a row with a phone", () => {
    expect(serializeContacts([{ who: "Mum", phone: "9860 7453" }])).toBe("Mum: 9860 7453");
  });

  it("defaults an unnamed phone row to 'Parent'", () => {
    expect(serializeContacts([{ who: "", phone: "9860 7453" }])).toBe("Parent: 9860 7453");
  });

  it("keeps a free-text note row verbatim", () => {
    expect(serializeContacts([{ who: "", phone: "", note: "Call the clinic directly" }])).toBe("Call the clinic directly");
  });

  it("drops a row with no usable phone and no note", () => {
    expect(serializeContacts([{ who: "Mum", phone: "" }])).toBe("");
  });

  it("joins multiple rows with newlines", () => {
    const text = serializeContacts([{ who: "Mum", phone: "9860 7453" }, { who: "Dad", phone: "9123 4567" }]);
    expect(text).toBe("Mum: 9860 7453\nDad: 9123 4567");
  });

  it("round-trips through parseContacts", () => {
    const original = "Mum: 9860 7453\nDad: 9123 4567\nCall the clinic directly";
    expect(serializeContacts(parseContacts(original))).toBe(original);
  });
});
