import { getFirestore, initializeFirestore } from "firebase/firestore";
import app from "@/api/firebase";

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
