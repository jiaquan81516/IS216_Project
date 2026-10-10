# Account deletion

**Status: built.** The function is `api/account/delete.js` and it follows the procedure below.
The client calls `deleteAccount()` in `src/app/api/server.js`, which posts to
`/api/account/delete` with `Authorization: Bearer <Firebase ID token>`. When the function is
not deployed, or `pnpm dev` is used instead of `vercel dev`, the call fails with the code
`server/unreachable` and the Settings page still runs the browser side fallback that can only
remove part of the data (see "Fallback" below). See `docs/setup.md` for the variables it needs.

## What the user is promised

The confirmation panel on `/settings` says, before the user types DELETE:

- Your profile, settings and saved devices go.
- Your private wellness check-ins go.
- Shared household data stays, so your partner keeps the care log, rota and calendar.
- Your care log entries will show the words A parent instead of your name.

The server function must make all four true. Nothing else.

## Endpoint

`POST /api/account/delete`

Request body: none. The caller is identified by a Firebase ID token, not by a uid in the body,
because a uid in a body is a request to delete somebody else's account.

Headers: `Authorization: Bearer <Firebase ID token>`. The client sends this now: `callServer`
in `src/app/api/server.js` reads `auth.currentUser.getIdToken()` and adds the header to every
server call. A signed out caller sends no header and gets a 401.

Answers:

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ "ok": true, "anonymisedEntries": n, "anonymisedShared": n, "invitesRevoked": n, "householdLeft": bool, "householdDeleted": bool, "calendarDisconnected": bool, "userDeleted": bool }` | Done. The client signs the user out and goes to `/`. |
| 401 | `{ "code": "auth/invalid-token", "message": "..." }` | No token, or it did not verify. |
| 429 | `{ "code": "server/too-many", "message": "..." }` | Three deletion attempts per ten minutes, per uid. |
| 500 | `{ "code": "...", "message": "..." }` | The client shows `message`. |

Every error body also carries the same code and message nested under `error`, so
`{ error: { code, message }, code, message }`. The nested shape is the one every other
endpoint uses; the flat one is what the client in `src/app/api/server.js` reads. Both are sent
rather than breaking either reader.

409 `account/last-member` is **not** used. See "The last member".

## Procedure, in order

Run with the Firebase Admin SDK, which is not bound by `firestore.rules`.

1. Verify the ID token. Take `uid` from the verified token only.
2. Read `users/{uid}` and keep `householdId`.
3. Revoke the refresh tokens (`auth.revokeRefreshTokens(uid)`) so other devices cannot keep
   writing while the deletion runs.
4. Anonymise the shared household data, if there is a household. For every document under
   `households/{hid}` that names the user, keep the document and replace the name, never the
   row:
   - `entries/*` where `by == uid`: set `byName` to `"A parent"`. Leave `by` as the uid, so
     the rules and the seen markers still work and the history does not change shape.
   - `events/*` and `tasks/*` where `createdBy == uid`, and `handovers/*` where `from == uid`:
     the same `byName` of `"A parent"`, for the same reason. The UI would fall back to "A
     parent" anyway once the member document is gone, but writing it down means the history
     cannot drift if that fallback ever changes. `createdBy` and `from` are left as the uid.
   - `swaps/*`, `nights/*`, `rota/settings`, `rtw/plan`: left alone. They hold uids, which the
     UI turns into "A parent" once the member document is gone, and none of them carries a
     name field to rewrite.
   - Do all of this in batches of at most 450 writes, and count what was changed for the
     answer body.
5. Remove the user from the household: delete `households/{hid}/members/{uid}` and remove the
   uid from `households/{hid}.memberIds` with `FieldValue.arrayRemove`.
6. Delete the private data under the user: every document in `users/{uid}/checkins` and
   `users/{uid}/devices`, then any other subcollection, with `admin.firestore().recursiveDelete`.
7. Delete `users/{uid}`.
8. Revoke the invite the user created, if they created one: `invites/*` where
   `createdBy == uid` and `usedAt == null` gets `revokedAt` set. Do not delete it.
9. If a Google Calendar connection exists, call Google's revoke endpoint and delete
   `googleTokens/{uid}` and `googleSync/{uid}`, so the app loses access rather than keeping a
   dangling grant. `serverLimits/{uid}` goes too, so a recreated account starts clean.
10. Delete the Firebase Auth user last (`auth.deleteUser(uid)`). Last, because the steps above
    are easier to retry while the account still exists.
11. Log the deletion with the uid, the household id and the counts, and nothing else. No
    email address, no display name, no check-in numbers.

Make the whole thing idempotent: a second call for a user that is already gone answers 200.

## The last member

**Decided: the household goes with them.** When the leaving user is the only member, the
household document and everything under it is removed with `recursiveDelete`, and the answer
says `householdDeleted: true`.

Why that one. Nobody else can see the household, so keeping it costs storage and gives the
user nothing. The promise on the Settings page is that shared data stays *so your partner
keeps the care log, rota and calendar*; with no partner there is nothing to keep, and leaving
an orphaned household behind would be the opposite of what the panel says. The anonymising in
step 4 still runs first, which costs a few writes that are then thrown away, and that is worth
it for one code path instead of two.

No 409 is ever returned, so the client needs no new case for this.

## Fallback, which exists now

`deleteAccountFallback` in `src/app/api/account.js` runs only when the endpoint is missing. From
the browser, under the rules, it can:

- delete `users/{uid}/checkins/*` and `users/{uid}/devices/*`
- delete `households/{hid}/members/{uid}` and take the uid out of `memberIds`
- delete `users/{uid}`
- call `deleteUser(auth.currentUser)`

It cannot anonymise the care log, because the entry rules only let the author of an entry
change it and rewriting every entry from a phone is not safe. The Settings page therefore lists
what was left behind in plain words rather than claiming a clean deletion, and
`auth/requires-recent-login` is caught and turned into "sign in again, then delete your
account". Once the endpoint exists the fallback should stay, as the answer to a server outage.

## Checklist, as built

- [x] Verify the ID token, never trust a uid in the body.
- [x] `byName` becomes "A parent" on the user's entries, events, tasks and handovers.
- [x] Member document and `memberIds` cleared.
- [x] `checkins` and `devices` gone, user document gone (`recursiveDelete`).
- [x] Unused invite revoked, not deleted.
- [x] Google refresh token revoked at Google and deleted here, with the sync state.
- [x] Auth user deleted last, refresh tokens revoked first.
- [x] Idempotent (a second call answers 200 with zero counts), batched in chunks of at most
      400 (`api/_lib/batch.js`), and logged as one line of uids and counts with no email, no
      display name and no check-in numbers.
- [x] `Authorization: Bearer <id token>` added to `callServer`.
- [x] Rate limited: three attempts per uid per ten minutes, answered 429 with a sentence the
      page shows (`api/_lib/rateLimit.js`).
