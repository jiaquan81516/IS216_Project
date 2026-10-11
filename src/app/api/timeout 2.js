// Reject instead of hanging forever when the database cannot be reached.
export function withTimeout(promise, ms = 10000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("The database did not answer in time.");
      error.code = "unavailable";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
