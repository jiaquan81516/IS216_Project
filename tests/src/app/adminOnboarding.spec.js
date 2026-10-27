import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { value: null }, authenticated: { value: true },
  getUserProfile: vi.fn(), ensureUserProfile: vi.fn(),
  signIn: vi.fn(), google: vi.fn(), token: vi.fn(),
}));
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ currentUser: state.user, isAuthenticated: state.authenticated }),
  waitForAuthInitialization: async () => {},
}));
vi.mock("@/api/profile", () => ({
  getUserProfile: state.getUserProfile, ensureUserProfile: state.ensureUserProfile,
}));
vi.mock("@/api/authApi", () => ({ signInWithGoogle: state.google }));
vi.mock("@/api/emailAuth", () => ({
  signInWithEmail: state.signIn, signUpWithEmail: vi.fn(), describeAuthError: () => "Sign-in failed",
}));
vi.mock("@/app/stores/onboarding", () => ({ useOnboarding: () => ({}) }));

import { installGuard } from "@/app/guard";
import { useAuth } from "@/app/composables/useAuth";
import { hasAdminClaim } from "@/api/adminAccess";
import { ROUTES } from "@/app/routes";

let navigate;
beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated.value = true;
  state.user.value = { uid: "u1", getIdTokenResult: state.token };
  state.token.mockResolvedValue({ claims: { admin: true } });
  state.getUserProfile.mockResolvedValue({ householdId: null });
  state.ensureUserProfile.mockResolvedValue({ householdId: null });
  state.signIn.mockResolvedValue(state.user.value);
  state.google.mockResolvedValue(state.user.value);
  installGuard({ beforeEach: (guard) => { navigate = (path) => guard({ path }); } });
});

describe("admin setup bypass", () => {
  it.each([ROUTES.JOURNEY, ROUTES.ROLE, ROUTES.ACCOUNT, ROUTES.SIGN_IN, ROUTES.HOUSEHOLD, ROUTES.HOME])(
    "redirects admins from %s to room management without reading a profile", async (path) => {
      expect(await navigate(path)).toBe(ROUTES.ROOMS);
      expect(state.getUserProfile).not.toHaveBeenCalled();
    },
  );
  it("allows direct room access without a profile or household", async () => {
    expect(await navigate(ROUTES.ROOMS)).toBe(true);
    expect(state.getUserProfile).not.toHaveBeenCalled();
  });
  it.each(["email", "google"])("skips profile creation after %s sign-in", async (provider) => {
    const auth = useAuth();
    const destination = provider === "email" ? await auth.signIn({ email: "admin@example.com", password: "password" }) : await auth.continueWithGoogle();
    expect(destination).toBe(ROUTES.ROOMS);
    expect(state.ensureUserProfile).not.toHaveBeenCalled();
  });
  it("retains profile creation and household setup for members", async () => {
    state.token.mockResolvedValue({ claims: {} });
    expect(await useAuth().signIn({})).toBe(ROUTES.HOUSEHOLD);
    expect(state.ensureUserProfile).toHaveBeenCalled();
    expect(await navigate(ROUTES.ROOMS)).toBe(ROUTES.HOUSEHOLD);
  });
  it("keeps completed members going to Home", async () => {
    state.token.mockResolvedValue({ claims: {} });
    state.getUserProfile.mockResolvedValue({ householdId: "house" });
    expect(await navigate(ROUTES.SIGN_IN)).toBe(ROUTES.HOME);
  });
  it("requires authentication for room management", async () => {
    state.authenticated.value = false;
    state.user.value = null;
    expect(await navigate(ROUTES.ROOMS)).toBe(ROUTES.SIGN_IN);
    expect(state.token).not.toHaveBeenCalled();
  });
  it("does not trust an editable profile admin flag", async () => {
    state.token.mockResolvedValue({ claims: {} });
    state.getUserProfile.mockResolvedValue({ admin: true, householdId: null });
    expect(await navigate(ROUTES.ROOMS)).toBe(ROUTES.HOUSEHOLD);
  });
  it("does not bypass setup if token verification fails", async () => {
    state.token.mockRejectedValue(new Error("offline"));
    expect(await navigate(ROUTES.ROOMS)).toBe(ROUTES.HOUSEHOLD);
  });
  it("requires a boolean true claim", async () => {
    state.token.mockResolvedValue({ claims: { admin: "true" } });
    expect(await hasAdminClaim(state.user.value)).toBe(false);
  });
});
