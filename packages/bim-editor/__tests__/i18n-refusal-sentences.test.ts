/**
 * The kernel's own sentences, on screen, in the language being drawn.
 *
 * A refusal arrives as `CommandError`: a code *and* a free-form English sentence
 * (`packages/bim-kernel/src/command-core.ts`). Most codes are said in the editor's
 * own words (`operatorMessage`), but six are passed through verbatim because the
 * kernel's sentence carries something the generic one cannot — which group, which
 * sheet, which revision. Those six reached the screen in English.
 *
 * `refusalWords` is the composition the session now uses at every refusal point:
 *
 *   1. the kernel's sentence, if a template can say it in Turkish
 *      (`translateProse`: numbers become `{0}` slots, the template comes from
 *      `locales/tr/prose.json`, the numbers go back in order);
 *   2. otherwise the translated sentence for the code — a Turkish sentence that
 *      says less, never an English one;
 *   3. in English, the kernel's sentence unchanged, because it is the source.
 *
 * What is proven here: every one of the six "kernel word" codes comes out Turkish
 * for a realistic sentence *and* for one no template can key; the specific sentence
 * wins when it can be translated; and no raw `{0}` or `{{…}}` ever reaches a screen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { englishOnly, withValues } from "../src/editor/i18n/translate";
import { operatorMessage, refusalWords } from "../src/editor/operator-messages";
import { translateFor } from "./helpers/editor-i18n";

const REPO_ROOT = join(__dirname, "../../..");

/** The catalogue the extractor writes: every sentence each code can carry. */
interface CatalogRow {
  readonly template: string;
  readonly codes: readonly string[];
  readonly matchable: boolean;
}
const catalogue: { readonly templates: readonly CatalogRow[] } = JSON.parse(
  readFileSync(join(REPO_ROOT, "docs/i18n/prose-templates.json"), "utf8"),
) as { readonly templates: readonly CatalogRow[] };

/** Every code the model can refuse an edit with (`CommandError['code']`). */
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
 * A noun that names one particular screen, and the English the kernel would have to
 * use for that screen to be the subject. A generic sentence may name one only when
 * *every* sentence behind that code is about it.
 *
 * `locked`, backed by exactly one sentence — an element lock during a trace — used to
 * send the reader to `Manage › Groups & phases`; `in_use`, backed by nineteen
 * sentences about groups, phases, circuits and load points, sent them to a sheet.
 * Both were confidently wrong, which is worse than vague: the English they replaced
 * was accurate.
 */
const SCREEN_NOUNS: readonly (readonly [string, string])[] = [
  ["pafta", "sheet"],
  ["grup", "group"],
  ["faz", "phase"],
  ["devre", "circuit"],
  ["pano", "panel"],
  ["görünüm", "view"],
  ["ızgara", "grid"],
  ["bölge", "zone"],
  ["oda", "room"],
  ["mekan", "space"],
  ["kolon", "stack"],
  ["armatür", "fixture"],
  ["şalter", "breaker"],
  ["yük noktası", "load point"],
  ["kat", "level"],
  ["duvar", "wall"],
  ["tavan", "ceiling"],
];

/**
 * The letters *after* a stem that make a different word, so `kat` is not `kategori` and
 * `oda` is not `odak`. Nothing shipped trips these today; the list is here so a future
 * sentence does not have to be rewritten to satisfy a matcher that misread it.
 *
 * Tails, not whole words: the matcher stands right after the stem, so `kategori` would
 * never match a lookahead written as `kategori` — the text there is `egori`.
 */
const STEM_NEIGHBOURS: Readonly<Record<string, readonly string[]>> = {
  kat: ["egori", "man", "kı", "al"],
  oda: ["k"],
  faz: ["la"],
  pano: ["rama"],
};

/**
 * The causes a refusal can have, and the English each code's sentences would carry if the
 * whole code were about that cause. Used to decide whether a generic sentence may *assert*
 * a cause.
 *
 * A generic sentence is shown in place of sentences it never saw. Asserting one cause over
 * a family that has several is the defect this round found: the round-2 `in_use` sentence
 * said "still used somewhere else", which is false for a lock, a pinned sheet item and a
 * panel with no free poles. So a cause may be asserted only when **every** backing sentence
 * agrees with it; otherwise the sentence has to offer alternatives.
 */
