import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInWithGoogle } from "@/api/authApi";
import { signInWithEmail, signUpWithEmail, describeAuthError } from "@/api/emailAuth";
import { ensureUserProfile, getUserProfile } from "@/api/profile";
import { hasAdminClaim } from "@/api/adminAccess";
import { ROUTES } from "@/app/routes";
import { useAuth } from "@/app/composables/useAuth";

const state = vi.hoisted(() => ({ currentUser: { value: null }, draft: {
  journey: null, role: null, name: "", hasAccount: false, clearAccount: vi.fn(), email: "", password: "",
} }));
vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: state.currentUser }) }));
vi.mock("@/api/authApi", () => ({ signInWithGoogle: vi.fn() }));
vi.mock("@/api/emailAuth", () => ({
  signInWithEmail: vi.fn(), signUpWithEmail: vi.fn(), describeAuthError: vi.fn(() => "Sign-in failed"),
}));
vi.mock("@/api/profile", () => ({ ensureUserProfile: vi.fn(), getUserProfile: vi.fn() }));
vi.mock("@/api/adminAccess", () => ({ hasAdminClaim: vi.fn().mockResolvedValue(false) }));
vi.mock("@/app/stores/onboarding", () => ({ useOnboarding: () => state.draft }));

beforeEach(() => {
  vi.clearAllMocks();
  state.currentUser.value = null;
  state.draft.journey = null;
  state.draft.role = null;
  state.draft.name = "";
  state.draft.hasAccount = false;
  hasAdminClaim.mockResolvedValue(false);
});

function signInSoon(uid) {
  // waitForSignedIn polls currentUser.value?.uid; simulate Firebase's listener catching up.
  setTimeout(() => { state.currentUser.value = { uid }; }, 0);
}

describe("useAuth / signIn", () => {
  it("signs in, waits for the auth listener, and routes to Home when the profile already has a household", async () => {
    signInWithEmail.mockResolvedValue({ uid: "u1" });
    signInSoon("u1");
    ensureUserProfile.mockResolvedValue({ householdId: "house1" });
    const { signIn, error, busy } = useAuth();
    const result = await signIn({ email: "a@b.com", password: "x" });
    expect(result).toBe(ROUTES.HOME);
    expect(error.value).toBe("");
    expect(busy.value).toBe(false);
  });

  it("routes to Household when the profile has no household yet", async () => {
    signInWithEmail.mockResolvedValue({ uid: "u1" });
    signInSoon("u1");
    ensureUserProfile.mockResolvedValue({ householdId: null });
    const { signIn } = useAuth();
    expect(await signIn({ email: "a@b.com", password: "x" })).toBe(ROUTES.HOUSEHOLD);
  });

  it("routes admins straight to the admin route without reading or creating a profile", async () => {
    signInWithEmail.mockResolvedValue({ uid: "u1" });
    signInSoon("u1");
    hasAdminClaim.mockResolvedValue(true);
    const { signIn } = useAuth();
    expect(await signIn({ email: "a@b.com", password: "x" })).toBe(ROUTES.ADMIN);
    expect(ensureUserProfile).not.toHaveBeenCalled();
  });

  it("passes the onboarding draft's journey/role, and the caller's own name takes priority", async () => {
    signUpWithEmail.mockResolvedValue({ uid: "u1" });
    signInSoon("u1");
    state.draft.journey = "newborn";
    state.draft.role = "parent";
    state.draft.name = "Draft Name";
    ensureUserProfile.mockResolvedValue({ householdId: "house1" });
    const { signUp } = useAuth();
    await signUp({ name: "Caller Name", email: "a@b.com", password: "x" });
    expect(ensureUserProfile).toHaveBeenCalledWith(
      { uid: "u1" }, { name: "Caller Name", journey: "newborn", role: "parent" },
    );
  });

  it("returns null and sets a friendly error message on failure", async () => {
    signInWithEmail.mockRejectedValue({ code: "auth/wrong-password" });
    const { signIn, error } = useAuth();
    const result = await signIn({ email: "a@b.com", password: "wrong" });
    expect(result).toBeNull();
    expect(error.value).toBe("Sign-in failed");
  });

  it("sets busy true while the sign-in is in flight, then false when it settles", async () => {
    let resolveSignIn;
    signInWithEmail.mockImplementation(() => new Promise((resolve) => { resolveSignIn = resolve; }));
    const { signIn, busy } = useAuth();
    const promise = signIn({ email: "a@b.com", password: "x" });
    expect(busy.value).toBe(true);
    resolveSignIn({ uid: "u1" });
    state.currentUser.value = { uid: "u1" };
    ensureUserProfile.mockResolvedValue({ householdId: "house1" });
    await promise;
    expect(busy.value).toBe(false);
  });
});

