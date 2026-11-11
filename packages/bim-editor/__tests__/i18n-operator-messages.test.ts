/**
 * The operator's words, in both languages.
 *
 * Everything here is said to someone at the moment something *didn't* happen:
 * the model refused an edit (18 codes), live editing isn't connected (7 kinds of
 * connection problem), pointer edits are paused, a tool can't act until a level
 * or a part is chosen, and a panel field holds nothing yet. These are refusals,
 * so the Turkish has to say the same thing as the English — what stopped it and
 * what to do next — not a softer sentence.
 *
 * What is proven, and how:
 *
 *   1. **Both languages.** Every message is produced twice, through
 *      `translateFor('tr')` and `translateFor('en')`. The Turkish must differ
 *      from the English: a key with no Turkish in `locales/tr/editor.json` falls
 *      back to the English the call site holds, which is exactly the gap these
 *      tests exist to catch.
 *   2. **English is unchanged, to the character.** The call sites are the source
 *      of truth for English, so `editorSourceCaptions()` reads them back and the
 *      table below is compared against it. That is the golden file.
 *   3. **No `{{placeholder}}` ever reaches a screen.** Every message function is
 *      called in both languages *and* with `englishOnly` — the translator that
 *      returns its English argument verbatim, braces and all. `withValues` is what
 *      makes that safe; without it a queued-edit count printed as `{{n}}` twice
 *      in this project already.
 *   4. **The meaning survives.** Each refusal's Turkish is pinned, and the ones
 *      that name a place in the app (`Manage › Groups & phases`, a sheet) still
 *      name it.
 */
import { englishOnly } from "../src/editor/i18n/translate";
import { connectionProblem, editsPausedMessage, operatorMessage, problemForDenied, type ConnectionProblemKind } from "../src/editor/operator-messages";
import { FIRST_LEVEL, toolBlocker, type ToolReadinessInput } from "../src/editor/tool-readiness";
import { captionsUnder, editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";

const TR = translateFor("tr");
const EN = translateFor("en");

/** One string a person can read: the key, the English the call site holds, and its Turkish. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

/** `"{{n}} edits"` with `{ n: 3 }` → `"3 edits"`. */
function fill(template: string, values: Readonly<Record<string, string | number>> | undefined): string {
  if (values === undefined) return template;
  return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));
}

// ---------------------------------------------------------------------------
// The 18 refusals, one table
// ---------------------------------------------------------------------------

/** Every code the model refuses an edit with — `CommandError['code']` in `@permitzip/bim-kernel`. */
const CODES = [
  "element_not_found",
  "wrong_kind",
  "outside_host",
  "tap_spacing",
  "min_straight_length",
  "anchored_would_move",
  "unsupported_geometry",
  "profile_incompatible",
  "disconnected",
  "invalid_value",
  "already_exists",
  "in_use",
  "stale_base",
  "conflict",
  "forbidden",
  "has_dependents",
  "undo_refused",
  "locked",
] as const;

/**
 * The 18 refusals, as the glossary's §8 error vocabulary words them.
 *
 * §2.1 `piece` → *eleman*; §2.4 `sheet` → *pafta*; §4 *Groups & phases* →
 * *Gruplar ve fazlar*; §8 *kilitli*, *kullanımda*, *bağlı elemanlar var*,
 * *geri alınamadı*, *çakışma*, *reddedildi*. §0.7 a sentence addresses the
 * reader in the polite plural (*deneyin*, *kaldırın*).
 */
