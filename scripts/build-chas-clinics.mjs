// Builds src/app/data/chasClinics.json from the data.gov.sg "CHAS Clinics" GeoJSON
// (Ministry of Health, dataset d_548c33ea2d99e29ec63a7cc9edcccedc, Singapore Open Data Licence).
//
//   node scripts/build-chas-clinics.mjs                 download from data.gov.sg and write the file
//   node scripts/build-chas-clinics.mjs --file x.geojson  use a GeoJSON file you already downloaded
//
// No dependencies. Needs Node 18 or newer (global fetch).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const DATASET_ID = "d_548c33ea2d99e29ec63a7cc9edcccedc";
export const DATASET_PAGE = `https://data.gov.sg/datasets/${DATASET_ID}/view`;
const API = `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}`;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/app/data/chasClinics.json");

const DENTAL = /\b(dental|dentist|dentistry|orthodont\w*|oral)\b/i;
const SMALL = new Set(["and", "of", "the", "at", "for", "pte", "ltd"]);
const KEEP_UPPER = new Set(["GP", "NUH", "KK", "HDB", "MRT", "SG", "TCM", "II", "III", "IV", "PTE", "LTD", "LLP", "PLT"]);

export function titleCase(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[a-z0-9']+/g, (word, i) => {
      const upper = word.toUpperCase();
      if (KEEP_UPPER.has(upper)) return upper;
      if (i > 0 && SMALL.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .replace(/\s+/g, " ")
    .trim();
}

const decode = (s) =>
  String(s)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

// data.gov.sg GeoJSON built from KML keeps its attributes in an HTML table in `Description`.
// Newer exports may use flat properties. Both shapes are read here.
export function readProps(properties = {}) {
  const out = {};
  const html = typeof properties.Description === "string" ? properties.Description : "";
  for (const m of html.matchAll(/<th[^>]*>\s*([A-Za-z_]+)\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    out[m[1].toUpperCase()] = decode(m[2]);
  }
  for (const [k, v] of Object.entries(properties)) {
    if (k !== "Description" && v !== null && typeof v !== "object") out[k.toUpperCase()] = String(v).trim();
  }
  return out;
}

const clean = (v) => (v && !/^(null|nil|na|n\/a|-)$/i.test(String(v).trim()) ? String(v).trim() : "");

export function buildAddress(p) {
  const street = [clean(p.BLK_HSE_NO), titleCase(clean(p.STREET_NAME))].filter(Boolean).join(" ");
  const floor = clean(p.FLOOR_NO);
  const unit = clean(p.UNIT_NO);
  const unitText = floor || unit ? `#${[floor, unit].filter(Boolean).join("-")}` : "";
  const building = titleCase(clean(p.BUILDING_NAME));
  const postal = clean(p.POSTAL_CD);
  return [street, unitText, building, postal ? `Singapore ${postal}` : "Singapore"].filter(Boolean).join(", ");
}

export function classify(p) {
  const text = `${p.HCI_NAME ?? ""} ${p.LICENCE_TYPE ?? ""} ${p.CLINIC_PROGRAMME_CODE ?? ""}`;
  return DENTAL.test(text) ? "dental" : "gp";
}

// Returns { clinics, skipped } from a parsed GeoJSON FeatureCollection.
export function buildClinics(geojson) {
  const clinics = [];
  const seen = new Set();
  let skipped = 0;
  for (const feature of geojson?.features ?? []) {
    const p = readProps(feature?.properties);
    const coords = feature?.geometry?.coordinates;
    const lng = Number(coords?.[0]);
    const lat = Number(coords?.[1]);
    const name = titleCase(clean(p.HCI_NAME));
    const id = clean(p.HCI_CODE) || `${name}-${clean(p.POSTAL_CD)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || seen.has(id)) {
      skipped += 1;
      continue;
    }
    seen.add(id);
    const phone = clean(p.HCI_TEL).replace(/\s+/g, " ");
    clinics.push({
      id,
      name,
      address: buildAddress(p),
      postal: clean(p.POSTAL_CD),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      phone: phone.replace(/\D/g, "").length >= 6 ? phone : "",
      type: classify(p),
    });
  }
  clinics.sort((a, b) => a.name.localeCompare(b.name));
  return { clinics, skipped };
}

export function buildSnapshot(geojson, { retrievedAt, sourceUpdated = null } = {}) {
  const { clinics } = buildClinics(geojson);
  return {
    meta: {
      dataset: "CHAS Clinics",
      datasetId: DATASET_ID,
      publisher: "Ministry of Health",
      source: "data.gov.sg",
      sourceUrl: DATASET_PAGE,
      licence: "Singapore Open Data Licence",
      retrievedAt,
      sourceUpdated,
      count: clinics.length,
    },
    clinics,
  };
}

async function download() {
  const start = await (await fetch(`${API}/initiate-download`)).json();
  if (start?.code && start.code !== 0 && start.code !== 201) console.warn("initiate-download:", start.errorMsg ?? start.code);
  for (let i = 0; i < 20; i += 1) {
    const poll = await (await fetch(`${API}/poll-download`)).json();
    const url = poll?.data?.url;
    if (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
      return res.json();
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("data.gov.sg did not return a download link in time");
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const geojson = fileIndex >= 0 ? JSON.parse(await readFile(args[fileIndex + 1], "utf8")) : await download();
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const snapshot = buildSnapshot(geojson, { retrievedAt });
  if (!snapshot.clinics.length) throw new Error("No clinics found in the file, nothing written.");
  await writeFile(OUT, JSON.stringify(snapshot) + "\n");
  const gp = snapshot.clinics.filter((c) => c.type === "gp").length;
  console.log(`Wrote ${snapshot.clinics.length} clinics (${gp} general practice) to ${OUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
