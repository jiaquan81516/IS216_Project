// What one baby is doing right now, read from the care log: asleep (a sleep with no end yet), just
// fed (within 40 minutes), getting hungry (three hours since the last feed), or simply awake.
import { agoText, todaySummary } from "@/app/utils/homeSummary";
import { formatMinutes, formatTime as clockTime, lastOfType, toDate } from "@/app/utils/entryHelpers";

// Returns the mood of the picture plus the three tallies for today.
export function readBaby(list, name, at) {
  const sum = todaySummary({ entries: list, now: at });
  const sleepText = sum.sleepMinutes ? formatMinutes(sum.sleepMinutes) : "0 m";
  const tally = { feeds: sum.feeds, nappies: sum.nappies, sleep: sleepText };
  const sleep = lastOfType(list, "sleep");
  const sleepStart = sleep ? toDate(sleep.at) : null;
  const sleepMinutes = sleepStart ? (at.getTime() - sleepStart.getTime()) / 60000 : 0;
  if (sleep && sleepStart && !toDate(sleep.endedAt) && sleepMinutes >= 0 && sleepMinutes < 16 * 60) {
    return { ...tally, state: "sleeping", title: `${name} is sleeping`, detail: `Since ${clockTime(sleepStart)}, ${formatMinutes(sleepMinutes)} so far` };
  }
  const fedAt = sum.lastFeedAt;
  const fedMinutes = fedAt ? (at.getTime() - fedAt.getTime()) / 60000 : null;
  if (fedMinutes !== null && fedMinutes >= 0 && fedMinutes < 40) {
    return { ...tally, state: "fed", title: `${name} has just been fed`, detail: `Fed ${agoText(fedAt, at)}` };
  }
  if (fedMinutes !== null && fedMinutes >= 180) {
    return { ...tally, state: "hungry", title: `${name} may be getting hungry`, detail: `Last fed ${agoText(fedAt, at)}` };
  }
  return { ...tally, state: "awake", title: `${name} is awake`, detail: fedAt ? `Last fed ${agoText(fedAt, at)}` : "No feeds logged yet" };
}
