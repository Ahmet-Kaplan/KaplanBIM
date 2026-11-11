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