const REFUSALS: Readonly<Record<(typeof CODES)[number], { readonly english: string; readonly turkish: string }>> = {
  element_not_found: {
    english: "That piece was removed by someone else. The view has been refreshed.",
    turkish: "O eleman başka biri tarafından kaldırıldı. Görünümünüz güncellendi.",
  },
  wrong_kind: { english: "That piece can't be changed this way.", turkish: "O eleman bu şekilde değiştirilemez." },
  outside_host: {
    english: "The branch can't slide past the end of the trunk.",
    turkish: "Branşman, ana hatın ucunu geçecek şekilde kaydırılamaz.",
  },
  tap_spacing: {
    english: "Too close to another branch takeoff. Keep them at least a takeoff width apart.",
    turkish: "Başka bir branşman ayrımına çok yakın. Aralarında en az bir ayrım genişliği bırakın.",
  },
  min_straight_length: {
    english: "A duct run would get shorter than its minimum straight length.",
    turkish: "Bir kanal hattı en kısa düz uzunluğundan daha kısa kalır.",
  },
  anchored_would_move: {
    english: "That would move ductwork that is pinned in place.",
    turkish: "Bu, yerine sabitlenmiş kanalı hareket ettirir.",
  },
  unsupported_geometry: {
    english: "That change isn't supported for this shape of run yet.",
    turkish: "Bu hat biçimi için bu değişiklik henüz desteklenmiyor.",
  },
  profile_incompatible: {
    english: "That size doesn't fit the fittings it connects to.",
    turkish: "Bu boyut, bağlandığı bağlantı parçalarına uymuyor.",
  },
  disconnected: { english: "That would disconnect the ductwork.", turkish: "Bu, kanalın bağlantısını koparır." },
  invalid_value: { english: "Enter a positive size.", turkish: "Pozitif bir boyut girin." },
  already_exists: {
    english: "Something with that name or number already exists. Pick another.",
    turkish: "Bu adda veya numarada bir kayıt zaten var. Başka birini seçin.",
  },
  in_use: {
    english: "That's still placed on a sheet. Remove it from the sheet first.",
    turkish: "Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.",
  },
  stale_base: {
    english: "Someone else changed this at the same time. Your view has been updated; try again.",
    turkish: "Aynı anda başka biri bunu değiştirdi. Görünümünüz güncellendi; tekrar deneyin.",
  },
  conflict: {
    english: "Someone else changed this at the same time. Your view has been updated; try again.",
    turkish: "Aynı anda başka biri bunu değiştirdi. Görünümünüz güncellendi; tekrar deneyin.",
  },
  forbidden: { english: "You don't have permission to edit this model.", turkish: "Bu modeli düzenleme yetkiniz yok." },
  has_dependents: { english: "Other things depend on this. Nothing was deleted.", turkish: "Buna bağlı elemanlar var. Hiçbir şey silinmedi." },
  undo_refused: { english: "That change can't be undone now.", turkish: "Bu değişiklik artık geri alınamıyor." },
  locked: {
    english: "That is in a locked group. Unlock the group in Manage › Groups & phases first.",
    turkish: "Bu, kilitli bir grupta. Önce Yönet › Gruplar ve fazlar bölümünden grubun kilidini açın.",
  },
};

test("the model refuses an edit with 18 codes, and every one is translated", () => {
  expect(CODES).toHaveLength(18);
  expect(Object.keys(REFUSALS).sort()).toEqual([...CODES].sort());
  for (const code of CODES) {
    const turkish = operatorMessage(code, TR).trim();
    expect({ code, said: turkish !== "" }).toEqual({ code, said: true });
  }
});

test("no refusal falls back to English in tr", () => {
  for (const code of CODES) {
    const english = operatorMessage(code, EN);
    const turkish = operatorMessage(code, TR);
    expect({ code, english }).toEqual({ code, english: REFUSALS[code].english });
    expect({ code, turkish }).toEqual({ code, turkish: REFUSALS[code].turkish });
    expect(turkish).not.toBe(english);
  }
});

test("a refusal that names a place in the app names it in Turkish too", () => {
  // `Manage › Groups & phases` is the breadcrumb the message tells the reader to go to.
  expect(operatorMessage("locked", TR)).toContain("Gruplar ve fazlar");
  // The one that says nothing was lost must still say nothing was lost.
  expect(operatorMessage("has_dependents", TR)).toContain("Hiçbir şey silinmedi");
});

