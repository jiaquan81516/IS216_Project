import { describe, it, expect, vi, beforeEach } from "vitest";
import { effectScope, nextTick } from "vue";
import { useSavedPlaces } from "@/app/composables/useSavedPlaces";

const state = vi.hoisted(() => ({ currentUserRef: null }));
vi.mock("@/composables/useAuth", async () => {
  const { ref } = await import("vue");
  state.currentUserRef = ref({ uid: "me1" });
  return { useAuth: () => ({ currentUser: state.currentUserRef }) };
});

function withScope(fn) {
  const scope = effectScope();
  const result = scope.run(fn);
  return { ...result, dispose: () => scope.stop() };
}

beforeEach(() => {
  localStorage.clear();
  state.currentUserRef.value = { uid: "me1" };
});

describe("useSavedPlaces", () => {
  it("starts empty with nothing stored", () => {
    const { savedIds } = withScope(() => useSavedPlaces("saved-rooms"));
    expect(savedIds.value).toEqual([]);
  });

  it("restores a previously saved list scoped to the signed-in uid", () => {
    localStorage.setItem("saved-rooms:me1", JSON.stringify(["r1", "r2"]));
    const { savedIds } = withScope(() => useSavedPlaces("saved-rooms"));
    expect(savedIds.value).toEqual(["r1", "r2"]);
  });

  it("recovers from corrupted stored JSON", () => {
    localStorage.setItem("saved-rooms:me1", "{not json");
    const { savedIds } = withScope(() => useSavedPlaces("saved-rooms"));
    expect(savedIds.value).toEqual([]);
  });

  it("coerces non-array stored data to an empty list", () => {
    localStorage.setItem("saved-rooms:me1", JSON.stringify({ not: "an array" }));
    const { savedIds } = withScope(() => useSavedPlaces("saved-rooms"));
    expect(savedIds.value).toEqual([]);
  });

  it("falls back to 'guest' scoping when signed out", () => {
    state.currentUserRef.value = null;
    localStorage.setItem("saved-rooms:guest", JSON.stringify(["r9"]));
    const { savedIds } = withScope(() => useSavedPlaces("saved-rooms"));
    expect(savedIds.value).toEqual(["r9"]);
  });

  it("toggleSaved adds an id not yet saved, and persists it", () => {
    const { savedIds, toggleSaved } = withScope(() => useSavedPlaces("saved-rooms"));
    toggleSaved({ id: "r1", name: "Room One" });
    expect(savedIds.value).toEqual(["r1"]);
    expect(JSON.parse(localStorage.getItem("saved-rooms:me1"))).toEqual(["r1"]);
  });

  it("toggleSaved removes an id that is already saved", () => {
    const { savedIds, toggleSaved } = withScope(() => useSavedPlaces("saved-rooms"));
    toggleSaved({ id: "r1", name: "Room One" });
    toggleSaved({ id: "r1", name: "Room One" });
    expect(savedIds.value).toEqual([]);
  });

  it("reloads the list when the signed-in uid changes", async () => {
    localStorage.setItem("saved-rooms:me1", JSON.stringify(["r1"]));
    localStorage.setItem("saved-rooms:partner1", JSON.stringify(["r2"]));
    const { savedIds } = withScope(() => useSavedPlaces("saved-rooms"));
    expect(savedIds.value).toEqual(["r1"]);
    state.currentUserRef.value = { uid: "partner1" };
    await nextTick();
    expect(savedIds.value).toEqual(["r2"]);
  });
});
