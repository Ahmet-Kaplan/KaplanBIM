/**
 * The hosted editor's bar mounts the language control.
 *
 * `<LanguageToggle>` existed, was tested, and was mounted nowhere: the hosted bar
 * carried `<ThemeToggle />` and no way to change the language, so the Turkish the
 * whole stage added could only be reached from the settings page. This checks the
 * bar as the page mounts it — real `HostedBar`, real `<EditorLanguageProvider>` —
 * and presses the control: the editor's own word has to come out Turkish, and the
 * host has to be told, because saving it in the account is the host's job.
 */
import { createElement, type ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MutinyThemeProvider, type MutinyLanguage } from "@permitzip/bim-ui";
import { useEditorTranslate } from "@permitzip/bim-editor/editor/i18n/translate";
import { EditorLanguageProvider } from "../client/editor-language";
import { HostedBar, type HostedBarModel } from "../client/hosted-bar";

const MODEL: HostedBarModel = {
  modelId: "model-1",
  modelName: "Riverside Clinic",
  owner: null,
  access: "owner",
  quoteLabel: null,
};

/** One editor word, drawn the way the ribbon draws it, beside the bar as the editor is. */
function EditorWord() {
  const t = useEditorTranslate();
  return createElement("span", { "data-testid": "editor-word" }, t("ribbon.tab.views", "Views", { ns: "editor" }));
}

/** The page's tree around the bar, minus the socket and the model surface. */
function page(language: MutinyLanguage, onLanguageChange: (next: MutinyLanguage) => void, bar: HostedBarModel = MODEL): ReactElement {
  const under = [createElement(HostedBar, { key: "bar", model: bar }), createElement(EditorWord, { key: "word" })];
  return createElement(MutinyThemeProvider, {
    presentation: "standalone",
    children: createElement(EditorLanguageProvider, { language, onLanguageChange, children: under }),
  });
}

describe("the hosted bar's language control", () => {
  afterEach(() => {
    document.documentElement.lang = "";
  });

  test("is mounted in the bar, next to the theme control", () => {
    render(page("en", () => undefined));
    expect(screen.getByTestId("hosted-bar")).toContainElement(screen.getByTestId("mutiny-language-toggle"));
    expect(screen.getByTestId("hosted-bar")).toContainElement(screen.getByTestId("mutiny-theme-toggle"));
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  });

  test("pressing Türkçe draws the editor's words in Turkish at once", () => {
    const changes: MutinyLanguage[] = [];
    render(page("en", (next) => changes.push(next)));
    expect(screen.getByTestId("editor-word")).toHaveTextContent("Views");

    fireEvent.click(screen.getByTestId("mutiny-language-tr"));

    // The tree is Turkish before the host's prop comes back, and the host is told,
    // which is what writes it to the account.
    expect(screen.getByTestId("editor-word")).toHaveTextContent("Görünümler");
    expect(changes).toEqual(["tr"]);
    expect(screen.getByRole("radio", { name: "Türkçe" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.lang).toBe("tr");
  });

  test("pressing English goes back, and says so", () => {
    const changes: MutinyLanguage[] = [];
    render(page("tr", (next) => changes.push(next)));
    expect(screen.getByTestId("editor-word")).toHaveTextContent("Görünümler");

    fireEvent.click(screen.getByTestId("mutiny-language-en"));

    expect(screen.getByTestId("editor-word")).toHaveTextContent("Views");
    expect(changes).toEqual(["en"]);
  });
});