// ---------------------------------------------------------------------------
// Why live editing isn't connected
// ---------------------------------------------------------------------------

const KINDS: readonly ConnectionProblemKind[] = ["unreachable", "device_offline", "quiet", "signed_out", "sign_in_refused", "no_model", "no_access"];

/** One problem's two halves in both languages, as §8's status vocabulary words them. */
interface ProblemWords {
  readonly title: string;
  readonly message: string;
  readonly englishTitle: string;
  readonly englishMessage: string;
}

const PROBLEMS: Readonly<Record<ConnectionProblemKind, ProblemWords>> = {
  unreachable: {
    title: "Bağlantı kurulamıyor",
    message: "Bağlantınızı kontrol edin veya tekrar deneyin. Arka planda denemeye devam ediyor.",
    englishTitle: "Can't reach the model server",
    englishMessage: "Check your connection or try again. Still trying in the background.",
  },
  device_offline: {
    title: "Bu bilgisayar çevrimdışı",
    message: "Önceden yaptığınız düzenlemeler burada kalır ve bağlantı geri geldiğinde gönderilir. Kendiliğinden yeniden bağlanır.",
    englishTitle: "This computer is offline",
    englishMessage: "Edits you already made stay here and are sent when the connection is back. Reconnects on its own.",
  },
  quiet: {
    title: "Bağlantı kontrol ediliyor",
    message: "Model sunucusu birkaç saniyedir yanıt vermiyor. Düzenlemeleriniz bu bilgisayarda tutuluyor ve sunucu yanıt verdiğinde gönderiliyor.",
    englishTitle: "Checking the connection",
    englishMessage: "The model server hasn't answered for a few seconds. Your edits are kept on this computer and sent when it answers.",
  },
  signed_out: {
    title: "Oturumunuz kapalı",
    message: "Tekrar oturum açın, sonra yeniden deneyin.",
    englishTitle: "You're signed out",
    englishMessage: "Sign in again, then try again.",
  },
  sign_in_refused: {
    title: "Model sunucusu oturum açmanızı reddetti",
    message: "Oturumu kapatıp yeniden açın, sonra tekrar deneyin. Sürüyorsa yazılım ekibine bildirin.",
    englishTitle: "The model server refused your sign-in",
    englishMessage: "Sign out and back in, then try again. If it keeps happening, tell the software team.",
  },
  no_model: {
    title: "Bu proje için canlı düzenleme henüz kurulmadı",
    message: "Bağlı modeller burada görünmeye devam eder. Canlı düzenleme, bu projeyi düzenleyebilen biri projeyi ilk açtığında başlar.",
    englishTitle: "Live editing isn't set up for this project yet",
    englishMessage: "The linked models still show here. Live editing starts the first time someone who can edit this project opens it.",
  },
  no_access: {
    title: "Bu modeli düzenleme yetkiniz yok",
    message: "Erişim için proje yöneticisinden izin isteyin.",
    englishTitle: "No access to edit this model",
    englishMessage: "Ask a project lead to give you access.",
  },
};

/** The paused-edit sentence's own halves: §8 has no plural after a number, so Turkish keeps one form. */
const PAUSED: readonly Caption[] = [
  { key: "paused.whyOffline", english: "This computer is offline", turkish: "Bu bilgisayar çevrimdışı" },
  { key: "paused.whyReconnecting", english: "Reconnecting to the model server", turkish: "Model sunucusuna yeniden bağlanılıyor" },
  {
    key: "paused.toolsOff",
    english: "Move, Place, Route and Split are off until it's back, so nothing is drawn on an out-of-date model.",
    turkish: "Bağlantı geri gelene kadar Taşı, Yerleştir, Güzergâh çiz ve Böl kapalı; böylece güncel olmayan bir model üzerine hiçbir şey çizilmez.",
  },
  { key: "paused.keptOne", english: "Your {{edits}} from before is queued and will be sent.", turkish: "Önceki {{edits}} kuyruğa alındı ve gönderilecek." },
  { key: "paused.keptMany", english: "Your {{edits}} from before are queued and will be sent.", turkish: "Önceki {{edits}} kuyruğa alındı ve gönderilecek." },
];

