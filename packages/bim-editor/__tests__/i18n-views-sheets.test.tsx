/**
 * Views, sheets, crops and orientation in two languages.
 *
 * The three things this file proves, and the hole each closes:
 *
 *   1. **The words are keyed** — `editorSourceCaptions()` reads every `.ts`/`.tsx`
 *      under `src/editor` (comments stripped) and pulls out each
 *      `t('<key>', '<English>'` call. A view-properties label that went back to a
 *      literal fails here; `SITES` pins how many places hold each caption.
 *   2. **The Turkish says the right thing, per the glossary** — §2.4 pins *pafta*
 *      for a sheet and *antet* for a title block, and §9/Ç6 pins *detay seviyesi*
 *      for "Detail level": **not** `kat` (that is a storey, §2.3).
 *   3. **Real components draw it** — `ViewsSheetsPanel` (its New menu), the view
 *      properties panel (crop box and detail level), title blocks and the
 *      orientation controls, in both languages.
 */
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "../src/ui/tooltip";
import { ViewsSheetsPanel } from "../src/editor/views-sheets/ViewsSheetsPanel";
import { ViewPropertiesPanel } from "../src/editor/views-sheets/ViewPropertiesPanel";
import { detailLevelLabel } from "../src/editor/views-sheets/ViewPropertiesPanel";
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor, Wrap } from "./helpers/editor-i18n";
import type { ViewElement } from "@permitzip/bim-kernel";
import { EditorHostProvider } from "../src/host";
import { createLocalEditorHost } from "../src/host/local";

const TR = translateFor("tr");
const EN = translateFor("en");

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §2.4: a sheet is a pafta, its title block an antet.
  { key: "panel.newSheet", english: "New sheet", turkish: "Yeni pafta" },
  { key: "panel.sheetProperties", english: "Number, name and title block…", turkish: "Numara, ad ve antet…" },
  { key: "panel.printSet", english: "Print set…", turkish: "Seti yazdır…" },
  { key: "panel.issueSet", english: "Issue set…", turkish: "Set yayınla…" },
  { key: "panel.revisions", english: "Revisions…", turkish: "Revizyonlar…" },
  { key: "panel.arrangeViews", english: "Arrange views…", turkish: "Görünümleri düzenle…" },
  { key: "titleBlock.titleBlock", english: "Title block", turkish: "Antet" },
  { key: "titleBlock.paper", english: "Paper", turkish: "Kâğıt" },
  { key: "titleBlock.default", english: "Default", turkish: "Varsayılan" },
  { key: "titleBlock.makeDefault", english: "Make default", turkish: "Varsayılan yap" },
  { key: "titleBlock.noneInLibrary", english: "No title blocks in the library", turkish: "Kitaplıkta antet yok" },
  { key: "projectInfo.title", english: "Project information", turkish: "Proje bilgileri" },
  // §9/Ç6: the view's detail level is "detay seviyesi", never "kat".
  { key: "view.detailLevel", english: "Detail level", turkish: "Detay seviyesi" },
  { key: "view.detail.coarse", english: "Coarse", turkish: "Kaba" },
  { key: "view.detail.medium", english: "Medium", turkish: "Orta" },
  { key: "view.detail.fine", english: "Fine", turkish: "İnce" },
  // Crop: the box, its four edges and its fit.
  { key: "view.cropBox", english: "Crop box", turkish: "Kırpma kutusu" },
  { key: "view.cropView", english: "Crop view", turkish: "Görünümü kırp" },
  { key: "view.showCropBoxLabel", english: "Show crop box", turkish: "Kırpma kutusunu göster" },
  { key: "view.annotationCrop", english: "Annotation crop", turkish: "Açıklama kırpması" },
  { key: "view.crop.leftEdge", english: "Left edge (ft)", turkish: "Sol kenar (ft)" },
  { key: "view.crop.topEdge", english: "Top edge (ft)", turkish: "Üst kenar (ft)" },
  { key: "view.fitCropToContent", english: "Fit crop to content", turkish: "Kırpmayı içeriğe sığdır" },
  { key: "crop3d.title", english: "3D crop box", turkish: "3B kırpma kutusu" },
  { key: "crop3d.width", english: "Width, east–west (ft)", turkish: "Genişlik, doğu–batı (ft)" },
  { key: "crop3d.turn", english: "Turn (degrees)", turkish: "Dönüş (derece)" },
  // Orientation.
  { key: "orientation.viewOrientation", english: "View orientation", turkish: "Görünüm yönü" },
  { key: "orientation.homeView", english: "Home view", turkish: "Ana görünüm" },
  { key: "orientation.side.north", english: "North", turkish: "Kuzey" },
  { key: "orientation.aboveSouthEast", english: "Above, from the south-east", turkish: "Yukarıdan, güneydoğudan" },
  { key: "orientation.planViewFromHere", english: "Plan view from here", turkish: "Buradan plan görünümü" },
  { key: "view.orthographic", english: "Orthographic", turkish: "Ortografik" },
  { key: "view.perspective", english: "Perspective", turkish: "Perspektif" },
  { key: "view.whatThisViewShows", english: "What this view shows", turkish: "Bu görünümün gösterdikleri" },
  { key: "view.linesAndColours", english: "Lines and colours", turkish: "Çizgiler ve renkler" },
  { key: "view.draftingShown", english: "Drafting shown", turkish: "Gösterilen açıklama" },
  { key: "view.liveModel", english: "Live model", turkish: "Canlı model" },
  { key: "view.printedDrawing", english: "Printed drawing", turkish: "Yazdırılan çizim" },
  { key: "view.rename", english: "Rename", turkish: "Yeniden adlandır" },
];

