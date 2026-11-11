/**
 * The project-management panels in two languages — the half of Task 4.4 that is
 * finished.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **The words are keyed** — `editorSourceCaptions()` reads every `.ts`/`.tsx`
 *      under `src/editor` and pulls out each `t('<key>', '<English>'` call. A
 *      submittal heading that went back to a literal fails here.
 *   2. **The Turkish says the right thing, per the glossary** — §6 pins a
 *      submittal as an *imalat onayı* and a change order as a *değişiklik emri*;
 *      §2.3 pins a space as a *mekan*, never an *alan* (that is an area).
 *   3. **Real components draw it** — the submittal panel and the change-order
 *      dialog, in both languages.
 *
 * **Deliberately not asserted here, because the tree is not done.**
 * `spaces/` is not keyed yet, so the Space properties panel's own *mekan* has no
 * Turkish to assert (the word is proved where it already exists: the ventilation
 * and loads panels); Ç20 (*Sahip* for a model's owner, *İşveren* for the contract
 * party) lives in `spaces/` and `responsibilities/` and is owed by the same round.
 * Both are named in `NOT_YET_GUARDED` (`i18n-negative-space.test.ts`) and in the
 * task report.
 */
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { SubmittalsPanel } from "../src/editor/submittals/SubmittalsPanel";
import { translateFor, Wrap } from "./helpers/editor-i18n";
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import type { ModelState } from "@permitzip/bim-kernel";

const TR = translateFor("tr");
const MODEL = { elements: {}, revision: 1 } as unknown as ModelState;
const EN = translateFor("en");

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §6: a submittal is an imalat onayı (Ç19), a change order a değişiklik emri.
  { key: "submittals.newSubmittal", english: "New submittal", turkish: "Yeni imalat onayı" },
  { key: "submittals.saveSubmittal", english: "Save submittal", turkish: "İmalat onayını kaydet" },
  { key: "submittals.approvedSubstitution", english: "Approved substitution", turkish: "Onaylı ikame" },
  { key: "submittals.approvedProduct", english: "Approved product", turkish: "Onaylı ürün" },
  { key: "submittals.contractor", english: "Contractor", turkish: "Yüklenici" },
  { key: "submittals.productData", english: "Product data", turkish: "Ürün verisi" },
  { key: "changeOrders.title", english: "Change orders", turkish: "Değişiklik emirleri" },
  { key: "changeOrders.newChangeOrder", english: "New change order", turkish: "Yeni değişiklik emri" },
  { key: "changeOrders.quantitiesOnly", english: "Quantities only: no price is part of this change order. Price it with your own price book if you choose to.", turkish: "Yalnız miktarlar: bu değişiklik emrinde fiyat yok. İsterseniz kendi fiyat kitabınızla fiyatlandırın." },
  { key: "changeOrders.quantityChange", english: "Quantity change", turkish: "Miktar değişimi" },
  { key: "changeOrders.addPriceBook", english: "To price this change privately, add a price book in Settings › Price books.", turkish: "Bu değişikliği kendiniz için fiyatlandırmak için Ayarlar › Fiyat kitapları altına bir fiyat kitabı ekleyin." },
  // §2.3: a space is a mekan; an alan is an area.
  { key: "ventilation.space", english: "Space", turkish: "Mekan" },
  { key: "loads.space", english: "Space", turkish: "Mekan" },
  // The other panels this round finished.
  { key: "versions.dialogDescription", english: "Saved versions and issued sets of this model. Start a branch from one, or say what kind of change it was.", turkish: "Bu modelin kayıtlı sürümleri ve yayın setleri. Birinden dal başlatın ya da ne tür bir değişiklik olduğunu söyleyin." },
  { key: "versions.issuedSet", english: "Issued set", turkish: "Yayın seti" },
  { key: "merge.proposeMerge", english: "Propose merge", turkish: "Birleştirme öner" },
  { key: "merge.title", english: "Propose merge to Main", turkish: "Ana hatta birleştirme öner" },
  { key: "signing.verify", english: "Verify", turkish: "Doğrula" },
  { key: "levels.useArchitectLevels", english: "Use the architect's levels", turkish: "Mimarın katlarını kullan" },
  { key: "settings.preview", english: "Preview", turkish: "Önizleme" },
  { key: "partsList.partTypes", english: "Part types", turkish: "Parça tipleri" },
  { key: "ifcExport.title", english: "Export IFC", turkish: "IFC dışa aktar" },
  { key: "ifcImport.branchName", english: "Branch name", turkish: "Dal adı" },
];

