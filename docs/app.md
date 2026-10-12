# Prototype App

App is built page by page. Each iteration adds one screen at a time under `src/app/`; V2 stays untouched and keeps working.

## Routes

| Step | Path | Notes |
| --- | --- | --- |
| Landing | `/` | public |
| 1 Journey | `/start` | preparing, newborn, return-to-work |
| 2 Role | `/role` | parent, partner, caregiver |
| 3 Account | `/account` | name, email, password, or Google |
| Sign in | `/signin` | email and password, or Google |
| 4 Household | `/household` | requires sign in; create, or join with a code |
| Home | `/home` | requires sign in and a household; inside the app shell layout |
| Care log | `/care-log` | same guard as Home; inside the app shell layout. `?log=feed` (or another type) opens the log panel and is then removed from the address |
| Handover | `/handover` | same guard and layout; real Firestore |
| Sleep rota | `/rota` | same guard and layout; real Firestore |
| Wellness | `/wellness` | same guard and layout; local state only |
| Support | `/support` | same guard and layout; local state only |
| Return to work | `/return-to-work` | same guard and layout; real Firestore |
| Calendar | `/calendar` | same guard and layout; real Firestore |
| Settings | `/settings` | same guard and layout; reached from the sidebar account menu, not the nav |
| Profile | `/profile` | same guard and layout; reached from the sidebar account menu, not the nav |

In create mode Step 4 also asks, all optional, for the baby's name, whether the baby is here or on the way, and the birth or due date. `babySummary()` in `src/api/profile.js` turns these into a name and a line such as "6 weeks old" for the Home page.

After creating or joining, Step 4 shows an inline success state with a "Go to home" button to `/home`. Signing in or creating an account with an existing household also goes to `/home`. The app guard sends `/home` visitors who are signed out to `/signin` and those without a household to `/household`.

## App shell and Home

`src/app/layouts/AppShell.vue` is a router layout: a 264px sticky sidebar (logo, household chip, 7 nav items, privacy note, user row) and a main column with a 1120px content area. Under 992px the sidebar becomes a top bar with a menu button. The shell calls `useHome()` once and provides it to pages (`HOME_KEY`), so the sidebar and page do not load twice. `useHome` reads the profile, household and members (`getHousehold`, `getHouseholdMembers` in `src/api/profile.js`), each with a timeout.

The shell also calls `useEntries(householdId)` once and provides it (`ENTRIES_KEY`), so Home and the care log share one live listener on `households/{id}/entries`. It calls `useHandovers(householdId, meUid)` the same way (`HANDOVERS_KEY`), so one listener on the newest 30 handovers feeds the handover page, the Home line and the care log dividers, and the sidebar can badge the Handover item when one is waiting for you. In the same way it calls `useShared(householdId, meUid, partnerUid)` once and provides it (`SHARED_KEY`), which binds the sleep rota, calendar and return to work stores to the household and unbinds them when the household changes or the shell unmounts. Pages inject it for the "Try again" button; the data itself comes from the Pinia stores. The listener waits for the household id (loading, never an error, until it exists), treats an empty collection as a normal empty snapshot, and reports `{ code }` on failure, with a 15 second watchdog that reports `timeout`.

Home is real data only. The main card reads "Log your first care entry" with a solid "Log care" button when there are no entries, or "Last feed {time}" with "Log a feed" and an outline "Open care log" when a feed exists. "Recent activity" lists the 5 newest entries (New badge for unseen partner entries) or "Nothing logged yet.". The Tonight card was removed until the rota page exists; there is no sample data, no "Sample" badge and no `homeSample.js`. The butter "Yours alone" check-in box stays.

All eight sidebar items link to the current pages (`src/app/data/nav.js`). The Home "Check in privately" button goes to `/wellness`.

## Firestore collections

