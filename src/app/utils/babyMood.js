// What one baby is doing right now, read from the care log: asleep (a sleep with no end yet), just
// fed (within 40 minutes), getting hungry (three hours since the last feed), or simply awake.
import { agoText, todaySummary } from "@/app/utils/homeSummary";
import { formatMinutes, formatTime as clockTime, lastOfType, toDate } from "@/app/utils/entryHelpers";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function expectedDueText(baby, at) {
  const value = baby?.babyDate;
  if (!ISO_DATE.test(value ?? "")) return "On the way";
  const [year, month, day] = value.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  const days = Math.round((target - today) / 86400000);
  if (days < 0) return "Past due date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days} days`;
  if (days < 14) return "Due in 1 week";
  return `Due in ${Math.floor(days / 7)} weeks`;
}

// Returns the mood of the picture plus the three tallies for today. An expected baby has a
// separate prenatal state: no care-log activity can make a baby who has not been born "awake".
export function readBaby(list, name, at, baby = {}) {
  if (baby?.babyStatus === "expected") {
    const detail = expectedDueText(baby, at);
    const title = detail === "On the way"
      ? `${name} is on the way`
      : detail === "Past due date"
        ? `${name}'s due date has passed`
        : `${name} is ${detail.toLowerCase()}`;
    return { expected: true, state: "expected", title, detail: "Care logging will be available after birth.", due: detail, feeds: 0, nappies: 0, sleep: "0 m" };
  }
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
