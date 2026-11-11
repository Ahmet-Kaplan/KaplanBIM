/**
 * The ribbon's words in both languages.
 *
 * Every caption the ribbon shows — the tab names, the group names under them and
 * the section words a trade's tab is divided by — is `t('<key>', '<English>')` at
 * the place it is written, with the Turkish in `locales/tr/editor.json`. English
 * is the source of truth: the call site holds it, and a key with no Turkish yet
 * still reads correctly.
 *
 * Three things these tests hold down:
 *
 *   1. Turkish, when the host gives the editor a Turkish translator — including
 *      the tabs and groups that only exist in some states (a run selected, a
 *      route being drawn, a drawing open, add-ons in the project).
 *   2. English, unchanged, character for character — the ribbon a person who
 *      never leaves English sees is the ribbon it was before this work.
 *   3. Nothing left English in a Turkish ribbon: the same ribbon built in both
 *      languages, caption by caption. That guard is what catches a group someone
 *      forgets to key, which no single-state test can.
 */
import { render, screen } from "@testing-library/react";
import { buildingModelRibbon, type BuildingModelRibbonContext } from "../src/editor/building-model-ribbon";
import { Ribbon } from "../src/editor/ribbon/Ribbon";
import { tradeTab } from "../src/editor/ribbon/trade-tab";
import { groupOwnWord, type RibbonTab } from "../src/editor/ribbon/types";
import { DEFAULT_DRAFT_SETTINGS, DEFAULT_MODIFY_PARAMS } from "../src/editor/views-sheets/draft/draft-input";
import { TooltipProvider } from "../src/ui/tooltip";
import { translateFor, Wrap } from "./helpers/editor-i18n";

const NOOP = (): void => {};

/** A stand-in for a command's icon: the ribbon draws it, this test reads captions. */
const Icon = (): null => null;

/**
 * The ribbon's input: a readable project with nothing selected and nothing open,
 * so every tab and group exists. It is typed, not cast, so a new field on the
 * context stops this test rather than silently building half a ribbon.
 */
function ribbonContext(overrides: Partial<BuildingModelRibbonContext> = {}): BuildingModelRibbonContext {
  return {
    t: translateFor("en"),
    tool: "select",
    chooseTool: NOOP,
    editBlocked: null,
    drawingOpen: null,
    showLiveModel: NOOP,
    undoLabel: null,
    redoLabel: null,
    undo: NOOP,
    redo: NOOP,
    fit: NOOP,
    model3dOpen: false,
    roofOff: false,
    setRoofOff: NOOP,
    showStats: false,
    setShowStats: NOOP,
    projection: null,
    drawingTool: "select",
    drawingTools: [],
    tagAll: null,
    setDrawingTool: NOOP,
    request: NOOP,
    sectionDrawing: false,
    toggleSection: NOOP,
    planOpen: false,
    openModel: NOOP,
    crop: null,
    crop3d: null,
    sheet: null,
    hasSheets: false,
    canLink: false,
    openLink: NOOP,
    addLevel: NOOP,
    addMountingPlane: NOOP,
    useArchitectLevels: NOOP,
    showLevels: false,
    setShowLevels: NOOP,
    parts: { newPart: NOOP, newBlocked: null, editSelected: NOOP, editBlocked: null },
    selection: null,
    rotateSelected: NOOP,
    editType: NOOP,
    resizeSelected: NOOP,
    chooseFittingType: NOOP,
    reducerShape: NOOP,
    focusRunInsulation: NOOP,
    showPressure: NOOP,
    deleteSelected: NOOP,
    clearSelection: NOOP,
    splitSelected: NOOP,
    moveSelected: NOOP,
    boxFilter: { duct: true, pipe: true, parts: true },
    toggleBoxFilter: NOOP,
    route: null,
    organization: { openGroups: NOOP, openPhases: NOOP, openFilters: NOOP, openTagStyles: NOOP },
    viewGraphics: null,
    coordinates: {
      showOrigin: false,
      setShowOrigin: NOOP,
      moving: false,
      toggleMove: NOOP,
      openTrueNorth: NOOP,
      openSurveyPoint: NOOP,
      openOrigin: NOOP,
      openWorkingAngle: NOOP,
      alignAxes: NOOP,
      aligningAxes: false,
      orientation: null,
    },
    ...overrides,
  };
}

