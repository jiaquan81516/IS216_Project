import { describe, it, expect, vi, beforeEach } from "vitest";
import { getHousehold, getHouseholdMembers, getUserProfile } from "@/api/profile";
import { hasAdminClaim } from "@/api/adminAccess";
import { setDisplay } from "@/app/composables/usePrefs";
import { useHome, firstNameOf, displayName } from "@/app/composables/useHome";

const state = vi.hoisted(() => ({ user: { uid: "me1", displayName: "Jess Tan", email: "jess@example.com" } }));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: state.user } }) }));
vi.mock("@/api/profile", () => ({
  getUserProfile: vi.fn(),
  getHousehold: vi.fn(),
  getHouseholdMembers: vi.fn(),
  babySummary: vi.fn(() => ({ line: "" })),
}));
vi.mock("@/api/adminAccess", () => ({ hasAdminClaim: vi.fn().mockResolvedValue(false) }));
vi.mock("@/app/composables/usePrefs", () => ({ setDisplay: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { uid: "me1", displayName: "Jess Tan", email: "jess@example.com" };
  hasAdminClaim.mockResolvedValue(false);
});

describe("firstNameOf", () => {
  it("takes the first word of the display name", () => {
    expect(firstNameOf("Jess Tan", "")).toBe("Jess");
  });
  it("falls back to the email's local part with no display name", () => {
    expect(firstNameOf("", "jess@example.com")).toBe("jess");
  });
  it("falls back to 'there' with neither", () => {
    expect(firstNameOf("", "")).toBe("there");
    expect(firstNameOf(null, null)).toBe("there");
  });
});

describe("displayName", () => {
  it("capitalises only the first letter", () => {
    expect(displayName("jess")).toBe("Jess");
    expect(displayName("JESS")).toBe("JESS");
  });
  it("handles an empty/null value", () => {
    expect(displayName("")).toBe("");
    expect(displayName(null)).toBe("");
  });
});

describe("useHome", () => {
  it("loads the profile, household and members for a parent with a household", async () => {
    getUserProfile.mockResolvedValue({ householdId: "house1", displayName: "Jess", email: "jess@example.com", role: "parent", settings: {} });
    getHousehold.mockResolvedValue({ inviteCode: "ABC123" });
    getHouseholdMembers.mockResolvedValue([{ uid: "me1", accessLevel: "parent" }, { uid: "p1", accessLevel: "parent", displayName: "Alex" }]);
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.error.value).toBe("");
    expect(home.householdId.value).toBe("house1");
    expect(home.inviteCode.value).toBe("ABC123");
    expect(home.partner.value).toMatchObject({ uid: "p1", firstName: "Alex" });
    expect(setDisplay).toHaveBeenCalled();
  });

  it("me resolves firstName/displayName/email from the profile, falling back to the auth user", async () => {
    getUserProfile.mockResolvedValue({ householdId: "house1", settings: {} });
    getHousehold.mockResolvedValue({});
    getHouseholdMembers.mockResolvedValue([]);
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.me.value).toMatchObject({ uid: "me1", firstName: "Jess", displayName: "Jess Tan", email: "jess@example.com" });
  });

  it("partner excludes caregivers and myself, keeping only the other primary parent", async () => {
    getUserProfile.mockResolvedValue({ householdId: "house1", settings: {} });
    getHousehold.mockResolvedValue({});
    getHouseholdMembers.mockResolvedValue([
      { uid: "me1", accessLevel: "parent" },
      { uid: "care1", accessLevel: "caregiver", role: "grandparent", displayName: "Nana" },
    ]);
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.partner.value).toBeNull();
  });

  it("an admin with no household loads a bare profile instead of erroring", async () => {
    getUserProfile.mockResolvedValue({ householdId: null, settings: {} });
    hasAdminClaim.mockResolvedValue(true);
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.error.value).toBe("");
    expect(home.household.value).toBeNull();
    expect(home.members.value).toEqual([]);
    expect(getHousehold).not.toHaveBeenCalled();
  });

  it("errors with 'No household' message for a non-admin with no household", async () => {
    getUserProfile.mockResolvedValue({ householdId: null, settings: {} });
    hasAdminClaim.mockResolvedValue(false);
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.error.value).toContain("could not load");
  });

  it("errors when not signed in", async () => {
    state.user = null;
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.error.value).toContain("could not load");
    expect(getUserProfile).not.toHaveBeenCalled();
  });

  it("errors when the household document itself is missing", async () => {
    getUserProfile.mockResolvedValue({ householdId: "house1", settings: {} });
    getHousehold.mockResolvedValue(null);
    getHouseholdMembers.mockResolvedValue([]);
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.error.value).toContain("could not load");
  });

  it("gives a specific message for a permission-denied failure", async () => {
    getUserProfile.mockRejectedValue({ code: "permission-denied" });
    const home = useHome();
    await vi.waitFor(() => expect(home.loading.value).toBe(false));
    expect(home.error.value).toContain("Care Brief");
  });

  it("reload() re-runs the load and ignores a stale in-flight result", async () => {
    let resolveFirst;
    getUserProfile.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const home = useHome();
    expect(home.loading.value).toBe(true);
    getUserProfile.mockResolvedValueOnce({ householdId: "house1", settings: {} });
    getHousehold.mockResolvedValue({});
    getHouseholdMembers.mockResolvedValue([]);
    const reloadPromise = home.reload();
    resolveFirst({ householdId: "stale-household", settings: {} }); // the first, now-stale load finally resolves
    await reloadPromise;
    expect(home.householdId.value).toBe("house1");
  });
});
