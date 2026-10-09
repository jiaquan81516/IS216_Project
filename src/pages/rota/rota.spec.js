import { beforeEach, describe, expect, it } from "vitest";
import { acceptSwap, declineSwap, resetRota, rota, swapBanner } from "@/data/rota.js";

const who = (id) => rota.find((n) => n.id === id).who;

describe("sleep rotation swap", () => {
  beforeEach(() => resetRota());

  it("exchanges the two nights when the swap is accepted", () => {
    expect(who("thu")).toBe("M");
    expect(who("fri")).toBe("D");
    acceptSwap();
    expect(who("thu")).toBe("D");
    expect(who("fri")).toBe("M");
    expect(swapBanner.open).toBe(false);
    expect(rota.some((n) => n.pending)).toBe(false);
  });

  it("leaves the rota alone when the swap is declined", () => {
    declineSwap();
    expect(who("thu")).toBe("M");
    expect(who("fri")).toBe("D");
    expect(swapBanner.open).toBe(false);
  });
});
