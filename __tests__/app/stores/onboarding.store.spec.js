import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { useOnboarding } from "@/app/stores/onboarding";

const STORAGE_KEY = "nt.app.draft";

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});
afterEach(() => {
  localStorage.clear();
});

describe("useOnboarding / initial load", () => {
  it("defaults to empty when nothing is stored", () => {
    const store = useOnboarding();
    expect(store.journey).toBeNull();
    expect(store.role).toBeNull();
    expect(store.name).toBe("");
  });

  it("restores a previously saved draft", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ journey: "newborn", role: "parent", name: "Jess" }));
    const store = useOnboarding();
    expect(store.journey).toBe("newborn");
    expect(store.role).toBe("parent");
    expect(store.name).toBe("Jess");
  });

  it("recovers from corrupted stored JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const store = useOnboarding();
    expect(store.journey).toBeNull();
    expect(store.role).toBeNull();
    expect(store.name).toBe("");
  });

  it("never restores email or password -- they are never persisted", () => {
    const store = useOnboarding();
    expect(store.email).toBe("");
    expect(store.password).toBe("");
  });
});

describe("hasAccount", () => {
  it("is true only once both email and password are set", () => {
    const store = useOnboarding();
    expect(store.hasAccount).toBe(false);
    store.email = "a@b.com";
    expect(store.hasAccount).toBe(false);
    store.password = "secret";
    expect(store.hasAccount).toBe(true);
  });
});

describe("setJourney / setRole", () => {
  it("updates the ref and persists the draft", async () => {
    const store = useOnboarding();
    store.setJourney("preparing");
    store.setRole("caregiver");
    await nextTick();
    expect(store.journey).toBe("preparing");
    expect(store.role).toBe("caregiver");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toMatchObject({ journey: "preparing", role: "caregiver" });
  });
});

describe("clearAccount", () => {
  it("clears email and password without touching the persisted draft", async () => {
    const store = useOnboarding();
    store.setJourney("newborn");
    await nextTick();
    store.email = "a@b.com";
    store.password = "secret";
    store.clearAccount();
    expect(store.email).toBe("");
    expect(store.password).toBe("");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).journey).toBe("newborn");
  });
});

describe("reset", () => {
  it("clears every field and removes the persisted draft", async () => {
    const store = useOnboarding();
    store.setJourney("newborn");
    store.setRole("parent");
    store.name = "Jess";
    store.email = "a@b.com";
    store.password = "secret";
    await nextTick();
    store.reset();
    expect(store.journey).toBeNull();
    expect(store.role).toBeNull();
    expect(store.name).toBe("");
    expect(store.email).toBe("");
    expect(store.password).toBe("");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
