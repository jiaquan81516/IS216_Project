# Setting up the server

NurtureTrack's server side is six Vercel serverless functions under `/api`. They do the three
things the browser is not allowed to do: hold a Google refresh token, write documents the
Firestore rules deny to every client, and delete an account properly.

Nothing in this guide changes the app's behaviour for a signed in user who does not connect
Google Calendar. Until the variables below are set, the Settings page says "The calendar server
is not set up yet." and the account deletion falls back to the browser, which is honest about
what it could not remove.

Push notifications are **not built yet**. There is no FCM, no service worker and no
`firebase/messaging` import anywhere. The notification preferences in Settings are saved and
waiting. When push is built it will need one more variable, `VITE_FIREBASE_VAPID_KEY`, from
Firebase console, Project settings, Cloud Messaging, Web Push certificates.

---

## 1. Firebase

1. Open the [Firebase console](https://console.firebase.google.com/) and pick the NurtureTrack
   project (`is216-821c0` for our group).
2. **Publish the rules.** Build, Firestore Database, Rules tab. Paste the whole of
   `firestore.rules` from this repository over what is there and press Publish. Or, with the
   Firebase CLI: `firebase deploy --only firestore:rules`.
   The new part is four server only collections, all denied to every client:
   `googleTokens`, `googleSync`, `oauthStates` and `serverLimits`.
3. **Publish the indexes** (optional, they are empty today):
   `firebase deploy --only firestore:indexes`.
4. **Make a service account key.** Project settings (the gear), Service accounts,
   "Generate new private key". A JSON file downloads. Keep it out of the repository: it is a
   master key to the whole database.
5. Open that JSON file. Three values out of it become Vercel variables:

   | JSON field | Vercel variable |
   | --- | --- |
   | `project_id` | `FIREBASE_PROJECT_ID` |
   | `client_email` | `FIREBASE_CLIENT_EMAIL` |
   | `private_key` | `FIREBASE_PRIVATE_KEY` |

   `private_key` in the JSON already contains literal `\n` sequences rather than real
   newlines. Copy it exactly as it appears, including the `-----BEGIN PRIVATE KEY-----` and
   `-----END PRIVATE KEY-----` parts and the `\n` sequences, as one line. The server puts the
   newlines back (`api/_lib/admin.js`).

## 2. Google Cloud

The Firebase project is a Google Cloud project, so this is the same project under a different
console.

1. Open the [Google Cloud console](https://console.cloud.google.com/) and check the project
   picker at the top says the Firebase project.
2. **Enable the Calendar API.** APIs and services, Library, search "Google Calendar API",
   Enable.
3. **Enable place suggestions.** In the same Library, enable **Maps JavaScript API** and
   **Places API (New)**. Create a separate API key for the browser, restrict it to the app's
   local and production web origins, restrict its API access to those two APIs, and save it as
   `VITE_GOOGLE_MAPS_API_KEY`. This key powers building/address suggestions when adding a
   pumping place; it is intentionally separate from the Calendar OAuth credentials.
4. **OAuth consent screen.** APIs and services, OAuth consent screen.
   - User type: External. Publishing status can stay "Testing" for the module.
   - App name: NurtureTrack. Support email and developer email: your own.
   - **Scopes:** add exactly these two, and nothing else:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`

     Both are "sensitive" scopes, which is fine while the app is in Testing.
   - **Test users:** add every Google account that will sign in during the demo, including
     the marker's if they will try it. In Testing mode an account that is not on this list
     gets "access blocked" from Google and the app can do nothing about it. The cap is 100.
5. **OAuth client.** APIs and services, Credentials, Create credentials, OAuth client ID.
   - Application type: Web application. Name: NurtureTrack web.
   - **Authorised redirect URIs**, both of them, spelled exactly like this:
     - `http://localhost:3000/api/google/callback`
     - `https://your-app.vercel.app/api/google/callback`

     Replace `your-app` with the real Vercel domain. If you also use a custom domain or a
     Vercel preview URL, add that one too: Google matches the whole string, so a missing port
     or an `http` where it wants `https` is a `redirect_uri_mismatch`.
   - **Authorised JavaScript origins** are not needed: the browser never talks to Google
     directly, the server does.
   - Copy the client ID and client secret.

   | From Google | Vercel variable |
   | --- | --- |
   | Client ID | `GOOGLE_CLIENT_ID` |
   | Client secret | `GOOGLE_CLIENT_SECRET` |
   | The redirect URI for that environment | `GOOGLE_REDIRECT_URI` |

## 3. Vercel

1. Install the CLI once: `npm i -g vercel`, then `vercel login`.
2. **Import the repository.** [vercel.com/new](https://vercel.com/new), pick the GitHub
   repository, and accept what it detects: framework Vite, build command `vite build`, output
   directory `dist`. `vercel.json` in the repository root already says all three, plus a 60
   second limit for the functions, which the sync needs on a first run.
   The `api/` folder and the Vite build live side by side with no extra configuration: Vercel
   turns every file under `api/` into a function and serves `dist/` for everything else, with
   the single page application fallback the Vite preset provides. Files in `api/_lib/` are
   shared modules, not endpoints, because a folder starting with an underscore is not routed.
3. **Environment variables.** Project settings, Environment variables. Add each of these to
   Production, Preview and Development:

   | Variable | Where it comes from |
   | --- | --- |
   | `FIREBASE_PROJECT_ID` | service account JSON, `project_id` |
   | `FIREBASE_CLIENT_EMAIL` | service account JSON, `client_email` |
   | `FIREBASE_PRIVATE_KEY` | service account JSON, `private_key`, one line with `\n` |
   | `GOOGLE_CLIENT_ID` | Google Cloud, Credentials |
   | `GOOGLE_CLIENT_SECRET` | Google Cloud, Credentials |
   | `GOOGLE_REDIRECT_URI` | `https://your-app.vercel.app/api/google/callback` |
   | `OAUTH_STATE_SECRET` | any long random string: `openssl rand -base64 48` |
   | `APP_URL` | `https://your-app.vercel.app`, with no trailing slash |
   | `VITE_FIREBASE_*` | the web config, only if you have moved it out of `src/api/firebase.js` |
   | `VITE_GOOGLE_MAPS_API_KEY` | browser-restricted key with Maps JavaScript API and Places API (New) |

   Everything without a `VITE_` prefix stays on the server: Vite only puts `VITE_` variables
   into the browser bundle, which is why the names are what they are. Never put a service
   account key or a client secret behind a `VITE_` name.
4. **Run it locally.** `vercel link` once, then:

   ```
   vercel env pull .env.local     # brings the variables down, git ignored
   vercel dev                     # Vite and the functions together, on port 3000
   ```

   `vercel dev` is the only way to run the functions locally. `pnpm dev` runs Vite alone, which
   is still useful: every `/api` call answers "not set up yet" and the app keeps working.
   When running locally, set `GOOGLE_REDIRECT_URI` and `APP_URL` to the `localhost:3000` values
   in `.env.local`, and leave the production values in the Vercel dashboard.
5. Deploy: `vercel --prod`, or just push to the default branch.

## 4. How to verify it works

1. **The variables.** Open `https://your-app.vercel.app/api/health`. It answers:

   ```json
   {
     "ok": true,
     "time": "2026-10-10T06:00:00.000Z",
     "env": { "firebaseAdmin": true, "google": true, "oauthState": true, "app": true },
     "missing": []
   }
   ```

   Every group must be `true`. Anything in `missing` names a variable that is not set. The
   endpoint never returns a value, only whether one is present.
2. **Connecting.** Sign in, go to `/settings`, Google Calendar, "Connect Google Calendar".
   Google asks for consent, then sends you back to `/settings?calendar=connected` and the
   page says "Google Calendar is connected." A failure comes back as `?calendar=error` and
   says so; pressing Cancel on Google's screen comes back as `?calendar=denied`.
   Check your Google Calendar: there is now a second calendar called NurtureTrack.
3. **Syncing.** Add an event on `/calendar`, then press "Sync now" in Settings. The line
   under the button reads something like "1 sent to Google." and the event appears in the
   NurtureTrack calendar. Add an event to that calendar in Google, press "Sync now" again, and
   it appears in NurtureTrack. The Calendar page shows "Synced with Google Calendar" under its
   heading while the connection is live.
4. **Deleting.** Use a throwaway account. Settings, Danger zone, type DELETE. The entries that
   account wrote keep their place in the care log and read "A parent".

## 5. If something does not work

| What you see | What it usually is |
| --- | --- |
| "The calendar server is not set up yet." | `pnpm dev` instead of `vercel dev`, or the function is not deployed |
| `/api/health` shows a group as `false` | that variable is missing in this Vercel environment, including Preview |
| Google says `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` and the URI in Google Cloud are not the same string |
| Google says access blocked | the account is not in the OAuth consent screen's test users |
| `?calendar=error` every time | check the Vercel function logs; a bad `FIREBASE_PRIVATE_KEY` is the usual cause |
| 429 "You have done that a few times just now" | the per uid limit: 3 deletions, 10 connects, 20 syncs per ten minutes |
| "Your database rules do not allow saving..." | the rules in the console are older than `firestore.rules` |

## 6. What is not set up here

- **Push notifications.** Not built. No FCM, no service worker, no token registration. The
  preferences in Settings are saved and do nothing yet. `VITE_FIREBASE_VAPID_KEY` is the
  variable that will be needed.
- **The invite redeem function.** The client checks the code and the rules stop a second use,
  but only a server could check and write it in one transaction. See `docs/data-model.md`,
  section 7.