test("every connection problem is Turkish, with its title", () => {
  expect(KINDS).toHaveLength(7);
  for (const kind of KINDS) {
    const turkish = connectionProblem(kind, TR);
    const english = connectionProblem(kind, EN);
    expect({ kind, title: turkish.title }).toEqual({ kind, title: PROBLEMS[kind].title });
    expect({ kind, message: turkish.message }).toEqual({ kind, message: PROBLEMS[kind].message });
    // And English one character at a time, from the same record.
    expect({ kind, title: english.title }).toEqual({ kind, title: PROBLEMS[kind].englishTitle });
    expect({ kind, message: english.message }).toEqual({ kind, message: PROBLEMS[kind].englishMessage });
  }
});

test("retryable says whether trying again can help, and it is not a language", () => {
  expect(KINDS.filter((kind) => connectionProblem(kind, TR).retryable)).toEqual(["unreachable", "device_offline", "quiet", "signed_out", "sign_in_refused"]);
});

test("the server's own reason is quoted, never translated away", () => {
  const problem = connectionProblem("no_access", TR, "the project is archived");
  expect(problem.message).toBe("Model sunucusu şunu söyledi: the project is archived");
  expect(connectionProblem("no_access", EN, "the project is archived").message).toBe("The model server said: the project is archived");
});

test("a refusal from the server becomes the right problem, in Turkish", () => {
  expect(problemForDenied("No such model", TR).kind).toBe("no_model");
  expect(problemForDenied("No such model", TR).title).toBe("Bu proje için canlı düzenleme henüz kurulmadı");
  expect(problemForDenied("Please sign in again", TR).kind).toBe("sign_in_refused");
  expect(problemForDenied("Please sign in again", TR).title).toBe("Model sunucusu oturum açmanızı reddetti");
  expect(problemForDenied("the project is archived", TR).kind).toBe("no_access");
  expect(problemForDenied("the project is archived", TR).title).toBe("Bu modeli düzenleme yetkiniz yok");
});

// ---------------------------------------------------------------------------
// Pointer edits paused
// ---------------------------------------------------------------------------

test("the paused-edit sentence is Turkish and still says what is off and what is kept", () => {
  // Offline, nothing waiting: the whole sentence.
  expect(editsPausedMessage(0, true, TR)).toBe(
    "Bu bilgisayar çevrimdışı. Bağlantı geri gelene kadar Taşı, Yerleştir, Güzergâh çiz ve Böl kapalı; böylece güncel olmayan bir model üzerine hiçbir şey çizilmez.",
  );
  // Reconnecting with edits kept: §8 has no plural after a number.
  const kept = editsPausedMessage(3, false, TR);
  expect(kept).toContain("Model sunucusuna yeniden bağlanılıyor");
  expect(kept).toContain("Önceki 3 düzenleme kuyruğa alındı ve gönderilecek");
  // One is the same shape in Turkish — no plural suffix after the number.
  expect(editsPausedMessage(1, false, TR)).toContain("Önceki 1 düzenleme kuyruğa alındı ve gönderilecek");
});

test("every half of the paused-edit sentence is Turkish, and none of it is English", () => {
  for (const caption of PAUSED) {
    const values = { edits: "3 düzenleme" };
    expect({ key: caption.key, text: TR(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values),
    });
    expect(TR(caption.key, caption.english, { ...values, ns: "editor" })).not.toBe(fill(caption.english, values));
  }
});

