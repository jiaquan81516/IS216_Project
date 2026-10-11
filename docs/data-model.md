# NurtureTrack data model (Firestore)

Cloud Firestore, document and collection based. Shared data lives under one household. Personal data lives under the user. Check-ins are private and locked to one user.

## 1. Overview

```
users/{uid}
  devices/{deviceId}
  checkins/{yyyy-mm-dd}          PRIVATE
households/{householdId}
  members/{uid}
  entries/{entryId}
  handovers/{handoverId}
  rota/settings
  nights/{yyyy-mm-dd}
  swaps/{swapId}
  events/{eventId}
  tasks/{taskId}
  rtw/plan
pumpingRooms/{roomId}
  reports/{reportId}
```

## 2. User

### users/{uid}  (only this user can read and write)

Profile
- displayName (string): defaults from Google, editable
- email, photoURL (string): from Google, read only in the app
- role (string): mum | dad | carer
- householdId (string or null): null until they create or join one
- onboarded (boolean): replaces the localStorage flag, so a new phone does not repeat setup
- confidence (number 1 to 5): from the onboarding scale, private
- createdAt, lastSeenAt (timestamp)

Settings
- notifications
  - push (boolean): master switch
  - feedsDue, partnerLogs, handovers, swapRequests (boolean)
  - checkInReminder: { on: boolean, time: "21:30" }
  - quietHours: { on: boolean, start: "23:00", end: "05:00" }
- calendar
  - connected (boolean), calendarId (string)
  - syncOn: { rota, appointments, myReminders } (boolean)
  - lastSyncedAt (timestamp)
- display
  - timeFormat: "12h" | "24h"
  - weekStartsOn: "mon" | "sun"
  - reduceMotion (boolean)
- privacy
  - shareLastSeen (boolean): whether your partner sees "seen 9:12 PM"

### users/{uid}/devices/{deviceId}
- fcmToken (string), platform (string), addedAt, lastUsedAt (timestamp)
- One document per device so dead tokens can be deleted individually.

### users/{uid}/checkins/{yyyy-mm-dd}  PRIVATE
- mood, stress, sleep, confidence (number 1 to 5)
- savedAt (timestamp)
- Never copy these numbers into any shared document or summary.

## 3. Household

### households/{householdId}
- babyName (string or null), babyStatus ("born" | "expected", default "born"), babyDate ("YYYY-MM-DD" string or null: date of birth when born, due date when expected; replaces the old born and dueDate fields), birthWeightKg (number)
- feeding (array of string): breast, formula, expressed
- memberIds (array of uid): used by security rules
- inviteCode (string): the code that is live now. Its expiry lives on the invite document,
  not here, so one place owns it.
- nights: { start: "21:00", end: "07:00", mode: "alternate" | "manual", first: uid }
- alerts: { feeds, partnerLogs, handovers, checkIn } (boolean defaults for new members)
- returnToWorkDate (timestamp)
- createdAt (timestamp)

### households/{id}/members/{uid}
- displayName, photoURL, role, joinedAt
- Copied from the user profile when they join and when they edit it, so the partner can see a name and photo without reading the private user document.
- App: the Profile page writes `users/{uid}` and this document in one batch (`saveProfile` in
  `src/app/api/account.js`), so the two copies of the name and role can never disagree. Only
  the member themselves may write or delete their own member document.

### households/{id}/entries/{entryId}  (the care log)
- type: feed | sleep | nappy | medication | note
- at (timestamp), endedAt (timestamp or null)
- by (uid)
- details (map): method, side, minutes, ml, nappyType, drug, text
- seenBy (map uid to timestamp): drives the unseen marker and "N new from Mei"
- createdAt (timestamp)
- App care log: `byName` (string) is the author's first name at the time of logging, and `details.text` is an optional note on any type (the whole body of a `note`). `details.nappyType` is wet | dirty | both; `details.method` is breast | bottle | expressed.
- A subcollection, not an array, so two parents logging at once do not collide and the document size limit is never hit.

