/**
 * The ribbon's words in both languages.
 *
 * Every caption the ribbon shows — the tab names, the group names under them and
 * the section words a trade's tab is divided by — is `t('<key>', '<English>')` at
 * the place it is written, with the Turkish in `locales/tr/editor.json`. English
 * is the source of truth: the call site holds it, and a key with no Turkish yet
 * still reads correctly.
 *
 * The two things these tests hold down:
 *
 *   1. Turkish, when the host gives the editor a Turkish translator.
 *   2. English, unchanged, character for character — the ribbon a person who
 *      never leaves English sees is the ribbon it was before this work.
 */
import { render, screen } from "@testing-library/react";
import { buildingModelRibbon, type BuildingModelRibbonContext } from "../src/editor/building-model-ribbon";
import { Ribbon } from "../src/editor/ribbon/Ribbon";
import { tradeTab } from "../src/editor/ribbon/trade-tab";
import type { RibbonGroup, RibbonTab } from "../src/editor/ribbon/types";
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

/** A project with a sheet in it, a coordination finding and the firm's library. */
function projectWithSheets(): Partial<BuildingModelRibbonContext> {
  return {
    hasSheets: true,
    coordination: { open: NOOP },
    history: { openVersions: NOOP, openResponsibilities: NOOP, openChangeOrders: NOOP },
    schedules: { views: [], newSchedule: NOOP, open: NOOP, openLibrary: NOOP, editBlocked: null },
  };
}

/** The ribbon with `language`'s translator, built exactly as the surface builds it. */
function ribbonIn(language: "en" | "tr", overrides: Partial<BuildingModelRibbonContext> = {}): readonly RibbonTab[] {
  return buildingModelRibbon(ribbonContext({ ...overrides, t: translateFor(language) }));
}

function tab(tabs: readonly RibbonTab[], id: string): RibbonTab {
  const found = tabs.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no ${id} tab in the ribbon: ${tabs.map((candidate) => candidate.id).join(", ")}`);
  return found;
}

function group(t: RibbonTab, id: string): RibbonGroup {
  const found = t.groups.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no ${id} group on the ${t.id} tab: ${t.groups.map((candidate) => candidate.id).join(", ")}`);
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
    expect(group(tab(tabs, "manage"), "project").label).toBe("Proje");
    expect(group(tab(tabs, "manage"), "groups-phases").label).toBe("Gruplar ve fazlar");
    expect(group(tab(tabs, "manage"), "coordinates").label).toBe("Koordinatlar");
  });

  test("names a group in Turkish when the project has a sheet open to print", () => {
    const tabs = ribbonIn("tr", projectWithSheets());
    // Nothing is open, so both captions say what it would take: a sheet to print.
    expect(captions(tabs, "sheets")).toEqual(["Seç", "Pafta", "Şekiller · önce bir pafta açın", "Yayın · yazdırmak için bir pafta açın"]);
    expect(group(tab(tabs, "manage"), "coordination").label).toBe("Koordinasyon");
    expect(captions(tabs, "manage")).toEqual(["Seç", "Proje", "Koordinatlar", "Gruplar ve fazlar", "Sürümler ve imza onayı", "Koordinasyon", "Kitaplık"]);
    expect(captions(tabs, "views")).toEqual(["Seç", "Oluştur", "Aç", "Grafikler", "Kırp", "Çizelgeler"]);
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

  test("keeps them when the project has a sheet, a coordination finding and a library", () => {
    const tabs = ribbonIn("en", projectWithSheets());
    expect(captions(tabs, "sheets")).toEqual(["Select", "Sheet", "Figures · open a sheet first", "Issue · open a sheet to print it"]);
    expect(captions(tabs, "manage")).toEqual(["Select", "Project", "Coordinates", "Groups & phases", "Versions & sign-off", "Coordination", "Library"]);
    expect(captions(tabs, "views")).toEqual(["Select", "Create", "Open", "Graphics", "Crop", "Schedules"]);
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

  test("names a group's More button in the language of the group", () => {
    draw(ribbonIn("tr"), "tr", "sheets");
    // Sheet has six controls: the last two fold under More.
    expect(screen.getByRole("button", { name: "pafta grubunda daha fazla araç" })).toBeTruthy();
  });

  test("names it in English in English", () => {
    draw(ribbonIn("en"), "en", "sheets");
    expect(screen.getByRole("button", { name: "More sheet tools" })).toBeTruthy();
  });

  test("still reads English when the host gave it no translator", () => {
    // A host that has not wired `<I18nProvider>` yet (the hosted editor) must see
    // the English ribbon, never blank captions.
    render(
      <TooltipProvider>
        <Ribbon tabs={ribbonIn("en")} value="views" onValueChange={NOOP} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId("ribbon-tab-views")).toHaveTextContent("Views");
    expect(screen.getByTestId("ribbon-group-create")).toHaveTextContent("Create");
  });
});