test("the paused-edit sentence is unchanged in English", () => {
  expect(editsPausedMessage(0, true, EN)).toBe(
    "This computer is offline. Move, Place, Route and Split are off until it's back, so nothing is drawn on an out-of-date model.",
  );
  expect(editsPausedMessage(3, false, EN)).toContain("Your 3 edits from before are queued and will be sent.");
  expect(editsPausedMessage(1, true, EN)).toContain("Your 1 edit from before is queued and will be sent.");
});

// ---------------------------------------------------------------------------
// Why a tool can't act yet
// ---------------------------------------------------------------------------

const TOOL: ToolReadinessInput = {
  tool: "place",
  canEdit: true,
  blockedReason: null,
  editPaused: null,
  levelCount: 2,
  partChosen: false,
  routeSizeProblem: null,
  routeSystemKnown: true,
};

test("the six ways a tool can refuse to act speak Turkish", () => {
  // The titles the brief names, one code at a time.
  expect(toolBlocker({ ...TOOL, canEdit: false }, TR)?.title).toBe("Burada parça yerleştirme işlemi yapılamaz");
  expect(toolBlocker({ ...TOOL, editPaused: "any reason" }, TR)?.title).toBe("Yeniden bağlanırken parça yerleştirme işlemi yapılamaz");
  expect(toolBlocker({ ...TOOL, modelToolsOff: true, sheetLabel: "A-101" }, TR)?.title).toBe("Önce bu paftada bir plan açın");
  expect(toolBlocker({ ...TOOL, levelCount: 0 }, TR)?.title).toBe("Önce bir kat ekleyin");
  expect(toolBlocker(TOOL, TR)?.title).toBe("Bir parça seçin");
  expect(toolBlocker({ ...TOOL, tool: "route", routeSizeProblem: "Width must be a number.", routeSystemKnown: false }, TR)?.title).toBe(
    "Önce boyutu düzeltin",
  );
  expect(toolBlocker({ ...TOOL, tool: "route", routeSizeProblem: null, routeSystemKnown: false }, TR)?.title).toBe("Bir sistem seçin");
});

test("a tool's refusal keeps its message, its fix and the reason it was given", () => {
  const noLevel = toolBlocker({ ...TOOL, levelCount: 0 }, TR);
  expect(noLevel?.message).toContain("Parçalar");
  expect(noLevel?.message).toContain("Bağlı modelin katları");
  expect(toolBlocker({ ...TOOL, tool: "route", levelCount: 0 }, TR)?.message).toContain("Kanallar ve borular");
  // The refusals that carry someone else's words still carry them.
  expect(toolBlocker({ ...TOOL, canEdit: false, blockedReason: "a reason from the host" }, TR)?.message).toBe("a reason from the host");
  const route = toolBlocker({ ...TOOL, tool: "route", routeSizeProblem: "Width must be a number.", routeSystemKnown: false }, TR);
  expect(route?.message).toContain("Width must be a number.");
  expect(route?.message).toContain("Soldaki boyut geçerli olana kadar çizim yapılamaz");
  // And the fixes are words too.
  expect(noLevel?.fixes.map((fix) => fix.label)).toEqual([
    `${FIRST_LEVEL.name} katını 0'-0" yüksekliğinde ekle`,
    "Kat ekle…",
  ]);
  expect(toolBlocker({ ...TOOL, editPaused: "any reason" }, TR)?.fixes.map((fix) => fix.label)).toEqual(["Şimdi dene"]);
  expect(toolBlocker({ ...TOOL, levelCount: 0, architectLevelsAvailable: true }, TR)?.fixes.map((fix) => fix.label)).toEqual([
    "Mimarın katlarını kullan",
    `${FIRST_LEVEL.name} katını 0'-0" yüksekliğinde ekle`,
    "Kat ekle…",
  ]);
});