const CAUSE_WORDS: readonly {
  readonly turkish: string;
  readonly english: readonly string[];
}[] = [
  { turkish: "kilit", english: ["lock"] },
  { turkish: "sabitlen", english: ["pin"] },
  { turkish: "dolu", english: ["full", "no free", "no room"] },
  {
    // The stem, not the noun: Turkish says `kullanımda`, `kullanıldığı`, `kullanılıyor`.
    // `kullanım` alone missed every one of those and made this rule decorative — the same
    // mistake the right-hand boundary made two rounds ago.
    turkish: "kullan",
    english: [
      "in use",
      "already used",
      "already on",
      "already stands",
      "spread over",
      "needs at least one",
      "use circuit",
      "already connects",
    ],
  },
  // The relationship `has_dependents` is *defined* by: every one of its four sentences is
  // another thing referring to this element (a pointer, a connector, a group, a pin).
  {
    turkish: "bağlı",
    english: [
      "depend",
      "attach",
      "connect",
      "pointing at",
      "filed under",
      "group",
      "pin",
    ],
  },
];

/** A disjunction: the sentence offers alternatives instead of asserting one cause. */
const DISJUNCTION_TR = /ya da|veya|yahut/iu;
const DISJUNCTION_EN = /\bor\b|either/iu;

/**
 * True when `text` names `word`.
 *
 * **Left boundary only, on purpose.** Turkish builds a word from a stem plus suffixes
 * on the *right*: `pafta` → `paftada`/`paftadan`, `grup` → `grupta`, `görünüm` →
 * `görünümü`, `faz` → `fazlar`. A right-hand boundary made this guard blind to exactly
 * the strings it exists to catch — it reported the old `in_use` sentence (“… bir
 * paftada kullanımda …”) as naming no sheet at all, so the two defects the review found
 * stayed invisible and only the English half of each self-test fired.
 *
 * The cost is over-reach in the other direction (`kat` also matches `kategori`), which
 * is the direction a guard should err: a false alarm is a sentence to rewrite, a missed
 * one is a wrong sentence on screen.
 */
function namesWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  // Longest-first over the neighbours the stems collide with, so a shorter neighbour never
  // hides a longer one.
  const neighbours = (
    (STEM_NEIGHBOURS as Readonly<Record<string, readonly string[]>>)[word] ?? []
  )
    .slice()
    .sort((left, right) => right.length - left.length)
    // Each tail is a word of its own, so it takes the plural and then a right boundary:
    // `fazla`/`fazlalar` are excluded, `fazlar` — the plural the guard exists for — is not;
    // `odak`+`lar` and `panorama`+`lar` are covered too. (`kat`'s old `ı` tail silently
    // dropped `katı`; it is gone, and a bare `katı` is over-reach the other way.)
    .map(
      (tail) =>
        `${tail.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:lar|ler)?(?![\\p{L}])`,
    )
    .join("|");
  const notANeighbour = neighbours === "" ? "" : `(?!${neighbours})`;
  return new RegExp(
    String.raw`(?<![\p{L}])${escaped}${notANeighbour}`,
    "iu",
  ).test(text);
}

const TR = translateFor("tr");
const EN = translateFor("en");

/**
 * One realistic sentence per code the session shows verbatim, as the kernel composes
 * it: a name and a count in the middle of the English.
 */
const KERNEL_WORD_SENTENCES = {
  has_dependents:
    '2 elements are in "Level 1". Choose a group to move them to, then delete.',
  undo_refused:
    "You can only undo your own changes; Ada Lovelace made revision 12",
  conflict:
    "Level 1 changed since your edit; undoing would overwrite that work.",
  already_exists: '"Level 1" already exists; choose a new id',
  in_use: '"Level 1" is locked. Unlock it before deleting it.',
  locked:
    "This element is locked so it can't slide while you trace. Unlock it first",
} as const;

test("the six codes the session shows verbatim come out Turkish", () => {
  const english = Object.entries(KERNEL_WORD_SENTENCES).filter(
    ([code, message]) =>
      refusalWords(
        code as keyof typeof KERNEL_WORD_SENTENCES,
        message,
        "tr",
        TR,
      ) === message,
  );
  expect(english).toEqual([]);
});

test("a sentence a template can key is preferred to the generic one", () => {
  // `Revision {0} is not in the recent history…` is in the map: the person gets the
  // kernel's meaning *and* the revision number, not the shorter generic sentence.
  const shown = refusalWords(
    "undo_refused",
    "Revision 12 is not in the recent history, so it can't be undone here",
    "tr",
    TR,
  );
  expect(shown).toBe(
    "Revizyon 12 son geçmişte yok, bu yüzden burada geri alınamaz",
  );
  expect(shown).not.toBe(
    refusalWords("undo_refused", "an older kernel sentence", "tr", TR),
  );
});