/** A project with a sheet, a coordination finding, the firm's library and its add-ons. */
function projectWithSheets(): Partial<BuildingModelRibbonContext> {
  return {
    hasSheets: true,
    coordination: { open: NOOP },
    history: { openVersions: NOOP, openResponsibilities: NOOP, openChangeOrders: NOOP },
    schedules: { views: [], newSchedule: NOOP, open: NOOP, openLibrary: NOOP, editBlocked: null },
    organization: { openGroups: NOOP, openPhases: NOOP, openFilters: NOOP, openTagStyles: NOOP, openAddons: NOOP, openCodes: NOOP },
  };
}

/** A drawing open with the draft bar live: Annotate gains Region and Symbol. */
function drawingWithDraft(): Partial<BuildingModelRibbonContext> {
  return {
    drawingOpen: "detail",
    drawingTool: "line",
    draft: {
      settings: DEFAULT_DRAFT_SETTINGS,
      setSettings: NOOP,
      params: DEFAULT_MODIFY_PARAMS,
      setParams: NOOP,
      pending: null,
      setPending: NOOP,
      selectedIds: [],
      setSelectedIds: NOOP,
      sendRequest: NOOP,
      registerSelectionActions: NOOP,
    },
  };
}

/** The Route tool on: the Route tab, with Height, Axis, Fittings and Finish. */
function drawingARoute(): Partial<BuildingModelRibbonContext> {
  return {
    route: {
      riseStyle: "45",
      setRiseStyle: NOOP,
      rise: NOOP,
      lock: "auto",
      setLock: NOOP,
      chooseElbow: NOOP,
      chooseTakeoff: NOOP,
      offsetArmed: false,
      armOffset: NOOP,
      finish: NOOP,
      cancel: NOOP,
      finishBlocked: null,
      riseBlocked: null,
    },
  };
}

/** A duct run selected: the contextual tab is named after what is selected. */
const DUCT_RUN: Partial<BuildingModelRibbonContext> = { selection: { kind: "run", label: "VAV-1 supply", domain: "duct" } };

/** A pipe run selected. */
const PIPE_RUN: Partial<BuildingModelRibbonContext> = { selection: { kind: "run", label: "WS-1", domain: "pipe" } };

/** A part selected: its group is captioned with the part's own type name. */
const PART: Partial<BuildingModelRibbonContext> = { selection: { kind: "part", label: "VAV box" } };

/** The ribbon with `language`'s translator, built exactly as the surface builds it. */
function ribbonIn(language: "en" | "tr", overrides: Partial<BuildingModelRibbonContext> = {}): readonly RibbonTab[] {
  return buildingModelRibbon(ribbonContext({ ...overrides, t: translateFor(language) }));
}