### households/{id}/handovers/{handoverId}
- from, to (uid): the sender and the only person who may accept it
- sentAt (timestamp): the end of the shift. Written from the sending device's clock, not
  `serverTimestamp()`, so the window the sender just read on screen is exactly what is stored
  and the newest-first list is ordered the moment the write is made locally
- periodStart (timestamp): the start of the shift, which is the previous handover's `sentAt`,
  or the start of the current day when there is none. The pair is the "since the last
  handover" window Home and the care log refer to
- note (string, 400 characters): what the other parent should know
- needsAttention (boolean), attentionNote (string, 140 characters): shown with the words
  "Needs attention", never colour alone
- summary: { feeds, sleepMinutes, nappies }: a snapshot of the care log between periodStart
  and sentAt, worked out at send time (`summariseWindow` in
  `src/app/api/handoverHelpers.js`) and then frozen, so editing an entry later never rewrites
  a handover that has already been sent
- nextUp (array of string, at most 3): short lines, offered from real data by
  `suggestedNextUp` or typed by hand
- acceptedAt (timestamp or null), acceptedBy (uid or null): null until the reader accepts it
- createdAt (timestamp), updatedAt (timestamp, only when the sender fixed it before it was
  accepted)
- One document per handover, never deleted, so the history is the record of the shifts.

### households/{id}/posts/{postId}  (the Home stream's plain messages)
- text (string, 1 to 500 characters), authorUid (uid), createdAt (server timestamp)
- ackedBy (array of uid): empty on create. The reader adds their own uid with one update
  that also sets `ackedAt` (server timestamp). Nothing else on a post ever changes
- No edits. Only the author may delete. Rules: members read; create needs `authorUid == uid`,
  the text length and `createdAt == request.time`; update is the acknowledgement above and
  only for a member who is not the author
- Index: none. The query orders by `createdAt` only (newest 50)
- The Home stream is not a collection. It is built in the browser by `buildStream` in
  `src/app/api/stream.js` from posts, care log entries, handovers and tasks, so no existing
  collection changed. Push alerts for new posts are not built; the stream relies on future
  push (FCM) to tell a parent something arrived.

### households/{id}/rota/settings  (the shared sleep rota plan, one document)
- pattern (string): alternate | split | manual
- firstOnDuty (uid or null): who takes the first night of the pattern
- startDate ("YYYY-MM-DD"): the day the pattern starts counting from
- handoverTime ("HH:MM")
- updatedAt (timestamp), updatedBy (uid): drives the "Updated by Mei 5 minutes ago" line
- App: the plan maths stays in `src/app/api/rotaHelpers.js`. A settings map cannot hold the
  per night overrides, because two parents editing different nights would overwrite each
  other, so each night is its own document (below).

### households/{id}/nights/{yyyy-mm-dd}  (the rota, one document per night)
- date ("YYYY-MM-DD", the same as the document id, so a week or a month can be queried on
  one field with no composite index)
- onCall (uid, or the string "open")
- setBy (uid), setAt (timestamp)
- Written when a parent sets a night by hand and when a swap is accepted. Deleting the
  document puts that night back on the pattern.

### households/{id}/swaps/{swapId}  (the rota, one document per request)
- date ("YYYY-MM-DD"): the night `from` gives away
- withDate ("YYYY-MM-DD" or null): the night `from` takes in return, null for nothing
- from (uid): the person asking, always the signed in user
- to (uid or null): the other parent, the only person who may accept or decline
- status: pending | accepted | declined | cancelled
- message (string): one of a few fixed notes, or empty
- createdAt (timestamp), respondedAt (timestamp or null)
- Accepting writes the status and the night documents in one batch, so the answer and the
  plan can never disagree.

### households/{id}/events/{eventId}  (calendar)
- title (string), type: appointment | family | work
- date, endDate ("YYYY-MM-DD"): endDate equals date for a single day event
- allDay (boolean), start, end ("HH:MM" or null when allDay)
- owner (uid, or the string "both"): the local App stores used "me" and "partner", which mean
  nothing once the data is shared, so an owner is now a uid. The UI shows Me, the partner's
  name or Both by comparing with the signed in uid (`ownerLabel` in
  `src/app/api/sharedHelpers.js`).
