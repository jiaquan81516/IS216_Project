// The pumping room directory. A top level collection, shared by every household, because a
// nursing room at a mall is the same room for everyone.
//
// pumpingRooms/{roomId}                  the room; approval is "pending" until an administrator accepts it
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
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";
import { featureMap } from "@/app/utils/roomHelpers";

export const ROOMS_MAX = 200;
export const NAME_MAX = 80;
export const ADDRESS_MAX = 200;
export const NOTE_MAX = 400;
export const PLACE_ID_MAX = 200;

const roomsRef = () => collection(db, "pumpingRooms");

function report(code, error) {
  console.error("[app rooms]", code, error);
}

// Live list of the rooms a parent may see: every approved room, plus the rooms this parent
// added that are still waiting for an administrator. Two queries, because a rule can only
// allow a query it can prove safe. Reports { code } on failure like the other modules.
export function subscribeRooms(uid, onData, onError) {
  let approved = [];
  let mine = [];
  const emit = () => {
    const seen = new Set();
    const rooms = [...approved, ...mine].filter((room) => !seen.has(room.id) && seen.add(room.id));
    onData(rooms.sort((a, b) => String(a.name).localeCompare(String(b.name))));
  };
  const fail = (error) => {
    report(error?.code, error);
    onError?.({ code: error?.code ?? "unknown" });
  };
  const stops = [
    onSnapshot(
      query(roomsRef(), where("approval", "==", "approved"), limit(ROOMS_MAX)),
      (snap) => {
        approved = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emit();
      },
      fail,
    ),
  ];
  if (uid) {
    stops.push(
      onSnapshot(
        query(roomsRef(), where("createdBy", "==", uid), where("approval", "==", "pending"), limit(ROOMS_MAX)),
        (snap) => {
          mine = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          emit();
        },
        fail,
      ),
    );
  }
  return () => stops.forEach((stop) => stop());
}

export async function addRoom(
  uid,
  { name, address, details = "", placeId = "", lat = null, lng = null, region = null, features = [], roomType = "", feedback = "" } = {},
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
  if (!cleanName || !cleanAddress || !cleanDetails) {
    const error = new Error("A room needs an address and exact location details.");
    error.code = "rooms/incomplete";
    throw error;
  }
  const created = await addDoc(roomsRef(), {
    name: cleanName,
    address: cleanAddress,
    details: cleanDetails,
    placeId: cleanPlaceId,
    roomType: String(roomType).trim().slice(0, NAME_MAX),
    feedback: String(feedback).trim().slice(0, NOTE_MAX),
    region: region ? String(region).slice(0, NAME_MAX) : null,
    features: featureMap(features),
    status: "unverified",
    verifiedAt: null,
    approval: "pending",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
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

// Directory room IDs also work here, even when the room comes from BMSG.
export async function addRoomFeedback(uid, roomId, text) {
  const clean = String(text ?? "").trim();
  if (!uid || !roomId || !clean || clean.length > NOTE_MAX) {
    throw new Error("Sign in and enter feedback of up to 400 characters.");
  }
  const result = await addDoc(collection(db, "pumpingRooms", roomId, "feedback"), {
    by: uid,
    text: clean,
    at: serverTimestamp(),
  });
  return result.id;
}

export async function listRoomFeedback(roomId) {
  const snap = await getDocs(query(collection(db, "pumpingRooms", roomId, "feedback"), orderBy("at", "desc"), limit(20)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}
