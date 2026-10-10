// The OAuth `state` value. Google hands it back to us untouched, so it has to be something
// we can trust on the way back: it carries the uid and a nonce, it is signed with a server
// secret, and it expires. The nonce is also written to Firestore and consumed exactly once
// by the callback, so a replayed state value is refused even inside its five minutes.
//
// Pure on purpose: no Firebase, no googleapis, no process.env. The caller passes the secret.
import { Buffer } from "node:buffer";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STATE_TTL_MS = 5 * 60 * 1000;

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text) {
  const padded = String(text).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded + "=".repeat((4 - (padded.length % 4)) % 4), "base64");
}

function sign(payload, secret) {
  return b64url(createHmac("sha256", String(secret)).update(payload).digest());
}

export function newNonce() {
  return b64url(randomBytes(18));
}

// `{ uid, nonce }` plus an expiry becomes "<payload>.<signature>".
export function encodeState({ uid, nonce }, secret, { now = Date.now(), ttlMs = STATE_TTL_MS } = {}) {
  if (!uid) throw new Error("A state value needs a uid.");
  if (!nonce) throw new Error("A state value needs a nonce.");
  if (!secret) throw new Error("A state value needs a signing secret.");
  const payload = b64url(JSON.stringify({ uid, nonce, exp: now + ttlMs }));
  return `${payload}.${sign(payload, secret)}`;
}

// Gives back `{ uid, nonce, exp }`, or throws an Error with a `code` of "state/bad" or
// "state/expired". Never trust anything in here before this function has run.
export function decodeState(state, secret, { now = Date.now() } = {}) {
  const bad = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };
  const text = String(state ?? "");
  const dot = text.indexOf(".");
  if (dot <= 0 || dot === text.length - 1) throw bad("state/bad", "That sign in link is not complete.");
  const payload = text.slice(0, dot);
  const given = text.slice(dot + 1);
  const wanted = sign(payload, secret);
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw bad("state/bad", "That sign in link has been changed.");
  }
  let data;
  try {
    data = JSON.parse(fromB64url(payload).toString("utf8"));
  } catch {
    throw bad("state/bad", "That sign in link is not readable.");
  }
  if (!data || typeof data.uid !== "string" || typeof data.nonce !== "string") {
    throw bad("state/bad", "That sign in link is missing something.");
  }
  if (!Number.isFinite(data.exp) || data.exp <= now) {
    throw bad("state/expired", "That sign in link has expired. Start again from Settings.");
  }
  return { uid: data.uid, nonce: data.nonce, exp: data.exp };
}
