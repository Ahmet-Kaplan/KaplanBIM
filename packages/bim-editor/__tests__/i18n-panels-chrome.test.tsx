/**
 * The dock panels and the status bar, in both languages.
 *
 * Every caption this test names is `t('<key>', '<English>', { ns: 'editor' })`
 * at the place the panel draws it, with the Turkish in
 * `locales/tr/editor.json`. English is the source of truth: the call site holds
 * it, so a panel whose Turkish has not been written yet still reads correctly.
 *
 * Four things are held down here:
 *
 *   1. A real panel renders Turkish when the host gives the editor a Turkish
 *      translator (`Views and sheets`, and the view list's own group headings —
 *      the `Schedules` in the brief).
 *   2. The status bar's connection states render Turkish, one per state the
 *      badge can be in (saved, saving, offline, reconnecting, catching up,
 *      read-only, denied, degraded, retrying), not just the happy one.
 *   3. Every dock panel caption is Turkish in `tr` and unchanged in `en`,
 *      caption by caption. This is the guard that catches a title someone
 *      forgets to key: it names the whole list, so a panel that only exists
 *      behind a condition (a model that has not loaded, "not placed yet", the
 *      add-on settings card, the copies dialog) is still covered on paper even
 *      though no single render can reach it.
 *   4. What is NOT covered is written down below, so nobody reads this file as
 *      a promise the code does not make.
 *
 * Contexts this file cannot render, and why (see the task report):
 *   - The surfaces that build these panels need a live model store, a socket and
 *     the whole editor host (Building Model, the coordination pane, the schedule
 *     pane). They are covered by caption 3 and by `npm run i18n:review`, which
 *     reads the `t('…')` call sites in the source rather than a render.
 *   - A known connection problem's *title* is owned by `connectionProblem()`
 *     (Task 3.3, `operator-messages.ts`): the badge shows that title as it
 *     arrives, so it stays English until 3.3 translates that record.
 */
import { render, screen } from "@testing-library/react";
import type { SaveState } from "@permitzip/bim-sync";
import { statusBadge } from "../src/editor/operator-messages";
import { ViewsSheetsPanel, viewGroups } from "../src/editor/views-sheets/ViewsSheetsPanel";
import type { Translate } from "../src/editor/i18n/translate";
import { TooltipProvider } from "../src/ui/tooltip";
import { translateFor, Wrap } from "./helpers/editor-i18n";

const NOOP = (): void => {};

/** Edits standing. "Saved" means the server has everything; nothing is waiting. */
const SAVED: SaveState = { pending: 0, retrying: 0, message: null };

/** One Turkish string per caption the editor's panels and status bar show. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

/**
 * The dock panels' captions, as the glossary writes them (§4 "Yan/dock
 * panelleri", §8 "Durum/hata sözlüğü").
 *
 * Namespaced by hand: `useEditorTranslate()` hides its `useT('editor')` from
 * `npm run i18n:review`, so every call site names the namespace itself.
 */
const PANEL_CAPTIONS: readonly Caption[] = [
  { key: "panel.properties", english: "Properties", turkish: "Özellikler" },
  { key: "panel.viewsAndSheets", english: "Views and sheets", turkish: "Görünümler ve paftalar" },
  { key: "panel.railAria", english: "Views, sheets and model filters", turkish: "Görünümler, paftalar ve model filtreleri" },
  { key: "panel.show", english: "Show", turkish: "Göster" },
  { key: "panel.showIn", english: "Show in {{view}}", turkish: "{{view}} içinde göster" },
  { key: "panel.linkedModels", english: "Linked models", turkish: "Bağlı modeller" },
  { key: "panel.notPlacedYet", english: "Not placed yet", turkish: "Henüz yerleştirilmedi" },
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
  { key: "panel.priceBook", english: "Price book", turkish: "Fiyat kitabı" },
  { key: "panel.group.floorPlans", english: "Floor plans", turkish: "Kat planları" },
  { key: "panel.group.ceilingPlans", english: "Ceiling plans", turkish: "Tavan planları" },
  { key: "panel.group.sections", english: "Sections", turkish: "Kesitler" },
  { key: "panel.group.threeD", english: "3D views", turkish: "3B görünümler" },
  { key: "panel.group.detailViews", english: "Detail views", turkish: "Detay görünümleri" },
  { key: "panel.group.schedules", english: "Schedules", turkish: "Çizelgeler" },
  { key: "panel.group.sheets", english: "Sheets", turkish: "Paftalar" },
] as const;