- notes (string, 280 characters)
- googleEventId (string or null): so syncing never duplicates
- googleUpdatedAt (string or null): Google's own `updated` stamp from the last sync, which is
  the other half of the conflict rule (whichever side was updated later wins)
- googleSyncedAt (timestamp or null): when the server last touched this event
- source ("google" or absent): set by the server on an event that came in from Google, so the
  UI can tell an imported appointment from one typed into NurtureTrack
- byName (string, only after a deletion): "A parent", see docs/account-deletion.md
- createdBy (uid), createdAt, updatedAt (timestamp)
- Events are shared, so either parent may edit or delete one. createdBy never changes. Only
  the Admin SDK writes the four google fields and source; the rules do not have to allow them
  because a client never sends them.

### households/{id}/tasks/{taskId}  (return to work)
- title (string), group: childcare | work | home | pumping | wellbeing
- due ("YYYY-MM-DD" or null; always present so the list can be ordered by it)
- owner (uid or "both", the same rule as a calendar event)
- done (boolean), doneAt (timestamp or null), doneBy (uid or null): the list says who
  finished a task
- notes (string)
- createdBy (uid), createdAt, updatedAt (timestamp)
- Tasks are shared, so either parent may edit, tick or delete one.

### households/{id}/rtw/plan  (the return to work plan, one document)
- returnDate ("YYYY-MM-DD" or null)
- responsibilities (map): area key (see `src/app/data/rtw.js`) to uid, "both" or null
- pumping: { items (map of checklist key to boolean), sessions (2 to 4 or null),
  times (array of morning | midday | afternoon) }
- updatedAt (timestamp), updatedBy (uid)
- One document because the whole plan is small and is edited a field at a time with
  `setDoc(..., { merge: true })`, which also creates it on the first write.

### invites/{code}  (code looks like NT-XXXX)
- householdId (string), createdBy (uid), createdAt (timestamp)
- expiresAt (timestamp): seven days after creation. An invite with no `expiresAt` is treated
  as valid for ever, so the codes made before expiry existed keep working.
- usedAt (timestamp or null), usedBy (uid or null): set in the same batch as the join, so a
  code cannot be passed on to a third person.
- revokedAt (timestamp or null): set when the household makes a new code. The old document is
  kept, never deleted, so an old code answers "That code was replaced" rather than "not
  found".
- Helpers: `inviteState`, `describeInviteState`, `expiresInText` in
  `src/app/api/inviteHelpers.js`. Writes: `createHousehold`, `joinHousehold`,
  `regenerateInviteCode` in `src/app/api/profile.js`.

## 4. Pumping rooms (global, shared by all households)

The real directory, shared by every household, because a nursing room at a mall is the same
room for everyone. While the collection is empty the Support page shows the two seed rooms in
`src/app/data/pumpingRooms.js`, which are marked as seed data and cannot be reported.

### pumpingRooms/{roomId}
- name (string, at most 80), address (string, at most 200), region (string or null)
- details (string, at most 200): the precise floor and room location entered by the member
- lat, lng (number), placeId (string, at most 200): selected through Google Places autocomplete
- features (map): { chair, power, lockable, sink, stroller }, each a boolean. The UI shows
  labels ("Power outlet"); `featureLabels` and `featureMap` in `src/app/api/roomHelpers.js` are
  the only place the two shapes meet.
- status: verified | unverified. The page calls `unverified` "needs verification", which is
  what it has always said.
- verifiedAt (timestamp or null): drives "Verified 3 days ago" through `daysSince`.
- createdBy (uid), createdAt (timestamp, must equal `request.time`)
- Nothing is ever deleted, so a bad edit can always be traced through the reports.

### pumpingRooms/{roomId}/reports/{reportId}
- by (uid): must be the caller
- field (string, at most 40), value (string, at most 400): today always `status` and either
  "verified" or "gone"
- at (timestamp): must equal `request.time`, so a flood of reports is at least attributable
- helpful (number): not written yet
- A confirmation or a flag writes one report and moves the room's `status` and `verifiedAt` in
  the same batch, so the answer and the record can never disagree.