- `users/{uid}`: displayName, email, photoURL, journey, role, householdId, onboarded, createdAt, lastSeenAt
- `households/{id}`: memberIds, inviteCode, journey, createdBy, createdAt, babyName (string or null), babyStatus (`born` or `expected`, default `born`), babyDate (`YYYY-MM-DD` or null; date of birth or due date)
- `households/{id}/members/{uid}`: displayName, photoURL, role, joinedAt
- `invites/{code}` (code looks like `NT-XXXX`): householdId, createdBy, createdAt, expiresAt, usedAt, usedBy, revokedAt
- `pumpingRooms/{roomId}` and `pumpingRooms/{roomId}/reports/{reportId}`: the shared pumping room directory (fields in `docs/data-model.md`)
- `households/{id}/handovers/{handoverId}`: the shift handovers (fields in `docs/data-model.md`)
- `households/{id}/rota/settings`, `households/{id}/nights/{yyyy-mm-dd}`, `households/{id}/swaps/{swapId}`, `households/{id}/events/{eventId}`, `households/{id}/tasks/{taskId}`, `households/{id}/rtw/plan`: the shared sleep rota, calendar and return to work plan (fields in `docs/data-model.md`)
- `googleTokens/{uid}`, `googleSync/{uid}`, `oauthStates/{nonce}`, `serverLimits/{uid}`: server only, written by the Firebase Admin SDK in the Vercel functions and denied to every client in `firestore.rules` (fields in `docs/data-model.md`, section 7b)

## Owner setup in the Firebase console

1. Authentication, Sign-in method: enable Email/Password (Google is already used by V2). Create the Firestore database (Build, Firestore Database).
2. Deploy the rules in `firestore.rules` (Firebase CLI: `firebase deploy --only firestore:rules`, or paste the file into the Rules tab and publish).

## Working rule

App is built page by page: logic and rules first, then one page UI at a time in `src/app/pages/<name>/index.vue`, shared pieces in `src/app/components/`.

## Landing layout

The App landing follows a Z pattern: top bar, then a hero row (copy and the only solid plum button on the left, a decorative coded preview on the right), then a "Where are you right now?" row of three link tiles, then a final row with the handover message on the left and an outline "Set up your household" button on the right. The preview is `aria-hidden` and uses `TonightTimeline` with a fixed time of 9:40 PM, inside a single white panel.

## Care log

`src/app/pages/care-log/index.vue` reads and writes real Firestore data in `households/{id}/entries` (fields in `docs/data-model.md`). Home links here with "Log a feed" (`?log=feed`), "Open care log" and "View full log".

Files:
- `src/api/entries.js`: `addEntry`, `updateEntry`, `deleteEntry`, `markSeen`, `subscribeEntries` (live, newest 50), `loadOlder`.
- `src/app/utils/entryHelpers.js`: pure helpers (`ENTRY_TYPES`, `summariseEntry`, `groupByDay`, `todayStats`, `lastOfType`, time formatting). No Firebase imports.
- `src/app/components/CareLogPanel.vue`: the right-side log and edit panel (a dialog; chips only, time never in the future). `ChipGroup.vue` is its radio-style chip row.
- Icons added to `Icon`: feed, diaper, note, medication, edit, trash, plus, check, x.

Load errors are logged with `console.error("[app care log]", error.code, error)` and shown by cause (`describeEntriesError` in `entryHelpers.js`): `permission-denied` means the entries rules in `firestore.rules` are not published yet, `failed-precondition` means a missing index, `unavailable` or timeout shows the connection message, anything else shows the code in a muted line. Failed mark-as-seen writes are only logged. The filter chips and the panel chips share `.app-chip` in `app.css`, which `AppShell`, the care log, Home and the chip components import themselves so the styles never depend on which page loaded first.

Behaviour: the timeline updates live. Entries by the partner that you have not seen show a "New" badge for the current visit; they are marked seen (`seenBy.<uid>`) shortly after they appear and the badge is gone on the next visit. Edit and delete exist only on entries you created. Delete asks inline ("Delete this entry?"). Undo is intentionally not built.

Rules (`firestore.rules`, under `households/{id}/entries/{entryId}`): members read; members create entries with `by` equal to their uid, a known type and a timestamp `at`; the author may update any field (but not change `by`); any member may update only their own key in `seenBy`; only the author deletes. Rules are not yet tested in the emulator. The query orders by `at` only, so it needs no composite index.

## Shared data for the sleep rota, calendar and return to work

These three pages read and write real Firestore under the household. Nothing of theirs is
kept in localStorage any more, and the old `nt.app.rota`, `nt.app.calendar` and `nt.app.rtw`
keys are gone: the first time a store binds it lifts an old payload into the household if
Firestore is still empty, and then removes the key (`migrateLegacyRota`,
`migrateLegacyCalendar`, `migrateLegacyRtw`). Old swap requests are not lifted, because they
were never real requests.

