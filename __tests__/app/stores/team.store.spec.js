import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { clearFeeling, setFeeling, subscribeFeelings } from "@/api/team";
import { notifyPartner } from "@/api/push";
import { useTeamStore, keyFor, SHARE_KEY, NUDGES_KEY } from "@/app/stores/team";

vi.mock("@/api/team", () => ({
  subscribeFeelings: vi.fn(() => vi.fn()),
  setFeeling: vi.fn().mockResolvedValue(undefined),
  clearFeeling: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/api/push", () => ({ notifyPartner: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  subscribeFeelings.mockImplementation(() => vi.fn());
  localStorage.clear();
  setActivePinia(createPinia());
});
afterEach(() => {
  localStorage.clear();
});

describe("keyFor", () => {
  it("namespaces the key by uid, or leaves it bare with no uid", () => {
    expect(keyFor(SHARE_KEY, "me1")).toBe(`${SHARE_KEY}:me1`);
    expect(keyFor(SHARE_KEY, "")).toBe(SHARE_KEY);
  });
});

describe("useTeamStore / binding", () => {
  it("starts loading with no feelings", () => {
    const store = useTeamStore();
    expect(store.feelings).toEqual({});
    expect(store.loading).toBe(true);
  });

  it("loads sharing and dismissed-nudge state scoped to the bound uid", () => {
    localStorage.setItem(keyFor(SHARE_KEY, "me1"), JSON.stringify(true));
    localStorage.setItem(keyFor(NUDGES_KEY, "me1"), JSON.stringify({ n1: "2026-11-01" }));
    const store = useTeamStore();
    store.bind("house1", "me1", "partner1");
    expect(store.shareOn).toBe(true);
    expect(store.dismissed).toEqual({ n1: "2026-11-01" });
  });

  it("defaults sharing to off and dismissed to {} with nothing stored", () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    expect(store.shareOn).toBe(false);
    expect(store.dismissed).toEqual({});
  });

  it("recovers from corrupted localStorage JSON by falling back to the default", () => {
    localStorage.setItem(keyFor(SHARE_KEY, "me1"), "{not json");
    const store = useTeamStore();
    store.bind("house1", "me1");
    expect(store.shareOn).toBe(false);
  });

  it("still loads per-uid preferences even with no household id", () => {
    localStorage.setItem(keyFor(SHARE_KEY, "me1"), JSON.stringify(true));
    const store = useTeamStore();
    store.bind("", "me1");
    expect(store.shareOn).toBe(true);
    expect(subscribeFeelings).not.toHaveBeenCalled();
  });

  it("populates feelings and stops loading once the subscription delivers", () => {
    const store = useTeamStore();
    store.bind("house1", "me1", "partner1");
    const onData = subscribeFeelings.mock.calls[0][1];
    onData({ partner1: { level: "ok", date: "2026-11-05" } });
    expect(store.feelings).toEqual({ partner1: { level: "ok", date: "2026-11-05" } });
    expect(store.loading).toBe(false);
  });

  it("surfaces a subscription error", () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    const onError = subscribeFeelings.mock.calls[0][2];
    onError({ code: "permission-denied" });
    expect(store.error).toEqual({ code: "permission-denied" });
  });

  it("ignores a stale callback after unbind", () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    const onData = subscribeFeelings.mock.calls[0][1];
    store.unbind();
    onData({ me1: { level: "ok" } });
    expect(store.feelings).toEqual({});
  });

  describe("partnerFeeling", () => {
    it("reads the partner's own feeling by uid", () => {
      const store = useTeamStore();
      store.bind("house1", "me1", "partner1");
      subscribeFeelings.mock.calls[0][1]({ partner1: { level: "hard", date: "2026-11-05" } });
      expect(store.partnerFeeling).toEqual({ level: "hard", date: "2026-11-05" });
    });

    it("is null with no partner uid, even if feelings map has data under other keys", () => {
      const store = useTeamStore();
      store.bind("house1", "me1");
      subscribeFeelings.mock.calls[0][1]({ me1: { level: "ok" } });
      expect(store.partnerFeeling).toBeNull();
    });

    it("is null when the partner has not shared anything", () => {
      const store = useTeamStore();
      store.bind("house1", "me1", "partner1");
      subscribeFeelings.mock.calls[0][1]({});
      expect(store.partnerFeeling).toBeNull();
    });
  });
});

