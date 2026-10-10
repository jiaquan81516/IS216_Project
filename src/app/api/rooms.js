// The pumping room directory. A top level collection, shared by every household, because a
// nursing room at a mall is the same room for everyone.
//
// pumpingRooms/{roomId}                  the room
// pumpingRooms/{roomId}/reports/{id}     one confirmation or flag by one member
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";
import { featureMap } from "./roomHelpers";

export const ROOMS_MAX = 200;
export const NAME_MAX = 80;
export const ADDRESS_MAX = 200;
export const NOTE_MAX = 400;
export const PLACE_ID_MAX = 200;

const roomsRef = () => collection(db, "pumpingRooms");

function report(code, error) {
  console.error("[app rooms]", code, error);
}

// Live list of every room, by name. Reports { code } on failure like the other modules.
export function subscribeRooms(onData, onError) {
  const q = query(roomsRef(), orderBy("name", "asc"), limit(ROOMS_MAX));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      report(error?.code, error);
      onError?.({ code: error?.code ?? "unknown" });
    },
  );
}

export async function addRoom(
  uid,
  { name, address, details = "", placeId = "", lat = null, lng = null, region = null, features = [] } = {},
) {
  const cleanName = String(name ?? "").trim().slice(0, NAME_MAX);
  const cleanAddress = String(address ?? "").trim().slice(0, ADDRESS_MAX);
  const cleanDetails = String(details ?? "").trim().slice(0, ADDRESS_MAX);
  const cleanPlaceId = String(placeId ?? "").trim().slice(0, PLACE_ID_MAX);
  if (!uid) {
    const error = new Error("Sign in again to add a room.");
    error.code = "rooms/no-user";
    throw error;
  }
  if (!cleanName || !cleanAddress || !cleanDetails || !cleanPlaceId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("A room needs a Google place and exact location details.");
    error.code = "rooms/incomplete";
    throw error;
  }
  const created = await addDoc(roomsRef(), {
    name: cleanName,
    address: cleanAddress,
    details: cleanDetails,
    placeId: cleanPlaceId,
    region: region ? String(region).slice(0, NAME_MAX) : null,
    features: featureMap(features),
    status: "unverified",
    verifiedAt: null,
    lat,
    lng,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

// A member says the room is still there ("confirm") or that it is gone ("gone"). Both write
// a report, so the history is attributable, and move the room's status in one batch.
export async function reportRoom(uid, roomId, kind) {
  if (!uid) {
    const error = new Error("Sign in again to report a room.");
    error.code = "rooms/no-user";
    throw error;
  }
  if (kind !== "confirm" && kind !== "gone") {
    const error = new Error("A report is either a confirmation or a flag.");
    error.code = "rooms/bad-report";
    throw error;
  }
  const confirmed = kind === "confirm";
  const roomRef = doc(db, "pumpingRooms", roomId);
  const reportRef = doc(collection(db, "pumpingRooms", roomId, "reports"));
  const batch = writeBatch(db);
  batch.set(reportRef, {
    by: uid,
    field: "status",
    value: confirmed ? "verified" : "gone",
    at: serverTimestamp(),
  });
  batch.update(roomRef, {
    status: confirmed ? "verified" : "unverified",
    verifiedAt: confirmed ? serverTimestamp() : null,
  });
  await batch.commit();
  return reportRef.id;
}

// One shot read, used by tests and by anything that only needs a snapshot.
export async function listRooms() {
  const snap = await getDocs(query(roomsRef(), orderBy("name", "asc"), limit(ROOMS_MAX)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
