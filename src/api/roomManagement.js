import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./db";
import { featureMap } from "@/app/utils/roomHelpers";

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
      !details || details.length > 200 || !Number.isFinite(room.lat) ||
      !Number.isFinite(room.lng) || room.lat < -90 || room.lat > 90 ||
      room.lng < -180 || room.lng > 180) {
    throw new Error("Enter a name, address, location details and valid coordinates.");
  }
  const target = room.id ? doc(rooms(), room.id) : doc(rooms());
  await setDoc(target, {
    name, address, details, lat: room.lat, lng: room.lng,
    features: featureMap(room.features),
    status: room.status === "verified" ? "verified" : "unverified",
    verifiedAt: room.status === "verified" ? (room.verifiedAt || serverTimestamp()) : null,
    deleted, updatedBy: uid, updatedAt: serverTimestamp(),
  });
  return target.id;
}