/** The status bar's captions: the connection chip and the group/phase strip. */
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

/** The words with `{{placeholders}}`, filled the way a call site fills them. */
const VALUES: Readonly<Record<string, Record<string, string | number>>> = {
  "panel.showIn": { view: "Level 1" },
  "panel.closePane": { name: "Kontrol listesi" },
  "panel.revisionsOnSheet": { number: "A-101" },
  "status.reconnectingKept": { edits: "3 düzenleme" },
  "status.offlineEdits": { edits: "3 düzenleme" },
  "status.notSavedRetryingCount": { n: 2 },
  "status.editsMany": { n: 3 },
  "status.chipAria": { label: "Bağlandı. Tüm değişiklikler kaydedildi" },
  "status.groupTooltip": { path: "Yönet › Gruplar ve fazlar" },
};

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

/** `"{{n}} edits"` with `{ n: 3 }` → `"3 edits"`. The panel never shows a placeholder. */
function fill(template: string, values: Readonly<Record<string, string | number>> | undefined): string {
  if (values === undefined) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]));
}

const TR: Translate = translateFor("tr");
const EN: Translate = translateFor("en");

test("status bar connection states are Turkish", () => {
  expect(statusBadge("live", SAVED, null, null, TR).label).toBe("Bağlandı. Tüm değişiklikler kaydedildi");
  const labels = BADGE_STATES.map((s) => s.label());
  for (const label of labels) expect(label).not.toBe("");
  expect(labels).toContain("Çevrimdışı: 3 düzenleme bu bilgisayarda tutuluyor");
  expect(labels).toContain("Yeniden bağlanıyor…");
  expect(labels).toContain("Kaydediliyor…");
  expect(labels).toContain("Bağlantı kontrol ediliyor…");
  expect(labels).toContain("Başkalarının değişiklikleri alınıyor…");
});

test("status bar connection states are unchanged in English", () => {
  expect(statusBadge("live", SAVED, null, null).label).toBe("Connected. All changes saved");
  expect(statusBadge("live", SAVED, null, null, EN).label).toBe("Connected. All changes saved");
  expect(statusBadge("offline", { pending: 2, retrying: 0, message: null }, { kind: "device_offline", title: "This computer is offline", message: "m", retryable: true }, null, EN).label).toBe("Offline: 2 edits kept on this computer");
  expect(statusBadge("live", { pending: 0, retrying: 1, message: null }, null, null, EN).label).toBe("Not saved yet (1) — retrying");
});

/**
 * The language-leak guard: every caption the panels and the status bar show, in
 * both languages, in one place. A caption that falls back to its English in `tr`
 * is the bug this stage exists to catch, and a caption whose English moved is a
 * change to a screen nobody asked to change.
 */
test("no dock panel or status bar caption stays English in tr", () => {
  for (const caption of [...PANEL_CAPTIONS, ...STATUS_CAPTIONS]) {
    const values = VALUES[caption.key];
    const withNs = values === undefined ? { ns: "editor" } : { ...values, ns: "editor" };
    // Filled the way a call site fills it: `{{placeholders}}` are the strings the
    // panel puts in, so a placeholder left as a word would show here too.
    const turkish = TR(caption.key, caption.english, withNs);
    expect({ key: caption.key, text: turkish }).toEqual({ key: caption.key, text: fill(caption.turkish, values) });
    const english = EN(caption.key, caption.english, withNs);
    expect({ key: caption.key, text: english }).toEqual({ key: caption.key, text: fill(caption.english, values) });
    expect(english).not.toBe(turkish);
  }
});