## 5. Security rules (outline)

- users/{uid} and all subcollections: read, write only if request.auth.uid == uid.
- households/{id} and subcollections: read, write only if request.auth.uid in resource.data.memberIds.
- Joining: a user can add themselves to memberIds only with a valid, unexpired inviteCode, checked by a Cloud Function.
- pumpingRooms: read for any signed in user. Create needs `createdBy == uid` and a name and an
  address, both within their length caps, and `createdAt == request.time`. Update may touch
  only `status` and `verifiedAt`, and only to the two allowed statuses. Reports are create only,
  with `by == uid` and `at == request.time`. No deletes anywhere.
- invites: read for any signed in user, because a joiner has to read the code. Create needs
  `createdBy == uid` with `usedAt` and `usedBy` null. Update is one of two things only:
  marking it used, which touches `usedAt` and `usedBy` alone, only once, with `usedBy` equal to
  the caller; or revoking it, which touches `revokedAt` alone and only for the creator. No
  deletes, so the history of codes is kept.
- households/{id} update: three cases. Joining adds exactly the caller to `memberIds`. Leaving
  removes exactly the caller from `memberIds`. Editing lets any member change `babyName`,
  `babyStatus`, `babyDate` and `inviteCode`, with the baby name capped at 80.
- members/{uid}: read by any member; only the member themselves may create, update or delete
  their own document, with `displayName` capped at 80.
- Entries: only the author can edit or delete their entry. seenBy can be written by any member for their own uid only.
- rota/{doc} and rtw/plan: members read; members create and update when `updatedBy` is their
  own uid. No deletes.
- nights: members read; members create and update when `setBy` is their own uid; members
  delete (clearing a night is how you go back to the pattern).
- swaps: members read; `from` must be the caller on create and the status must be pending;
  only `to` may accept or decline; only `from` may cancel; no deletes, so the history stays.
- handovers: members read; `from` must be the caller on create and `to` must be another
  member, with `acceptedAt` and `acceptedBy` null; only `from` may edit, and only while
  `acceptedAt` is still null; only `to` may accept, and that write may touch nothing but
  `acceptedAt` and `acceptedBy`, with `acceptedBy` equal to their own uid; no deletes.
- posts: members read; create in your own name with 1 to 500 characters, `createdAt ==
  request.time` and `ackedBy` empty; only a member who is not the author may update, and only
  to add their own uid to `ackedBy` and set `ackedAt`; only the author may delete.
- events and tasks: members read; `createdBy` must be the caller on create and may not
  change; either parent may update or delete, because these are shared plans rather than
  personal records. That is a deliberate choice: a shared calendar where only the author can
  remove an event is worse at 3 AM than one either parent can tidy.

## 6. Indexes

- entries: at descending
- entries: type, at descending
- nights: date ascending (range over one field, so Firestore's single field indexes are
  enough)