test("a sentence no template can key falls back to the translated code, never to English", () => {
  const shown = refusalWords(
    "has_dependents",
    '2 elements are in "Level 1". Choose a group to move them to, then delete.',
    "tr",
    TR,
  );
  // The generic sentence says less — and says it in Turkish, which is the point.
  expect(shown).toContain("Buna bağlı başka şeyler var");
  expect(shown).not.toContain("elements");
});

test("English is answered with the kernel's own sentence, unchanged", () => {
  const message =
    "Revision 12 is not in the recent history, so it can't be undone here";
  expect(refusalWords("undo_refused", message, "en", EN)).toBe(message);
});

test("no raw slot or placeholder reaches the screen", () => {
  const leaked = Object.entries(KERNEL_WORD_SENTENCES)
    .map(([code, message]) =>
      refusalWords(
        code as keyof typeof KERNEL_WORD_SENTENCES,
        message,
        "tr",
        TR,
      ),
    )
    .filter((shown) => /\{\{|\}\}|\{\d+\}/u.test(shown));
  expect(leaked).toEqual([]);
});

// ---------------------------------------------------------------------------
// The same defect, one layer up: the editor's own "not connected" prose
// ---------------------------------------------------------------------------

/**
 * `isn't connected`, in every form it reaches the source.
 *
 * `isn.t connected` looked like it covered them and covered none but the ASCII one:
 * `.` is *one* character and `isn&apos;t` has six between `isn` and `t`. The review
 * measured it false on the exact JSX form a revert would produce, so the whole guard
 * was decorative. Each apostrophe is spelled out and a self-test below proves it.
 */