test("a tool's refusal is unchanged in English", () => {
  expect(toolBlocker({ ...TOOL, canEdit: false }, EN)?.title).toBe("Can't place parts here");
  expect(toolBlocker({ ...TOOL, canEdit: false }, EN)?.message).toBe("Live editing isn't connected, so nothing can be added.");
  expect(toolBlocker({ ...TOOL, editPaused: "any reason" }, EN)?.title).toBe("Can't place parts while reconnecting");
  expect(toolBlocker({ ...TOOL, modelToolsOff: true }, EN)?.title).toBe("Open a plan on this sheet first");
  expect(toolBlocker({ ...TOOL, modelToolsOff: true }, EN)?.message).toContain("on this sheet");
  expect(toolBlocker({ ...TOOL, levelCount: 0 }, EN)?.title).toBe("Add a level first");
  expect(toolBlocker(TOOL, EN)?.title).toBe("Choose a part");
  expect(toolBlocker({ ...TOOL, tool: "route", routeSizeProblem: "Width must be a number.", routeSystemKnown: false }, EN)?.message).toBe(
    "Width must be a number. Clicks won't draw until the size on the left is valid.",
  );
  expect(toolBlocker({ ...TOOL, levelCount: 0 }, EN)?.fixes.map((fix) => fix.label)).toEqual([
    `Add ${FIRST_LEVEL.name} at 0'-0"`,
    "Add a level…",
  ]);
  expect(toolBlocker({ ...TOOL, editPaused: "any reason" }, EN)?.fixes.map((fix) => fix.label)).toEqual(["Try now"]);
});

// ---------------------------------------------------------------------------
// Empty states — the words a panel shows when it has nothing to show
// ---------------------------------------------------------------------------

/** §8's empty-value vocabulary, as each surface writes it. */
const EMPTY_STATES: readonly Caption[] = [
  { key: "empty.noneYet", english: "None yet", turkish: "Henüz yok" },
  { key: "empty.notSet", english: "Not set", turkish: "Ayarlanmadı" },
  { key: "empty.mixedGroups", english: "Mixed groups", turkish: "Karışık gruplar" },
  { key: "empty.mixedPhases", english: "Mixed phases", turkish: "Karışık fazlar" },
  { key: "empty.mixed", english: "Mixed", turkish: "Karışık" },
  { key: "empty.allLevels", english: "All levels", turkish: "Tüm katlar" },
  { key: "empty.notCalculated", english: "Not calculated", turkish: "Hesaplanmadı" },
  { key: "empty.noFanYet", english: "No fan yet", turkish: "Henüz fan yok" },
  {
    key: "empty.nothingYetField",
    english: "Nothing yet: type some text or insert a field.",
    turkish: "Henüz bir şey yok: biraz metin yazın veya bir alan ekleyin.",
  },
  {
    key: "empty.nothingToRead",
    english: "Nothing to read yet: draw a panel and its feeders, or pick what this block reads.",
    turkish: "Henüz okunacak bir şey yok: bir pano ve besleyicilerini çizin veya bu bloğun neyi okuyacağını seçin.",
  },
  { key: "empty.notDemolished", english: "Not demolished", turkish: "Yıkılmadı" },
  { key: "empty.notFedYet", english: "Not fed yet", turkish: "Henüz beslenmiyor" },
  { key: "empty.notOnCircuit", english: "Not on a circuit", turkish: "Devrede değil" },
  {
    key: "empty.noVoltageSet",
    english: "No voltage set: set it above before circuiting",
    turkish: "Gerilim ayarlanmadı: devreye almadan önce yukarıdan ayarlayın",
  },
  {
    key: "empty.noneLinkedYet",
    english: "None linked yet. You can model without one; Manage › Link a model brings in the architect's model when you have it.",
    turkish: "Henüz bağlı yok. Bağlı model olmadan da modelleyebilirsiniz; mimarın modelini edindiğinizde Yönet › Model bağla onu getirir.",
  },
  { key: "empty.totalsNotConnected", english: "Totals appear once the model is connected.", turkish: "Model bağlandığında toplamlar görünür." },
  { key: "empty.noChangeToSave", english: "No change to save.", turkish: "Kaydedilecek değişiklik yok." },
  { key: "empty.noChangeToPutBack", english: "No change to put back.", turkish: "Geri konacak değişiklik yok." },
  { key: "empty.pickADate", english: "Pick a date", turkish: "Tarih seçin" },
  { key: "empty.fromProject", english: "From project: {{name}}", turkish: "Projeden: {{name}}" },
  { key: "empty.fromProjectAria", english: "from the project, {{name}}", turkish: "projeden, {{name}}" },
  { key: "empty.notSetAria", english: "not set", turkish: "ayarlanmadı" },
];

