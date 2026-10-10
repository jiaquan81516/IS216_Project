// JSON answers and method checking for every function under /api.
//
// Error shape. The task asks for `{ error: { code, message } }` and
// docs/account-deletion.md promises a flat `{ code, message }`, which is what the client in
// src/v3/api/server.js reads. Rather than break one of the two, every error carries both: the
// nested `error` object and the same code and message at the top level. Adding fields is
// safe for both readers.

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function ok(res, body = {}) {
  sendJson(res, 200, { ok: true, ...body });
}

export function fail(res, status, code, message) {
  sendJson(res, status, { error: { code, message }, code, message });
}

// True when the request may go on. Answers 405 and returns false when it may not.
export function allowMethod(req, res, methods) {
  const allowed = Array.isArray(methods) ? methods : [methods];
  if (allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed.join(", "));
  fail(res, 405, "server/method", `Use ${allowed.join(" or ")} for this endpoint.`);
  return false;
}

// Vercel parses a JSON body for us, but a string body or an empty one both turn up in the
// wild, so read it defensively.
export function readBody(req) {
  const body = req?.body;
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body) || {};
  } catch {
    return {};
  }
}

// One line of logging, with no personal data in it. See docs/account-deletion.md step 11.
export function logLine(tag, fields) {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`);
  console.log(`[${tag}] ${parts.join(" ")}`);
}
