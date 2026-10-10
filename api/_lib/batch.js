// Firestore takes at most 500 operations in one batched write. Every server function here
// stays under 400, which leaves room for the extra writes a step adds around the loop.

export const BATCH_MAX = 400;

// Splits a list into chunks of at most `size`. A size of 0 or less, or a value that is not a
// list, gives back an empty list rather than throwing, because a sync run must not die on an
// empty collection.
export function chunk(items, size = BATCH_MAX) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const asked = Math.floor(Number(size));
  const step = Number.isFinite(asked) && asked > 0 ? asked : BATCH_MAX;
  const out = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

// How many batches a list of writes will take. Useful for the summary bodies.
export function batchCount(items, size = BATCH_MAX) {
  return chunk(items, size).length;
}
