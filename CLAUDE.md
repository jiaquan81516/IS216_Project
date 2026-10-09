# NurtureTrack (IS216, group Cocomelon, G9)

Dual-user postpartum web app for two parents (Daniel and Mei). Graded by a dad, so it must feel calm and useful at 3 AM.

## Stack
Vue 3 + Vite, Pinia, vue-router, Bootstrap 5 (installed), Firebase (Google sign in, Firestore), Vercel, FCM push, Google Calendar API. Package manager: pnpm.
Use Bootstrap utilities and CSS variable overrides in `src/assets/styles/main.css`. Do not add Tailwind.

## Design source of truth
Figma file: https://www.figma.com/design/EQ8l3puqd2k146elsbasST (key `EQ8l3puqd2k146elsbasST`), page "Main Flow".
Build from **Prototype B: Preline UI kit** only. Prototype A is the old design, ignore it.
Read each frame with the Figma MCP `get_design_context` (load the figma-design-to-code skill first). Frame IDs and routes are in `docs/design.md`.
The Preline kit is Tailwind-based. Copy its look (spacing, radii, borders, badge and button styles) into Bootstrap, do not copy its classes.

## Design tokens
- Plum `#3B2F3F` (primary, one solid plum button per screen), page bg `#FDFCFB`, ink `#1F2937`, muted `#6B7280`, line `#E5E7EB`
- Daniel apricot `#F6D8C6` / `#E3A584`, Mei powder `#DCE6F2` / `#5C7A9E`
- Butter `#F5E7B8` with dashed border `#6F5F3A`: ONLY for "Yours alone" private content
- Coral `#C0553B`: the "Now" marker and unseen items. Yellow only for warnings. Red soft only for urgent medical notes.
- Soft badges: Feed blue `#DBEAFE`/`#1E40AF`, Nappy teal `#CCFBF1`/`#115E59`, Sleep gray, Medication and Note outlined
- Fonts: Young Serif for page titles and card headings, Inter for everything else. Body text 14px minimum.
- Radii 8 for inputs and rows, 12 for cards. 1px `#E5E7EB` borders, no shadows.

## Signature pieces to keep
- The night strip (6 PM to 6 AM bar, feed ticks, coral "Now" line) on Landing and Home.
- The butter dashed "Yours alone" box. Anything private to one parent (check-in, confidence rating) uses it, and the other parent never sees that data.

## Product rules
- Minimise free text inputs. Prefer taps, choice rows, scales.
- Plain, warm copy. No em dashes. Sentence case. Buttons name the action ("Save entry", not "Submit").
- Medical and helpline content is general guidance only. Sample data is labelled as placeholder. Verify Singapore helpline numbers, doctor thresholds and mall addresses before demo.

## Repo layout
`src/pages/<name>/index.vue` per page, with `components/`, `composables/`, `shared/` beside it. Shared UI in `src/components/common` and `src/components/layout`. Routes in `src/shared/constants/routes.js`. Auth in `src/composables/useAuth.js` and `src/api/`.
The old scaffold UI was deleted and rebuilt from Figma Prototype B. One folder per page in `src/pages/<name>/index.vue` (24 pages, names match `src/shared/constants/routes.js`). Shared UI lives in `src/components/ui/`, layouts in `src/layouts/`, sample data in `src/data/`, onboarding state in `src/stores/household.js`. Real Google sign in is wired through `src/composables/useAuth.js`; everything else uses sample data until Firestore is added.

## Working agreement
Branch per feature (`dev/<initials>/<feature>`), small commits, run `pnpm lint` and `pnpm test:unit` before pushing. Build in the order listed in `docs/design.md`.

## Prototype V3 (in progress, built page by page)
V3 lives beside V2 and never edits it: routes under `/v3`, code under `src/v3/`, Figma frames under "Prototype V3" on the Main Flow page. Done so far: Landing, Step 1 journey, Step 2 role, Step 3 create account, Sign in, Step 4 shared space (create or join), the app shell (`src/v3/layouts/V3AppShell.vue`, sidebar on desktop, top bar under 992px), Home at `/v3/home` and the Care log at `/v3/care-log` (real Firestore, see `docs/v3.md`). Home was built from a written spec, not Figma. Home uses real data only (last feed and recent activity from the care log entries); the Tonight card is removed until the rota page exists, and there is no V3 sample data. The sidebar links other than Today and Care log go to the matching V2 pages until their V3 versions exist (`src/v3/data/nav.js`). Signed in users with a household now land on `/v3/home`. Do not build past the Care log until asked. Auth is Firebase email/password and Google; profile and household data go to Firestore (see `docs/v3.md`, `firestore.rules`).

V3 update: Sleep rota (`/v3/rota`), Wellness (`/v3/wellness`) and Support (`/v3/support`) are built. They have NO backend: state is local Pinia stores persisted to localStorage (`nt.v3.rota`, `nt.v3.checkins`, `nt.v3.rooms`), each wrapped in try/catch. Return to work (`/v3/return-to-work`) and Calendar (`/v3/calendar`) are built the same way (local Pinia stores in `nt.v3.rtw` and `nt.v3.calendar`), so all seven sidebar items in `src/v3/data/nav.js` are V3 pages now. Google Calendar sync and Firestore for these pages are planned, not built. Pumping room data is sample data and the helpline numbers are copied from V2 and unverified.