function tab(tabs: readonly RibbonTab[], id: string): RibbonTab {
  const found = tabs.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no ${id} tab in the ribbon: ${tabs.map((candidate) => candidate.id).join(", ")}`);
  return found;
}

/** The captions of one tab, in order: what a person actually reads. */
function captions(tabs: readonly RibbonTab[], id: string): string[] {
  return tab(tabs, id).groups.map((g) => g.label);
}

describe("the ribbon in Turkish", () => {
  test("names the tabs in Turkish", () => {
    const tabs = ribbonIn("tr");
    expect(["model", "views", "sheets", "manage", "annotate", "modify"].map((id) => tab(tabs, id).label)).toEqual([
      "Model",
      "Görünümler",
      "Paftalar",
      "Yönet",
      "Açıklama",
      "Değiştir",
    ]);
  });

  test("names the groups in Turkish", () => {
    const tabs = ribbonIn("tr");
    expect(captions(tabs, "model")).toEqual(["Seç", "Oluştur", "Parçalar", "Referans", "Görüntüle"]);
    expect(captions(tabs, "annotate")).toEqual(["Seç", "Ölçü", "Detay", "Metin", "Etiket"]);
    expect(captions(tabs, "modify")).toEqual(["Seç", "Değiştir", "Geometri", "Düzenle"]);
    expect(captions(tabs, "views")).toEqual(["Seç", "Oluştur", "Aç", "Grafikler", "Kırp"]);
    expect(captions(tabs, "sheets")).toEqual(["Seç", "Pafta", "Şekiller · önce bir pafta açın", "Yayın"]);
    expect(captions(tabs, "manage")).toEqual(["Seç", "Proje", "Koordinatlar", "Gruplar ve fazlar"]);
  });

  test("names a group in Turkish when the project has a sheet open to print", () => {
    const tabs = ribbonIn("tr", projectWithSheets());
    // Nothing is open, so both captions say what it would take: a sheet to print.
    expect(captions(tabs, "sheets")).toEqual(["Seç", "Pafta", "Şekiller · önce bir pafta açın", "Yayın · yazdırmak için bir pafta açın"]);
    expect(captions(tabs, "views")).toEqual(["Seç", "Oluştur", "Aç", "Grafikler", "Kırp", "Çizelgeler"]);
  });

  test("names the Manage groups and the words inside them in Turkish", () => {
    const tabs = ribbonIn("tr", projectWithSheets());
    expect(captions(tabs, "manage")).toEqual(["Seç", "Proje", "Koordinatlar", "Gruplar ve fazlar", "Model ayarları", "Sürümler ve imza onayı", "Koordinasyon", "Kitaplık"]);
    // "Model settings" is a group the surface always offers once add-ons exist.
    expect(tab(tabs, "manage").groups.find((g) => g.id === "model-settings")?.label).toBe("Model ayarları");
  });

  test("names the groups that only exist with a drawing open or a route being drawn", () => {
    expect(captions(ribbonIn("tr", drawingWithDraft()), "annotate")).toEqual(["Seç", "Ölçü", "Detay", "Bölge", "Metin", "Etiket", "Sembol"]);
    const route = ribbonIn("tr", drawingARoute());
    expect(tab(route, "route").label).toBe("Güzergâh");
    expect(captions(route, "route")).toEqual(["Seç", "Yükseklik", "Eksen", "Bağlantı parçaları", "Bitir"]);
  });

  test("names a contextual tab after what is selected, in Turkish", () => {
    expect(tab(ribbonIn("tr", DUCT_RUN), "selection").label).toBe("Kanal hattı");
    expect(tab(ribbonIn("tr", PIPE_RUN), "selection").label).toBe("Boru hattı");
    const part = ribbonIn("tr", PART);
    // The tab says what it is; the group beside it carries the part's own type name.
    expect(tab(part, "selection").label).toBe("Parça");
    expect(captions(part, "selection")).toEqual(["Seç", "VAV box", "Seçim"]);
  });

  test("draws a trade's tab in the section words the glossary fixes", () => {
    const sections = tradeTab(
      {
        id: "electrical",
        label: "Electrical",
        select: { id: "select", label: "Seç", commands: [] },
        create: [{ id: "place", label: "Place", commands: [{ id: "p", label: "Place", icon: Icon, description: "" }] }],
        connect: { id: "circuits", label: "Circuits", commands: [{ id: "c", label: "Circuit", icon: Icon, description: "" }] },
      },
      translateFor("tr"),
    );
    expect(sections.groups.map((g) => g.label)).toEqual(["Seç", "Oluştur", "Bağla"]);
  });

  test("keeps a trade group's own name inside its section word", () => {
    const sections = tradeTab(
      {
        id: "mechanical",
        label: "Mechanical",
        select: { id: "select", label: "Seç", commands: [] },
        create: [
          { id: "one", label: "Place diffusers", commands: [{ id: "a", label: "Diffuser", icon: Icon, description: "" }] },
          { id: "two", label: "Place grilles", commands: [{ id: "b", label: "Grille", icon: Icon, description: "" }] },
        ],
      },
      translateFor("tr"),
    );
    // The section word is Turkish; the trade's group names are its own until their stage.
    expect(sections.groups.map((g) => g.label)).toEqual(["Seç", "Oluştur · Place diffusers", "Oluştur · Place grilles"]);
  });
});

/**
 * Captions that are the same in both languages, and why:
 *
 * - `Model` and `Plan` are the Turkish words too (glossary §9/Ç1, §4).
 * - A selected thing's own name ("VAV box", "VAV-1 supply", "3 drawn items") is
 *   model data, not a translated word: it reads the same in either language.
 */
const SAME_IN_BOTH = new Set(["tab:model", "tab:drawn-items", "group:plan", "group:part", "group:run", "group:group", "group:branch", "group:drawn-done"]);

/** Every caption that stayed English in the Turkish ribbon, or `[]`. */
function englishLeftInTurkish(overrides: Partial<BuildingModelRibbonContext>): string[] {
  const english = ribbonIn("en", overrides);
  const turkish = ribbonIn("tr", overrides);
  const leaks: string[] = [];
  for (const en of english) {
    const tr = turkish.find((candidate) => candidate.id === en.id);
    if (tr === undefined) {
      leaks.push(`tab:${en.id} is missing from the Turkish ribbon`);
      continue;
    }
    if (en.label === tr.label && !SAME_IN_BOTH.has(`tab:${en.id}`)) leaks.push(`tab:${en.id} "${tr.label}"`);
    for (const group of en.groups) {
      const translated = tr.groups.find((candidate) => candidate.id === group.id);
      if (translated === undefined) {
        leaks.push(`group:${en.id}/${group.id} is missing from the Turkish ribbon`);
        continue;
      }
      if (group.label === translated.label && !SAME_IN_BOTH.has(`group:${group.id}`)) leaks.push(`group:${en.id}/${group.id} "${translated.label}"`);
    }
  }
  return leaks;
}

describe("nothing is left English in a Turkish ribbon", () => {
  test.each([
    ["a plain project", {}],
    ["a project with sheets, add-ons, versions and a library", projectWithSheets()],
    ["a drawing open with the draft bar live", drawingWithDraft()],
    ["the Route tool on", drawingARoute()],
    ["a duct run selected", DUCT_RUN],
    ["a pipe run selected", PIPE_RUN],
    ["a part selected", PART],
  ])("%s", (_name, overrides) => {
    expect(englishLeftInTurkish(overrides as Partial<BuildingModelRibbonContext>)).toEqual([]);
  });
});

describe("the ribbon in English", () => {
  test("keeps every tab and group caption exactly as it was", () => {
    const tabs = ribbonIn("en");
    expect(tabs.map((t) => t.label)).toEqual(["Model", "Annotate", "Modify", "Views", "Sheets", "Manage"]);
    expect(tabs.map((t) => t.groups.map((g) => g.label))).toEqual([
      ["Select", "Create", "Parts", "Datum", "Display"],
      ["Select", "Dimension", "Detail", "Text", "Tag"],
      ["Select", "Modify", "Geometry", "Edit"],
      ["Select", "Create", "Open", "Graphics", "Crop"],
      ["Select", "Sheet", "Figures · open a sheet first", "Issue"],
      ["Select", "Project", "Coordinates", "Groups & phases"],
    ]);
  });

  test("keeps them in every state the Turkish tests cover", () => {
    const sheets = ribbonIn("en", projectWithSheets());
    expect(captions(sheets, "sheets")).toEqual(["Select", "Sheet", "Figures · open a sheet first", "Issue · open a sheet to print it"]);
    expect(captions(sheets, "manage")).toEqual(["Select", "Project", "Coordinates", "Groups & phases", "Model settings", "Versions & sign-off", "Coordination", "Library"]);
    expect(captions(sheets, "views")).toEqual(["Select", "Create", "Open", "Graphics", "Crop", "Schedules"]);
    expect(captions(ribbonIn("en", drawingWithDraft()), "annotate")).toEqual(["Select", "Dimension", "Detail", "Region", "Text", "Tag", "Symbol"]);
    const route = ribbonIn("en", drawingARoute());
    expect(tab(route, "route").label).toBe("Route");
    expect(captions(route, "route")).toEqual(["Select", "Height", "Axis", "Fittings", "Finish"]);
    expect(tab(ribbonIn("en", DUCT_RUN), "selection").label).toBe("Duct run");
    expect(tab(ribbonIn("en", PIPE_RUN), "selection").label).toBe("Pipe run");
  });

  test("keeps the section words a trade's tab is divided by", () => {
    const sections = tradeTab(
      {
        id: "electrical",
        label: "Electrical",
        select: { id: "select", label: "Select", commands: [] },
        create: [{ id: "place", label: "Place", commands: [{ id: "p", label: "Place", icon: Icon, description: "" }] }],
        connect: { id: "circuits", label: "Circuits", commands: [{ id: "c", label: "Circuit", icon: Icon, description: "" }] },
      },
      translateFor("en"),
    );
    expect(sections.groups.map((g) => g.label)).toEqual(["Select", "Create", "Connect"]);
  });

  test("keeps the caption of a group whose own name is the section's word", () => {
    const sections = tradeTab(
      {
        id: "electrical",
        label: "Electrical",
        select: { id: "select", label: "Select", commands: [] },
        create: [
          { id: "one", label: "Create", commands: [{ id: "a", label: "Panel", icon: Icon, description: "" }] },
          { id: "two", label: "Place", commands: [{ id: "b", label: "Device", icon: Icon, description: "" }] },
        ],
      },
      translateFor("en"),
    );
    // Not "Create · Create": a group already called after its section keeps the one word.
    expect(sections.groups.map((g) => g.label)).toEqual(["Select", "Create", "Create · Place"]);
  });
});

describe("the ribbon's More control", () => {
  test("names the group in Turkish, in the caption and on the button", () => {
    render(
      <Wrap language="tr">
        <TooltipProvider>
          <Ribbon tabs={ribbonIn("tr")} value="sheets" onValueChange={NOOP} />
        </TooltipProvider>
      </Wrap>,
    );
    // Sheet has six controls: the last two fold under More.
    expect(screen.getByRole("button", { name: "pafta grubunda daha fazla araç" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "pafta grubunda daha fazla araç" })).toHaveTextContent("Daha fazla");
  });

  test("names it in English in English", () => {
    render(
      <Wrap language="en">
        <TooltipProvider>
          <Ribbon tabs={ribbonIn("en")} value="sheets" onValueChange={NOOP} />
        </TooltipProvider>
      </Wrap>,
    );
    const more = screen.getByRole("button", { name: "More sheet tools" });
    expect(more).toHaveTextContent("More");
  });

  test("fills the placeholder in when the host gave no translator at all", () => {
    // Without `<I18nProvider>` the words are English; the name must still be a
    // sentence, not "More {{name}} tools" read out to a screen reader.
    render(
      <TooltipProvider>
        <Ribbon tabs={ribbonIn("en")} value="sheets" onValueChange={NOOP} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId("ribbon-tab-sheets")).toHaveTextContent("Sheets");
    expect(screen.getByTestId("ribbon-group-sheet")).toHaveTextContent("Sheet");
    expect(screen.getByRole("button", { name: "More sheet tools" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /{{name}}/ })).toBeNull();
  });

  test("lowers a group's word in the language the caption is written in", () => {
    // Turkish: `İ` lowercases to a plain `i`, `I` to `ı`.
    expect(groupOwnWord("Şekiller", "tr")).toBe("şekiller");
    expect(groupOwnWord("İletişim", "tr")).toBe("iletişim");
    expect(groupOwnWord("Işık", "tr")).toBe("ışık");
    // English keeps its own casing: a Turkish locale would read "ıssue".
    expect(groupOwnWord("Issue", "en")).toBe("issue");
    expect(groupOwnWord("Issue")).toBe("issue");
    // The last part of a section caption is the group's own word.
    expect(groupOwnWord("Şekiller · Ölçü", "tr")).toBe("ölçü");
  });
});

describe("the ribbon on screen", () => {
  function draw(tabs: readonly RibbonTab[], language: "en" | "tr", openTab: string) {
    return render(
      <Wrap language={language}>
        <TooltipProvider>
          <Ribbon tabs={tabs} value={openTab} onValueChange={NOOP} />
        </TooltipProvider>
      </Wrap>,
    );
  }

  test("shows the Turkish tabs and group captions", () => {
    draw(ribbonIn("tr"), "tr", "views");
    expect(screen.getByTestId("ribbon-tab-views")).toHaveTextContent("Görünümler");
    expect(screen.getByTestId("ribbon-tab-sheets")).toHaveTextContent("Paftalar");
    expect(screen.getByTestId("ribbon-tab-manage")).toHaveTextContent("Yönet");
    expect(screen.getByTestId("ribbon-group-create")).toHaveTextContent("Oluştur");
    expect(screen.getByTestId("ribbon-group-crop")).toHaveTextContent("Kırp");
    // The group's caption is the accessible name of the controls it holds.
    expect(screen.getByRole("group", { name: "Grafikler" })).toBeTruthy();
  });
});
