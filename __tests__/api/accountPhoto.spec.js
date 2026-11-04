import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  update: vi.fn(),
  commit: vi.fn(),
  existing: new Set(),
}));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("@/api/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ deleteUser: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  arrayRemove: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: (_db, ...path) => ({ path: path.join("/") }),
  getDoc: mocks.getDoc,
  getDocs: vi.fn(),
  serverTimestamp: () => "server-time",
  setDoc: vi.fn(),
  writeBatch: () => ({ update: mocks.update, commit: mocks.commit }),
}));
import { savePhoto } from "@/api/account";

const photo = `data:image/jpeg;base64,${"A".repeat(40)}`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.existing = new Set(["households/h1/members/me", "households/h2/members/me"]);
  mocks.commit.mockResolvedValue(undefined);
  mocks.getDoc.mockImplementation(async (ref) => ({ exists: () => mocks.existing.has(ref.path), ref }));
});

describe("savePhoto", () => {
  it("saves the photo on the profile and on every household member document in one batch", async () => {
    await expect(savePhoto("me", ["h1", "h2"], photo)).resolves.toBe(photo);
    expect(mocks.update).toHaveBeenCalledTimes(3);
    expect(mocks.update).toHaveBeenCalledWith({ path: "users/me" }, { photoURL: photo });
    expect(mocks.update).toHaveBeenCalledWith({ path: "households/h1/members/me" }, { photoURL: photo });
    expect(mocks.update).toHaveBeenCalledWith({ path: "households/h2/members/me" }, { photoURL: photo });
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });
  it("removes the photo with null", async () => {
    await savePhoto("me", ["h1"], null);
    expect(mocks.update).toHaveBeenCalledWith({ path: "users/me" }, { photoURL: null });
    expect(mocks.update).toHaveBeenCalledWith({ path: "households/h1/members/me" }, { photoURL: null });
  });
  it("skips households where there is no member document, which the rules would not let it create", async () => {
    mocks.existing.delete("households/h2/members/me");
    await savePhoto("me", ["h1", "h2"], photo);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).not.toHaveBeenCalledWith({ path: "households/h2/members/me" }, expect.anything());
  });
  it("ignores empty and repeated household ids", async () => {
    await savePhoto("me", ["h1", "", null, "h1", undefined], photo);
    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it("still saves the profile when the person has no household yet", async () => {
    await savePhoto("me", [], photo);
    await savePhoto("me", undefined, photo);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledWith({ path: "users/me" }, { photoURL: photo });
  });
  it.each([
    ["a script", "javascript:alert(1)"],
    ["a PNG data URL", "data:image/png;base64,AAAA"],
    ["an empty string", ""],
    ["plain http", "http://example.com/a.jpg"],
  ])("refuses %s before writing anything", async (_label, value) => {
    await expect(savePhoto("me", ["h1"], value)).rejects.toMatchObject({ code: "photo/invalid" });
    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("passes a failed write up so the page can show an error", async () => {
    mocks.commit.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    await expect(savePhoto("me", ["h1"], photo)).rejects.toMatchObject({ code: "permission-denied" });
  });
});
