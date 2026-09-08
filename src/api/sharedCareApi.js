import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/api/firebase";

function requireId(value, label) {
  if (!value) throw new Error(`${label} is required.`);
}

export async function getCareGroup(careGroupId) {
  requireId(careGroupId, "A care group ID");
  const snapshot = await getDoc(doc(db, "careGroups", careGroupId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function getCareGroupsForUser(userId) {
  requireId(userId, "A user ID");
  const groupsQuery = query(
    collection(db, "careGroups"),
    where("memberIds", "array-contains", userId),
  );
  const snapshot = await getDocs(groupsQuery);
  return snapshot.docs.map((groupDocument) => ({
    id: groupDocument.id,
    ...groupDocument.data(),
  }));
}

export function addCaregiverToGroup(careGroupId, userId) {
  requireId(careGroupId, "A care group ID");
  requireId(userId, "A user ID");
  return updateDoc(doc(db, "careGroups", careGroupId), {
    memberIds: arrayUnion(userId),
  });
}

export function removeCaregiverFromGroup(careGroupId, userId) {
  requireId(careGroupId, "A care group ID");
  requireId(userId, "A user ID");
  return updateDoc(doc(db, "careGroups", careGroupId), {
    memberIds: arrayRemove(userId),
  });
}
