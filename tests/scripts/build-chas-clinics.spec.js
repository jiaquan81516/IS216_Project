import { describe, expect, it } from "vitest";
import { buildAddress, buildClinics, buildSnapshot, classify, readProps, titleCase } from "../../scripts/build-chas-clinics.mjs";

const html = (o) =>
  `<center><table>${Object.entries(o).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table></center>`;
const feature = (props, coords = [103.85, 1.3]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [...coords, 0] },
  properties: { Name: "kml_1", Description: html(props) },
});

const gp = { HCI_CODE: "CL001", HCI_NAME: "ALPHA FAMILY CLINIC PTE LTD", HCI_TEL: "6123 4567", POSTAL_CD: "123456", BLK_HSE_NO: "12", STREET_NAME: "TEST STREET 3", FLOOR_NO: "01", UNIT_NO: "05", BUILDING_NAME: "TEST PLAZA", CLINIC_PROGRAMME_CODE: "CHAS" };

describe("build-chas-clinics", () => {
  it("title cases names", () => {
    expect(titleCase("ALPHA FAMILY CLINIC PTE LTD")).toBe("Alpha Family Clinic PTE LTD");
    expect(titleCase("Dr TAN AND PARTNERS")).toBe("Dr Tan and Partners");
  });
  it("reads the HTML table in Description and flat properties", () => {
    expect(readProps({ Description: html({ HCI_NAME: "A &amp; B" }) }).HCI_NAME).toBe("A & B");
    expect(readProps({ hci_name: "Flat" }).HCI_NAME).toBe("Flat");
  });
  it("builds an address with unit and building", () => {
    expect(buildAddress(gp)).toBe("12 Test Street 3, #01-05, Test Plaza, Singapore 123456");
    expect(buildAddress({ POSTAL_CD: "NIL", STREET_NAME: "X ROAD" })).toBe("X Road, Singapore");
  });
  it("classifies dental clinics", () => {
    expect(classify(gp)).toBe("gp");
    expect(classify({ HCI_NAME: "SMILE DENTAL SURGERY" })).toBe("dental");
  });
  it("builds compact sorted clinics, skipping bad and duplicate rows", () => {
    const geo = {
      features: [
        feature({ ...gp, HCI_CODE: "CL002", HCI_NAME: "ZULU CLINIC" }),
        feature(gp),
        feature(gp),
        feature({ HCI_CODE: "CL003", HCI_NAME: "NO COORDS" }, [NaN, NaN]),
        feature({ HCI_CODE: "CL004", HCI_NAME: "BRIGHT DENTAL", HCI_TEL: "NIL" }),
      ],
    };
    const { clinics, skipped } = buildClinics(geo);
    expect(skipped).toBe(2);
    expect(clinics.map((c) => c.id)).toEqual(["CL001", "CL004", "CL002"]);
    expect(clinics.map((c) => c.name)).toEqual(["Alpha Family Clinic PTE LTD", "Bright Dental", "Zulu Clinic"]);
    expect(clinics[0]).toMatchObject({ phone: "6123 4567", type: "gp", lat: 1.3, lng: 103.85 });
    expect(clinics[1]).toMatchObject({ phone: "", type: "dental" });
  });
  it("adds licence and source to the snapshot meta", () => {
    const snap = buildSnapshot({ features: [feature(gp)] }, { retrievedAt: "2026-10-11" });
    expect(snap.meta).toMatchObject({ source: "data.gov.sg", licence: "Singapore Open Data Licence", retrievedAt: "2026-10-11", count: 1 });
  });
});
