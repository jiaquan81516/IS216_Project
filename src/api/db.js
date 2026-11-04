import { connectFirestoreEmulator, getFirestore, initializeFirestore } from "firebase/firestore";
import app, { firebaseE2E } from "@/api/firebase";

// Auto-detect long polling so requests do not stall behind browsers, proxies or
// extensions that block Firestore's default streaming connection.
function createDb() {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const db = createDb();
if (firebaseE2E.enabled) {
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(firebaseE2E.firestoreHost);
  if (!match) throw new Error("Firestore E2E emulator host must be local.");
  connectFirestoreEmulator(db, match[1], Number(match[2]));
}