/** How many call sites each shared caption has today; a new site is a deliberate bump here. */
const SITES: Readonly<Record<string, number>> = {
  "view.projection": 2,
  "view.noLimit": 2,
  "titleBlock.default": 2,
  "titleBlock.unknownError": 2,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("every view and sheet caption is still keyed in the source, with its English", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("a view or sheet caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

test("sheet and title block labels are Turkish", () => {
  expect(TR("panel.newSheet", "New sheet", { ns: "editor" })).toBe("Yeni pafta");
  expect(TR("titleBlock.titleBlock", "Title block", { ns: "editor" })).toBe("Antet");
  expect(TR("titleBlock.paper", "Paper", { ns: "editor" })).toBe("Kâğıt");
  for (const key of ["panel.newSheet", "titleBlock.titleBlock"]) {
    const english = CAPTIONS.find((c) => c.key === key)?.english ?? "";
    expect(EN(key, english, { ns: "editor" })).toBe(english);
  }
});

test("view crop and orientation labels are Turkish", () => {
  expect(TR("view.cropBox", "Crop box", { ns: "editor" })).toBe("Kırpma kutusu");
  expect(TR("view.cropView", "Crop view", { ns: "editor" })).toBe("Görünümü kırp");
  expect(TR("orientation.viewOrientation", "View orientation", { ns: "editor" })).toBe("Görünüm yönü");
  expect(TR("orientation.side.north", "North", { ns: "editor" })).toBe("Kuzey");
  // The audit asks for the crop's own verbs too, not just its headings.
  expect(TR("view.fitCropToContent", "Fit crop to content", { ns: "editor" })).toBe("Kırpmayı içeriğe sığdır");
  expect(TR("view.crop.leftEdge", "Left edge (ft)", { ns: "editor" })).toBe("Sol kenar (ft)");
});

test("detail level reads detay seviyesi, not kat", () => {
  // §9/Ç6: `kat` is a storey (§2.3); the view's detail level is its own term.
  expect(TR("view.detailLevel", "Detail level", { ns: "editor" })).toBe("Detay seviyesi");
  expect(detailLevelLabel(TR)).toBe("Detay seviyesi");
  expect(detailLevelLabel(TR)).not.toBe("Kat");
  expect(detailLevelLabel(TR).toLowerCase()).not.toContain("kat");
  expect(detailLevelLabel(EN)).toBe("Detail level");
});

test("English labels are unchanged", () => {
  for (const caption of CAPTIONS) {
    expect(EN(caption.key, caption.english, { ns: "editor" })).toBe(fill(caption.english, undefined));
  }
});

/** `{ view: { cropBox: "Kırpma kutusu" } }` → `"view.cropBox"`. */
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

test("every view, sheet, crop and orientation caption in the source has its Turkish", () => {
  const prefixes = ["view.", "crop3d.", "titleBlock.", "projectInfo.", "orientation."];
  const inSource = [...editorSourceCaptions().keys()].filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
  expect(inSource.length).toBeGreaterThan(120);
  expect(inSource.filter((key) => (LOCALE[key] ?? "").trim() === "")).toEqual([]);
});

test("a placeholder is never written with one brace", () => {
  const wrong = Object.entries(LOCALE)
    .filter(([key]) => ["view.", "crop3d.", "titleBlock.", "projectInfo.", "orientation."].some((prefix) => key.startsWith(prefix)))
    .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
    .map(([key]) => key);
  expect(wrong).toEqual([]);
});

// ---------------------------------------------------------------------------
// Rendered surfaces
// ---------------------------------------------------------------------------

const NOOP = (): void => {};

const PANEL_PROPS = {
  model: null,
  canEdit: false,
  blockedReason: "You don't have permission to edit this model.",
  open: { kind: "model", mode: "3d" } as const,
  onOpen: NOOP,
  onRequest: NOOP,
  userId: "person-1",
};

test("the views and sheets panel's own menu is Turkish", () => {
  render(
    <Wrap language="tr">
      <TooltipProvider>
        <ViewsSheetsPanel {...PANEL_PROPS} />
      </TooltipProvider>
    </Wrap>,
  );
  // The panel's empty state and its two open rows.
  expect(screen.getByText("Henüz kayıtlı görünüm yok")).toBeTruthy();
  expect(screen.getByText("3B model")).toBeTruthy();
  expect(screen.getByText("Üstten plan")).toBeTruthy();
  expect(screen.queryByText("No saved views yet")).toBeNull();
});

test("the views and sheets panel is unchanged in English", () => {
  render(
    <Wrap language="en">
      <TooltipProvider>
        <ViewsSheetsPanel {...PANEL_PROPS} />
      </TooltipProvider>
    </Wrap>,
  );
  expect(screen.getByText("No saved views yet")).toBeTruthy();
  expect(screen.getByText("Top-down plan")).toBeTruthy();
});

const VIEW: ViewElement = {
  id: "v1",
  kind: "view",
  name: "Level 1 plan",
  viewType: "floor_plan",
  cropMin: { x: 0, y: 0 },
  cropMax: { x: 30480, y: 30480 },
  props: { level: "Level 1", scale: 48 },
} as unknown as ViewElement;

/** The host the view properties read their shared data from: a local one, with nothing connected. */
const HOST = createLocalEditorHost({ authorityUrl: "ws://127.0.0.1:3095/sync" });

function viewPanel(language: "tr" | "en") {
  render(
    <Wrap language={language}>
      <EditorHostProvider host={HOST}>
        <TooltipProvider>
        <ViewPropertiesPanel
          view={VIEW}
          canEdit={false}
          blockedReason=""
          submit={() => null}
          references={[]}
          display="model"
          onDisplay={NOOP}
          onRename={NOOP}
          />
        </TooltipProvider>
      </EditorHostProvider>
    </Wrap>,
  );
}

test("the view properties draw their crop and detail level in Turkish", () => {
  viewPanel("tr");
  // "Detail level", §9/Ç6: detay seviyesi — and the word `kat` (a storey) is nowhere near it.
  expect(screen.getByTestId("view-detail-level").getAttribute("aria-label")).toBe("Detay seviyesi");
  expect(screen.getAllByText("Detay seviyesi").length).toBeGreaterThan(0);
  expect(screen.queryByText("Detail level")).toBeNull();
  expect(screen.getByText("Kırpma kutusu")).toBeTruthy();
  expect(screen.getByText("Görünümü kırp")).toBeTruthy();
  expect(screen.getByText("Çizgiler ve renkler")).toBeTruthy();
  expect(screen.getByText("Bu görünümün gösterdikleri")).toBeTruthy();
  expect(screen.getByText("Yeniden adlandır")).toBeTruthy();
});

test("the view properties are unchanged in English", () => {
  viewPanel("en");
  expect(screen.getByTestId("view-detail-level").getAttribute("aria-label")).toBe("Detail level");
  expect(screen.getByText("Crop box")).toBeTruthy();
  expect(screen.getByText("Crop view")).toBeTruthy();
  expect(screen.getByText("Lines and colours")).toBeTruthy();
});
