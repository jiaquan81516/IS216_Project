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
  nights/{yyyy-mm-dd}
  events/{eventId}
  tasks/{taskId}
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
- inviteCode (string), inviteExpiresAt (timestamp)
- nights: { start: "21:00", end: "07:00", mode: "alternate" | "manual", first: uid }
- alerts: { feeds, partnerLogs, handovers, checkIn } (boolean defaults for new members)
- returnToWorkDate (timestamp)
- createdAt (timestamp)

### households/{id}/members/{uid}
- displayName, photoURL, role, joinedAt
- Copied from the user profile when they join and when they edit it, so the partner can see a name and photo without reading the private user document.

### households/{id}/entries/{entryId}  (the care log)
- type: feed | sleep | nappy | medication | note
- at (timestamp), endedAt (timestamp or null)
- by (uid)
- details (map): method, side, minutes, ml, nappyType, drug, text
- seenBy (map uid to timestamp): drives the unseen marker and "N new from Mei"
- createdAt (timestamp)
- V3 care log: `byName` (string) is the author's first name at the time of logging, and `details.text` is an optional note on any type (the whole body of a `note`). `details.nappyType` is wet | dirty | both; `details.method` is breast | bottle | expressed.
- A subcollection, not an array, so two parents logging at once do not collide and the document size limit is never hit.

### households/{id}/handovers/{handoverId}
- from, to (uid)
- sentAt (timestamp), note (string), needsAttention (boolean)
- summary: { feeds, sleepMinutes, nappies } (snapshot of the shift)
- nextUp (array of string)
- acceptedAt (timestamp or null), acceptedBy (uid or null)

### households/{id}/nights/{yyyy-mm-dd}  (the rota, one document per night)
- onCall (uid)
- swap: { requestedBy, withNight, status: pending | accepted | declined, message }
- overriddenBy (uid or null)

### households/{id}/events/{eventId}  (calendar)
- title, start, end, type: appointment | family | work
- googleEventId (string): so syncing never duplicates
- createdBy (uid)

### households/{id}/tasks/{taskId}  (return to work)
- plan: "mum" | "dad"
- group: childcare | work | home | pumping | wellbeing
- title, dueDate, assignedTo (uid), reminder, notes
- done (boolean)

## 4. Pumping rooms (global, shared by all households)

### pumpingRooms/{roomId}
- name, address, region, hours, levels
- lat, lng (number), placeId (string, from Google Places or OneMap)
- features: { power, lockable, stroller, ... }, each yes | no | unsure
- status: verified | unverified | check again
- verifiedAt (timestamp)

### pumpingRooms/{roomId}/reports/{reportId}
- by (uid), field, value, at (timestamp), helpful (number)

## 5. Security rules (outline)

- users/{uid} and all subcollections: read, write only if request.auth.uid == uid.
- households/{id} and subcollections: read, write only if request.auth.uid in resource.data.memberIds.
- Joining: a user can add themselves to memberIds only with a valid, unexpired inviteCode, checked by a Cloud Function.
- pumpingRooms: read for any signed in user. Writes only through reports, rate limited.
- Entries: only the author can edit or delete their entry. seenBy can be written by any member for their own uid only.

## 6. Indexes

- entries: at descending
- entries: type, at descending
- nights: document id range for a week
- events: start ascending

## 7. Server side needed

- Cloud Function or Vercel endpoint to send FCM pushes (handover sent, swap requested, entry logged). Read the recipient's quietHours and notification settings first.
- Invite code redeem function.
- Account deletion function: remove user document, devices and check-ins, and anonymise their entries as "A parent".

## 8. Not stored

- Guide text, helplines and doctor thresholds: keep in code so they are reviewed and versioned.
- The running feed timer: keep on the device and save the entry only when it stops.

## 9. Open items

- Verify Singapore helpline numbers and doctor thresholds before launch.
- Design Settings, Profile and Linked partner screens.
- Replace the in-memory sample data in src/data with Firestore reads, starting with entries.