describe("setSharing", () => {
  it("turns sharing on and persists it, without calling the API", async () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    const ok = await store.setSharing(true);
    expect(ok).toBe(true);
    expect(store.shareOn).toBe(true);
    expect(JSON.parse(localStorage.getItem(keyFor(SHARE_KEY, "me1")))).toBe(true);
    expect(clearFeeling).not.toHaveBeenCalled();
  });

  it("turns sharing off and clears whatever was already shared", async () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    const ok = await store.setSharing(false);
    expect(ok).toBe(true);
    expect(clearFeeling).toHaveBeenCalledWith("house1", "me1");
  });

  it("reports failure if clearing the shared feeling fails", async () => {
    clearFeeling.mockRejectedValueOnce({ code: "unavailable" });
    const store = useTeamStore();
    store.bind("house1", "me1");
    const ok = await store.setSharing(false);
    expect(ok).toBe(false);
    expect(store.writeError).toContain("could not stop sharing");
  });

  it("gives a friendlier message for a permission-denied failure", async () => {
    clearFeeling.mockRejectedValueOnce({ code: "permission-denied" });
    const store = useTeamStore();
    store.bind("house1", "me1");
    await store.setSharing(false);
    expect(store.writeError).toContain("firestore.rules");
  });
});

describe("shareFeeling", () => {
  it("does nothing when sharing is off", async () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    const ok = await store.shareFeeling("ok", "2026-11-05");
    expect(ok).toBe(false);
    expect(setFeeling).not.toHaveBeenCalled();
  });

  it("shares the feeling and notifies the partner only for a 'hard' day", async () => {
    const store = useTeamStore();
    store.bind("house1", "me1", "partner1");
    await store.setSharing(true);
    const ok = await store.shareFeeling("hard", "2026-11-05");
    expect(ok).toBe(true);
    expect(setFeeling).toHaveBeenCalledWith("house1", "me1", { level: "hard", date: "2026-11-05" });
    expect(notifyPartner).toHaveBeenCalledWith("house1", "feeling", "me1");
  });

  it("does not notify the partner for a non-hard day", async () => {
    const store = useTeamStore();
    store.bind("house1", "me1", "partner1");
    await store.setSharing(true);
    await store.shareFeeling("ok", "2026-11-05");
    expect(notifyPartner).not.toHaveBeenCalled();
  });

  it("reports failure without losing the private check-in", async () => {
    setFeeling.mockRejectedValueOnce({ code: "unavailable" });
    const store = useTeamStore();
    store.bind("house1", "me1");
    await store.setSharing(true);
    const ok = await store.shareFeeling("ok", "2026-11-05");
    expect(ok).toBe(false);
    expect(store.writeError).toContain("still saved");
  });
});

describe("dismiss", () => {
  it("records a dismissal keyed by nudge id and persists it per uid", () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    store.dismiss("n1", "2026-11-05");
    expect(store.dismissed).toEqual({ n1: "2026-11-05" });
    expect(JSON.parse(localStorage.getItem(keyFor(NUDGES_KEY, "me1")))).toEqual({ n1: "2026-11-05" });
  });

  it("keeps earlier dismissals when adding a new one", () => {
    const store = useTeamStore();
    store.bind("house1", "me1");
    store.dismiss("n1", "2026-11-05");
    store.dismiss("n2", "2026-11-06");
    expect(store.dismissed).toEqual({ n1: "2026-11-05", n2: "2026-11-06" });
  });
});
