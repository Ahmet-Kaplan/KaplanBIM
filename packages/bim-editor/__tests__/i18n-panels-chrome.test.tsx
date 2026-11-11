/**
 * The dock panels and the status bar, in both languages.
 *
 * Every caption this file names is `t('<key>', '<English>', { ns: 'editor' })`
 * at the place the panel draws it, with the Turkish in
 * `locales/tr/editor.json`. English is the source of truth: the call site holds
 * it, so a panel whose Turkish has not been written yet still reads correctly.
 *
 * What is *proven* here, and how (the earlier version of this file claimed more
 * than it did — it read the locale file, so a component that went back to a bare
 * literal still passed):
 *
 *   1. **The key is still in the source.** `editorSourceCaptions()` reads every
 *      `.ts`/`.tsx` under `src/editor` (comments stripped) and pulls out each
 *      `t('<key>', '<English>'` call. Every caption below must be in it, with
 *      the English it has today; and every `panel.*`/`status.*` key in the source
 *      must be in the table. That is the half that bites when someone reverts a
 *      caption to a literal or adds a new one without translating it.
 *   2. **The Turkish says the right thing.** `editorResources` ships only
 *      `{ tr: … }`, so a translator's English side is the default the call site
 *      passes — comparing it to itself would prove nothing. Instead the English
 *      comes from the *source* (1) and the Turkish from the locale file, and the
 *      two must differ.
 *   3. **Real components render it.** `ViewsSheetsPanel` (both languages, the
 *      title and the `Schedules` group), `ResizableSideRail` (the Properties rail:
 *      a translated title must not be glued to an English verb — "Collapse
 *      Özellikler" is the bug) and `PanelView`'s live branch (a `aria-label` with
 *      the panel's name in it).
 *   4. **The status bar, one state at a time**, through `statusBadge`, plus the
 *      paused-edit sentence that takes the translator-less path — where a
 *      `{{n}}` would otherwise reach the screen (see the `edits` tests).
 *
 * Contexts this file cannot render, and why (the report says the same):
 *   - The surfaces that build these panels need a live model store, a socket and
 *     the whole editor host (Building Model, the coordination pane, the schedule
 *     pane). They are covered by (1) and (2), not by a render.
 *   - A known connection problem's *title* arrives already worded by
 *     `connectionProblem()`, so it is proven in `i18n-operator-messages.test.ts`
 *     rather than here: the badge shows that title as it arrives.
 */
import { render, screen } from "@testing-library/react";
import type { SaveState } from "@permitzip/bim-sync";
import { CONNECTED_LOAD_ONLY, ElectricalLoadEngine } from "@permitzip/bim-pack-electrical";
import { editsPausedMessage, statusBadge } from "../src/editor/operator-messages";
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { ResizableSideRail } from "../src/editor/layout/ResizableSideRail";
import { PanelView } from "../src/editor/electrical/PanelView";
import type { NecRules } from "../src/editor/electrical/use-nec-rules";
import { ViewsSheetsPanel, viewGroups } from "../src/editor/views-sheets/ViewsSheetsPanel";
import type { Translate } from "../src/editor/i18n/translate";
import { TooltipProvider } from "../src/ui/tooltip";
import { referenceDistribution } from "../../bim-kernel/__tests__/fixtures/electrical-building";
import { translateFor, Wrap } from "./helpers/editor-i18n";

const NOOP = (): void => {};

/** Edits standing. "Saved" means the server has everything; nothing is waiting. */
const SAVED: SaveState = { pending: 0, retrying: 0, message: null };

/** One caption the editor's panels and status bar show, as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

/**
 * The dock panels' captions (§4 "Yan/dock panelleri" + §4.2, `docs/i18n/glossary.md`).
 *
 * Namespaced by hand at the call sites: `useEditorTranslate()` hides its
 * `useT('editor')` from `npm run i18n:review`, so every call site names the
 * namespace itself. The keys here are read back out of the source by
 * `editorSourceCaptions()`, so a rename cannot leave this table quietly right.
 */
