// Who is calling. Every endpoint takes the caller from a verified Firebase ID token and
// never from the request body: a uid in a body is a request to delete somebody else's
// account (docs/account-deletion.md).
//
// The token normally comes from the Authorization header. GET /api/google/connect also
// accepts it as a query parameter, because that request can be a top level navigation to
// Google's consent screen and a browser cannot put a header on one of those.
import { auth } from "./admin.js";

export const TOKEN_ERROR = "auth/invalid-token";

function unauthorised(message = "Sign in again, then try that once more.") {
  const error = new Error(message);
  error.code = TOKEN_ERROR;
  error.status = 401;
  return error;
}

export function readToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (match) return match[1].trim();
  const query = req?.query?.token;
  const fromQuery = Array.isArray(query) ? query[0] : query;
  return typeof fromQuery === "string" && fromQuery ? fromQuery : "";
}

// Returns the decoded token, or throws a 401 shaped error.
export async function requireUser(req) {
  const token = readToken(req);
  if (!token) throw unauthorised("You need to be signed in to do that.");
  try {
    return await auth.verifyIdToken(token);
  } catch (cause) {
    const error = unauthorised("Your sign in has expired. Sign in again, then try that once more.");
    error.cause = cause;
    return Promise.reject(error);
  }
}

export function isAuthError(error) {
  return error?.code === TOKEN_ERROR;
}
