import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./db";
import { featureMap } from "@/app/utils/roomHelpers";
import { resolveRoomLocation } from "./roomLocation";

const rooms = () => collection(db, "pumpingRoomOverrides");

export function subscribeRoomOverrides(onData, onError) {
  return onSnapshot(rooms(), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
  }, onError);
}

export async function saveManagedRoom(uid, room, deleted = false) {
  if (deleted) {
    if (!uid || !room.id) throw new Error("A signed-in user and room are required.");
    await setDoc(doc(rooms(), room.id), {
      deleted: true, updatedBy: uid, updatedAt: serverTimestamp(),
    });
    return room.id;
  }
  const name = String(room.name ?? "").trim();
  const address = String(room.address ?? "").trim();
  const details = String(room.details ?? "").trim();
  if (!uid || !name || name.length > 80 || !address || address.length > 200 ||
      !details || details.length > 200) {
    const error = new Error("Enter a name, address and location details within the field limits.");
    error.code = "rooms/invalid-input";
    throw error;
  }
  // Always resolve the current address; never reuse coordinates from an edited address.
  const { lat, lng } = await resolveRoomLocation(address);
  const target = room.id ? doc(rooms(), room.id) : doc(rooms());
  await setDoc(target, {
    name, address, details, lat, lng,
    features: featureMap(room.features),
    status: room.status === "verified" ? "verified" : "unverified",
    verifiedAt: room.status === "verified" ? (room.verifiedAt || serverTimestamp()) : null,
    deleted, updatedBy: uid, updatedAt: serverTimestamp(),
  });
  return target.id;
}