const PANEL_CAPTIONS: readonly Caption[] = [
  { key: "panel.properties", english: "Properties", turkish: "Özellikler" },
  { key: "panel.viewsAndSheets", english: "Views and sheets", turkish: "Görünümler ve paftalar" },
  { key: "panel.railAria", english: "Views, sheets and model filters", turkish: "Görünümler, paftalar ve model filtreleri" },
  { key: "panel.show", english: "Show", turkish: "Göster" },
  { key: "panel.showIn", english: "Show in {{view}}", turkish: "{{view}} içinde göster" },
  { key: "panel.showRail", english: "Show {{name}}", turkish: "{{name}} panelini göster" },
  { key: "panel.collapseRail", english: "Collapse {{name}}", turkish: "{{name}} panelini daralt" },
  { key: "panel.collapseRailToStrip", english: "Collapse {{name}} to a strip", turkish: "{{name}} panelini şeride daralt" },
  { key: "panel.resizeRail", english: "Resize {{name}}", turkish: "{{name}} panelini yeniden boyutlandır" },
  { key: "panel.linkedModels", english: "Linked models", turkish: "Bağlı modeller" },
  { key: "panel.notPlacedYet", english: "Not placed yet", turkish: "Henüz yerleştirilmedi" },
  { key: "panel.placeAPart", english: "Place a part", turkish: "Parça yerleştir" },
  { key: "panel.stopPlacing", english: "Stop placing", turkish: "Yerleştirmeyi durdur" },
  { key: "panel.spaces", english: "Spaces", turkish: "Mekanlar" },
  { key: "panel.questions", english: "Questions", turkish: "Sorular" },
  { key: "panel.submittals", english: "Submittals", turkish: "Onay belgeleri" },
  { key: "panel.coordination", english: "Coordination", turkish: "Koordinasyon" },
  { key: "panel.coordinationFindings", english: "Coordination findings", turkish: "Koordinasyon bulguları" },
  { key: "panel.closePane", english: "Close {{name}} (Esc)", turkish: "{{name}} penceresini kapat (Esc)" },
  { key: "panel.closeNotPlacedYet", english: "Close Not placed yet", turkish: "Henüz yerleştirilmedi penceresini kapat" },
  { key: "panel.closeProperties", english: "Close properties", turkish: "Özellikler penceresini kapat" },
  { key: "panel.closeSpaces", english: "Close Spaces", turkish: "Mekanlar penceresini kapat" },
  { key: "panel.closePanelView", english: "Close panel view", turkish: "Pano görünümünü kapat" },
  { key: "panel.checklist", english: "Checklist", turkish: "Kontrol listesi" },
  { key: "panel.designLimits", english: "Design limits", turkish: "Tasarım limitleri" },
  { key: "panel.addOns", english: "Add-ons", turkish: "Eklentiler" },
  { key: "panel.titleBlocks", english: "Title blocks", turkish: "Antetler" },
  { key: "panel.changeOrders", english: "Change orders", turkish: "Değişiklik emirleri" },
  { key: "panel.history", english: "History", turkish: "Geçmiş" },
  { key: "panel.versions", english: "Versions", turkish: "Sürümler" },
  { key: "panel.responsibilities", english: "Responsibilities", turkish: "Sorumluluklar" },
  { key: "panel.copies", english: "Copies", turkish: "Kopyalar" },
  { key: "panel.revisionsOnSheet", english: "Revisions on {{number}}", turkish: "{{number}} paftasının revizyonları" },
  { key: "panel.notesLegend", english: "Notes legend", turkish: "Not açıklamaları" },
  { key: "panel.panelView", english: "Panel view", turkish: "Pano görünümü" },
  { key: "panel.panelViewNamed", english: "Panel view: {{name}}", turkish: "Pano görünümü: {{name}}" },
  { key: "panel.priceBook", english: "Price book", turkish: "Fiyat kitabı" },
  { key: "panel.group.floorPlans", english: "Floor plans", turkish: "Kat planları" },
  { key: "panel.group.ceilingPlans", english: "Ceiling plans", turkish: "Tavan planları" },
  { key: "panel.group.sections", english: "Sections", turkish: "Kesitler" },
  { key: "panel.group.threeD", english: "3D views", turkish: "3B görünümler" },
  { key: "panel.group.detailViews", english: "Detail views", turkish: "Detay görünümleri" },
  { key: "panel.group.schedules", english: "Schedules", turkish: "Çizelgeler" },
  { key: "panel.group.sheets", english: "Sheets", turkish: "Paftalar" },
] as const;

