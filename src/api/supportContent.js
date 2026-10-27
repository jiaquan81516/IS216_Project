import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./db";

// The Support page text lives in supportContent/guides and supportContent/contacts, each
// holding one ordered `items` list. Until an administrator saves a list, the page shows
// the built-in defaults from src/app/data/support.js.
export const SUPPORT_LISTS = Object.freeze(["guides", "contacts"]);
export const SUPPORT_MAX_ITEMS = 30;

const ref = (list) => doc(db, "supportContent", list);

export function subscribeSupportList(list, onData, onError) {
  return onSnapshot(ref(list), (snapshot) => {
    const items = snapshot.exists() ? snapshot.data().items : null;
    onData(Array.isArray(items) ? items : null);
  }, onError);
}

export async function saveSupportList(uid, list, items) {
  if (!uid || !SUPPORT_LISTS.includes(list) || !Array.isArray(items) || items.length > SUPPORT_MAX_ITEMS) {
    throw new Error("A signed-in administrator and a valid list are required.");
  }
  await setDoc(ref(list), { items, updatedBy: uid, updatedAt: serverTimestamp() });
}
