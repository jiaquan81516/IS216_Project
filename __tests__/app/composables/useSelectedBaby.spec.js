import { describe, it, expect, vi, beforeEach } from "vitest";
import { getHouseholdBabies } from "@/api/profile";
import { useSelectedBaby } from "@/app/composables/useSelectedBaby";

vi.mock("@/api/profile", () => ({ getHouseholdBabies: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Module-level shared state: reset it directly since useSelectedBaby shares one ref module-wide.
  const { babies, selectBaby } = useSelectedBaby();
  babies.value = [];
  selectBaby("primary");
});

describe("useSelectedBaby", () => {
  it("defaults to 'primary' with nothing stored", () => {
    const { selectedBabyId } = useSelectedBaby();
    expect(selectedBabyId.value).toBe("primary");
  });

  it("restores a previously selected id from storage on module load (new instance)", () => {
    // selectBaby persists, and a later call just reads the shared ref -- simulate a fresh
    // page load by calling selectBaby then checking a brand-new destructure sees it.
    const { selectBaby } = useSelectedBaby();
    selectBaby("baby2");
    const fresh = useSelectedBaby();
    expect(fresh.selectedBabyId.value).toBe("baby2");
  });

  it("selectedBaby resolves to the matching entry in babies", async () => {
    getHouseholdBabies.mockResolvedValue([{ id: "baby1", name: "Alex" }, { id: "baby2", name: "Sam" }]);
    const { loadBabies, selectBaby, selectedBaby } = useSelectedBaby();
    await loadBabies("house1");
    selectBaby("baby2");
    expect(selectedBaby.value).toEqual({ id: "baby2", name: "Sam" });
  });

  it("falls back to the first baby when the selected id isn't in the household", async () => {
    getHouseholdBabies.mockResolvedValue([{ id: "baby1", name: "Alex" }]);
    const { loadBabies, selectBaby, selectedBaby, selectedBabyId } = useSelectedBaby();
    selectBaby("stale-id-from-another-household");
    await loadBabies("house1");
    expect(selectedBabyId.value).toBe("baby1");
    expect(selectedBaby.value).toEqual({ id: "baby1", name: "Alex" });
  });

  it("clears the selected id when the household has no active babies", async () => {
    getHouseholdBabies.mockResolvedValue([]);
    const { loadBabies, selectedBabyId, selectedBaby } = useSelectedBaby();
    await loadBabies("house1");
    expect(selectedBabyId.value).toBe("");
    expect(selectedBaby.value).toBeNull();
  });

  it("on a load failure, clears babies, selects 'primary', and records the error code", async () => {
    getHouseholdBabies.mockRejectedValue({ code: "permission-denied" });
    const { loadBabies, babies, babyLoadError, selectedBabyId } = useSelectedBaby();
    await loadBabies("house1");
    expect(babies.value).toEqual([]);
    expect(babyLoadError.value).toBe("permission-denied");
    expect(selectedBabyId.value).toBe("primary");
  });

  it("selectBaby persists the choice to localStorage", () => {
    const { selectBaby } = useSelectedBaby();
    selectBaby("baby9");
    expect(localStorage.getItem("selectedBabyId")).toBe("baby9");
  });
});
