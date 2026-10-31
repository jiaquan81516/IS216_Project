// The "welcome" loading time after signing in and after finishing setup. It gives the app a
// moment to settle and the person a moment to see that something is being prepared.
export const WELCOME_MS = 4000;

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits until `ms` have passed since `startedAt`, so the total is the same however fast the work was.
export const waitUntil = (startedAt, ms = WELCOME_MS) => wait(Math.max(0, ms - (Date.now() - startedAt)));

export const SIGN_IN_MESSAGES = Object.freeze(["Signing you in", "Getting your household ready", "Almost there"]);
export const SETUP_MESSAGES = Object.freeze(["Setting things up", "Getting resources", "Almost there"]);
