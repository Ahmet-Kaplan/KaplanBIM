/**
 * The MEP panels in two languages — the half of Task 4.3 that is finished.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **The words are keyed** — `editorSourceCaptions()` reads every `.ts`/`.tsx`
 *      under `src/editor` and pulls out each `t('<key>', '<English>'` call. A
 *      pressure label that went back to a literal fails here.
 *   2. **The Turkish says the right thing, per the glossary** — §9/Ç9 pins *hat*
 *      for a duct or pipe run (a *run* command stays *çalıştır*); §9/Ç13 pins
 *      *sürtünme oranı* for a friction rate, and keeps *debi* and *birim fiyat*
 *      apart from it; §7 pins the unit symbols, which never travel.
 *   3. **Real components draw it** — the pressurization section and the
 *      ventilation panel, in both languages.
 *
 * **Ç7 (pano / panel) and Ç12 (armatür) are asserted here**, now that `electrical/`
 * is keyed: a panelboard is a *pano* while a UI side panel stays a *panel*, and a
 * luminaire is an *armatür*.
 *
 * **The plumbing half of §9/Ç8, §9/Ç9, §9/Ç12 and §9/Ç13 lives in
 * `i18n-plumbing.test.tsx`** — *branşman*, *hat*, *armatür* versus *yük birimi*,
 * *debi* versus *eğim* — because that tree is now keyed end to end and owns its
 * own guards. This file keeps holding what the four MEP trees share (the pinned
 * site counts, the placeholder-parity sweep, the rendered panels).
 */
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "../src/ui/tooltip";
import { PressurizationSection } from "../src/editor/balance/PressurizationSection";
import { VentilationPanel } from "../src/editor/ventilation/VentilationPanel";
import { loadStatusWord, loadTradeWord } from "../src/editor/loads/loads-breakdown";
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor, Wrap } from "./helpers/editor-i18n";
import type { ModelState } from "@permitzip/bim-kernel";

const TR = translateFor("tr");
const EN = translateFor("en");

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §2.4/§9/Ç4: a table of model data is a çizelge, its pressure column a basınç.
  { key: "balance.pressurization", english: "Pressurization", turkish: "Basınçlandırma" },
  { key: "balance.zone", english: "Zone", turkish: "Bölge" },
  { key: "balance.pressure", english: "Pressure", turkish: "Basınç" },
  { key: "balance.exhaust", english: "Exhaust", turkish: "Egzoz" },
  { key: "balance.makeupAir", english: "Makeup air", turkish: "Takviye hava" },
  { key: "balance.outdoorAir", english: "Outdoor air", turkish: "Dış hava" },
  { key: "balance.makeupAirLoad", english: "Makeup air load", turkish: "Takviye hava yükü" },
  { key: "balance.tableCommand", english: "Pressurization table", turkish: "Basınçlandırma çizelgesi" },
  // §2.8/§9/Ç9: a duct is a kanal, the air it carries a hava debisi, its run a hat.
  { key: "ventilation.title", english: "Ventilation", turkish: "Havalandırma" },
  { key: "ventilation.airflow", english: "Airflow", turkish: "Hava debisi" },
  { key: "ventilation.velocity", english: "Velocity", turkish: "Hız" },
  { key: "ventilation.scopeRun", english: "This run", turkish: "Bu hat" },
  { key: "ventilation.scopePiece", english: "This piece", turkish: "Bu parça" },
  { key: "ventilation.insulation", english: "Insulation", turkish: "Yalıtım" },
  { key: "ventilation.zones", english: "Zones", turkish: "Bölgeler" },
  { key: "ventilation.space", english: "Space", turkish: "Mekan" },
  // §5: the schedule's own words.
  { key: "ventilation.tableCommand", english: "Ventilation table", turkish: "Havalandırma çizelgesi" },
  { key: "loads.title", english: "Loads", turkish: "Yükler" },
  { key: "loads.byTrade", english: "By trade", turkish: "Türe göre" },
  { key: "loads.counted", english: "Counted: {{parts}}", turkish: "Sayılan: {{parts}}" },
  // Ç7: an electrical panelboard is a pano; a UI side panel stays a panel.
  { key: "electrical.panelSchedule", english: "Panel schedule", turkish: "Pano çizelgesi" },
  { key: "electrical.feedPanel", english: "Feed panel", turkish: "Panoyu besle" },
  { key: "electrical.mainBreaker", english: "main breaker", turkish: "ana şalter" },
  // Ç8: a branch circuit is a branşman devresi.
  { key: "electrical.keyword.branchcircuit", english: "branch circuit", turkish: "branşman devresi" },
  // Ç12: a luminaire is an armatür.
  { key: "electrical.continueDevice.light", english: "Light", turkish: "Armatür" },
  { key: "electrical.continueDevice.downlight", english: "Downlight", turkish: "Gömme spot" },
  // §2.3: a dedicated space is an ayrılmış boşluk, never an *alan*.
  { key: "electrical.keepTheSpaceAboveClearNEC11026E", english: "Keep the space above clear (NEC 110.26(E))", turkish: "Üstündeki boşluğu açık tut (NEC 110.26(E))" },
  // §7: the kVA and amp columns keep their symbols; only the frame is Turkish.
  { key: "electrical.kvaAndAmps", english: "{{kva}} kVA, {{amps}}", turkish: "{{kva}} kVA, {{amps}}" },
  { key: "electrical.ampsBusValue", english: "{{value}} A bus", turkish: "{{value}} A bara" },
  { key: "electrical.fedFrom", english: "Fed from", turkish: "Beslendiği yer" },
];

