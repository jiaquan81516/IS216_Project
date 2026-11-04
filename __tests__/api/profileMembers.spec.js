import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDocs: vi.fn(), onSnapshot: vi.fn() }));
vi.mock("@/api/db", () => ({ db: {} }));
vi.mock("@/api/firebase", () => ({ auth: {} }));
vi.mock("firebase/firestore", () => ({
  arrayUnion: vi.fn(),
  collection: (_db, ...path) => ({ path: path.join("/") }),
  collectionGroup: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: mocks.getDocs,
  onSnapshot: mocks.onSnapshot,
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));
import { getHouseholdMembers, subscribeHouseholdMembers } from "@/api/profile";

const photo = `data:image/jpeg;base64,${"A".repeat(40)}`;
const snap = (...docs) => ({ docs: docs.map(([id, data]) => ({ id, data: () => data })) });

beforeEach(() => vi.clearAllMocks());

describe("household members keep their photo", () => {
  it("returns each member's photoURL so the partner can be shown with a face", async () => {
    mocks.getDocs.mockResolvedValue(
      snap(
        ["me", { displayName: "Mei", role: "Mum", accessLevel: "parent", photoURL: photo }],
        ["alex", { displayName: "Alex", role: "Dad", accessLevel: "parent", photoURL: "https://example.com/a.jpg" }],
      ),
    );
    const members = await getHouseholdMembers("h1");
    expect(members.map((m) => m.photoURL)).toEqual([photo, "https://example.com/a.jpg"]);
  });

  it("uses an empty string when a member has no photo, a null photo or a bad value", async () => {
    mocks.getDocs.mockResolvedValue(
      snap(["a", { displayName: "A", accessLevel: "parent" }], ["b", { displayName: "B", photoURL: null }], ["c", { displayName: "C", photoURL: 42 }]),
    );
    const members = await getHouseholdMembers("h1");
    expect(members.map((m) => m.photoURL)).toEqual(["", "", ""]);
  });

  it("also carries the photo on the live list", () => {
    let received;
    mocks.onSnapshot.mockImplementation((_ref, onData) => {
      onData(snap(["p", { displayName: "Pat", accessLevel: "parent", photoURL: photo }]));
      return () => {};
    });
    subscribeHouseholdMembers("h1", (list) => (received = list));
    expect(received[0].photoURL).toBe(photo);
  });

  it("returns nothing without a household", async () => {
    expect(await getHouseholdMembers("")).toEqual([]);
  });
});
