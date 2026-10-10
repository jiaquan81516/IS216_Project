// Pure helpers for the shared App pages (sleep rota, calendar, return to work).
// No Vue, Pinia, Firebase or storage imports.
//
// Shared data stores an owner as a user id, or the string "both". The pages still show
// "Me", the partner's name or "Both", so every owner value goes through ownerLabel or
// ownerKey with the signed in user's uid.
import { toDate } from "./entryHelpers";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The name to show for an owner. "both" is Both, the signed in user is meName and any other
// uid is the other parent. An empty owner has no label.
export function ownerLabel(owner, meUid, meName = "Me", partnerName = "Your partner") {
  if (owner === "both") return "Both";
  if (owner === "open") return "Open";
  if (!owner) return "";
  if (meUid && owner === meUid) return meName || "Me";
  if (owner === "me") return meName || "Me";
  if (owner === "partner") return partnerName || "Your partner";
  return partnerName || "Your partner";
}

// The styling and counting key for an owner: "me", "partner", "both", "open" or null.
// Plain "me" and "partner" pass through, so the pure plan helpers keep working.
export function ownerKey(owner, meUid) {
  if (owner === "both" || owner === "open" || owner === "me" || owner === "partner") return owner;
  if (!owner) return null;
  if (meUid && owner === meUid) return "me";
  return "partner";
}

// The value to store for a chip choice. "none" and anything unknown store nothing.
export function ownerUid(key, meUid, partnerUid) {
  if (key === "both") return "both";
  if (key === "me") return meUid || null;
  if (key === "partner") return partnerUid || null;
  return null;
}

// "just now", "5 minutes ago", "2 hours ago", "yesterday", "on 2 October".
export function relativeTime(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return "";
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1 minute ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 2) return "1 hour ago";
  const sameDay = date.toDateString() === now.toDateString();
  if (hours < 24 && sameDay) return `${hours} hours ago`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "yesterday";
  return `on ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// "Updated by Mei 5 minutes ago". Empty when nothing has been saved yet.
export function updatedLine(record, meUid, meName = "you", partnerName = "your partner", now = new Date()) {
  const when = relativeTime(record?.updatedAt, now);
  if (!when) return "";
  const who = ownerLabel(record?.updatedBy, meUid, meName, partnerName);
  return who ? `Updated by ${who} ${when}` : `Updated ${when}`;
}

// Turns a Firestore error code into the message shown on a shared page. `what` names the
// thing that failed to load, for example "sleep rota".
export function describeSharedError(code, what = "page") {
  const c = String(code ?? "");
  if (c === "permission-denied") {
    return {
      text: `Your database rules do not allow reading the ${what} yet. Publish the latest firestore.rules in the Firebase console, then try again.`,
      detail: "",
    };
  }
  if (c === "failed-precondition") {
    return { text: "The database needs an index for this view. Check the console link in the browser log.", detail: "" };
  }
  if (c === "unavailable" || c === "timeout" || c === "deadline-exceeded") {
    return { text: `We could not load the ${what}. Check your connection and try again.`, detail: "" };
  }
  return { text: `We could not load the ${what}.`, detail: c ? `Error code: ${c}` : "" };
}
