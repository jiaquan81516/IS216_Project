# Pumping rooms map

Page: `/support/rooms` (`src/app/pages/pumping-rooms/index.vue`), inside the app shell, guarded like the other app pages. Linked from a "Find a pumping room" card in Support Guides (the old Support pumping rooms tab and its directory UI were removed) and from the Return to work pumping section.

## Data sources

1. Community rooms: the Firestore collection `pumpingRooms` (see `docs/data-model.md`). Shown first. Only these can be "Verified", and only when their `status` is `verified`.
2. Malls: `src/app/data/malls.fallback.js`, a hand picked starter list of 23 well known malls.
   - No government dataset was used. A search of data.gov.sg, OneMap, URA, LTA, HPB and SG Enable found no open dataset of Singapore shopping malls, and none that lists nursing or lactation rooms. data.gov.sg search results were unrelated (for example HDB shop counts). The OneMap themes endpoint needs a token.
   - Coordinates and addresses were looked up in the OneMap public search API (`https://www.onemap.gov.sg/api/common/elastic/search`, Singapore Land Authority, Singapore Open Data Licence v1.0) on 2026-10-11.
   - There is no regeneration script because there is no source file to regenerate from. To refresh a mall, search it in OneMap and edit the entry by hand. If a real dataset is found later, add `scripts/build-mall-rooms.mjs` that writes a JSON file and point `loadMalls` in `src/app/api/malls.js` at it.
3. Seed examples (`src/app/data/pumpingRooms.js`) appear only while the Firestore collection is empty. Their coordinates are in `SEED_COORDS` (OneMap). A seed is dropped when a mall already covers it (Raffles City).

Merge order: community rooms, then malls, then seeds. A later entry is dropped when it has the same `placeId`, or a near identical name within 100 m of an earlier one (`mergeRooms` in `src/app/api/mapHelpers.js`).

## Labelling rule

A mall listing does not prove the mall has a pumping or nursing room. Mall entries say "Mall, nursing room not confirmed", never show "Verified", and are hidden by "Verified only". Seed examples say "Example room, not confirmed". If a dataset that truly lists nursing rooms is added, change the label to "Listed as having a nursing room by {source}" and name the source.

There are no opening hours anywhere on purpose.

## How the page works

- Header and controls: search (Google Places autocomplete, Singapore only), count, Filter panel (Chair, Power outlet, Lockable, Sink, Verified only), room cards sorted by distance from the search or map centre, "View all rooms", and an Add a room panel (same flow and store action as Support).
- Layout: the page scrolls normally. Order: header, search, count and controls, view switch, map (full grid width, 360px, 12px radius, 1px border), then a two column grid of cards (Save, Show on map, Open in Google Maps, Directions). Old split layout removed.
- Map slot: with a working key, the interactive Google map below; otherwise a keyless embed iframe (`https://www.google.com/maps?q=Singapore&z=11&output=embed`) that moves to a room (`lat,lng (name)`, z=15) on "Show on map" or card click. The "map is off" notice is gone; only geolocation errors show a status notice.
- Interactive map (key present): Google map with classic markers drawn from SVG (plum circle, white pin), grid clustering (`clusterRooms`), a small info card (flat, no shadow), a "use my location" button and the default zoom controls.
- Typing in Location also filters the list by name and address. Choosing a Google suggestion moves the search centre instead.
- Saved places use the same localStorage key as Support (`nurturetrack:saved-pumping-rooms`).
- Default centre: the user's location if they allow it, otherwise Singapore (1.3521, 103.8198, zoom 12).
- Without `VITE_GOOGLE_MAPS_API_KEY` (or if the script fails) the list still works, a status notice is shown, and Location is a plain text filter.

## Running without a Maps key

`hasMapsKey()` and `mapsState` ("ready", "no-key", "failed", "loading") live in `src/app/api/mapsState.js`. An empty, blank, `PASTE...` or `your-google-maps...` value counts as no key. `window.gm_authFailure`, a script error and a 10 second load timeout set "failed". In "no-key" or "failed" the page hides the map, shows a calm status line, uses a plain "Search rooms" text filter, gives each card "Open in Google Maps" and "Directions" links (no key needed), skips distance until "Use my location" is tapped, and shows an explanation instead of the add form (the Firestore rules need a Google `placeId`, `lat` and `lng`, so they are not loosened). The Support page add form shows the same explanation. With a working key nothing changes.

## Environment

`VITE_GOOGLE_MAPS_API_KEY` (optional; browser key, Maps JavaScript API plus Places API). The page uses the legacy `places.Autocomplete` for the search box, so the key needs the Places API (not only Places API New).

## Tests

`tests/src/app/api/mapHelpers.spec.js`, `malls.spec.js`, `tests/src/app/components/RoomCard.spec.js`, `RoomFilterPanel.spec.js`, `tests/src/app/pages/pumping-rooms/pumping-rooms.spec.js`. The Maps loader is mocked; nothing touches the network.
