// How a check-in blooms. Every check-in carries a stage, stored with it, so the dashboard can show a
// flower for each parent without reading their private answers again.
//   budding   closed, muted: no check-in yet (also what a check-in settles back to once support is arranged)
//   opening   a soft colour, half open: an ordinary, middling day
//   bloom     fully open, warm: doing well
//   drooping  petals folding: struggling
//   wilted    bowed stem, faded: needs support
export const MOOD_STAGES = Object.freeze(["budding", "opening", "bloom", "drooping", "wilted"]);

// What a parent can ask for when they check in. checkOnMe is assumed when nothing is chosen.
export const NEEDS = Object.freeze(["coverTonight", "checkOnMe", "giveSpace"]);
export const DEFAULT_NEED = "checkOnMe";

// From the two required answers: mood and the load carried, each 1 to 5.
export function moodStageFor({ mood, stress } = {}) {
  if (mood === 1 || stress === 5) return "wilted";
  if (mood === 2 || stress === 4) return "drooping";
  if (mood >= 4 && stress <= 3) return "bloom";
  return "opening";
}

export const isStruggling = (stage) => stage === "drooping" || stage === "wilted";
