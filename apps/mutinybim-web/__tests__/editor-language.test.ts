/**
 * The hosted editor's language wiring.
 *
 * The editor takes its words from `<I18nProvider>`; without one every editor
 * string falls back to its English default and the stage is invisible in the
 * product. `entry.tsx` reads the language out of the server's page data, but it
 * also opens a model host and mounts the app, so the wiring lives in
 * `client/editor-language.tsx` where a test can reach it.
 *
 * The probe is the editor's own hook (`useEditorTranslate`), so this checks the
 * whole chain the ribbon uses: page data → provider → editor translator → a
 * ribbon word that must come out Turkish.
 */
import { createElement, type ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useMutinyLanguage, type MutinyLanguage } from "@permitzip/bim-ui";
import { useEditorTranslate } from "@permitzip/bim-editor/editor/i18n/translate";
import { useSchedulesTranslate } from "@permitzip/bim-schedules-ui";
import { EditorLanguageProvider, editorPageLanguage } from "../client/editor-language";

/** The provider, as `entry.tsx` mounts it: the page's language and the tree under it. */
function withLanguage(language: MutinyLanguage, node: ReactElement, onLanguageChange?: (next: MutinyLanguage) => void): ReactElement {
  return createElement(EditorLanguageProvider, { language, ...(onLanguageChange === undefined ? {} : { onLanguageChange }), children: node });
}

/** One word out of the editor's ribbon, drawn the way the ribbon draws it. */
function RibbonWord() {
  const t = useEditorTranslate();
  return createElement("span", { "data-testid": "word" }, t("ribbon.tab.views", "Views", { ns: "editor" }));
}

/**
 * One word out of the schedule surfaces, drawn the way `ScheduleGrid` draws it.
 *
 * This is the check the stage was missing: the schedules package ships its own
 * namespace (`schedulesResources`), and a host that passes only `editorResources`
 * gets English back for all 360 of its keys while every package test still passes
 * — the package's own tests wrap the surfaces themselves.
 */
function ScheduleWord() {
  const t = useSchedulesTranslate();
  return createElement("span", { "data-testid": "schedule-word" }, t("grid.columns", "Columns", { ns: "schedules" }));
}

/** The language picker the editor's bar will carry: it changes the provider's language. */
function WithPicker() {
  const { setLanguage } = useMutinyLanguage();
  return createElement("span", null, createElement("button", { type: "button", "data-testid": "switch", onClick: () => setLanguage("tr") }, "Türkçe"), createElement(RibbonWord));
}

describe("the language the editor page opens in", () => {
  test("is the language the server answered the page in", () => {
    expect(editorPageLanguage("tr")).toBe("tr");
    expect(editorPageLanguage("en")).toBe("en");
  });

  test("is English when the page data carries none, or carries nonsense", () => {
    // Older page data, a hand-edited value, a language MutinyBIM does not speak.
    expect(editorPageLanguage(undefined)).toBe("en");
    expect(editorPageLanguage(null)).toBe("en");
    expect(editorPageLanguage("")).toBe("en");
    expect(editorPageLanguage("tr-TR")).toBe("en");
    expect(editorPageLanguage("de")).toBe("en");
    expect(editorPageLanguage(42)).toBe("en");
  });
});

describe("the provider the hosted editor gives the editor", () => {
  test("draws the editor's words in Turkish", () => {
    render(withLanguage("tr", createElement(RibbonWord)));
    expect(screen.getByTestId("word")).toHaveTextContent("Görünümler");
  });

  test("draws them in English in English", () => {
    render(withLanguage("en", createElement(RibbonWord)));
    expect(screen.getByTestId("word")).toHaveTextContent("Views");
  });

  test("tells the host about a change, so it can keep it in state and in the account", () => {
    const changes: MutinyLanguage[] = [];
    render(
      withLanguage("en", createElement(WithPicker), (next) => {
        changes.push(next);
      }),
    );
    expect(screen.getByTestId("word")).toHaveTextContent("Views");
    fireEvent.click(screen.getByTestId("switch"));
    expect(changes).toEqual(["tr"]);
    // The tree is in the new language at once, before the host's prop comes back.
    expect(screen.getByTestId("word")).toHaveTextContent("Görünümler");
  });
});

describe("the schedules namespace reaches the product", () => {
  test("a schedule word comes out Turkish through the editor's own provider", () => {
    render(withLanguage("tr", createElement(ScheduleWord)));
    expect(screen.getByTestId("schedule-word").textContent).toBe("Sütunlar");
  });

  test("and is unchanged in English", () => {
    render(withLanguage("en", createElement(ScheduleWord)));
    expect(screen.getByTestId("schedule-word").textContent).toBe("Columns");
  });

  test("the provider is given both packages' Turkish, not the editor's alone", async () => {
    const { editorResources } = await import("@permitzip/bim-editor/editor/i18n/resources");
    const { schedulesResources } = await import("@permitzip/bim-schedules-ui");
    const { mergeResources } = await import("@permitzip/bim-ui");
    const merged = mergeResources(editorResources, schedulesResources);
    expect(Object.keys(merged.tr ?? {}).sort()).toEqual(["editor", "schedules"]);
    // Both halves are the real files, not empty shells: count the leaves, not the groups.
    const leaves = (node: unknown): number =>
      typeof node === "string" ? 1 : Object.values(node as Record<string, unknown>).reduce<number>((n, child) => n + leaves(child), 0);
    expect(leaves(merged.tr?.editor)).toBeGreaterThan(500);
    expect(leaves(merged.tr?.schedules)).toBeGreaterThan(300);
  });
});