/**
 * How many controls hold each empty value today.
 *
 * "Not set" is written in four separate pickers and "Mixed phases" in a
 * placeholder *and* the disabled item that explains it: a caption that went back
 * to a literal at one of them would still pass a presence check, so the count is
 * pinned. A new site means a deliberate bump here — the number must not fall
 * silently.
 */
const EMPTY_SITES: Readonly<Record<string, number>> = {
  "empty.notSet": 4,
  "empty.noneYet": 2,
  "empty.mixedGroups": 2,
  "empty.mixedPhases": 2,
  "empty.mixed": 2,
  "empty.allLevels": 2,
  "empty.notDemolished": 2,
  // The parameter field draws the project's default in its button, its picker and its placeholder.
  "empty.fromProject": 3,
};

const EMPTY_VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "empty.fromProject": { name: "L1" },
  "empty.fromProjectAria": { name: "L1" },
};

test("every empty state reads Turkish", () => {
  for (const caption of EMPTY_STATES) {
    const values = EMPTY_VALUES[caption.key];
    expect({ key: caption.key, text: TR(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values),
    });
    // Nothing falls back to the English it was written with.
    expect(TR(caption.key, caption.english, { ...values, ns: "editor" })).not.toBe(fill(caption.english, values));
  }
});

test("an empty value is still keyed at every control that holds one", () => {
  const source = editorSourceCaptions();
  for (const caption of EMPTY_STATES) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: EMPTY_SITES[caption.key] ?? 1 });
  }
});

test("every empty state is unchanged in English", () => {
  for (const caption of EMPTY_STATES) {
    const values = EMPTY_VALUES[caption.key];
    expect({ key: caption.key, text: EN(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.english, values),
    });
  }
});

// ---------------------------------------------------------------------------
// The guards: no placeholder on a screen, no caption only in the JSON
// ---------------------------------------------------------------------------

/**
 * Every message function, in every language a host can give it — including
 * `englishOnly`, which returns its English argument verbatim. A `{{n}}` that
 * survives this is a `{{n}}` a person would read.
 */