| Area | Firestore module | Store | Collections |
| --- | --- | --- | --- |
| Sleep rota | `src/api/rota.js` | `src/app/stores/rota.js` | `rota/settings`, `nights/{yyyy-mm-dd}`, `swaps/{swapId}` |
| Calendar | `src/api/calendar.js` | `src/app/stores/calendar.js` | `events/{eventId}` |
| Return to work | `src/api/rtw.js` | `src/app/stores/returnToWork.js` | `tasks/{taskId}`, `rtw/plan` |

Each api module follows `entries.js`: `onSnapshot` listeners that report `{ code }` on
failure and log `console.error("[app rota]", code, error)`, one shot reads wrapped in
`withTimeout`, `serverTimestamp()` for createdAt and updatedAt, and `setDoc(..., { merge:
true })` for the two single documents so a missing document is created on the first write.
The pure helpers stay where they were (`rotaHelpers.js`, `calendarHelpers.js`,
`rtwHelpers.js`) and are still tested on their own.

Each store has `loading`, `error` (`{ code }` or null), `writeError` (a sentence shown
inline when a write fails), `bind(householdId, meUid, partnerUid)` and `unbind()`. A page
shows "Loading..." in an `aria-live` region until the household id exists, so it never shows
an error before it could possibly have data, and shows `role="alert"` with an outline "Try
again" that re-binds. The messages come from `describeSharedError` in
`src/app/utils/sharedHelpers.js`, the same cause by cause style as the care log, so
`permission-denied` tells you to publish the latest `firestore.rules`.

Owners are uids now. The local stores used "me" and "partner", which mean nothing when two
people share the data, so an event owner, a task owner, a responsibility and the rota's
`firstOnDuty` all store a uid (or the string "both", or "open" for a night). The pages turn
that back into a name with `ownerLabel(owner, meUid, meName, partnerName)` and into a colour
with `ownerKey`, both in `src/app/utils/sharedHelpers.js`, which also holds `ownerUid` (a chip
choice back to a uid), `relativeTime` ("just now", "5 minutes ago", "yesterday") and
`updatedLine` ("Updated by Mei 5 minutes ago", shown on the rota settings and the return to
work plan).

Indexes: none are needed. Nights, events and tasks range over or order by one field each,
and swaps order by `createdAt` with the status filtered in the page, so
`firestore.indexes.json` stays empty.

Still local, by design: Wellness check-ins are private to one parent and stay in
`nt.app.checkins`, and pumping rooms added by hand stay in `nt.app.rooms`.

| Key | Store | Holds |
| --- | --- | --- |
| `nt.app.checkins` | `src/app/stores/checkins.js` | one `{date, mood 1-5, stress 1-5, savedAt}` per day, replaced when saved again the same day |
| `nt.app.rooms` | `src/app/stores/rooms.js` | pumping rooms added by the user (status "needs verification") |

Sleep rota: the plan is still generated by the pure helpers in `src/app/utils/rotaHelpers.js`
(`weekNights`, `restSummary`, `suggest`), which work in "me" and "partner" terms; the store
exposes `view`, the same plan with uids mapped onto those two words, and `plan`, the raw
settings. Swaps really work now: you ask in your own name, the other parent sees a pending
request and can Accept or Decline, and accepting writes the swap status and both night
documents in one batch. Only `to` may answer, only `from` may cancel. "Apply suggestion"
sends a request instead of changing the plan alone, except when the suggestion is that your
partner has too many nights and there is nothing to offer in return, where it simply puts
you on that night (nobody needs to agree to that). Setting a night by hand writes
`nights/{date}`; "Back to plan" deletes it. "Reset plan" writes the default settings and
clears every loaded night for both of you.

Wellness: mood and stress only, saved privately on this device. Mood "Very low" or stress
"Very high" shows a gentle note linking to Support. There is no "private" info box on the
page by design.

Support: Guides reuse the V2 help content (`src/data/help.js`, imported). Trusted resources
reuse the V2 Help side panel contacts (`src/app/data/support.js`); they are unverified and the
page says so. Pumping rooms use the two sample rooms in `src/app/data/pumpingRooms.js` (SAMPLE
DATA, not confirmed) plus rooms stored in `nt.app.rooms`. The map is a OneMap embed
iframe for the selected room; "Add to Google Calendar" opens a prefilled Google Calendar
event in a new tab (helpers in `src/app/utils/roomHelpers.js`).

