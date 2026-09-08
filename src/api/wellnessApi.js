import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/api/firebase";

function requireUserId(userId) {
  if (!userId) throw new Error("A user ID is required.");
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map((entryDocument) => ({
    id: entryDocument.id,
    ...entryDocument.data(),
  }));
}

function getEntriesByUser(collectionName, userId) {
  requireUserId(userId);
  const entriesQuery = query(
    collection(db, collectionName),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  return getDocs(entriesQuery).then(mapSnapshot);
}

function addUserEntry(collectionName, entry) {
  requireUserId(entry?.userId);
  return addDoc(collection(db, collectionName), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

export function addWellnessCheckIn(checkIn) {
  return addUserEntry("wellnessCheckIns", checkIn);
}

export function getWellnessCheckInsByUser(userId) {
  return getEntriesByUser("wellnessCheckIns", userId);
}

export function addJournalEntry(entry) {
  return addUserEntry("journalEntries", entry);
}

export function getJournalEntriesByUser(userId) {
  return getEntriesByUser("journalEntries", userId);
}
