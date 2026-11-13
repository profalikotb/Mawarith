import type { CaseInput, Group } from "./types";

const g = (): Group => ({ state: "no", count: 1, names: [] });
const gu = (): Group => ({ state: "unknown", count: 1, names: [] });

/** A blank case. Relatives default to "unknown" for the core questions so nothing is silently assumed absent. */
export function emptyCase(blankAsUnknown = true): CaseInput {
  const G = blankAsUnknown ? gu : g;
  return {
    schema: 1,
    meta: { title: "", deceasedGender: "male", deathDate: "", deceasedIsMuslim: true, confirmDeceased: false, framework: "EG" },
    estate: { fractionOnly: false, assets: [], receivables: [], debts: [], funeralPiasters: "0", wills: [], excessConsent: "none" },
    family: {
      husband: { state: blankAsUnknown ? "unknown" : "no", status: "married" },
      wives: { state: blankAsUnknown ? "unknown" : "no", list: [] },
      father: { state: blankAsUnknown ? "unknown" : "no" },
      mother: { state: blankAsUnknown ? "unknown" : "no" },
      paternalGrandfather: { state: "no" },
      gm: { mm: "no", fm: "no", mmm: "no", fmm: "no", ffm: "no" },
      children: [],
      fullBrothers: G(),
      fullSisters: G(),
      patBrothers: G(),
      patSisters: G(),
      matBrothers: G(),
      matSisters: G(),
      fullNephews: g(),
      patNephews: g(),
      fullNephewSons: g(),
      patNephewSons: g(),
      fullUncles: g(),
      patUncles: g(),
      fullCousins: g(),
      patCousins: g(),
      fullCousinSons: g(),
      patCousinSons: g(),
      remoteAgnates: "no",
      distantKin: "no",
      otherRelative: "unknown",
    },
    flags: {
      pregnancy: "no",
      pregnancyRelation: "decedent_child",
      missingPerson: "no",
      heirDiedAfter: "no",
      simultaneousDeath: "no",
      nasabDispute: "no",
      marriageDispute: "no",
      divorceIssue: "no",
      impediment: "no",
      minors: "no",
      disputedWill: "no",
      foreignAssets: "no",
      generalDispute: "no",
    },
  };
}

let seq = 0;
export const uid = (p = "p") => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
