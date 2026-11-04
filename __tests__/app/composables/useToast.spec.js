import { describe, it, expect, beforeEach } from "vitest";
import { useToast } from "@/app/composables/useToast";

beforeEach(() => {
  // Module-level shared state: drain whatever an earlier test left behind.
  const { toasts, closeToast } = useToast();
  for (const t of [...toasts.value]) closeToast(t.id);
});

describe("useToast", () => {
  it("adds a toast with defaults filled in", () => {
    const { toasts, showToast } = useToast();
    showToast({ title: "Saved" });
    expect(toasts.value).toEqual([{ id: expect.any(String), title: "Saved", text: "", kind: "success", ms: 5000 }]);
  });

  it("keeps only the most recent 3 toasts", () => {
    const { toasts, showToast } = useToast();
    showToast({ title: "1" });
    showToast({ title: "2" });
    showToast({ title: "3" });
    showToast({ title: "4" });
    expect(toasts.value.map((t) => t.title)).toEqual(["2", "3", "4"]);
  });

  it("closes a toast by id, leaving the others", () => {
    const { toasts, showToast, closeToast } = useToast();
    const id1 = showToast({ title: "1" });
    const id2 = showToast({ title: "2" });
    closeToast(id1);
    expect(toasts.value.map((t) => t.id)).toEqual([id2]);
  });

  it("closing an id that doesn't exist does nothing", () => {
    const { toasts, showToast, closeToast } = useToast();
    showToast({ title: "1" });
    closeToast("not-a-real-id");
    expect(toasts.value).toHaveLength(1);
  });

  it("shares the same toast list across every call to useToast()", () => {
    const a = useToast();
    const b = useToast();
    a.showToast({ title: "From A" });
    expect(b.toasts.value).toHaveLength(1);
  });

  it("gives every toast a distinct, increasing id even across instances", () => {
    const { showToast } = useToast();
    const id1 = showToast({ title: "1" });
    const id2 = showToast({ title: "2" });
    expect(id1).not.toBe(id2);
  });
});
