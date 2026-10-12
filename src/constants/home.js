// Placeholder sample data for the Home page.
export const TASKS = [
  { id: "bottles", title: "Wash and sterilise two bottles", description: "Takes about ten minutes." },
  {
    id: "nappies",
    title: "Check nappies and wipes for tomorrow",
    description: "There are six nappies left in the changing bag.",
  },
];

export const COMING_UP = [
  {
    title: "Baby's 3-week check",
    dow: "Thu",
    day: "8",
    detail: "10:30 AM at the clinic. You are both listed.",
    calendar: { start: "20261008T103000", end: "20261008T113000", location: "Clinic" },
  },
  { title: "Your night on call", dow: "Sun", day: "11", detail: "6 PM to 6 AM." },
];

export const RETURN_TO_WORK = { done: 4, total: 9, daysToGo: 27 };

// Opens a pre-filled Google Calendar event (Singapore time).
export function calendarUrl(ev) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Baby's 3-week check",
    dates: `${ev.start}/${ev.end}`,
    ctz: "Asia/Singapore",
    details: "Added from NurtureTrack.",
    location: ev.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
