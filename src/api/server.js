// Thin client for the Vercel server functions under /api. The functions can be missing on a
// plain `vite dev`, so every call must fail politely when the endpoint is not there yet: a
// 404, a 405 or a network error all become one coded error the pages can explain.
//
// Every call carries `Authorization: Bearer <Firebase ID token>`, because the server takes
// the caller from the verified token and never from the body. A signed out caller sends no
// header and gets a 401 it can explain, which is the same outcome as before.
import { auth } from "@/api/firebase";

export const SERVER_UNREACHABLE = "server/unreachable";

// The signed in user's ID token, or null. Firebase refreshes it for us when it is close to
// expiring. A failure here is never fatal: the call goes out without a header and the server
// answers 401.
export async function currentIdToken() {
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch (cause) {
    console.error("[app server]", cause?.code, cause);
    return null;
  }
}

function unreachable(cause) {
  const error = new Error("The server is not set up yet.");
  error.code = SERVER_UNREACHABLE;
  if (cause) error.cause = cause;
  return error;
}

function failed(status, body) {
  const error = new Error(body?.message || "The server could not finish that.");
  error.code = body?.code || `server/${status}`;
  error.status = status;
  return error;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// GET or POST /api/<path>. Throws a SERVER_UNREACHABLE error when the function does not
// exist yet, so a page can show "not set up yet" rather than a stack trace.
export async function callServer(path, { method = "POST", body, getToken = currentIdToken } = {}) {
  const init = { method, headers: { Accept: "application/json" } };
  const token = await getToken();
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`/api/${path}`, init);
  } catch (cause) {
    throw unreachable(cause);
  }
  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw unreachable();
  }
  const data = await readJson(response);
  // A dev server with no function often answers the HTML app shell with a 200.
  if (data === null && response.ok) throw unreachable();
  if (!response.ok) throw failed(response.status, data);
  return data ?? {};
}

// The default way to leave the page. Passed in by the tests, because jsdom will not let a
// spy replace window.location.assign.
function goTo(url) {
  if (typeof window !== "undefined") window.location.assign(url);
}

// Starts the Google Calendar consent flow. The server answers with the URL to send the
// browser to; without one we fall back to the endpoint itself, which redirects. That fallback
// is a top level navigation, so it carries the ID token as a query parameter: a browser
// cannot put a header on a navigation. The server verifies it either way.
export async function startGoogleConnect(navigate = goTo, { getToken = currentIdToken } = {}) {
  const token = await getToken();
  const data = await callServer("google/connect", { method: "GET", getToken: async () => token });
  const fallback = token ? `/api/google/connect?token=${encodeURIComponent(token)}` : "/api/google/connect";
  const target = typeof data.url === "string" && data.url ? data.url : fallback;
  navigate(target);
  return target;
}

export function disconnectGoogle() {
  return callServer("google/disconnect");
}

// Runs one two way sync of the household calendar. Answers { pushed, pulled, deleted, errors }.
export function syncGoogleCalendar(householdId) {
  return callServer("google/sync", { body: { householdId } });
}

// "2 sent to Google, 1 brought in." or "Everything was already in step."
export function describeSyncResult(result) {
  const pushed = Number(result?.pushed) || 0;
  const pulled = Number(result?.pulled) || 0;
  const parts = [];
  if (pushed) parts.push(`${pushed} sent to Google`);
  if (pulled) parts.push(`${pulled} brought in`);
  const errors = Array.isArray(result?.errors) ? result.errors.length : 0;
  if (!parts.length) return errors ? "Nothing changed, and some events could not be synced." : "Everything was already in step.";
  const line = `${parts.join(", ")}.`;
  return errors ? `${line} Some events could not be synced.` : line;
}

// Deletes the account for real: removes the user document, the private check-ins and the
// device tokens, and anonymises the household entries. See docs/account-deletion.md.
export function deleteAccount() {
  return callServer("account/delete");
}

export function isServerUnreachable(error) {
  return error?.code === SERVER_UNREACHABLE;
}

// One sentence for the page. `what` names the part that is missing, for example "calendar".
export function describeServerError(error, what = "") {
  if (isServerUnreachable(error)) {
    return what ? `The ${what} server is not set up yet.` : "The server is not set up yet.";
  }
  return error?.message || "Something went wrong. Please try again.";
}