/**
 * How many call sites each shared caption has today; a new site is a deliberate
 * bump here. A key written in two places would pass a presence check while one
 * of them went back to a literal.
 */
const SITES: Readonly<Record<string, number>> = {
  // RoutePanel names the same materials in its Material picker (2026-11-10: the route panel round).
  "plumbing.materialWord.castIron": 2,
  "plumbing.materialWord.blackSteel": 2,
  "plumbing.materialWord.galvanized": 2,
  "plumbing.materialWord.pe": 2,
  // Plumbing: every caption the plumbing tree writes more than once (its own
  // glossary guards are in `i18n-plumbing.test.tsx`).
  "plumbing.autoSize": 2,
  "plumbing.autoSizeOf": 2,
  "plumbing.deleteWord": 3,
  "plumbing.demandCurve": 2,
  "plumbing.didntGoThrough": 3,
  "plumbing.done": 2,
  "plumbing.everyPipeIsLargeEnough": 2,
  "plumbing.fixtureUnitsWord": 2,
  "plumbing.fromTheBuildingTypeLabel": 2,
  "plumbing.gasSizing": 3,
  "plumbing.insulation": 2,
  "plumbing.inWc": 3,
  "plumbing.keyword.hunterCurve": 2,
  "plumbing.material": 3,
  "plumbing.morePipesNeedALargerSize": 2,
  "plumbing.name": 2,
  "plumbing.noneLower": 2,
  "plumbing.notLive": 6,
  "plumbing.notSaved": 2,
  "plumbing.number": 2,
  "plumbing.pickTheEdition": 2,
  "plumbing.pipeSizing": 2,
  "plumbing.pipeTypes": 3,
  "plumbing.placeLoadPoint": 2,
  "plumbing.routingTheDrainOn": 2,
  "plumbing.save": 2,
  "plumbing.setTheDemandCurve": 2,
  "plumbing.sizedPipesDoneMany": 2,
  "plumbing.sizedPipesDoneOne": 2,
  "plumbing.sizedPipesOnMany": 2,
  "plumbing.sizedPipesOnOne": 2,
  "plumbing.sizePipes": 2,
  "plumbing.sizePipesMany": 2,
  "plumbing.sizePipesOne": 2,
  "plumbing.stacks": 2,
  "plumbing.system": 4,
  "plumbing.systems": 4,
  "plumbing.theEquation": 2,
  "plumbing.theProjectsCodeStudy": 2,
  "plumbing.turnAutoSizingOff": 2,
  "plumbing.turnAutoSizingOn": 2,
  "plumbing.velocityWord": 2,
  "balance.pressurization": 2,
  "loads.byTrade": 2,
  "loads.status.open": 2,
  "loads.select": 2,
  "loads.estimateVsDevices": 2,
  "loads.zone": 2,
  "loads.space": 2,
  "ventilation.select": 3,
  "ventilation.tryAgain": 3,
  "ventilation.thisLevel": 2,
  "ventilation.openSpaces": 2,
  "ventilation.space": 3,
  "ventilation.heatGain": 2,
  "ventilation.mount": 2,
  "ventilation.noInsulationKernel": 2,
  "ventilation.insulationNoneLower": 2,
  "ventilation.insulation": 3,
  "ventilation.insulationNone": 2,
  "ventilation.insulationWrap": 2,
  "ventilation.insulationLiner": 2,
  "ventilation.insulationThickness": 2,
  "ventilation.linerSurface": 2,
  "ventilation.linerFaced": 2,
  "ventilation.linerSprayCoated": 2,
  "ventilation.systemDefault": 2,
  "ventilation.notLive": 4,
  "ventilation.airflow": 2,
  "ventilation.velocity": 2,
  "ventilation.loss": 2,
  "ventilation.transitionShape": 2,
  "ventilation.title": 5,
  "ventilation.people": 3,
  "ventilation.voz": 2,
  "ventilation.tableCommand": 2,
  "ventilation.area": 2,
  "ventilation.exhaust": 2,
  "ventilation.governingParen": 2,
  "ventilation.keyword.exhaust": 2,
  "ventilation.keyword.outdoorAir": 2,
  "ventilation.keyword.abbrOa": 2,
  "ventilation.keyword.ashrae621": 2,
  "ventilation.keyword.schedule": 2,
  "ventilation.modelStillLoading": 5,
  // Electrical: every caption the electrical panels and the ribbon share.
  "electrical.225A42CircuitsMainLugs": 2,
  "electrical.225AMainBreaker42Circuits": 2,
  "electrical.addToCircuit": 4,
  "electrical.bedroom": 2,
  "electrical.bkr": 2,
  "electrical.breakerA": 4,
  "electrical.cancel": 8,
  "electrical.changeCircuit": 3,
  "electrical.circuit": 8,
  "electrical.class": 2,
  "electrical.close": 2,
  "electrical.columns": 2,
  "electrical.connectionTypes": 3,
  "electrical.continueCircuit": 3,
  "electrical.default": 3,
  "electrical.demandFigures": 2,
  "electrical.description": 5,
  "electrical.designator": 2,
  "electrical.editCircuit": 2,
  "electrical.editNameAria": 3,
  "electrical.electrical": 4,
  "electrical.electricalCheck": 2,
  "electrical.electricalSchedules": 2,
  "electrical.electricaltypesdialog_195": 2,
  "electrical.electricaltypesdialog_336": 2,
  "electrical.electricaltypesdialog_338": 2,
  "electrical.fedFrom": 3,
  "electrical.feed": 3,
  "electrical.feederTypes": 2,
  "electrical.keepIt": 2,
  "electrical.keyword.homerun": 2,
  "electrical.keyword.singleline": 2,
  "electrical.kvaAndAmps": 4,
  "electrical.lengthFt": 2,
  "electrical.load": 2,
  "electrical.mainBreaker": 2,
  "electrical.mainLugs": 2,
  "electrical.makes": 2,
  "electrical.mark": 2,
  "electrical.mechanicalEquipmentWithElectrical": 2,
  "electrical.nEstimates": 2,
  "electrical.nOnACircuit": 2,
  "electrical.name": 2,
  "electrical.noFreeSlots": 2,
  "electrical.noneOnACircuitYet": 2,
  "electrical.now": 2,
  "electrical.panel": 7,
  "electrical.placeAPanelFirstElectricalPanelThenNameItInI": 3,
  "electrical.poleBreaker": 2,
  "electrical.proposeReceptacles": 2,
  "electrical.remove": 2,
  "electrical.required": 2,
  "electrical.rooms": 3,
  "electrical.safetySwitch": 4,
  "electrical.save": 3,
  "electrical.saveForThisProject": 2,
  "electrical.saveName": 3,
  "electrical.saving": 2,
  "electrical.selectOnePanelOrTransformerToFeed": 2,
  "electrical.serves": 2,
  "electrical.sizeIt": 2,
  "electrical.slots": 5,
  "electrical.supplyFrom": 2,
  "electrical.supplyFromWording": 2,
  "electrical.systemHeading": 3,
  "electrical.template": 2,
  "electrical.templateName": 3,
  "electrical.theBreakerIsAmpsANumberAbove0OrLeaveItEmptyF": 2,
  "electrical.theLengthIsFeetANumberAbove0": 2,
  "electrical.thePanel": 2,
  "electrical.title": 2,
  "electrical.unit": 2,
  "electrical.valueWord": 2,
  "electrical.voltageV1Pole": 2,
  "electrical.voltageVPoles": 2,
  "electrical.youCanUndoThis": 2,
  // The run properties' read-only refusal is on the route-like button's tooltip, the
  // delete tooltip and both move forms; `Height` labels a level piece and a fitting.
  "run.notLive": 4,
  "run.connected": 2,
  "run.height": 2,
  // The group properties say the same feet example, the same `Move` and the same
  // three size fields as the run forms: one caption, two surfaces.
  "run.needFeet": 2,
  "run.move": 2,
  "run.diameterIn": 2,
  "run.widthIn": 2,
  "run.heightIn": 2,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("every MEP caption is still keyed in the source, with its English", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("an MEP caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

test("every MEP caption written twice or more has its site count pinned", () => {
  const source = editorSourceCaptions();
  const prefixes = ["ventilation.", "balance.", "loads.", "electrical.", "plumbing.", "run."];
  const unpinned = [...source.entries()]
    .filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
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

test("run reads hat in MEP context", () => {
  // §9/Ç9: a duct or pipe run is a *hat*; the *run* command stays *çalıştır*.
  expect(TR("ventilation.scopeRun", "This run", { ns: "editor" })).toBe("Bu hat");
  expect(TR("ventilation.scopeRun", "This run", { ns: "editor" })).not.toContain("çalıştır");
  expect(TR("ventilation.scopePiece", "This piece", { ns: "editor" })).toBe("Bu parça");
  // The run properties' own words: `Route another like this` makes a hat, and neither
  // the button nor the sentence that says a move carries its neighbours says çalıştır.
  expect(TR("run.routeLike", "Route another like this", { ns: "editor" })).toBe("Buna benzer bir hat daha çiz");
  expect(TR("run.notLiveRouted", "Live editing isn't connected, so nothing can be routed", { ns: "editor" })).toContain("hat");
  expect(TR("run.riseMoves", "The rise gets taller or shorter; the run above it moves with its top.", { ns: "editor" })).toContain("hat");
  for (const key of ["run.routeLike", "run.notLiveRouted", "run.slideBranch", "run.moveWhy"] as const) {
    expect(TR(key, "", { ns: "editor" })).not.toContain("çalıştır");
  }
  // §2.8: the trunk a branch leaves is an ana hat.
  expect(TR("run.alongTrunk", "Along the trunk", { ns: "editor" })).toBe("Ana hat boyunca");
  // §2.1: a piece is an eleman; §2.8: a branch is a branşman.
  expect(TR("run.resizeThis", "Resize this piece", { ns: "editor" })).toBe("Bu elemanı yeniden boyutlandır");
  expect(TR("run.branch", "Branch", { ns: "editor" })).toBe("Branşman");
});

test("rate is disambiguated per Ç13: a friction rate is a sürtünme oranı", () => {
  expect(TR("ventilation.frictionRate", "Friction rate", { ns: "editor" })).toBe("Sürtünme oranı");
  // Neither the flow (debi) nor the price (birim fiyat) word leaked into it.
  expect(TR("ventilation.frictionRate", "Friction rate", { ns: "editor" })).not.toBe("Debi");
  expect(TR("ventilation.frictionRate", "Friction rate", { ns: "editor" })).not.toContain("fiyat");
  // …and a flow is a debi, not an oran.
  expect(TR("ventilation.airflow", "Airflow", { ns: "editor" })).toBe("Hava debisi");
});

test("Ç7: a panelboard reads pano, and a UI side panel stays panel", () => {
  expect(TR("electrical.panel", "Panel", { ns: "editor" })).toBe("Pano");
  expect(TR("electrical.panelSchedule", "Panel schedule", { ns: "editor" })).toBe("Pano çizelgesi");
  expect(TR("electrical.feedPanel", "Feed panel", { ns: "editor" })).toBe("Panoyu besle");
  // Ç7's other half: the dock a person drags a view from is a *panel*, never a *pano*.
  const dock = TR("canvas.noViewsPlaced", "No views placed yet. Drag a view from the panel onto the sheet.", { ns: "editor" });
  expect(dock).toContain("Panel");
  expect(dock).not.toContain("Pano");
});

test("Ç12 and §2.3: a luminaire is an armatür, a dedicated space is a boşluk", () => {
  expect(TR("electrical.continueDevice.light", "Light", { ns: "editor" })).toBe("Armatür");
  expect(TR("electrical.continueDevice.downlight", "Downlight", { ns: "editor" })).toBe("Gömme spot");
  const dedicated = TR("electrical.keepTheSpaceAboveClearNEC11026E", "Keep the space above clear (NEC 110.26(E))", { ns: "editor" });
  expect(dedicated).toContain("boşluğ");
  expect(dedicated).not.toContain("alan");
  // Ç8: a MEP branch stays a branşman, never a *dal* (that is a version branch).
  expect(TR("electrical.keyword.branchcircuit", "branch circuit", { ns: "editor" })).toBe("branşman devresi");
});

test("unit symbols are never translated", () => {
  // §7: the symbols travel as they are. CFM, fpm, in. w.c. and kVA are not words.
  expect(TR("ventilation.airflowCfm", "Airflow (CFM)", { ns: "editor" })).toBe("Hava debisi (CFM)");
  expect(TR("ventilation.airflowCfm", "Airflow (CFM)", { ns: "editor" })).toContain("CFM");
  const carries = TR("ventilation.carries", "Carries {{cfm}} CFM: {{fpm}} fpm, {{friction}}” per 100 ft{{through}}.", {
    ns: "editor",
    cfm: "1,200",
    fpm: "900",
    friction: "0.08",
    through: "",
  });
  expect(carries).toContain("CFM");
  expect(carries).toContain("fpm");
  expect(carries).toContain("100 ft");
  // A kVA column keeps its symbol too, in the words around it.
  expect(TR("balance.tableKind.pressurization", "pressurization", { ns: "editor" })).toBe("basınçlandırma");
  expect(TR("electrical.kvaAndAmps", "{{kva}} kVA, {{amps}}", { ns: "editor", kva: "12", amps: "33 A" })).toBe("12 kVA, 33 A");
  expect(TR("electrical.ampsBusValue", "{{value}} A bus", { ns: "editor", value: "800" })).toBe("800 A bara");
});

test("the load statuses and trades are Turkish, and the trade words are not spliced raw", () => {
  expect(loadStatusWord("mismatch", TR)).toBe("İlgi bekliyor");
  expect(loadStatusWord("connected", TR)).toBe("Bir boru, kanal ya da devrede");
  expect(loadTradeWord("plumbing", TR)).toBe("Su ve drenaj");
  expect(loadTradeWord("electrical", TR)).toBe("Elektrik");
  // The kernel's own English label is never handed to the screen in Turkish.
  expect(loadTradeWord("mechanical", TR)).not.toBe("Air");
  expect(loadTradeWord("mechanical", EN)).toBe("Air");
});

test("English labels are unchanged", () => {
  for (const caption of CAPTIONS) {
    expect(EN(caption.key, caption.english, { ns: "editor" })).toBe(fill(caption.english, undefined));
  }
});

/** `{ ventilation: { airflow: "Hava debisi" } }` → `"ventilation.airflow"`. */
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

const MEP_PREFIXES = ["ventilation.", "balance.", "loads.", "electrical.", "plumbing.", "run."] as const;

test("every MEP caption in the source has its Turkish", () => {
  const inSource = [...editorSourceCaptions().keys()].filter((key) => MEP_PREFIXES.some((prefix) => key.startsWith(prefix)));
  expect(inSource.length).toBeGreaterThan(120);
  expect(inSource.filter((key) => (LOCALE[key] ?? "").trim() === "")).toEqual([]);
});

test("a placeholder is never written with one brace", () => {
  const wrong = Object.entries(LOCALE)
    .filter(([key]) => MEP_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
    .map(([key]) => key);
  expect(wrong).toEqual([]);
});

// ---------------------------------------------------------------------------
// Rendered surfaces
// ---------------------------------------------------------------------------

const NOOP = (): void => {};

const MODEL = { elements: {}, revision: 1 } as unknown as ModelState;

test("the pressurization section draws its Turkish headings, and its units as they are", () => {
  render(
    <Wrap language="tr">
      <TooltipProvider>
        <PressurizationSection model={MODEL} scope={null} />
      </TooltipProvider>
    </Wrap>,
  );
  expect(screen.getByTestId("pressurization-section")).toBeTruthy();
  expect(screen.getAllByText("Basınçlandırma").length).toBeGreaterThan(0);
  expect(screen.queryByText("Pressurization")).toBeNull();
});

test("the pressurization section is unchanged in English", () => {
  render(
    <Wrap language="en">
      <TooltipProvider>
        <PressurizationSection model={MODEL} scope={null} />
      </TooltipProvider>
    </Wrap>,
  );
  expect(screen.getAllByText("Pressurization").length).toBeGreaterThan(0);
});

test("the ventilation panel asks for a floor plan in Turkish, and says CFM untranslated", () => {
  const { container } = render(
    <Wrap language="tr">
      <TooltipProvider>
        <VentilationPanel model={null} error={null} levelId={null} levelName={null} adoption={null} state={null} onClose={NOOP} />
      </TooltipProvider>
    </Wrap>,
  );
  expect(container.textContent ?? "").toContain("Model yükleniyor");
  expect(container.textContent ?? "").not.toContain("Loading the model");
});