const NOT_CONNECTED = /isn(?:'|&#39;|&apos;|\u2019)t\s+connected/iu;

/**
 * Sentences in `files` (`id` → source) that say "isn't connected" without being inside a
 * `t('session.…', '…')` call. Split out of its test so the guard can be proven to fire.
 */
function bareConnectedSentences(
  files: Readonly<Record<string, string>>,
): string[] {
  const bare: string[] = [];
  for (const [id, text] of Object.entries(files)) {
    for (const line of text.split("\n")) {
      const found = NOT_CONNECTED.exec(line);
      if (found === null) continue;
      // A comment explaining the family is not a sentence on a screen.
      if (/^\s*(?:\*|\/\*|\/\/)/u.test(line)) continue;
      // The key has to be on the same line, before the sentence: `t('session.…', "…"`
      // with any options after it (on this line or the next).
      if (
        /t\(\s*'session\.[A-Za-z]+',\s*"[^"]*$/u.test(
          line.slice(0, found.index),
        )
      )
        continue;
      bare.push(`${id}: ${line.trim()}`);
    }
  }
  return bare;
}

const OWNED_FILES = [
  "packages/bim-editor/src/editor/model-session.ts",
  "packages/bim-editor/src/editor/BuildingModelSurface.tsx",
];

/** The two files' sources, read once. */
function ownedSources(): Record<string, string> {
  return Object.fromEntries(
    OWNED_FILES.map((id) => [id, readFileSync(join(REPO_ROOT, id), "utf8")]),
  );
}

test("the session and the surface say why editing is off in a translated sentence", () => {
  // These call sites hand a sentence back to a panel when there is no live session.
  // Written as a bare English literal they reached a Turkish screen as English — the
  // same complaint this file exists for, one layer above the kernel. Every one of
  // them is a `t('session.…', '…', { ns: 'editor' })` now, and this keeps it that way.
  expect(bareConnectedSentences(ownedSources())).toEqual([]);
});

test("the isn't-connected guard sees every apostrophe the source can carry", () => {
  const forms = [
    "Live editing isn't connected",
    "Live editing isn&apos;t connected",
    "Live editing isn&#39;t connected",
    "Live editing isn\u2019t connected",
  ];
  expect(forms.filter((form) => !NOT_CONNECTED.test(form))).toEqual([]);
  expect(NOT_CONNECTED.test("Live editing is connected")).toBe(false);
  expect(NOT_CONNECTED.test("Live editing is not connected")).toBe(false);
});

test("the isn't-connected guard fires on a bare JSX sentence and passes the keyed one", () => {
  // The exact shape of a revert of the read-only alert: JSX text, `&apos;`, no `t()`.
  expect(
    bareConnectedSentences({
      "surface.tsx":
        "                <AlertDescription>Live editing isn&apos;t connected for this project yet.</AlertDescription>",
    }),
  ).toHaveLength(1);
  expect(
    bareConnectedSentences({
      "surface.tsx":
        "                <AlertDescription>{t('session.viewOnlyBody', \"Live editing isn&apos;t connected for this project yet.\", { ns: 'editor' })}</AlertDescription>",
    }),
  ).toEqual([]);
});

test("every keyed sentence in those two files has a Turkish string, and the count is pinned", () => {
  // A site added without its Turkish, or a site quietly reverted to a bare literal,
  // has to fail here rather than in review.
  const turkish = JSON.parse(
    readFileSync(
      join(REPO_ROOT, "packages/bim-editor/locales/tr/editor.json"),
      "utf8",
    ),
  ) as Record<string, Record<string, string> | string>;
  const files = [
    "packages/bim-editor/src/editor/model-session.ts",
    "packages/bim-editor/src/editor/BuildingModelSurface.tsx",
  ];
  const used = new Map<string, number>();
  for (const id of files) {
    const text = readFileSync(join(REPO_ROOT, id), "utf8");
    // `t(\n  'session.…'` is a call too: the alert's sentences wrap.
    for (const match of text.matchAll(/t\(\s*'(session\.[A-Za-z]+)'/gu)) {
      const key = match[1] ?? "";
      used.set(key, (used.get(key) ?? 0) + 1);
    }
  }
  const session = (turkish.session ?? {}) as Record<string, string>;
  const missing = [...used.keys()].filter((key) => {
    const leaf = key.slice("session.".length);
    return session[leaf] === undefined || session[leaf].trim() === "";
  });
  expect(missing).toEqual([]);
  // The pinned counts: the read-only alert (`viewOnlyTitle`, `viewOnlyBody`), the two
  // "couldn't select" toasts and the rest of the family this task keyed. Changing a
  // count means changing a call site — update it deliberately.
  expect(Object.fromEntries([...used].sort())).toEqual({
    "session.aRun": 1,
    "session.alreadyPassesClear": 1,
    "session.axisLockOffSteps": 1,
    "session.axisLockedTo": 1,
    "session.axisLockedToZNote": 1,
    "session.backWhereItWas": 1,
    "session.boxDragCount": 1,
    "session.boxNothingInside": 1,
    "session.boxSelectedInside": 1,
    "session.boxSelectedTouching": 1,
    "session.boxTouchesNothing": 1,
    "session.branchCannotLeaveSide": 1,
    "session.branchingOffFace": 1,
    "session.branchingOffSide": 1,
    "session.changeNotSaved": 1,
    "session.chooseLevelToPlace": 1,
    "session.chooseLevelToPlaceIt": 1,
    "session.chooseLevelToRoute": 3,
    "session.chooseWhatToRoute": 4,
    "session.chooseWhatToRouteInPanel": 1,
    "session.clickNextOrEnter": 1,
    "session.clickNextPoint": 3,
    "session.clickOneMorePoint": 1,
    "session.clickSecondPoint": 1,
    "session.clickWhereRouteStarts": 1,
    "session.connectOtherWayFailed": 1,
    "session.connectWorkedOut": 1,
    "session.continuingFrom": 1,
    "session.crossingsUnchecked": 1,
    "session.down": 1,
    "session.downWord": 1,
    "session.dragAlong": 1,
    "session.dragCancelled": 1,
    "session.dragElbowFlipped": 1,
    "session.dragGroupTogether": 1,
    "session.dragInProgress": 1,
    "session.dragStopped": 1,
    "session.dragToMove": 1,
    "session.dragToNextPoint": 1,
    "session.dragWholeGroup": 1,
    "session.drawTowardsObstacle": 1,
    "session.drawingFrom": 1,
    "session.droppingLeg": 1,
    "session.east": 1,
    "session.editWasNotSaved": 1,
    "session.editsCount": 1,
    "session.editsWereNotSaved": 1,
    "session.elbowChanged": 1,
    "session.existingMep": 1,
    "session.faceBottom": 1,
    "session.faceTop": 1,
    "session.finishOnRoute": 1,
    "session.fittingCountMany": 1,
    "session.fittingCountOne": 1,
    "session.flipLetGo": 1,
    "session.flipRefused": 1,
    "session.geometryEngineFailed": 1,
    "session.groupOne": 1,
    "session.groupWhole": 1,
    "session.heightAt": 1,
    "session.holdShiftUpDown": 2,
    "session.inheritCancelled": 1,
    "session.inheritHint": 1,
    "session.inheritTakes": 1,
    "session.joinEndToEndWith": 1,
    "session.joinedEndToEndWith": 1,
    "session.joinedLegToFace": 1,
    "session.labelAway": 1,
    "session.labelNewBranch": 1,
    "session.lastChange": 1,
    "session.lengthMustBePositive": 1,
    "session.lengthNow": 1,
    "session.levelNotAdded": 1,
    "session.linkedModel": 2,
    "session.loadingReference": 1,
    "session.lowAngleUpDown": 1,
    "session.measureAnswer": 1,
    "session.modelNotLoaded": 1,
    "session.modelNotLoadedYet": 1,
    "session.modelNotOpen": 3,
    "session.modelStillOpening": 1,
    "session.movePreview": 1,
    "session.noAirflowYet": 1,
    "session.noFreeConnector": 1,
    "session.noGlobalId": 1,
    "session.noRoomForRise": 1,
    "session.north": 1,
    "session.notConnected": 7,
    "session.notConnectedDeleted": 1,
    "session.notConnectedDuct": 1,
    "session.notConnectedLevel": 1,
    "session.notConnectedMoved": 2,
    "session.notConnectedNudged": 1,
    "session.notConnectedResized": 1,
    "session.notConnectedRouted": 1,
    "session.notConnectedSaved": 5,
    "session.notConnectedSplit": 1,
    "session.notConnectedUndone": 1,
    "session.nothingMovesOnItsOwn": 1,
    "session.nothingPicked": 1,
    "session.nothingToFinish": 1,
    "session.nothingToInherit": 1,
    "session.nothingToRedo": 1,
    "session.nothingToUndo": 2,
    "session.nothingUnderPointer": 1,
    "session.nudgeDirection": 1,
    "session.nudged": 1,
    "session.obstacleSizeUnknown": 1,
    "session.offsetDoesNotFit": 1,
    "session.offsetRises": 1,
    "session.offsetsLevelLegOnly": 1,
    "session.offsetsOnPlanLegs": 1,
    "session.onMountingPlane": 1,
    "session.oneEdit": 1,
    "session.onePart": 1,
    "session.oneStraightPiece": 1,
    "session.partAlreadyPlaced": 1,
    "session.partConnector": 2,
    "session.partHasNoType": 1,
    "session.partNoLongerInModel": 1,
    "session.partTypeNotLoaded": 1,
    "session.partsCouldNotBePlaced": 1,
    "session.partsCount": 1,
    "session.pickedNotInTheWay": 1,
    "session.placeHint": 1,
    "session.pointAtFloorRoof": 1,
    "session.pointAtSomethingToStart": 1,
    "session.referencesUnavailable": 1,
    "session.reloadedAtRevision": 1,
    "session.reloadedDroppedEdits": 1,
    "session.remoteSavedRevision": 1,
    "session.revitLoadFailed": 1,
    "session.riseAtThisPoint": 1,
    "session.riserKeys": 1,
    "session.risingLeg": 1,
    "session.routeAddPoint": 1,
    "session.routeAxisKeys": 1,
    "session.routeCheck": 1,
    "session.routeCheckMore": 1,
    "session.routeClickOpenEndSideOrPoint": 1,
    "session.routeClickToStart": 1,
    "session.routeDrops": 1,
    "session.routeHeightNeedsPoint": 1,
    "session.routePlaneLockedBadge": 1,
    "session.routeReadout": 1,
    "session.routeReadoutTail": 1,
    "session.routeRises": 1,
    "session.routeStartHere": 1,
    "session.routeStartOn": 1,
    "session.routeSummaryAt": 1,
    "session.routeUnchecked": 1,
    "session.routeWithCrossings": 1,
    "session.routed": 1,
    "session.routedAndConnectedTo": 1,
    "session.runChanged": 3,
    "session.savePartTypes": 1,
    "session.selectFailed": 1,
    "session.selectHint": 1,
    "session.selectSomethingFirst": 1,
    "session.shiftKey": 1,
    "session.sizesTableNotSaved": 1,
    "session.south": 1,
    "session.splitClickOnPiece": 1,
    "session.splitClickToSplit": 1,
    "session.splitDone": 1,
    "session.splitPointAtPiece": 1,
    "session.standingOn": 1,
    "session.startOnContinueHere": 1,
    "session.startRouteFirst": 1,
    "session.startedHere": 1,
    "session.startedOn": 2,
    "session.startedOnPressOrDrag": 1,
    "session.startingThreeDView": 1,
    "session.straightPieces": 1,
    "session.switchWaitsForSave": 1,
    "session.tabWholeRun": 1,
    "session.tapHeightDrops": 1,
    "session.tapHeightRises": 1,
    "session.tapOffBranchHere": 1,
    "session.tapRefused": 1,
    "session.tapRelease": 1,
    "session.thatEndConnected": 1,
    "session.thatPart": 1,
    "session.theLevel": 1,
    "session.theOpenEndOf": 3,
    "session.theSelection": 2,
    "session.theSlab": 1,
    "session.thisApp": 1,
    "session.tooManyToMove": 1,
    "session.transitionAdded": 1,
    "session.typedLengthsNeedOpenEnd": 1,
    "session.unavailableNextHint": 1,
    "session.unavailableNextPlain": 1,
    "session.undid": 1,
    "session.undoAddLevel": 1,
    "session.undoBranchSlide": 1,
    "session.undoChange": 1,
    "session.undoCopy": 1,
    "session.undoDelete": 1,
    "session.undoEdits": 1,
    "session.undoElement": 1,
    "session.undoItems": 1,
    "session.undoJoinEndToEnd": 1,
    "session.undoLevelChange": 1,
    "session.undoLevelsFromLinked": 1,
    "session.undoLinkedLevelCleared": 1,
    "session.undoLinkedLevelSet": 1,
    "session.undoMove": 1,
    "session.undoPlace": 1,
    "session.undoRenameLevel": 1,
    "session.undoResizePieces": 1,
    "session.undoRotate": 1,
    "session.undoTypeChange": 1,
    "session.undoWouldOverwrite": 1,
    "session.unplacedLoadFailed": 1,
    "session.up": 1,
    "session.upWord": 1,
    "session.viewOnlyBody": 1,
    "session.viewOnlyTitle": 1,
    "session.wayAlong": 1,
    "session.wayAtEnd": 1,
    "session.wayCorner": 1,
    "session.wayDown": 1,
    "session.waySquare": 1,
    "session.wayUp": 1,
    "session.west": 1,
    "session.whatFarEnd": 1,
    "session.whatNearEnd": 1,
    "session.whatThe": 2,
    "session.whereFloorPlane": 1,
    "session.wherePlaneLocked": 1,
    "session.wordOfLabelNewBranch": 1,
    "session.workPlaneLocked": 1,
    "session.workPlaneUnlocked": 1,
  });
});

// ---------------------------------------------------------------------------
// The generic sentence has to be true for every sentence it stands in for
// ---------------------------------------------------------------------------

/**
 * Everything wrong with one code's generic sentence, given the sentences it stands in
 * for. Split out of its test so the guard can be proven to fire (below): a guard that
 * never fires is worse than none.
 */
function genericSentenceDefects(
  code: string,
  generic: string,
  genericEnglish: string,
  backing: readonly { readonly template: string }[],
): string[] {
  const defects: string[] = [];

  // A cause may be asserted only when every backing sentence agrees with it; otherwise the
  // sentence has to present alternatives. This is the rule the round-2 `in_use` sentence
  // broke, and the one `SCREEN_NOUNS` alone could not see.
  const alternativesOffered =
    DISJUNCTION_TR.test(generic) || DISJUNCTION_EN.test(genericEnglish);
  for (const cause of CAUSE_WORDS) {
    const named =
      namesWord(generic, cause.turkish) ||
      cause.english.some((signal) => namesWord(genericEnglish, signal));
    if (!named) continue;
    const everySentenceAgrees =
      backing.length > 0 &&
      backing.every((row) =>
        cause.english.some((signal) => namesWord(row.template, signal)),
      );
    if (everySentenceAgrees || alternativesOffered) continue;
    const howMany = backing.filter((row) =>
      cause.english.some((signal) => namesWord(row.template, signal)),
    ).length;
    defects.push(
      `${code}: "${generic}" asserts the cause "${cause.turkish}" but only ${howMany} of ${backing.length} of its sentences are about it, and it offers no alternative ("ya da"/"or")`,
    );
  }

  for (const [turkish, english] of SCREEN_NOUNS) {
    const said =
      namesWord(generic, turkish) || namesWord(genericEnglish, english);
    if (!said) continue;
    // "Every sentence agrees" means: there is at least one, and all of them name it.
    const everySentenceSaysIt =
      backing.length > 0 &&
      backing.every((row) => namesWord(row.template, english));
    if (everySentenceSaysIt) continue;
    const howMany = backing.filter((row) =>
      namesWord(row.template, english),
    ).length;
    defects.push(
      `${code}: "${generic}" names "${turkish}" but only ${howMany} of ${backing.length} of its sentences mention "${english}"`,
    );
  }
  return defects;
}

test("no generic refusal names a screen that only some of its sentences are about", () => {
  const defects = CODES.flatMap((code) =>
    genericSentenceDefects(
      code,
      operatorMessage(code, TR),
      operatorMessage(code, EN),
      catalogue.templates.filter((row) => row.codes.includes(code)),
    ),
  );
  expect(defects).toEqual([]);
});

test("the cause-neutrality guard sees Turkish suffixes, so it can fire at all", () => {
  // Turkish attaches suffixes on the right. A boundary-strict matcher reported the old
  // `in_use` sentence as naming no sheet, which is why two rounds of review found this
  // and the guard did not.
  expect(
    namesWord(
      "Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.",
      "pafta",
    ),
  ).toBe(true);
  expect(
    namesWord(
      '"Level 1" is locked, so new elements can\'t go in it.',
      "grupta",
    ),
  ).toBe(false);
  expect(namesWord("Kilitli bir grupta. Gruplar ve fazlar.", "grup")).toBe(
    true,
  );
  expect(namesWord("Görünümünüz güncellendi.", "görünüm")).toBe(true);
  expect(namesWord("Karışık fazlar", "faz")).toBe(true);
  // Quiet where there is genuinely no such noun.
  expect(
    namesWord("Bu değer geçerli değil. Kontrol edip tekrar deneyin.", "pafta"),
  ).toBe(false);
  expect(namesWord("Kilitli olduğu için değiştirilemedi.", "grup")).toBe(false);
});

test("the cause rule fires on a sentence that asserts one cause over many", () => {
  const inUse = catalogue.templates.filter((row) =>
    row.codes.includes("in_use"),
  );

  // The round-2 sentence. It passed the screen-noun rule with the fixed matcher only
  // because it named no screen — and it is still wrong, because "still used somewhere
  // else" is false for a lock, for a pinned sheet item and for a full panel. This is the
  // assertion the guard was missing.
  // The *kind* is asserted, not merely "something was wrong": a future screen-noun defect on
  // the same sentence must not be able to stand in for the cause defect.
  const oldSentence =
    "Bu hâlâ başka bir yerde kullanıldığı için işlem yapılmadı. Hiçbir şey değişmedi.";
  const oldDefects = genericSentenceDefects(
    "in_use",
    oldSentence,
    "That is still used somewhere else, so nothing was changed.",
    inUse,
  );
  expect(
    oldDefects.filter((defect) => defect.includes("asserts the cause")),
  ).toHaveLength(1);
  expect(
    oldDefects.every((defect) => defect.includes("asserts the cause")),
  ).toBe(true);

  // A hypothetical single-cause sentence fails the same way, and for the same reason.
  const singleCause = genericSentenceDefects(
    "in_use",
    "Kilitli olduğu için yapılamadı.",
    "That couldn't be done because it is locked.",
    inUse,
  );
  expect(
    singleCause.filter((defect) =>
      defect.includes('asserts the cause "kilit"'),
    ),
  ).toHaveLength(1);

  // What ships offers the alternatives instead, and passes.
  expect(
    genericSentenceDefects(
      "in_use",
      operatorMessage("in_use", TR),
      operatorMessage("in_use", EN),
      inUse,
    ),
  ).toEqual([]);
});

test("the cause rule allows a cause every sentence agrees with", () => {
  // `locked` asserts a lock and may: its only sentence is about a lock. The disjunction is
  // not needed when the whole family really is one cause.
  const locked = catalogue.templates.filter((row) =>
    row.codes.includes("locked"),
  );
  expect(locked.length).toBeGreaterThan(0);
  expect(
    genericSentenceDefects(
      "locked",
      operatorMessage("locked", TR),
      operatorMessage("locked", EN),
      locked,
    ),
  ).toEqual([]);
  // The same sentence over a family with other causes is refused.
  const inUse = catalogue.templates.filter((row) =>
    row.codes.includes("in_use"),
  );
  expect(
    genericSentenceDefects(
      "in_use",
      "Kilitli olduğu için değiştirilemedi. Kilidi açıp tekrar deneyin.",
      "That is locked, so it couldn't be changed.",
      inUse,
    ).filter((defect) => defect.includes('asserts the cause "kilit"')),
  ).toHaveLength(1);
});

test("the stem matcher has an exception list, so `kat` is not `kategori`", () => {
  // The looser matcher (left boundary only) is what lets it see `paftada`; the price is that
  // a short stem can sit inside an unrelated word. Nothing shipped trips these, and the list
  // is here so a future sentence does not have to be rewritten to satisfy a misreading.
  expect(namesWord("Kategori filtresi", "kat")).toBe(false);
  expect(namesWord("Katman listesi", "kat")).toBe(false);
  expect(namesWord("Odak noktası", "oda")).toBe(false);
  expect(namesWord("Fazla değer", "faz")).toBe(false);
  expect(namesWord("Odaklar listesi", "oda")).toBe(false);
  expect(namesWord("Panorama", "pano")).toBe(false);
  expect(namesWord("Panoramalar", "pano")).toBe(false);
  expect(namesWord("Fazlar seçili", "faz")).toBe(true);
  // The real words still match.
  expect(namesWord("Kilitli bir grupta", "grup")).toBe(true);
  expect(namesWord("Üç kat seçili", "kat")).toBe(true);
});

test("the cause-neutrality guard fires on the sentence from the Turkish side alone", () => {
  // The English says nothing about a sheet; only the Turkish half named one, which is
  // exactly the half the old matcher could not see.
  expect(
    genericSentenceDefects(
      "in_use",
      "Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.",
      "That is still in use, so it can't be changed.",
      catalogue.templates.filter((row) => row.codes.includes("in_use")),
    ),
  ).not.toEqual([]);
});

test("the cause-neutrality guard fires on the two sentences the review found", () => {
  const backing = (code: string): readonly { template: string }[] =>
    catalogue.templates.filter((row) => row.codes.includes(code));

  // Before this fix: `locked` sent the reader to `Manage › Groups & phases` while its
  // only sentence is an element lock during a trace.
  expect(
    genericSentenceDefects(
      "locked",
      "Bu, kilitli bir grupta. Önce Yönet › Gruplar ve fazlar bölümünden grubun kilidini açın.",
      "That is in a locked group. Unlock the group in Manage › Groups & phases first.",
      backing("locked"),
    ),
  ).not.toEqual([]);

  // And `in_use` sent them to a sheet, while all nineteen sentences are about groups,
  // phases, circuits and load points.
  expect(
    genericSentenceDefects(
      "in_use",
      "Bu hâlâ bir paftada kullanımda. Önce paftadan kaldırın.",
      "That's still placed on a sheet. Remove it from the sheet first.",
      backing("in_use"),
    ),
  ).not.toEqual([]);

  // The sentences that ship now are clean, and a noun every sentence agrees with is
  // allowed: `undo_refused` says only what all five of its sentences say.
  expect(
    genericSentenceDefects(
      "locked",
      operatorMessage("locked", TR),
      operatorMessage("locked", EN),
      backing("locked"),
    ),
  ).toEqual([]);
  expect(
    genericSentenceDefects(
      "min_straight_length",
      "Bir parça çok kısa kalır.",
      "A piece would be too short.",
      [
        { template: "A piece would be too short" },
        { template: "A piece would be too short here" },
      ],
    ),
  ).toEqual([]);
});

// ---------------------------------------------------------------------------
// Placeholders, under a translator that returns its English verbatim
// ---------------------------------------------------------------------------

test("no placeholder reaches the screen through englishOnly", () => {
  // `englishOnly` is the translator a host without an i18next instance hands the
  // session: it returns the English argument *including* `{{placeholders}}`. Every
  // sentence with a hole in it therefore has to be repaired by `withValues` — the
  // defect that has slipped through this project twice (a queued-edit count printed
  // as `{{n}}`).
  const sentences = [
    [
      "session.changeNotSaved",
      "Your change wasn't saved. {{reason}}",
      { reason: "That end is already connected" },
    ],
    [
      "session.levelNotAdded",
      "Level 1 wasn't added: {{reason}}",
      { reason: "That end is already connected" },
    ],
    [
      "session.boxSelectedInside",
      "{{count}} selected: {{mode}} the box.",
      { count: 3, mode: "fully inside" },
    ],
    [
      "session.boxSelectedTouching",
      "{{count}} selected: {{mode}} the box.",
      { count: 1, mode: "touching" },
    ],
    [
      "session.selectFailed",
      "Couldn't select {{label}}: live editing isn't connected.",
      { label: "Fan 3" },
    ],
    [
      "session.selectHint",
      "Couldn't select {{label}}. It may have nothing drawn yet; find it in the Loads list.",
      { label: "Fan 3" },
    ],
    ["session.boxDragCount", "{{count}} in the box.", { count: 2 }],
  ] as const;
  const leaked = sentences
    .map(([key, english, values]) => ({
      key,
      shown: withValues(englishOnly(key, english), values),
    }))
    .filter(({ shown }) => /\{\{|\}\}/u.test(shown));
  expect(leaked).toEqual([]);
});

test("the two placeholder sentences are wrapped in withValues, not handed to a bare t()", () => {
  // `englishOnly` returns its English argument verbatim, `{{reason}}` and all, so a
  // call site that loses `withValues` leaks braces. Nothing asserted it before: reverting
  // either line stayed green.
  const source = readFileSync(
    join(REPO_ROOT, "packages/bim-editor/src/editor/model-session.ts"),
    "utf8",
  );
  const unwrapped = ["session.changeNotSaved", "session.levelNotAdded"].filter(
    (key) =>
      !new RegExp(
        String.raw`withValues\(\s*this\.t\(\s*'${key.replace(".", "\\.")}'`,
        "u",
      ).test(source),
  );
  expect(unwrapped).toEqual([]);
});
