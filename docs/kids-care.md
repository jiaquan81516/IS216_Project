# Kids care

Page: `/support/kids-care` (`src/app/pages/kids-care/index.vue`), inside the app shell with the same guard as `/support/rooms`, and the sidebar keeps "Support" highlighted. Views by query: `?view=emergency` (default) and `?view=clinics`.

## Emergency view

Static, hand curated list in `src/app/data/kidsEmergency.js`, checked against each hospital's own web page on 2026-10-11. Addresses and coordinates come from the OneMap public search API (Singapore Land Authority, Singapore Open Data Licence).

Included:
- KK Women's and Children's Hospital Children's Emergency (KKH page, MOH reply of 6 August 2026 names it as a dedicated paediatric emergency). The KKH page does not state opening hours, so the card says to check.
- NUH Children's Emergency (NUH facilities page: "24 hours").

Left out on purpose:
- Singapore General Hospital, Ng Teng Fong General Hospital, Sengkang General Hospital: their own pages say they have no paediatric facilities and send children to KKH or NUH.
- Changi General Hospital, Khoo Teck Puat Hospital, Tan Tock Seng Hospital, Woodlands Health: the pages checked did not state a paediatric emergency service. Add one only after confirming it on the hospital's own page, and record the source URL.

No phone numbers are listed because none of the official service pages gave one. 995 (SCDF ambulance) is shown in the notice.

## Clinics view

Data: data.gov.sg dataset "CHAS Clinics" (`d_548c33ea2d99e29ec63a7cc9edcccedc`), Ministry of Health, GeoJSON, Singapore Open Data Licence. Page: https://data.gov.sg/datasets/d_548c33ea2d99e29ec63a7cc9edcccedc/view

Snapshot: `src/app/data/chasClinics.json`, built by `scripts/build-chas-clinics.mjs` and lazy loaded with `import()` only when the Clinics view opens. Fields: id, name, address, postal, lat, lng, phone, type (`gp` or `dental`). Dental clinics are hidden unless the Filter option is on. The page shows the nearest 50 (after "Use my location") or the first 50 by name, with "Show more".

Refresh command:

```
node scripts/build-chas-clinics.mjs                  # downloads from data.gov.sg
node scripts/build-chas-clinics.mjs --file chas.geojson   # or use a file you downloaded
```

Then run `pnpm test:unit` and commit the JSON.

## Status of the snapshot

The file in the repo is currently an empty snapshot (`"clinics": []`). The build sandbox could not reach data.gov.sg (network allowlist), so the dataset was never downloaded, and no clinic data was written or invented. The page shows an honest empty state until the refresh command is run on a machine with internet access. The parser reads both the usual `Description` HTML table and flat properties, but it has only been tested on synthetic fixtures, so check the first real run (count and a few addresses).

## Limits

- The CHAS list confirms CHAS participation only. It says nothing about child specialties, paediatric training, opening hours or whether the clinic takes walk ins.
- GP versus dental is decided by the clinic name and licence text (words such as dental, dentist, orthodontic). It is a heuristic.
- Dataset page was last updated by MOH on 2024-06-06 when checked, so some clinics may have closed.
- Distance is straight line distance, not travel time.
- Emergency details can change; the page tells people to check the hospital's website.

## Tests

`tests/src/app/api/kidsCareHelpers.spec.js`, `tests/scripts/build-chas-clinics.spec.js`, `tests/src/app/pages/kids-care/kids-care.spec.js`. No network is used.