test("no message function can print a placeholder", () => {
  const translations = [TR, EN, englishOnly];
  const said: string[] = [];
  for (const translate of translations) {
    for (const code of CODES) said.push(operatorMessage(code, translate));
    for (const kind of KINDS) {
      for (const reason of [undefined, "the project is archived"]) {
        const problem = connectionProblem(kind, translate, reason);
        said.push(problem.title, problem.message);
      }
    }
    for (const reason of ["No such model", "Please sign in again", "the project is archived"]) {
      const problem = problemForDenied(reason, translate);
      said.push(problem.title, problem.message);
    }
    for (const queued of [0, 1, 2, 3, 11]) {
      for (const deviceOffline of [false, true]) said.push(editsPausedMessage(queued, deviceOffline, translate));
    }
    for (const input of [
      TOOL,
      { ...TOOL, canEdit: false },
      { ...TOOL, editPaused: "any reason" },
      { ...TOOL, modelToolsOff: true },
      { ...TOOL, modelToolsOff: true, sheetLabel: "A-101" },
      { ...TOOL, levelCount: 0 },
      { ...TOOL, levelCount: 0, architectLevelsAvailable: true },
      { ...TOOL, tool: "route", routeSizeProblem: "Width must be a number.", routeSystemKnown: false },
    ] satisfies ToolReadinessInput[]) {
      const blocker = toolBlocker(input, translate);
      if (blocker === null) continue;
      said.push(blocker.title, blocker.message, ...blocker.fixes.map((fix) => fix.label));
    }
  }
  expect(said.length).toBeGreaterThan(50);
  expect(said.filter((text) => /\{\{/u.test(text))).toEqual([]);
  expect(said.filter((text) => text.trim() === "")).toEqual([]);
});

/** Every caption in the tables above, in one list. */
function captions(): readonly Caption[] {
  const refusals = CODES.map((code) => ({ key: `operator.${code}`, english: REFUSALS[code].english, turkish: REFUSALS[code].turkish }));
  const problems: Caption[] = KINDS.flatMap((kind) => {
    const words = PROBLEMS[kind];
    return [
      { key: `connection.${kind}.title`, english: words.englishTitle, turkish: words.title },
      { key: `connection.${kind}.message`, english: words.englishMessage, turkish: words.message },
    ];
  });
  return [...refusals, ...problems, ...PAUSED, ...EMPTY_STATES];
}

/** The one connection caption no kind reaches directly: the server's own reason, quoted inside our sentence. */
const SERVER_SAID: Caption = { key: "connection.serverSaid", english: "The model server said: {{reason}}", turkish: "Model sunucusu şunu söyledi: {{reason}}" };

test("the English in these tables is the English the source says", () => {
  const source = editorSourceCaptions();
  const operatorKeys = CODES.map((code) => `operator.${code}`);
  for (const key of operatorKeys) {
    expect({ key, english: source.get(key)?.english }).not.toEqual({ key, english: undefined });
  }
  for (const caption of [...EMPTY_STATES, ...PAUSED, SERVER_SAID]) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
  // Refusals are written in one place only: the table in `operator-messages.ts`.
  for (const key of operatorKeys) expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites: 1 });
});

test("no operator, tool or empty-state caption in the source is missing from these tables", () => {
  const listed = new Set([...captions().map((caption) => caption.key), SERVER_SAID.key, ...toolCaptionKeys()]);
  const inSource = captionsUnder(editorSourceCaptions(), ["operator.", "connection.", "paused.", "tool.", "empty."]);
  expect(inSource.filter((key) => !listed.has(key))).toEqual([]);
});

/**
 * The tool readiness captions, by key only: their English and Turkish are pinned
 * through `toolBlocker` above, one whole refusal at a time, which is the shape a
 * person reads them in.
 */
function toolCaptionKeys(): readonly string[] {
  return [
    "tool.doing.place",
    "tool.doing.route",
    "tool.doing.move",
    "tool.doing.split",
    "tool.readOnlyTitle",
    "tool.readOnlyMessage",
    "tool.pausedTitle",
    "tool.noModelViewTitle",
    "tool.noModelViewMessage",
    "tool.thisSheet",
    "tool.noLevelTitle",
    "tool.noLevelMessage",
    "tool.parts",
    "tool.ductsAndPipes",
    "tool.noPartTitle",
    "tool.noPartMessage",
    "tool.routeSizeTitle",
    "tool.routeSizeMessage",
    "tool.noSystemTitle",
    "tool.noSystemMessage",
    "tool.fix.addFirstLevel",
    "tool.fix.addLevel",
    "tool.fix.useArchitectLevels",
  ];
}

test("no tool caption stays English in tr", () => {
  const source = editorSourceCaptions();
  for (const key of toolCaptionKeys()) {
    const english = source.get(key)?.english;
    expect({ key, present: english !== undefined }).toEqual({ key, present: true });
    if (english === undefined) continue;
    expect({ key, turkish: TR(key, english, { name: FIRST_LEVEL.name, doing: "parça yerleştir", what: "Parçalar", at: "0'-0\"", sheet: "bu pafta", reason: "x", ns: "editor" }) }).not.toEqual({
      key,
      turkish: english,
    });
  }
});