/** The status bar's captions: the connection chip and the group/phase strip (§8). */
const STATUS_CAPTIONS: readonly Caption[] = [
  { key: "status.live", english: "Connected. All changes saved", turkish: "Bağlandı. Tüm değişiklikler kaydedildi" },
  { key: "status.readOnly", english: "View only — live editing not connected", turkish: "Yalnızca görüntüleme — canlı düzenleme bağlı değil" },
  { key: "status.readOnlyNotSetUp", english: "View only — live editing isn't set up yet", turkish: "Yalnızca görüntüleme — canlı düzenleme henüz kurulmadı" },
  { key: "status.noAccess", english: "No access to edit this model", turkish: "Bu modeli düzenleme yetkiniz yok" },
  { key: "status.reconnecting", english: "Reconnecting…", turkish: "Yeniden bağlanıyor…" },
  { key: "status.reconnectingKept", english: "Reconnecting… {{edits}} kept on this computer", turkish: "Yeniden bağlanıyor… {{edits}} bu bilgisayarda tutuluyor" },
  { key: "status.offline", english: "Offline: changes kept on this computer", turkish: "Çevrimdışı: değişiklikler bu bilgisayarda tutuluyor" },
  { key: "status.offlineEdits", english: "Offline: {{edits}} kept on this computer", turkish: "Çevrimdışı: {{edits}} bu bilgisayarda tutuluyor" },
  { key: "status.checking", english: "Checking the connection…", turkish: "Bağlantı kontrol ediliyor…" },
  { key: "status.notConnected", english: "Not connected", turkish: "Bağlantı kurulamadı" },
  { key: "status.notSavedRetrying", english: "Not saved yet — retrying", turkish: "Kaydedilmedi — yeniden deniyor" },
  { key: "status.notSavedRetryingCount", english: "Not saved yet ({{n}}) — retrying", turkish: "Kaydedilmedi ({{n}}) — yeniden deniyor" },
  { key: "status.saving", english: "Saving…", turkish: "Kaydediliyor…" },
  { key: "status.catchingUp", english: "Catching up with others' changes…", turkish: "Başkalarının değişiklikleri alınıyor…" },
  { key: "status.connecting", english: "Connecting…", turkish: "Bağlanıyor…" },
  { key: "status.editOne", english: "1 edit", turkish: "1 düzenleme" },
  { key: "status.editsMany", english: "{{n}} edits", turkish: "{{n}} düzenleme" },
  { key: "status.chipAria", english: "Live editing: {{label}}. Show details", turkish: "Canlı düzenleme: {{label}}. Ayrıntıları göster" },
  { key: "status.tryNow", english: "Try now", turkish: "Şimdi dene" },
  { key: "status.detailDegraded", english: "The model server is up but can’t save right now. Your edits are kept and sent again.", turkish: "Model sunucusu çalışıyor ama şu anda kaydedemiyor. Düzenlemeleriniz tutuluyor ve yeniden gönderilecek." },
  { key: "status.detailPending", english: "Your latest edit is on its way to the model server.", turkish: "Son düzenlemeniz model sunucusuna gidiyor." },
  { key: "status.detailLive", english: "The model server has every edit you made. Others see them live.", turkish: "Yaptığınız her düzenleme model sunucusunda; başkaları canlı görüyor." },
  { key: "status.detailConnecting", english: "Opening the live connection to the model server.", turkish: "Model sunucusuna canlı bağlantı açılıyor." },
  { key: "status.newWorkGoesIn", english: "New work goes in", turkish: "Yeni iş şu gruba girer:" },
  { key: "status.builtIn", english: "built in", turkish: "şu fazda inşa edilir:" },
  { key: "status.activeGroupAndPhase", english: "Active group and phase", turkish: "Etkin grup ve faz" },
  { key: "status.activeGroup", english: "Active group", turkish: "Etkin grup" },
  { key: "status.activePhase", english: "Active phase", turkish: "Etkin faz" },
  { key: "status.locked", english: "(locked)", turkish: "(kilitli)" },
  { key: "status.groupTooltip", english: "New ducts, pipes and parts go in this group. Edit groups in {{path}}.", turkish: "Yeni kanallar, borular ve parçalar bu gruba girer. Grupları {{path}} bölümünden düzenleyin." },
  { key: "status.phaseTooltip", english: "New elements are created in this phase; Demolish removes them in it.", turkish: "Yeni elemanlar bu fazda oluşturulur; Yıkım onları bu fazda kaldırır." },
] as const;

