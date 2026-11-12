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

/**
 * The prefixes this file owns: the words a view, a sheet, a crop, the orientation
 * controls, the drafting bar, a tag, a note, a drawing-set dialog and a diagram
 * are drawn with. The exhaustiveness half below uses it, so a key added to one of
 * these surfaces cannot arrive without a site count.
 */
const OWNED = [
  "view.",
  "crop3d.",
  "coordinates.",
  "orientation.",
  "canvas.",
  "draft.",
  "tag.",
  "dimension.",
  "note.",
  "section.",
  "selection.",
  "sheetDialog.",
  "sheetFigure.",
  "arrange.",
  "callout.",
  "circuits.",
  "figure.",
  "issue.",
  "keynote.",
  "parameter.",
  "print.",
  "printedPdf.",
  "revisions.",
  "set.",
  "drawingSet.",
  "drawing.",
  "titleBlock.",
  "projectInfo.",
  "diagram.",
] as const;

/**
 * How many call sites each shared caption has today; a new site is a deliberate
 * bump here. A key written in two places (a heading and a tooltip, an aria-label
 * and a button) would pass a presence check while one of them went back to a
 * literal, which is exactly the revert this table catches.
 */
const SITES: Readonly<Record<string, number>> = {
  "callout.refersTo": 2,
  "canvas.delete": 2,
  "canvas.deleteWhat": 2,
  "canvas.drawInsideFrame": 2,
  "canvas.editingOnSheet": 2,
  "canvas.lockedBy": 2,
  "canvas.regionThreeCorners": 2,
  "canvas.snapsTo": 2,
  "canvas.tag": 2,
  "canvas.undo.changeDimension": 2,
  "canvas.undo.drawRectangle": 2,
  "canvas.undo.removeFromSheet": 2,
  "canvas.undo.resizeNote": 2,
  "canvas.undo.takeOffSheet": 3,
  "coordinates.cancel": 2,
  "coordinates.howOriginMoves": 2,
  "coordinates.snappedTo": 2,
  "coordinates.typeCoordinates": 2,
  "crop3d.localOnly": 2,
  "crop3d.localOnlyWhy": 3,
  "crop3d.moveGripWhat": 2,
  "crop3d.title": 2,
  "crop3d.worksIn3d": 2,
  "diagram.leaveOff": 2,
  "diagram.leaveOffWhat": 2,
  "diagram.leftOff": 2,
  "diagram.namedOnThisDiagram": 2,
  "diagram.nothingMoved": 2,
  "diagram.properties": 2,
  "diagram.resetPositions": 2,
  "diagram.resetPositionsN": 2,
  "diagram.resetWhat": 2,
  "diagram.showAgain": 2,
  "diagram.showAgainWhat": 2,
  "draft.cancelEsc": 2,
  "draft.lineStyle": 2,
  "draft.need.boundaryThenLine": 2,
  "draft.need.pickComponent": 2,
  "draft.need.theCentre": 2,
  "draft.need.twoDifferentPoints": 2,
  "draft.need.twoPoints": 2,
  "draft.pick.basePoint": 3,
  "draft.pick.offsetSide": 2,
  "draft.pick.splitGapWhere": 2,
  "draft.pick.trimBoundary": 2,
  "draft.prompt.arcCentre": 2,
  "draft.prompt.arcStart": 2,
  "draft.prompt.firstPoint": 3,
  "draft.prompt.splineNext": 2,
  "draft.shape.dimension": 2,
  "draft.what.chain": 2,
  "drawing.drawing": 3,
  "figure.chartLower": 2,
  "figure.notAPicture": 2,
  "figure.pictureLower": 2,
  "figure.undo.resize": 2,
  "grip.lineEnd": 2,
  "issue.printedBy": 2,
  "keynote.noTablesYet": 2,
  "keynote.pickAKeynote": 2,
  "keynote.undo.giveKey": 2,
  "orientation.offWorkPlane": 2,
  "orientation.samePoints": 2,
  "print.drawingSet": 2,
  "print.title": 2,
  "print.waitingEdits": 2,
  "revisions.date": 2,
  "revisions.placeholder": 2,
  "revisions.rev": 2,
  "schedule.elements": 2,
  "schedule.modelStillLoading": 2,
  "schedule.newWindow.giveName": 2,
  "schedule.newWindow.giveSheetNumber": 2,
  "schedule.oneElement": 2,
  "schedule.priceWith.retry": 2,
  "schedule.priceWith.title": 2,
  "section.cancel": 2,
  "section.dragThisEnd": 2,
  "selection.spreadTags": 3,
  // The inspector's level fallback (both place and plane rows) and the origin overlay's run end.
  "selection.noLevel": 2,
  "coordinates.runEnd": 2,
  "set.checking": 3,
  "sheetDialog.cancel": 4,
  "sheetDialog.createAndOpen": 2,
  "sheetDialog.name": 3,
  "tag.moveTheTag": 2,
  "titleBlock.default": 2,
  "titleBlock.libraryService": 2,
  "titleBlock.unknownError": 3,
  "view.annotationCropReach": 2,
  "view.cropBox": 2,
  "view.dragCropHandle": 2,
  "view.drawEveryLinkedObject": 2,
  "view.leaveOutLinkedUnder": 2,
  "view.noLimit": 2,
  "view.projection": 3,
  // The linked models' display controls name where a change lands too
  // (`linked-display/use-linked-display.ts`): one panel in View properties, one hook
  // in the canvas, the same two words.
  "view.thisView": 2,
  "view.type.detail": 2,
  "view.undoLabel.cropBoxOf": 3,
  "view.your3dView": 2,
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

/**
 * The other half of the pin: a caption written in two places must have a number
 * in `SITES`. Without this, `SITES[key] ?? 1` quietly assumed one site for every
 * new key, and a second site could appear (or revert) unpinned.
 */
test("every caption this file owns that is written twice or more has its site count pinned", () => {
  const source = editorSourceCaptions();
  const unpinned = [...source.entries()]
    .filter(([key]) => OWNED.some((prefix) => key.startsWith(prefix)))
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
