// Run only in a trusted terminal with the server's Firebase environment variables.
import process from "node:process";
import { readFile } from "node:fs/promises";

const [uid, action, keyFile] = process.argv.slice(2);
if (!uid || !["grant", "revoke", "check"].includes(action)) {
  console.error("Usage: node scripts/set-room-admin.mjs <firebase-uid> grant|revoke|check [service-account.json]");
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
  const { auth } = await import("../api/_lib/admin.js");
  const user = await auth.getUser(uid);
  if (action === "check") {
    console.log(JSON.stringify({ projectId: process.env.FIREBASE_PROJECT_ID, uid: user.uid, admin: user.customClaims?.admin === true, disabled: user.disabled }));
  } else {
    const claims = { ...user.customClaims };
    if (action === "grant") claims.admin = true;
    else delete claims.admin;
    await auth.setCustomUserClaims(uid, claims);
    console.log(`Room admin access ${action === "grant" ? "granted" : "revoked"} for ${uid}. Sign out and sign in to refresh the session.`);
  }
}
