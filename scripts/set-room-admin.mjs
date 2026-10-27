// Run only in a trusted terminal with the server's Firebase environment variables.
import process from "node:process";
import { readFile } from "node:fs/promises";

// For "name" the third argument is the display name; the key comes from the environment.
const [uid, action, third] = process.argv.slice(2);
const keyFile = action === "name" ? undefined : third;
if (!uid || !["grant", "revoke", "check", "list", "name"].includes(action)) {
  console.error("Usage: node scripts/set-room-admin.mjs <firebase-uid> grant|revoke|check [service-account.json]\n       node scripts/set-room-admin.mjs - list [service-account.json]");
  process.exitCode = 1;
} else {
  // Load credentials only in Node, before the server module reads its environment.
  if (keyFile) {
    const key = JSON.parse(await readFile(keyFile, "utf8"));
    if (!key.project_id || !key.client_email || !key.private_key) {
      throw new Error("The key file must be a Firebase service account JSON file.");
    }
    process.env.FIREBASE_PROJECT_ID = key.project_id;
    process.env.FIREBASE_CLIENT_EMAIL = key.client_email;
    process.env.FIREBASE_PRIVATE_KEY = key.private_key;
  }
  const { auth, db } = await import("../api/_lib/admin.js");
  // The admins collection is only a directory, so finding every administrator never means
  // paging through all users. Access still comes from the admin claim on the sign in token.
  if (action === "list") {
    const snapshot = await db.collection("admins").get();
    console.log(JSON.stringify(snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })), null, 2));
    process.exit(0);
  }
  if (action === "name") {
    if (!third) throw new Error("Give the display name, for example: <uid> name bob.lim.111");
    await auth.updateUser(uid, { displayName: third });
    console.log(`Display name for ${uid} set to ${third}. Sign out and sign in to refresh the session.`);
    process.exit(0);
  }
  const user = await auth.getUser(uid);
  if (action === "check") {
    console.log(JSON.stringify({ projectId: process.env.FIREBASE_PROJECT_ID, uid: user.uid, admin: user.customClaims?.admin === true, disabled: user.disabled }));
  } else {
    const claims = { ...user.customClaims };
    if (action === "grant") claims.admin = true;
    else delete claims.admin;
    await auth.setCustomUserClaims(uid, claims);
    const entry = db.collection("admins").doc(uid);
    if (action === "grant") await entry.set({ email: user.email ?? null, grantedAt: new Date().toISOString() });
    else await entry.delete();
    console.log(`Room admin access ${action === "grant" ? "granted" : "revoked"} for ${uid}. Sign out and sign in to refresh the session.`);
  }
}