/**
 * How many call sites each shared caption has today; a new site is a deliberate
 * bump here. A key written in two places would pass a presence check while one
 * of them went back to a literal.
 */
const SITES: Readonly<Record<string, number>> = {
  "changeOrders.retry": 6,
  "changeOrders.accept": 3,
  "changeOrders.refuse": 3,
  "changeOrders.cancel": 2,
  "changeOrders.noCost": 2,
  "changeOrders.forAndOpenedBy": 2,
  "changeOrders.cites": 2,
  "changeOrders.covers": 2,
  "changeOrders.anotherCompany": 2,
  "ifcExport.anExportRunning": 2,
  "ifcImport.close": 4,
  "ifcImport.tryAgain": 2,
  "levels.useArchitectLevels": 2,
  "levels.cancel": 2,
  "levels.upToDate": 2,
  "merge.noChanges": 2,
  "submittals.newSubmittal": 3,
  "submittals.approvedSubstitution": 2,
  "submittals.cancel": 2,
  "versions.retry": 2,
  "ventilation.space": 3,
  "loads.space": 2,
  "versions.whatKindWasThis": 2,
  "versions.kindOfChange": 2,
  "versions.asResponsibleFor": 2,
};

const PREFIXES = ["submittals.", "changeOrders.", "versions.", "merge.", "signing.", "levels.", "settings.", "partsList.", "ifcImport.", "ifcExport."] as const;

const fill = (template: string): string => template;