/** A placeholder's value per language: an inserted name is a word of that language. */
type Values = Readonly<Record<string, string | number>>;

/**
 * What each call site passes for its `{{placeholders}}`, per language.
 *
 * Per language because an inserted word is a word: the pane's close label reads
 * `Close checklist (Esc)` in English (the pane's name lower-cased in a sentence)
 * and `Kontrol listesi penceresini kapat (Esc)` in Turkish, and the rail's verbs
 * take `Properties` / `Özellikler`.
 */
const VALUES: Readonly<Record<string, { readonly tr?: Values; readonly en?: Values }>> = {
  "panel.showIn": { tr: { view: "Level 1" }, en: { view: "Level 1" } },
  "panel.closePane": { tr: { name: "Kontrol listesi" }, en: { name: "checklist" } },
  "panel.revisionsOnSheet": { tr: { number: "A-101" }, en: { number: "A-101" } },
  "panel.showRail": { tr: { name: "Özellikler" }, en: { name: "Properties" } },
  "panel.collapseRail": { tr: { name: "Özellikler" }, en: { name: "Properties" } },
  "panel.collapseRailToStrip": { tr: { name: "Özellikler" }, en: { name: "Properties" } },
  "panel.resizeRail": { tr: { name: "Özellikler" }, en: { name: "Properties" } },
  "panel.panelViewNamed": { tr: { name: "L1" }, en: { name: "L1" } },
  "status.reconnectingKept": { tr: { edits: "3 düzenleme" }, en: { edits: "3 edits" } },
  "status.offlineEdits": { tr: { edits: "3 düzenleme" }, en: { edits: "3 edits" } },
  "status.notSavedRetryingCount": { tr: { n: 2 }, en: { n: 2 } },
  "status.editsMany": { tr: { n: 3 }, en: { n: 3 } },
  "status.chipAria": { tr: { label: "Bağlandı. Tüm değişiklikler kaydedildi" }, en: { label: "Connected. All changes saved" } },
  // The path the app passes is `MANAGE_PATH` in `organization/labels.ts` — a fixed
  // English breadcrumb, the same string in both languages until Stage 4 keys it.
  "status.groupTooltip": { tr: { path: "Manage › Groups & phases" }, en: { path: "Manage › Groups & phases" } },
};

const TR: Translate = translateFor("tr");
const EN: Translate = translateFor("en");

// ---------------------------------------------------------------------------
// The source, read the way `npm run i18n:review` reads it
// ---------------------------------------------------------------------------

/**
 * How many call sites each shared caption has today.
 *
 * A key is often written in more than one place (a region's name in its
 * `aria-label` *and* in its visible heading and its close button), so "the key is
 * still in the source" alone would stay green while one of them went back to a
 * literal. This table is that check. A new site of an existing caption means a
 * deliberate bump here — which is the point: the number must not fall silently.
 */
const SITES: Readonly<Record<string, number>> = {
  "panel.addOns": 2,
  "panel.changeOrders": 2,
  "panel.copies": 2,
  "panel.linkedModels": 3,
  "panel.notPlacedYet": 2,
  "panel.properties": 2,
  "panel.questions": 4,
  "panel.show": 3,
  "panel.showRail": 2,
  "panel.spaces": 4,
  "panel.submittals": 3,
  "panel.titleBlocks": 2,
  "panel.versions": 2,
  "panel.viewsAndSheets": 3,
  "status.reconnecting": 2,
  // The group picker marks a locked group the same way the status bar's strip does.
  "status.locked": 2,
  // The status bar's "Try now" is also the paused tool notice's button.
  "status.tryNow": 2,
};