describe("useAuth / continueWithGoogle (deferProfile)", () => {
  it("skips creating a profile and goes to Household when none exists yet", async () => {
    signInWithGoogle.mockResolvedValue({ uid: "u1", displayName: "Jess" });
    signInSoon("u1");
    getUserProfile.mockResolvedValue(null);
    const { continueWithGoogle } = useAuth();
    const result = await continueWithGoogle({ deferProfile: true });
    expect(result).toBe(ROUTES.HOUSEHOLD);
    expect(ensureUserProfile).not.toHaveBeenCalled();
  });

  it("fills the onboarding draft's name from the Google profile when the draft has none yet", async () => {
    signInWithGoogle.mockResolvedValue({ uid: "u1", displayName: "Jess" });
    signInSoon("u1");
    getUserProfile.mockResolvedValue(null);
    const { continueWithGoogle } = useAuth();
    await continueWithGoogle({ deferProfile: true });
    expect(state.draft.name).toBe("Jess");
  });

  it("does not overwrite an existing draft name", async () => {
    state.draft.name = "Already set";
    signInWithGoogle.mockResolvedValue({ uid: "u1", displayName: "Jess" });
    signInSoon("u1");
    getUserProfile.mockResolvedValue(null);
    const { continueWithGoogle } = useAuth();
    await continueWithGoogle({ deferProfile: true });
    expect(state.draft.name).toBe("Already set");
  });

  it("a returning user with an existing profile goes straight to Home/Household based on it", async () => {
    signInWithGoogle.mockResolvedValue({ uid: "u1" });
    signInSoon("u1");
    getUserProfile.mockResolvedValue({ householdId: "house1" });
    const { continueWithGoogle } = useAuth();
    expect(await continueWithGoogle({ deferProfile: true })).toBe(ROUTES.HOME);
  });
});

describe("useAuth / commitAccount", () => {
  it("throws a specific code if there's no signed-in user and no account draft", async () => {
    const { commitAccount } = useAuth();
    await expect(commitAccount()).rejects.toMatchObject({ code: "auth/missing-details" });
  });

  it("creates the account from the draft when not yet signed in", async () => {
    state.draft.hasAccount = true;
    state.draft.name = "Jess";
    state.draft.email = "jess@example.com";
    state.draft.password = "secret";
    signUpWithEmail.mockResolvedValue({ uid: "u1" });
    signInSoon("u1");
    ensureUserProfile.mockResolvedValue({ householdId: "house1" });
    const { commitAccount } = useAuth();
    const user = await commitAccount();
    expect(user).toEqual({ uid: "u1" });
    expect(state.draft.clearAccount).toHaveBeenCalled();
  });

  it("uses the already-signed-in user directly, skipping signUpWithEmail", async () => {
    state.currentUser.value = { uid: "u1" };
    ensureUserProfile.mockResolvedValue({ householdId: "house1" });
    const { commitAccount } = useAuth();
    await commitAccount();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });
});

describe("useAuth / loadProfile", () => {
  it("returns null with nobody signed in", async () => {
    const { loadProfile } = useAuth();
    expect(await loadProfile()).toBeNull();
  });

  it("loads and returns the profile for the signed-in user", async () => {
    state.currentUser.value = { uid: "u1" };
    getUserProfile.mockResolvedValue({ householdId: "house1" });
    const { loadProfile, authProfile } = useAuth();
    const result = await loadProfile();
    expect(result).toEqual({ householdId: "house1" });
    expect(authProfile.value).toEqual({ householdId: "house1" });
  });
});
