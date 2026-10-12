# Pumping rooms map

Page: `/support/rooms` (`src/app/pages/pumping-rooms/index.vue`), inside the app shell, guarded like the other app pages. Linked from a "Find a pumping room" card in Support Guides (the old Support pumping rooms tab and its directory UI were removed) and from the Return to work pumping section.

## Data sources

1. Community rooms: the Firestore collection `pumpingRooms` (see `docs/data-model.md`). Shown first. These are "Verified" only when their `status` is `verified`.
2. BMSG directory rooms: `src/app/data/bmsgRooms.js`, loaded by `loadBmsgRooms` in `src/api/bmsgRooms.js`. They are shown as Verified, with a "Source: BMSG Nursing Room Directory" link on the card.
   - Source: the Breastfeeding Mothers' Support Group (BMSG) Nursing Room Directory, https://breastfeeding.org.sg/nursing-room-directory/ (page last updated 2026-04-13, text retrieved 2026-10-11). BMSG is a charity. Listings are contributed by its members and parents, and BMSG does not have jurisdiction over the rooms. This is not government data and it is not an audit.
   - What comes from where: the nursing room facts (room or pod, what is available, location and level text, parent feedback) come from BMSG. Coordinates and addresses come from OneMap (Singapore Land Authority, Singapore Open Data Licence v1.0), looked up by hand on 2026-10-11. No government dataset lists nursing rooms.
   - Mapping: BMSG's lockable cubicle, power points, wash basin and single or double pram items map to the app's Lockable, Power outlet, Sink and Stroller access features (shown and filterable). Everything else (diaper changing station, water dispenser, family-friendly access and so on) is kept in `facilities` and shown as one plain line on the card. Parent feedback is shown as one muted line. `verifiedOn` is the retrieval date and `verifiedDaysAgo` is computed from it when the page loads.
   - Included: Raffles City Shopping Centre, Suntec Convention Centre, VivoCity, Waterway Point, Parkway Parade and Takashimaya (inside Ngee Ann City, so it uses the Ngee Ann City address and point). Only these six have a coordinate source on file.
   - Not included yet, because OneMap's search API now needs an API token and no coordinate could be confirmed without it (coordinates are never guessed): Alexandra Retail Mall, Buangkok Square Mall, Forum Shopping Mall, IMM, Orchard Central, Paragon, The Star Vista, United Square, Institute of Mental Health, Ng Teng Fong Hospital, Serangoon Polyclinic, Holy Cross Church and Pusara Aman Mosque. Their BMSG details are in the directory page. Ng Teng Fong Hospital needs care: the Tower B Level 2 room is inside an office area and the Tower C Level 1M room is staff only, so say so in `details`.
   - Excluded on purpose: the Embassy of the Republic of the Philippines in Singapore, because it is not publicly accessible.
   - How to refresh or add one by hand: open the directory page, then add or edit a row in `ROWS` in `src/app/data/bmsgRooms.js` (name, kind `mall`, `public` or `worship`, type, level text, BMSG's "available" list and feedback copied as written). Get the address and coordinates from the OneMap search (`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=<name>&returnGeom=Y&getAddrDetails=Y&pageNum=1`, free token from onemap.gov.sg) and copy the address as OneMap returns it. Update `retrieved` and `pageUpdated` in `BMSG_SOURCE`. `tests/src/app/data/bmsgRooms.spec.js` checks ids, Singapore bounds, address, source and dashes.
3. Seed examples (`src/app/data/pumpingRooms.js`) appear only while the Firestore collection is empty. Their coordinates are in `SEED_COORDS` in the same file. A seed is dropped when a BMSG room covers it (Raffles City).

Merge order: community rooms, then BMSG rooms, then seeds. A later entry is dropped when it has the same `placeId`, or a near identical name within 100 m of an earlier one (`mergeRooms` in `src/app/utils/mapHelpers.js`). The rest of the rooms will come from users adding them (Firestore).

## Labelling rule

A room with `status` verified reads "Verified", whether it is a community room or a BMSG directory room, and "Verified only" shows both. BMSG rooms always name their source on the card. Seed examples say "Example room, not confirmed". The old "Mall, nursing room not confirmed" hand picked mall list is gone. The foot of the page says: "Verified rooms are from the Breastfeeding Mothers' Support Group directory. Know another room? Add it."

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

`hasMapsKey()` and `mapsState` ("ready", "no-key", "failed", "loading") live in `src/api/mapsState.js`. An empty, blank, `PASTE...` or `your-google-maps...` value counts as no key. `window.gm_authFailure`, a script error and a 10 second load timeout set "failed". In "no-key" or "failed" the page hides the map, shows a calm status line, uses a plain "Search rooms" text filter, gives each card "Open in Google Maps" and "Directions" links (no key needed), skips distance until "Use my location" is tapped, and shows an explanation instead of the add form (the Firestore rules need a Google `placeId`, `lat` and `lng`, so they are not loosened). The Support page add form shows the same explanation. With a working key nothing changes.

## Environment

`VITE_GOOGLE_MAPS_API_KEY` (optional; browser key, Maps JavaScript API plus Places API). The page uses the legacy `places.Autocomplete` for the search box, so the key needs the Places API (not only Places API New).

## Tests

`tests/src/app/utils/mapHelpers.spec.js`, `tests/src/api/bmsgRooms.spec.js`, `tests/src/app/data/bmsgRooms.spec.js`, `tests/src/app/components/RoomCard.spec.js`, `RoomFilterPanel.spec.js`, `tests/src/app/pages/pumping-rooms/pumping-rooms.spec.js`. The Maps loader is mocked; nothing touches the network.
