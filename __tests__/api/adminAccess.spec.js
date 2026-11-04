import { afterEach, describe, expect, it, vi } from "vitest";
import { hasAdminClaim } from "@/api/adminAccess";

afterEach(() => vi.useRealTimers());

describe("admin token refresh", () => {
  it("refreshes an older token and shares the result across concurrent callers", async () => {
    const user = { getIdTokenResult: vi.fn(async (refresh) => ({ claims: { admin: refresh === true } })) };
    expect(await Promise.all([hasAdminClaim(user), hasAdminClaim(user)])).toEqual([true, true]);
    expect(user.getIdTokenResult).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("checks role changes again after the refresh interval", async () => {
    vi.useFakeTimers();
    const user = { getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: true } }) };
    expect(await hasAdminClaim(user)).toBe(true);
    user.getIdTokenResult.mockResolvedValue({ claims: {} });
    await vi.advanceTimersByTimeAsync(60000);
    expect(await hasAdminClaim(user)).toBe(false);
  });

  it("fails closed on a network error and allows a later retry", async () => {
    const user = { getIdTokenResult: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ claims: { admin: true } }) };
    expect(await hasAdminClaim(user)).toBe(false);
    expect(await hasAdminClaim(user)).toBe(true);
  });

  it("does not share claims between accounts", async () => {
    const admin = { getIdTokenResult: vi.fn().mockResolvedValue({ claims: { admin: true } }) };
    const member = { getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }) };
    expect(await hasAdminClaim(admin)).toBe(true);
    expect(await hasAdminClaim(member)).toBe(false);
    expect(await hasAdminClaim(null)).toBe(false);
  });
});