Shared pieces: `src/app/components/Tabs.vue` (underlined tab bar with arrow keys; the page
renders the tabpanels).

## Return to work

`src/app/pages/return-to-work/index.vue` is a guided planner, not a dashboard: the first thing is the return date line, then the ordered "Next steps" list. Tabs: Plan, Responsibilities, Pumping preparation.

- Plan: with no date, "When do you go back?" and the page's one solid button, "Save date" (it becomes outline while the add task form is open). With a date, one sentence ("Back at work on 4 November. 21 days to go.") and a "Change date" text button. Tasks are grouped Overdue, This week (today and the next six days), Later, No date and Done, with empty groups left out, sorted by due date then title. Each task has a checkbox, owner badge, group, due text, edit and delete (inline "Delete this task?" confirm). "Add a task" opens an inline form. "Suggestions" lists six fixed prompts (`src/app/data/rtw.js`) that the user adds with one tap (owner both, no date); an added suggestion disappears. There is no sample data; the empty state says "No tasks yet. Add one or start from the suggestions below."
- Responsibilities (draft): eight areas, each with an owner chip row (Me, partner, Both, Not decided), a summary line, a hint when one person has 2 or more extra areas, and "Make a task" which adds a task with the chosen owner (both when undecided).
- Pumping preparation (draft): five checklist items with "n of 5 done", breaks per workday (2 to 4) and time of day chips with a summary, and a rooms list that reuses `SAMPLE_ROOMS` plus rooms saved in `nt.app.rooms`. "Open in Support" goes to `/support`; the Support page has no query for its pumping tab yet, so the link opens its first tab.
- Pure helpers (`src/app/utils/rtwHelpers.js`): `daysUntil`, `returnSentence`, `dueText`, `groupTasks`, `ownerCounts(tasks, meUid)` (open tasks only), `suggestedTasks`, `responsibilityCounts(responsibilities, meUid)`, `balanceHint`, `pumpingSummary`. The two counting helpers take the signed in uid, because an owner is a uid now. Components: `RtwResponsibilities.vue`, `RtwPumping.vue` (the checklist comes from the store's `pumpingItems`).
- Shared now: the date, the tasks and the plan are the same for both parents, a done task says who finished it ("Done by Mei 5 minutes ago"), and the plan shows "Updated by {name} {when}".

## Calendar

`src/app/pages/calendar/index.vue` is a shared month calendar in the TimeTree style, with a Month and Agenda switch (chips, no tabs). Both parents see the same events, live.

- Month view: Monday first, 6 weeks. Each cell shows the date (today is a plum circle), up to two single-line chips coloured by owner (me apricot, partner powder, both gray with a plum left border; the owner name is also in visually hidden text), "+n more", and a small moon with the initial of whoever is on night duty (`aria-label="Night duty: {name}"`). Night duty is read from the shared sleep rota through `nightOwner(rota.view, iso)` in `src/app/utils/calendarHelpers.js`. Multi-day events show as a chip on each day. Under 768px the chips become owner coloured dots and the day panel is a bottom sheet.
- Day panel: `src/app/components/CalendarDayPanel.vue`, a dialog like `CareLogPanel` (Escape closes, focus returns, focus is trapped). It lists the day's events with edit and delete (inline confirm) and holds the add and edit form: title, All day switch, start and end date (added so multi-day events can be made), start and end time, owner chips, type chips (Appointment, Family, Work) and notes (280 characters). "Add event" in the toolbar opens it in add mode for the selected day if that day is in the month shown, otherwise today, otherwise the first of the month shown.
- Agenda: events from today, grouped by day. Empty state "No events yet. Add the first one.".
- Owner chips still read Me, the partner's name and Both; the stored value is a uid or "both" (`CalendarDayPanel` takes a `me-uid` prop and maps both ways).
- Planned, not built: Google Calendar sync (V2 notes and `docs/design.md` describe the intent). Every event already carries `googleEventId: null` for it.

## Handover

`src/app/pages/handover/index.vue` is the boundary between two shifts. At the end of a shift
one parent sends a short summary of what happened, anything that needs attention and what is
coming up; the other parent reads it and accepts it. It is the same "since the last handover"
window Home and the care log already talk about, so it is now a real line in the data rather
than a figure of speech.

Files:
- `src/api/handovers.js`: `subscribeHandovers` (live, newest 30, ordered by `sentAt`),
  `subscribeLatestHandover`, `sendHandover`, `acceptHandover`, `updateHandover`. Same shape as
  `entries.js`: listeners report `{ code }` and log `console.error("[app handover]", code,
  error)`.
- `src/app/utils/handoverHelpers.js`: pure, fully tested. `periodStartFrom`, `summariseWindow`,
  `summaryBlocks`, `summaryLine`, `suggestedNextUp`, `handoverStatus`, `formatWindow`,
  `handoverRows`.
- `src/app/composables/useHandovers.js`: one live listener, bound in `AppShell` and shared
  through `HANDOVERS_KEY`. It also works out `latest`, `waitingForMe` and `waitingCount`.
- Icon added to `Icon`: `handover`, an arrow passing between two points.

The window: `periodStart` is the previous handover's `sentAt`, or the start of the current day
when there is none. `summary` is `summariseWindow(entries, periodStart, now)`, worked out from
the care log at send time and then frozen, so editing an entry later never rewrites history.
`sentAt` is the sending device's clock rather than `serverTimestamp()`, so the window the
sender just read on screen is exactly what is stored and the list is ordered the moment the
write is made locally.

The page: a prominent plain section at the top when a handover is waiting for you ("Mei handed
over at 7:10 AM", the window line, the summary as three stat blocks split by 1px vertical
lines, the note, an attention line marked with the words "Needs attention" rather than colour
alone, the next up list, and the page's single solid plum button "Accept handover"). Otherwise
the send form in the same plain style: the "Since 7:10 AM" window line, the live summary, a
note of at most 400 characters with a counter, a "Needs attention" checkbox that reveals a
short input, up to three removable chips for what is coming up with suggestions offered as
outline "Add" buttons plus a free text add, and one solid plum button "Send handover to Mei".
With nobody else in the household the button is disabled and says why. Below both is "Earlier
handovers", the last 10 as compact rows (time, who to whom, status text, feeds and sleep) that
expand to show the note. Loading, error and empty states follow the care log, so
`permission-denied` tells you to publish the latest `firestore.rules`
(`describeSharedError(code, "handovers")`).

`suggestedNextUp` only ever offers things that are already in the data, at most three: "Next
feed due around 9:00 PM" from the last feed logged plus three hours, "{name} is on duty
tonight" (or "Tonight is a split night") from the shared sleep rota, and "Medication due" when
a medication entry was logged with a repeat written in its note. It never invents clinical
advice.

Integration: Home shows one quiet line when a handover is waiting for you, linking to the
page, and no second solid button; its "Recent activity" header reads "Since the last handover"
once one exists. The care log timeline gets a 1px divider row labelled "Handover sent 7:10 AM"
at each boundary inside the loaded window, derived from the handovers the shared listener
already holds, so the log reads as shifts. A boundary with no entry on one side of it is left
out, so a divider never hangs at the top or the bottom of a day.

Rules (`firestore.rules`, under `households/{id}/handovers/{handoverId}`): members read; a
member creates one with `from` equal to their own uid and `to` another member, unaccepted; the
sender may fix it while `acceptedAt` is still null; the reader may only set `acceptedAt` and
`acceptedBy`, and only to their own uid; nothing is ever deleted. No index is needed, because
the query orders by `sentAt` alone.

## Settings and Profile

Both sit inside the app shell, with the same guard as Home, and neither is in the main nav.
They are reached from the sidebar user row, which is now an account menu
(`src/app/components/UserMenu.vue`): a button with `aria-expanded` that opens a plain 1px
bordered panel holding Profile, Settings and Sign out. The panel takes the arrow keys, closes
on Escape with focus back on the button, closes on a click outside and on a route change.

`/profile` edits `displayName` (required, 40 characters) and `role` (chips Mum, Dad, Carer)
and shows the email read only with the sign in method underneath, read from
`auth.currentUser.providerData` rather than stored by us. Saving writes `users/{uid}` and
mirrors `displayName` and `role` into `households/{hid}/members/{uid}` in one batch
(`saveProfile` in `src/api/account.js`), so the partner sees the new name without reading
the private user document. One solid plum button, "Save changes", with an inline `role="status"`
confirmation. The role values are `mum`, `dad` and `carer` from `docs/data-model.md`. The old
onboarding stored `parent`, `partner` or `caregiver`, so a profile carrying one of those shows
no chip selected rather than a wrong one.

`/settings` has no solid button at all: every control saves itself. A change updates the
screen at once, the write waits about 600 ms (`debounce` in `src/app/utils/settingsHelpers.js`),
and several fields changed close together go in one write, each under its own dotted path
(`settings.display.timeFormat` and so on), so two sections can never overwrite each other. A
quiet "Saved" sits in an `aria-live="polite"` region. The sections, each a plain section
separated by a 1px line:

- Notifications: the master "Push notifications" switch, then feeds due, partner logs,
  handovers and swap requests, a check-in reminder with a time, and quiet hours with a start
  and an end. Above them: "Push notifications need the server set up. These preferences are
  saved now and used once it is connected." Only the preferences are built. There is no FCM,
  no service worker, no token registration and no Firebase Messaging import anywhere.
- Google Calendar: an outline "Connect Google Calendar" that calls `startGoogleConnect()` in
  `src/api/server.js`, the connected state from `settings.calendar.connected`, an outline
  "Disconnect", and the three sync switches. With no server the page says "The calendar server
  is not set up yet." rather than failing.
- Display: time format chips, week start chips and a reduce motion switch. These are real:
  `src/app/composables/usePrefs.js` holds them in one small module level store, filled once
  by `useHome` from the profile and updated the moment a chip is tapped. The calendar month
  grid reads `weekStart` from it and the care log renders its times through its `formatTime`,
  so both change straight away. Reduce motion sets `data-app-motion="reduce"` on the document
  element, which `app.css` uses to switch the few colour transitions off.
- Privacy: "Show my partner when I was last active" (`privacy.shareLastSeen`).
- Partner: the partner's name and role when somebody has joined, otherwise the invitation
  code with Copy, how long it lasts ("Expires in 6 days") and an outline "Generate a new code".
- Household: baby name, status and date, saved to `households/{hid}` by any member on the same
  600 ms debounce, then "Leave household" behind a typed LEAVE.
- Danger zone: "Delete my account" behind a typed DELETE.

Both typed confirmations use `src/app/components/ConfirmDanger.vue`: an outline button with
coral text, disabled until the word matches, never a solid red one.

`.env.example` lists the `VITE_FIREBASE_*` keys and `VITE_FIREBASE_VAPID_KEY`, which is only
needed when push is built. `src/api/firebase.js` still holds the config inline, because it is
a V2 file and App does not change it.

## Partner linking and invitation expiry

An invite is `invites/{code}` with `householdId`, `createdBy`, `createdAt`, `expiresAt` (seven
days), `usedAt`, `usedBy` and `revokedAt`. The pure helpers are in
`src/app/utils/inviteHelpers.js`: `inviteState` reads "valid", "expired", "used", "revoked" or
"missing", `describeInviteState` turns that into the sentence the user reads, and
`expiresInText` gives "Expires in 6 days". An invite with no `expiresAt` is treated as valid
for ever, so the codes that already exist keep working.

`joinHousehold` now reads the invite first and refuses an expired, used or revoked code with
its own error code (`invite/expired` and so on) and its own sentence, for example "That code
has expired. Ask your partner for a new one." On success it marks the invite used in the same
batch as the join, so a code cannot be passed on to a third person. `createHousehold` writes
the expiry from the start. `regenerateInviteCode` writes a new invite, points
`households/{hid}.inviteCode` at it and marks the old invite `revokedAt` rather than deleting
it, so an old code gets "That code was replaced" instead of "not found".

## Pumping rooms

The directory is the top level collection `pumpingRooms`, shared by every household, because a
nursing room at a mall is the same room for everyone. `src/api/rooms.js` has
`subscribeRooms`, `addRoom` and `reportRoom`; the Pinia store `src/app/stores/rooms.js` binds
the listener, maps each document to the list shape with `roomView` in
`src/app/utils/roomHelpers.js` and falls back to the two seed rooms in
`src/app/data/pumpingRooms.js` while the collection is empty. The seed rooms are marked
`seed: true` and the page says so; they cannot be confirmed or flagged, because they are not
database rows. The old `nt.app.rooms` key is gone and nothing migrates it: two placeholder rooms
on one laptop are not worth a migration.

The Support page keeps its filters, the map embed and "Add to Google Calendar", and gains a
"Confirm this room" and "Flag as gone" pair of outline buttons per real room. A report writes
`pumpingRooms/{roomId}/reports/{reportId}` with `{ by, field, value, at }` and moves the room's
`status` and `verifiedAt` in the same batch, so the answer and the record can never disagree.
Confirming shows "Verified 3 days ago" from `verifiedAt`. Flagging as gone sets the status back
to `unverified` and records the word "gone" in the report, because the status field only has
two values and the report is where the reason lives.

## Rate limiting on the client

`src/app/utils/limits.js` keeps a sliding window per action in `localStorage` under
`nt.app.limits`: at most 5 room reports, 10 entries, 3 invite regenerations and 3 account
deletion attempts in ten minutes. Over the limit the action is refused with "You have done that
a few times just now. Try again in a few minutes." The deciding part (`pruneStamps`, `decide`)
is pure and tested; the storage wrapper swallows a blocked `localStorage`. Signing out clears
the counters, so one person's limit does not follow the next. This is a courtesy guard, not
security: the real limits belong on the server, and the rules now at least make every write
attributable and bounded.

## Account deletion

"Delete my account" calls `deleteAccount()` in `src/api/server.js`, which posts to
`/api/account/delete`. When that function does not exist yet the page falls back to
`deleteAccountFallback` in `src/api/account.js`, which removes what the browser is allowed
to remove and then lists in plain words what it could not, rather than claiming a clean
deletion. `auth/requires-recent-login` becomes "sign out, sign in again, and then delete your
account". The full server procedure is written out in `docs/account-deletion.md`.

## The server functions

Six Vercel serverless functions under `/api`, ESM like the rest of the repository, each one a
default export `(req, res)`. `docs/setup.md` is the copy paste guide to the Firebase, Google
Cloud and Vercel steps they need; `/api/health` says which environment variable groups are
set, and never what is in them.

Shared modules live in `api/_lib/`, which Vercel does not route because the folder starts with
an underscore:

| Module | What it does |
| --- | --- |
| `admin.js` | Firebase Admin, started on first use, not on import, from `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (literal `\n` turned back into newlines). Exports lazy `db` and `auth`, so a missing variable answers `server/not-configured` from the endpoint instead of crashing before the handler runs. |
| `auth.js` | `requireUser(req)` verifies `Authorization: Bearer <idToken>` with `auth.verifyIdToken` and returns the decoded token, or throws a 401. It also accepts a `token` query parameter, for the one request that is a top level navigation. |
| `respond.js` | `ok`, `fail`, `sendJson`, `allowMethod`, `readBody`, `logLine`. Every error carries `{ error: { code, message }, code, message }`: the nested shape is the house style, the flat one is what `src/api/server.js` already reads, so both are sent. |
| `rateLimit.js` | a per uid sliding window in `serverLimits/{uid}`, one array of millisecond timestamps per action, trimmed on write. 3 account deletions, 10 calendar connects and 20 syncs per ten minutes, answered 429 with a `Retry-After` header. A Firestore failure in the limiter never blocks the user. |
| `limitWindow.js` | the pure deciding half of that limiter (`pruneStamps`, `decide`), unit tested |
| `google.js` | the OAuth2 client from `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI`; loading a stored refresh token, getting an authorised calendar client, persisting a rotated token, finding or creating the secondary calendar called "NurtureTrack", and revoking a grant |
| `state.js` | the signed OAuth `state` value: `{ uid, nonce }` plus a five minute expiry, HMAC signed with `OAUTH_STATE_SECRET`. Pure, so it is unit tested. |
| `calendarMap.js` | the mapping between a NurtureTrack event and a Google event in both directions, and the conflict rule. Pure, so it is unit tested. |
| `batch.js` | `chunk(items, 400)`, because Firestore takes at most 500 writes in a batch and 400 leaves room |

### The endpoints

| Endpoint | Contract |
| --- | --- |
| `GET /api/health` | `{ ok, time, env: { firebaseAdmin, google, oauthState, app }, missing: [names] }`. Never a value, only whether one is present. |
| `GET /api/google/connect` | Signed in. Answers `{ ok, url }` to a fetch, and a 302 to the same URL to a top level navigation, which is why it also accepts the ID token as `?token=`. Scopes `calendar` and `calendar.events`, `access_type=offline`, `prompt=consent`. |
| `GET /api/google/callback` | Google's redirect. Always ends as a redirect to `${APP_URL}/settings?calendar=connected`, `=error` or `=denied`, because a person is looking at it. |
| `POST /api/google/disconnect` | Signed in. Revokes at Google, deletes `googleTokens/{uid}` and `googleSync/{uid}`, sets `settings.calendar.connected` to false. Idempotent. |
| `POST /api/google/sync` | Signed in, body `{ householdId }`, and the caller must be in that household's `memberIds` or it is a 403. Answers `{ ok, pushed, pulled, deleted, errors }`. |
| `POST /api/account/delete` | Signed in. The procedure in `docs/account-deletion.md`. Answers a summary of what was removed. |

### The sync, and the conflict rule

The calendar is a secondary Google calendar called "NurtureTrack", created on first connect,
so nothing NurtureTrack does ever touches the user's main calendar.

**Push.** Every event under `households/{hid}/events` changed since `lastSyncedAt` is inserted
or patched in Google, and the Google event id is written back on the Firestore document so the
next run patches instead of making a second copy. The first run, when there is no
`lastSyncedAt`, pushes everything. Each pushed event carries private extended properties
`ntEventId`, `ntType` and `ntOwner`, which is how the pull recognises an event that came from
here.

**Deletes.** There is no tombstone collection, and the browser writes nothing extra. The
server keeps its own map in `googleSync/{uid}.pushed` of what it pushed; any id in that map
with no Firestore document behind it any more is deleted from Google and dropped from the map.
A 404 or 410 from Google means it was already gone, which is the outcome we wanted.

**Pull.** `events.list` with the stored `syncToken` when there is one, so only what changed
comes back, otherwise the last 60 days onward with `singleEvents: true`. A 410 means the token
is too old: it is thrown away and the window is read in full. A cancelled Google event deletes
the matching Firestore document. A Google event with no match is created with `source:
"google"`.

**Conflict rule.** Whichever side was updated later wins. Firestore's `updatedAt` is compared
with Google's `updated`, which the server keeps on the document as `googleUpdatedAt` so the
next run has something to compare against. A tie goes to NurtureTrack, so a second run with
the same data changes nothing and the sync is safe to press twice. A side with no timestamp
loses to a side that has one; with no timestamp anywhere, NurtureTrack wins for the same
reason.

**Time zone.** Every timed event is sent with an explicit `timeZone` of "Asia/Singapore", and
an event coming back from Google in any offset is read as the matching Singapore wall clock.
Singapore has been +08:00 with no daylight saving since 1982, so the mapping uses a fixed
offset, which keeps `calendarMap.js` pure and its tests deterministic. Google's all day end
date is exclusive, so a NurtureTrack event ending on the 26th is sent as ending on the 27th
and read back as the 26th.

### What changed in the client

- `src/api/server.js` adds `Authorization: Bearer <ID token>` to every call from
  `auth.currentUser.getIdToken()`, and keeps every existing graceful behaviour: a 404, 405,
  501, an HTML answer or a network failure is still one `server/unreachable` error. It gained
  `syncGoogleCalendar(householdId)` and `describeSyncResult(result)`. `startGoogleConnect`
  asks for the token once and puts it in the fallback URL, because that fallback is a top
  level navigation and a browser cannot put a header on one.
- Settings reads `?calendar=connected`, `=error` or `=denied` on mount, says so in one line
  (`role="status"`, or `role="alert"` when it went wrong) and takes the flag out of the
  address so a refresh does not say it again. The Calendar section gained a "Sync now" outline
  button, shown only while connected, disabled while it runs, which reports the counts in
  plain words underneath. Settings still has no solid button anywhere.
- The Calendar page shows one muted line, "Synced with Google Calendar", when
  `settings.calendar.connected`, and nothing at all otherwise. Connecting and syncing stay on
  Settings.

Push notifications are still not built: no FCM, no service worker, no `firebase/messaging`
import anywhere. The notification preferences in Settings are saved and untouched.