- events: date ascending
- tasks: due ascending
- swaps: createdAt descending
- handovers: sentAt descending
- pumpingRooms: name ascending (one field, so Firestore's single field indexes are enough)
- No composite index is needed for App: every shared query orders by, and ranges over, the
  same single field, which is why `firestore.indexes.json` is still empty. Status is
  filtered in the page, not in the swaps query, to keep it that way, and the pumping room
  filters are applied in the page too rather than in the query.

## 7. Server side needed

- Cloud Function or Vercel endpoint to send FCM pushes (handover sent, swap requested, entry
  logged). Read the recipient's quietHours and notification settings first. The preferences in
  `users/{uid}.settings.notifications` are saved and waiting; no token is registered yet.
- Invite code redeem function. The client checks `expiresAt`, `usedAt` and `revokedAt` itself
  and the rules stop a second use, but only a server can check and write in one transaction.
- **Built.** `POST /api/account/delete`: the full procedure is written out in
  `docs/account-deletion.md`.
- **Built.** `GET /api/google/connect`, `GET /api/google/callback`,
  `POST /api/google/disconnect`, `POST /api/google/sync`: the Google Calendar consent flow and
  the two way sync. `GET /api/health` reports which environment variable groups are set.
  The client calls them through `src/app/api/server.js`, which adds
  `Authorization: Bearer <Firebase ID token>` to every call and still shows "The calendar
  server is not set up yet." when the functions are not deployed. Setup in `docs/setup.md`.
- **Still needed.** A Cloud Function or Vercel endpoint to send FCM pushes. Not built: there is
  no FCM, no service worker and no `firebase/messaging` import anywhere, and
  `VITE_FIREBASE_VAPID_KEY` is the variable it will need.
- Rate limiting. `src/app/api/limits.js` keeps a sliding window in `localStorage` (5 room
  reports, 10 entries, 3 invite regenerations, 3 deletion attempts per 10 minutes), which is a
  courtesy guard, not security: anyone can clear their own storage. The real counters are now
  on the server in `serverLimits/{uid}` for the endpoints that exist (3 account deletions, 10
  calendar connects, 20 syncs per 10 minutes), answered 429 with a `message` the page shows
  and a `Retry-After` header. Room creation, room reports and invite regeneration are still
  client side only, because they have no endpoint yet. Rules cannot count writes over
  time, so what they do instead is make every write attributable and bounded: a report must
  carry `by == request.auth.uid` and `at == request.time`, a room must carry
  `createdAt == request.time`, and the user supplied strings are capped (room name 80, address
  200, report value and entry note 400, display name 80).

## 7b. Server only collections

Four top level collections that only the Firebase Admin SDK touches. `firestore.rules` denies
read and write to every client on all four, because a browser has no business holding any of
it. None of them is ever read by `src/`.

### googleTokens/{uid}
- refreshToken (string): the long lived key to that user's Google Calendar. Never leaves the
  server. Access tokens are not stored at all: a fresh one is fetched from the refresh token
  on every run, which costs one request and saves having to expire anything.
- scope (string): what Google actually granted, as it came back
- calendarId (string): the id of the secondary calendar called "NurtureTrack"
- connectedAt, rotatedAt (timestamp): rotatedAt only when Google replaces the refresh token

### googleSync/{uid}
- syncToken (string or null): Google's incremental sync token, so a pull reads only what
  changed. A 410 from Google means it is too old; it is thrown away and the window is read in
  full.
- pushed (map): firestoreEventId to googleEventId, for every event this server pushed. This is
  how a deleted event is noticed: an id in the map with no Firestore document behind it any
  more is deleted from Google and dropped from the map. It is why there is **no tombstone
  collection** and why the browser never has to write one.
- lastSyncedAt (timestamp): the cut off for the next push

### oauthStates/{nonce}
- uid (string), createdAt, expiresAt (timestamp): the one time nonce inside the signed OAuth
  `state` value. The callback reads and deletes it in one transaction, so the same consent
  link cannot be used twice even while its five minute signature is still valid.

### serverLimits/{uid}
- one array of millisecond timestamps per action (`accountDelete`, `googleConnect`,
  `googleSync`), trimmed to the ten minute window on every write
- updatedAt (number)

## 8. Not stored

- Guide text, helplines and doctor thresholds: keep in code so they are reviewed and versioned.
- The running feed timer: keep on the device and save the entry only when it stops.

## 9. Open items

- Verify Singapore helpline numbers and doctor thresholds before launch.
- Settings, Profile and the partner section are built (`/settings`, `/profile`). The
  Linked partner screen as a page of its own is not needed: the Partner section on Settings
  does the job.
- Replace the in-memory sample data in src/data with Firestore reads, starting with entries.
- Wellness check-ins stay private and on the device for now (`nt.app.checkins`). The user
  settings document holds a `checkins` subcollection in this model but App does not write it
  yet; moving the check-ins there is the next step, and they must stay private to the one uid.
- The pumping rooms are in Firestore now and `nt.app.rooms` is gone.
- `lat`, `lng` and `placeId` on a room are never written. The map is a Google Maps embed built
  from the name and the address, which is good enough until somebody adds Places lookup.
