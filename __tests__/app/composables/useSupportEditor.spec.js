import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { saveSupportList, SUPPORT_MAX_ITEMS } from "@/api/supportContent";
import { useToast } from "@/app/composables/useToast";
import { useSupportEditor } from "@/app/composables/useSupportEditor";

vi.mock("@/composables/useAuth", () => ({ useAuth: () => ({ currentUser: { value: { uid: "admin1" } } }) }));
vi.mock("@/api/supportContent", () => ({
  SUPPORT_MAX_ITEMS: 30,
  saveSupportList: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  saveSupportList.mockResolvedValue(undefined);
  const { toasts, closeToast } = useToast();
  for (const t of [...toasts.value]) closeToast(t.id);
});

describe("useSupportEditor / guides", () => {
  it("start(-1) opens a blank guide draft with one empty step", () => {
    const items = ref([]);
    const { editing, start } = useSupportEditor("guides", items);
    start(-1);
    expect(editing.value.index).toBe(-1);
    expect(editing.value.draft.title).toBe("");
    expect(editing.value.draft.steps).toEqual([{ title: "", body: "" }]);
    expect(editing.value.draft.slug).toMatch(/^guide-/);
  });

  it("start(index) clones the existing item and flattens callIf into callIfText", () => {
    const items = ref([{ slug: "g1", title: "Fever", blurb: "b", intro: "i", steps: [], callIf: ["Over 38C", "Baby under 3 months"] }]);
    const { editing, start } = useSupportEditor("guides", items);
    start(0);
    expect(editing.value.draft.callIfText).toBe("Over 38C\nBaby under 3 months");
    // Mutating the draft must not mutate the original item (deep clone).
    editing.value.draft.title = "Changed";
    expect(items.value[0].title).toBe("Fever");
  });

  it("save() rejects a blank title without calling the API", () => {
    const items = ref([]);
    const { start, save, error } = useSupportEditor("guides", items);
    start(-1);
    save();
    expect(error.value).toBe("Enter a title.");
    expect(saveSupportList).not.toHaveBeenCalled();
  });

  it("save() trims fields, drops empty steps, splits callIfText into callIf, and appends a new item", async () => {
    const items = ref([]);
    const { start, save, editing } = useSupportEditor("guides", items);
    start(-1);
    editing.value.draft.title = "  Fever  ";
    editing.value.draft.blurb = "  ";
    editing.value.draft.intro = " Info ";
    editing.value.draft.steps = [{ title: " Step 1 ", body: "" }, { title: "", body: "" }];
    editing.value.draft.callIfText = " Over 38C \n\n Baby lethargic ";
    save();
    await vi.waitFor(() => expect(saveSupportList).toHaveBeenCalled());
    const [, , saved] = saveSupportList.mock.calls[0];
    expect(saved).toEqual([{
      slug: expect.stringMatching(/^guide-/),
      title: "Fever", blurb: "", intro: "Info",
      steps: [{ title: "Step 1", body: "" }],
      callIf: ["Over 38C", "Baby lethargic"],
    }]);
  });

  it("save() replaces the item in place when editing an existing index", async () => {
    const items = ref([
      { slug: "g1", title: "Fever", blurb: "", intro: "", steps: [], callIf: [] },
      { slug: "g2", title: "Cough", blurb: "", intro: "", steps: [], callIf: [] },
    ]);
    const { start, save, editing } = useSupportEditor("guides", items);
    start(1);
    editing.value.draft.title = "Cough updated";
    editing.value.draft.callIfText = "";
    save();
    await vi.waitFor(() => expect(saveSupportList).toHaveBeenCalled());
    const [, , saved] = saveSupportList.mock.calls[0];
    expect(saved).toHaveLength(2);
    expect(saved[0].title).toBe("Fever");
    expect(saved[1].title).toBe("Cough updated");
  });

  it("clears editing and shows a toast once save succeeds", async () => {
    const items = ref([]);
    const { start, save, editing } = useSupportEditor("guides", items);
    const { toasts } = useToast();
    start(-1);
    editing.value.draft.title = "Fever";
    editing.value.draft.callIfText = "";
    save();
    await vi.waitFor(() => expect(editing.value).toBeNull());
    expect(toasts.value.at(-1).title).toBe("Guide saved");
  });
});

describe("useSupportEditor / contacts", () => {
  it("start(-1) opens a blank contact draft", () => {
    const items = ref([]);
    const { editing, start } = useSupportEditor("contacts", items);
    start(-1);
    expect(editing.value.draft).toMatchObject({ name: "", purpose: "", telLabel: "" });
    expect(editing.value.draft.id).toMatch(/^contact-/);
  });

  it("save() rejects a blank name", () => {
    const items = ref([]);
    const { start, save, error } = useSupportEditor("contacts", items);
    start(-1);
    save();
    expect(error.value).toBe("Enter a name.");
  });

  it("save() trims fields and strips to id/name/purpose/telLabel before persisting", async () => {
    const items = ref([]);
    const { start, save, editing } = useSupportEditor("contacts", items);
    start(-1);
    editing.value.draft.name = "  Dr Tan  ";
    editing.value.draft.purpose = " Checkups ";
    editing.value.draft.telLabel = " 6123 4567 ";
    save();
    await vi.waitFor(() => expect(saveSupportList).toHaveBeenCalled());
    const [, , saved] = saveSupportList.mock.calls[0];
    expect(saved).toEqual([{ id: expect.stringMatching(/^contact-/), name: "Dr Tan", purpose: "Checkups", telLabel: "6123 4567" }]);
  });
});

describe("remove", () => {
  it("removes the item at the given index and shows a toast", async () => {
    const items = ref([{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    const { remove, confirming } = useSupportEditor("contacts", items);
    const { toasts } = useToast();
    confirming.value = 1;
    remove(1);
    await vi.waitFor(() => expect(confirming.value).toBe(-1));
    const [, , saved] = saveSupportList.mock.calls[0];
    expect(saved).toEqual([{ id: "c1", name: "A", purpose: undefined, telLabel: "" }]);
    expect(toasts.value.at(-1).title).toBe("Contact deleted");
  });
});

describe("persist failures", () => {
  it("shows a friendly message on permission-denied and keeps editing open", async () => {
    saveSupportList.mockRejectedValueOnce({ code: "permission-denied" });
    const items = ref([]);
    const { start, save, error, editing } = useSupportEditor("guides", items);
    start(-1);
    editing.value.draft.title = "Fever";
    editing.value.draft.callIfText = "";
    save();
    await vi.waitFor(() => expect(error.value).not.toBe(""));
    expect(error.value).toContain("admin claim");
    expect(editing.value).not.toBeNull();
  });

  it("shows a generic error for any other failure", async () => {
    saveSupportList.mockRejectedValueOnce({ code: "unavailable" });
    const items = ref([]);
    const { start, save, error, editing } = useSupportEditor("guides", items);
    start(-1);
    editing.value.draft.title = "Fever";
    editing.value.draft.callIfText = "";
    save();
    await vi.waitFor(() => expect(error.value).not.toBe(""));
    expect(error.value).toBe("We could not save that. Try again.");
  });

  it("ignores a second save() call while the first is still in flight", async () => {
    let resolveFirst;
    saveSupportList.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const items = ref([]);
    const { start, save, busy, editing } = useSupportEditor("guides", items);
    start(-1);
    editing.value.draft.title = "Fever";
    editing.value.draft.callIfText = "";
    save();
    expect(busy.value).toBe(true);
    save(); // second call should be a no-op while busy
    expect(saveSupportList).toHaveBeenCalledTimes(1);
    resolveFirst();
    await vi.waitFor(() => expect(busy.value).toBe(false));
  });
});

describe("atLimit", () => {
  it("is true once the list reaches SUPPORT_MAX_ITEMS", () => {
    const full = ref(Array.from({ length: SUPPORT_MAX_ITEMS }, (_, i) => ({ id: `c${i}` })));
    const { atLimit } = useSupportEditor("contacts", full);
    expect(atLimit()).toBe(true);
    const notFull = ref([{ id: "c1" }]);
    expect(useSupportEditor("contacts", notFull).atLimit()).toBe(false);
  });
});