/** `"{{n}} edits"` with `{ n: 3 }` → `"3 edits"`. The panel never shows a placeholder. */
function fill(template: string, values: Values | undefined): string {
  if (values === undefined) return template;
  return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));
}

/**
 * The guard that actually bites: the caption must still be a `t('<key>', …)`
 * call in the component, with the English it has today. A component that reverts
 * to `title="Properties"` fails here even though `tr/editor.json` still has the
 * key — which is exactly the hole the first version of this file had.
 */
test("every panel and status caption is still keyed in the source, with its English", () => {
  const source = editorSourceCaptions();
  for (const caption of [...PANEL_CAPTIONS, ...STATUS_CAPTIONS]) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const caption of [...PANEL_CAPTIONS, ...STATUS_CAPTIONS]) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

test("no panel or status caption in the source is missing from this file", () => {
  const listed = new Set([...PANEL_CAPTIONS, ...STATUS_CAPTIONS].map((c) => c.key));
  const inSource = [...editorSourceCaptions().keys()].filter((key) => key.startsWith("panel.") || key.startsWith("status."));
  expect(inSource.filter((key) => !listed.has(key))).toEqual([]);
});

test("no dock panel or status bar caption stays English in tr", () => {
  for (const caption of [...PANEL_CAPTIONS, ...STATUS_CAPTIONS]) {
    const values = VALUES[caption.key];
    const turkish = TR(caption.key, caption.english, { ...values?.tr, ns: "editor" });
    const english = EN(caption.key, caption.english, { ...values?.en, ns: "editor" });
    // Filled the way a call site fills it: a `{{placeholder}}` left as a word shows here too.
    expect({ key: caption.key, text: turkish }).toEqual({ key: caption.key, text: fill(caption.turkish, values?.tr) });
    expect({ key: caption.key, text: english }).toEqual({ key: caption.key, text: fill(caption.english, values?.en) });
    expect(turkish).not.toBe(english);
  }
});

// ---------------------------------------------------------------------------
// Rendered panels
// ---------------------------------------------------------------------------

const PANEL_PROPS = {
  model: null,
  canEdit: false,
  blockedReason: "You don't have permission to edit this model.",
  open: { kind: "model", mode: "3d" } as const,
  onOpen: NOOP,
  onRequest: NOOP,
  userId: "person-1",
};

test("dock panel titles are Turkish when language is tr", () => {
  render(
    <Wrap language="tr">
      <TooltipProvider>
        <ViewsSheetsPanel {...PANEL_PROPS} />
      </TooltipProvider>
    </Wrap>,
  );
  expect(screen.getByRole("heading", { name: "Görünümler ve paftalar" })).toBeTruthy();
  expect(screen.getByLabelText("Görünümler ve paftalar")).toBeTruthy();
  // The list's own group headings: `Schedules` is the word the brief names.
  const groups = viewGroups(translateFor("tr")).map((g) => g.title);
  expect(groups).toContain("Çizelgeler");
  expect(groups).not.toContain("Schedules");
  expect(screen.queryByText("Views and sheets")).toBeNull();
});

test("dock panel titles are unchanged in English", () => {
  render(
    <Wrap language="en">
      <TooltipProvider>
        <ViewsSheetsPanel {...PANEL_PROPS} />
      </TooltipProvider>
    </Wrap>,
  );
  expect(screen.getByRole("heading", { name: "Views and sheets" })).toBeTruthy();
  expect(viewGroups(translateFor("en")).map((g) => g.title)).toEqual(["Floor plans", "Ceiling plans", "Sections", "3D views", "Detail views", "Schedules"]);
});

/**
 * The rail's own verbs around a translated title.
 *
 * `ResizableSideRail` is handed the Properties panel's *translated* title, so a
 * bare `` `Collapse ${title}` `` reads "Collapse Özellikler" — half a sentence in
 * each language, on the button, its tooltip, the collapsed strip and the resize
 * handle. This is the render that catches it.
 */
function Rail({ language }: { readonly language: "tr" | "en" }) {
  return (
    <Wrap language={language}>
      <TooltipProvider>
        <ResizableSideRail side="right" surface="properties" title={language === "tr" ? "Özellikler" : "Properties"} defaultWidthPx={320}>
          <span>body</span>
        </ResizableSideRail>
      </TooltipProvider>
    </Wrap>
  );
}

test("the Properties rail says its verbs in the same language as its title (tr)", () => {
  const { container } = render(<Rail language="tr" />);
  expect(screen.getByLabelText("Özellikler panelini daralt")).toBeTruthy();
  expect(screen.getByLabelText("Özellikler panelini yeniden boyutlandır")).toBeTruthy();
  // No English verb left glued to the Turkish name.
  expect(container.textContent).not.toMatch(/Collapse|Show|Resize/u);
});

test("the Properties rail is unchanged in English", () => {
  const { container } = render(<Rail language="en" />);
  expect(screen.getByLabelText("Collapse Properties")).toBeTruthy();
  expect(screen.getByLabelText("Resize Properties")).toBeTruthy();
  expect(container.textContent).not.toMatch(/daralt|boyutlandır/u);
});

/**
 * The panel view's own region name, in its *live* branch — the one behind a real
 * panel. The empty/error branch ("That panel is gone") was keyed from the start;
 * this one needed a model with a panelboard in it, which is why the reference
 * building is borrowed from the electrical pack's fixtures.
 */
function panelView(language: "tr" | "en") {
  const building = referenceDistribution();
  const nec: NecRules = {
    engine: new ElectricalLoadEngine(CONNECTED_LOAD_ONLY),
    necEdition: null,
    label: "",
    source: "none",
    picked: null,
    edition: null,
    pick: NOOP,
    problem: null,
  };
  return (
    <Wrap language={language}>
      <TooltipProvider>
        <PanelView
          model={building.head}
          panelId="l1"
          canEdit={false}
          editBlocked={null}
          submit={() => null}
          onPanel={NOOP}
          onClose={NOOP}
          onEditCircuit={NOOP}
          onFeed={NOOP}
          report={new ElectricalLoadEngine(CONNECTED_LOAD_ONLY).report(building.head, "l1")}
          nec={nec}
        />
      </TooltipProvider>
    </Wrap>
  );
}

test("the live panel view names itself in Turkish", () => {
  render(panelView("tr"));
  expect(screen.getByLabelText("Pano görünümü: L1")).toBeTruthy();
  expect(screen.queryByLabelText("Panel view: L1")).toBeNull();
});

test("the live panel view is unchanged in English", () => {
  render(panelView("en"));
  expect(screen.getByLabelText("Panel view: L1")).toBeTruthy();
});

// ---------------------------------------------------------------------------
// The status bar
// ---------------------------------------------------------------------------

/**
 * The badge states, one per shape `statusBadge` can take. The right-hand texts
 * are what a person must see; a state missing here is a state nobody checked.
 */
const BADGE_STATES: readonly { readonly why: string; readonly label: () => string }[] = [
  { why: "live, everything saved", label: () => statusBadge("live", SAVED, null, null, TR).label },
  { why: "read-only (no live editing at all)", label: () => statusBadge("read_only", SAVED, null, null, TR).label },
  { why: "no live model yet", label: () => statusBadge("connecting", SAVED, { kind: "no_model", title: "x", message: "y", retryable: false }, null, TR).label },
  { why: "denied", label: () => statusBadge("denied", SAVED, null, null, TR).label },
  { why: "offline with edits kept", label: () => statusBadge("offline", { pending: 3, retrying: 0, message: null }, { kind: "unreachable", title: "x", message: "y", retryable: true }, null, TR).label },
  { why: "offline with nothing kept", label: () => statusBadge("offline", SAVED, null, null, TR).label },
  { why: "offline, edits kept, no reason yet", label: () => statusBadge("offline", { pending: 3, retrying: 0, message: null }, null, null, TR).label },
  { why: "this computer is offline", label: () => statusBadge("connecting", SAVED, { kind: "device_offline", title: "x", message: "y", retryable: true }, null, TR).label },
  { why: "the line has gone quiet", label: () => statusBadge("connecting", SAVED, { kind: "quiet", title: "x", message: "y", retryable: true }, null, TR).label },
  { why: "pointer edits are paused", label: () => statusBadge("live", SAVED, null, "Reconnecting to the model server", TR).label },
  { why: "degraded with no text from the server", label: () => statusBadge("degraded", SAVED, null, null, TR).label },
  { why: "edits the server refused, being retried", label: () => statusBadge("live", { pending: 0, retrying: 2, message: null }, null, null, TR).label },
  { why: "saving", label: () => statusBadge("live", { pending: 1, retrying: 0, message: null }, null, null, TR).label },
  { why: "catching up with others", label: () => statusBadge("catching_up", SAVED, null, null, TR).label },
  { why: "connecting", label: () => statusBadge("connecting", SAVED, null, null, TR).label },
];

test("status bar connection states are Turkish", () => {
  expect(statusBadge("live", SAVED, null, null, TR).label).toBe("Bağlandı. Tüm değişiklikler kaydedildi");
  const labels = BADGE_STATES.map((s) => s.label());
  for (const label of labels) expect(label).not.toBe("");
  expect(labels).toContain("Çevrimdışı: 3 düzenleme bu bilgisayarda tutuluyor");
  expect(labels).toContain("Yeniden bağlanıyor…");
  expect(labels).toContain("Kaydediliyor…");
  expect(labels).toContain("Bağlantı kontrol ediliyor…");
  expect(labels).toContain("Başkalarının değişiklikleri alınıyor…");
  // Not one of them shows a raw placeholder.
  for (const label of labels) expect(label).not.toMatch(/\{\{/u);
});

test("status bar connection states are unchanged in English", () => {
  expect(statusBadge("live", SAVED, null, null, EN).label).toBe("Connected. All changes saved");
  expect(statusBadge("offline", { pending: 2, retrying: 0, message: null }, { kind: "device_offline", title: "This computer is offline", message: "m", retryable: true }, null, EN).label).toBe("Offline: 2 edits kept on this computer");
  expect(statusBadge("live", { pending: 2, retrying: 0, message: null }, null, null, EN).label).toBe("Saving…");
  expect(statusBadge("live", { pending: 0, retrying: 1, message: null }, null, null, EN).label).toBe("Not saved yet (1) — retrying");
});

/**
 * `editsPausedMessage` is the reason Move/Place/Route are off, produced by the
 * model session and shown verbatim in the chip's popover and at the tool. It takes
 * its translator from the session (Task 3.3), so this holds the English it must
 * still say, while `i18n-operator-messages.test.ts` holds the Turkish and the
 * `{{n}}` guard. Both of its paths (`editPausedReason()` and the `refusePaused()`
 * hint) read the same function.
 */
test("the paused-edit sentence never prints a placeholder", () => {
  for (const queued of [0, 1, 2, 3, 11]) {
    for (const deviceOffline of [false, true]) {
      const words = editsPausedMessage(queued, deviceOffline, EN);
      expect({ queued, deviceOffline, words }).toEqual({ queued, deviceOffline, words: expect.not.stringMatching(/\{\{/u) });
    }
  }
  // The two shapes a person actually reads.
  expect(editsPausedMessage(3, false, EN)).toContain("Your 3 edits from before are queued and will be sent.");
  expect(editsPausedMessage(1, true, EN)).toContain("Your 1 edit from before is queued and will be sent.");
  expect(editsPausedMessage(0, true, EN)).toBe("This computer is offline. Move, Place, Route and Split are off until it's back, so nothing is drawn on an out-of-date model.");
});

/**
 * The status bar's own placeholder path with the translator it is given in the
 * app (`englishOnly` is never passed by the surface, but `Translate` types allow
 * it, and this is what a bad caller would see).
 */
test("statusBadge with the editor's English translator still fills its counts", () => {
  const label = statusBadge("offline", { pending: 7, retrying: 0, message: null }, { kind: "unreachable", title: "x", message: "y", retryable: true }, null, EN).label;
  expect(label).toBe("Offline: 7 edits kept on this computer");
  expect(label).not.toMatch(/\{\{/u);
});
