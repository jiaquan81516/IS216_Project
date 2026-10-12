import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(js|vue|css|html|json)$/.test(name) && !/ 2\./.test(name) ? [full] : [];
  });
}

describe("no Google Maps in src", () => {
  const files = walk(join(process.cwd(), "src"));
  const banned = [/google\.com\/maps/i, /maps\.googleapis/i, /googleMaps/, /VITE_GOOGLE_MAPS/, /gm_authFailure/];
  it("has no Google Maps reference (Calendar and sign-in are allowed)", () => {
    const hits = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const re of banned) if (re.test(text)) hits.push(`${file}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
