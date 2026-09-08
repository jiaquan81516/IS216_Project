import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/api/firebase";

const feedingsCollection = collection(db, "feedings");

function toFirestoreFeeding(feeding, includeCreatedAt = false) {
  const data = { ...feeding };

  if (feeding.feedingTime && !(feeding.feedingTime instanceof Timestamp)) {
    data.feedingTime = Timestamp.fromDate(new Date(feeding.feedingTime));
  }

  if (includeCreatedAt) data.createdAt = serverTimestamp();
  return data;
}

function feedingQuery(babyId) {
  if (!babyId) throw new Error("A baby ID is required to load feedings.");
  return query(
    feedingsCollection,
    where("babyId", "==", babyId),
    orderBy("feedingTime", "desc"),
  );
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map((feedingDocument) => ({
    id: feedingDocument.id,
    ...feedingDocument.data(),
  }));
}

export async function addFeeding(feeding) {
  if (!feeding?.babyId)
    throw new Error("A baby ID is required to add a feeding.");
  return addDoc(feedingsCollection, toFirestoreFeeding(feeding, true));
}

export async function getFeedingsByBaby(babyId) {
  return mapSnapshot(await getDocs(feedingQuery(babyId)));
}

export function updateFeeding(id, feeding) {
  if (!id) throw new Error("A feeding ID is required to update a feeding.");
  return updateDoc(doc(db, "feedings", id), toFirestoreFeeding(feeding));
}

export function deleteFeeding(id) {
  if (!id) throw new Error("A feeding ID is required to delete a feeding.");
  return deleteDoc(doc(db, "feedings", id));
}

export function subscribeToFeedings(babyId, callback, onError) {
  return onSnapshot(
    feedingQuery(babyId),
    (snapshot) => callback(mapSnapshot(snapshot)),
    onError,
  );
}