test("every project-panel caption is still keyed in the source, with its English", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("a project-panel caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

test("every project-panel caption written twice or more has its site count pinned", () => {
  const source = editorSourceCaptions();
  const unpinned = [...source.entries()]
    .filter(([key]) => PREFIXES.some((prefix) => key.startsWith(prefix)))
    .filter(([key, caption]) => caption.sites > 1 && SITES[key] === undefined)
    .map(([key, caption]) => `${key} (${caption.sites} sites)`);
  expect(unpinned).toEqual([]);
});

test("no pinned count is stale: every key in SITES is still in the source that many times", () => {
  const source = editorSourceCaptions();
  const wrong = Object.entries(SITES)
    .filter(([key, sites]) => (source.get(key)?.sites ?? 0) !== sites)
    .map(([key, sites]) => `${key}: pinned ${sites}, source has ${source.get(key)?.sites ?? 0}`);
  expect(wrong).toEqual([]);
});

test("submittals read imalat onayı, and never the raw English", () => {
  // §6/Ç19: the trade's own term, not a literal translation of "submittal".
  expect(TR("submittals.newSubmittal", "New submittal", { ns: "editor" })).toBe("Yeni imalat onayı");
  expect(TR("submittals.saveSubmittal", "Save submittal", { ns: "editor" })).toBe("İmalat onayını kaydet");
  expect(TR("submittals.newSubmittal", "New submittal", { ns: "editor" })).not.toContain("Submittal");
  // §6: an approved product is an onaylı ürün, an approved substitution an onaylı ikame.
  expect(TR("submittals.approvedProduct", "Approved product", { ns: "editor" })).toBe("Onaylı ürün");
  expect(TR("submittals.approvedSubstitution", "Approved substitution", { ns: "editor" })).toBe("Onaylı ikame");
});

test("change order reads değişiklik emri, and its money words stay §6's", () => {
  expect(TR("changeOrders.title", "Change orders", { ns: "editor" })).toBe("Değişiklik emirleri");
  expect(TR("changeOrders.newChangeOrder", "New change order", { ns: "editor" })).toBe("Yeni değişiklik emri");
  // §6: a price book is a fiyat kitabı, a quantity change a miktar değişimi.
  expect(TR("changeOrders.quantityChange", "Quantity change", { ns: "editor" })).toBe("Miktar değişimi");
  expect(TR("changeOrders.addPriceBook", "To price this change privately, add a price book in Settings › Price books.", { ns: "editor" })).toContain("fiyat kitabı");
  // The change order is explicitly not a maliyet: it carries no price of its own.
  expect(TR("changeOrders.quantitiesOnly", "Quantities only: no price is part of this change order. Price it with your own price book if you choose to.", { ns: "editor" })).toContain("değişiklik emrinde fiyat yok");
});

test("space reads mekan, never alan", () => {
  // §2.3: `space` is a mekan; `alan` is an area and stays with `area`.
  expect(TR("ventilation.space", "Space", { ns: "editor" })).toBe("Mekan");
  expect(TR("loads.space", "Space", { ns: "editor" })).toBe("Mekan");
  expect(TR("ventilation.space", "Space", { ns: "editor" })).not.toBe("Alan");
  expect(TR("ventilation.area", "Area", { ns: "editor" })).toBe("Alan");
});

test("every panel title this round owns is translated", () => {
  const titles = ["versions.dialogDescription", "merge.title", "levels.useArchitectLevels", "settings.preview", "partsList.partTypes", "ifcExport.title", "ifcImport.branchName", "signing.verify"] as const;
  for (const key of titles) expect((LOCALE[key] ?? "").trim()).not.toBe("");
});

test("English labels are unchanged", () => {
  for (const caption of CAPTIONS) {
    expect(EN(caption.key, caption.english, { ns: "editor" })).toBe(fill(caption.english));
  }
});

/** `{ submittals: { newSubmittal: "Yeni imalat onayı" } }` → `"submittals.newSubmittal"`. */
function flatten(source: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") out[id] = value;
    else if (typeof value === "object" && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id));
  }
  return out;
}

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locales", "tr", "editor.json"), "utf8")) as Record<string, unknown>);

test("every project-panel caption in the source has its Turkish", () => {
  const inSource = [...editorSourceCaptions().keys()].filter((key) => PREFIXES.some((prefix) => key.startsWith(prefix)));
  expect(inSource.length).toBeGreaterThan(250);
  expect(inSource.filter((key) => (LOCALE[key] ?? "").trim() === "")).toEqual([]);
});

test("a placeholder is never written with one brace", () => {
  const wrong = Object.entries(LOCALE)
    .filter(([key]) => PREFIXES.some((prefix) => key.startsWith(prefix)))
    .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
    .map(([key]) => key);
  expect(wrong).toEqual([]);
});

// ---------------------------------------------------------------------------
// Rendered surfaces
// ---------------------------------------------------------------------------

test("the submittals panel draws its Turkish empty state", () => {
  render(
    <Wrap language="tr">
      <SubmittalsPanel model={MODEL} canEdit={false} blockedReason="" submit={() => null} selection={[]} selectionLabel="" />
    </Wrap>,
  );
  expect(screen.getByText("Henüz imalat onayı yok")).toBeTruthy();
  expect(screen.getByText("Yeni imalat onayı")).toBeTruthy();
  expect(screen.queryByText("No submittals yet")).toBeNull();
});

test("the submittals panel is unchanged in English", () => {
  render(
    <Wrap language="en">
      <SubmittalsPanel model={MODEL} canEdit={false} blockedReason="" submit={() => null} selection={[]} selectionLabel="" />
    </Wrap>,
  );
  expect(screen.getByText("No submittals yet")).toBeTruthy();
  expect(screen.getByText("New submittal")).toBeTruthy();
});
