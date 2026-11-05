# NurtureTrack

A shared web app that helps both new parents, and the caregivers who help them, keep newborn care, schedules and wellbeing in one place.

IS216 Web Application Development II · G9 Group 4

## Live app

**https://nurture-track.vercel.app**

## Sign in

Use any of the accounts below on the live app. All accounts sign in with **email and password**. Parent accounts can also use **Continue with Google** on the sign-in page.

| Account   | Role                                               | Where to sign in                                                           | Email                | Password     |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- | ------------ |
| User 1    | Parent                                             | https://nurture-track.vercel.app/signin                                    | Jocelyn123@gmail.com | password1234 |
| User 2    | Parent (partner in the same household)             | https://nurture-track.vercel.app/signin                                    | Jacob@gmail.com      | password1234 |
| Caregiver | Caregiver (sees the Care Brief)                    | https://nurture-track.vercel.app/signin                                    | nannylim@gmail.com   | password1234 |
| Admin     | Administrator (rooms, clinics and support content) | https://nurture-track.vercel.app/signin/admin/8b9e6ddbf55959127e0e4178 | `bob@gmail.com`    | `password` |

The admin sign-in page is private: it only exists at the link above, and it accepts email and password only.

## Run it locally

You need [Node.js](https://nodejs.org) 22 and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

Open the address Vite prints (http://localhost:5173).

The app connects to our Firebase project, whose web configuration is in `src/api/firebase.js`, so you do not need to set up Firebase or create a `.env` file to sign in and use it. Local sessions use the same accounts and the same data as the live app.

Other commands:

```sh
pnpm build      # production build into dist/
pnpm preview    # serve the production build locally
pnpm lint       # oxlint and ESLint
pnpm format     # Prettier
```

### Optional settings

These features need a value in a `.env` file in the project root. Restart `pnpm dev` after changing it.

| Variable                                                                                                            | Turns on                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_ADMIN_SIGNIN_KEY`                                                                                           | The admin sign-in page at `/signin/admin/<key>`. At least 12 letters, digits, `_` or `-`. Without it the page does not exist. |
| `VITE_FIREBASE_VAPID_KEY`                                                                                         | Web push notifications (Firebase Cloud Messaging web push key).                                                                     |
| `VITE_GOOGLE_OAUTH_CLIENT_ID`                                                                                     | Google Calendar sync straight from the browser.                                                                                     |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ONEMAP_EMAIL`, `ONEMAP_PASSWORD` | Address lookup when an admin adds or edits a pumping room. `pnpm dev` runs this lookup locally with these values.                 |

## Run the tests

**Unit tests** (Vitest):

```sh
pnpm test:unit            # watch mode
pnpm test:unit --run      # run once
```

**End-to-end tests** (Playwright, against local Firebase emulators, never the live data):

```sh
pnpm exec playwright install      # first run only
pnpm test:e2e
```

You need Java 21 or newer for the Firebase emulators. `pnpm test:e2e` starts the emulators and a test copy of the app by itself. Ports 4000, 4173, 4400, 8080 and 9099 must be free. To run one file:

```sh
pnpm test:e2e __tests__/e2e/profile-photo.spec.js
```

## Deploy

The app is deployed to Vercel from the GitHub repository. `vercel.json` already sets the framework (Vite), build command and output folder, and turns every file in `api/` into a serverless function.

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Add the environment variables the functions use, for Production, Preview and Development:

   | Variable                                                                                                     | Used for                               |
   | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
   | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`                                 | Firebase Admin (service account)       |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `OAUTH_STATE_SECRET`, `APP_URL` | Google Calendar server sync            |
   | `ONEMAP_EMAIL`, `ONEMAP_PASSWORD`                                                                        | Pumping room address lookup            |
   | `ADMIN_UID`                                                                                                | Admin account for the server functions |
   | `VITE_ADMIN_SIGNIN_KEY`, `VITE_FIREBASE_VAPID_KEY`, `VITE_GOOGLE_OAUTH_CLIENT_ID`                      | Same as the optional settings above    |

   Only variables that start with `VITE_` reach the browser. Keep every other value on the server.
3. Publish the Firestore security rules whenever `firestore.rules` changes:

   ```sh
   firebase deploy --only firestore:rules
   ```
4. Check the server settings at `https://<your-domain>/api/health`. It reports which groups of variables are set, never their values.

`vercel dev` runs the app and the serverless functions together locally; `pnpm dev` runs the app alone.

## Tech stack

Vue 3, Vite, Pinia, Vue Router and Bootstrap 5 on the front end. Firebase (Cloud Firestore, Authentication, Cloud Messaging) and Vercel serverless functions on the back end. Vitest and Playwright for testing.
