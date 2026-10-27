/* global process */
// The OneMap token for server calls. OneMap tokens last about three days, so instead of pasting
// a new one each time, set ONEMAP_EMAIL and ONEMAP_PASSWORD (your free OneMap account) and the
// server fetches and reuses a fresh token itself. A fixed ONEMAP_TOKEN still works as a fallback.
let cached = { token: "", expires: 0 };

export async function oneMapToken() {
  const email = process.env.ONEMAP_EMAIL?.trim();
  const password = process.env.ONEMAP_PASSWORD;
  if (email && password) {
    if (cached.token && Date.now() < cached.expires - 3600000) return cached.token;
    try {
      const response = await fetch("https://www.onemap.gov.sg/api/auth/post/getToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (response.ok && data.access_token) {
        const expiry = Number(data.expiry_timestamp) * 1000;
        cached = { token: data.access_token, expires: Number.isFinite(expiry) && expiry > Date.now() ? expiry : Date.now() + 2 * 86400000 };
        return cached.token;
      }
      console.error("[onemap token] sign in was refused");
    } catch (error) {
      console.error("[onemap token]", error?.name, error?.message);
    }
  }
  return process.env.ONEMAP_TOKEN?.trim() || "";
}
