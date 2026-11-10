/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider, useMutinyLanguage, useT, type MutinyLanguage } from "../src";

function Greet() {
  const t = useT("common");
  return <span data-testid="greet">{t("greet", "Hello")}</span>;
}

function LanguageLabel() {
  const t = useT();
  return <span data-testid="label">{t("language.label", "Language")}</span>;
}

function Switch() {
  const { language, setLanguage } = useMutinyLanguage();
  return (
    <button data-testid="switch" onClick={() => setLanguage(language === "tr" ? "en" : "tr")}>
      {language}
    </button>
  );
}

describe("I18nProvider", () => {
  afterEach(() => {
    document.documentElement.lang = "";
  });

  it("useT returns the active language's string and re-renders on change", () => {
    render(
      <I18nProvider language="tr" resources={{ tr: { common: { greet: "Merhaba" } } }}>
        <Greet />
        <Switch />
      </I18nProvider>,
    );
    expect(screen.getByTestId("greet")).toHaveTextContent("Merhaba");
    expect(screen.getByTestId("switch")).toHaveTextContent("tr");

    act(() => {
      fireEvent.click(screen.getByTestId("switch"));
    });

    expect(screen.getByTestId("switch")).toHaveTextContent("en");
    expect(screen.getByTestId("greet")).toHaveTextContent("Hello");
  });

  it("serves the bundled Turkish common namespace and falls back to English", () => {
    const { unmount } = render(
      <I18nProvider language="tr">
        <LanguageLabel />
      </I18nProvider>,
    );
    expect(screen.getByTestId("label")).toHaveTextContent("Dil");
    unmount();

    render(
      <I18nProvider language="en">
        <LanguageLabel />
      </I18nProvider>,
    );
    expect(screen.getByTestId("label")).toHaveTextContent("Language");
  });

  it("tells the host and the document about a language change", () => {
    const changes: MutinyLanguage[] = [];
    render(
      <I18nProvider language="en" onLanguageChange={(next) => changes.push(next)}>
        <Switch />
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe("en");

    act(() => {
      fireEvent.click(screen.getByTestId("switch"));
    });

    expect(changes).toEqual(["tr"]);
    expect(document.documentElement.lang).toBe("tr");
  });

  it("follows the language prop when the host owns it", () => {
    const { rerender } = render(
      <I18nProvider language="en">
        <LanguageLabel />
      </I18nProvider>,
    );
    expect(screen.getByTestId("label")).toHaveTextContent("Language");

    rerender(
      <I18nProvider language="tr">
        <LanguageLabel />
      </I18nProvider>,
    );
    expect(screen.getByTestId("label")).toHaveTextContent("Dil");
  });

  it("refuses to hand out language state outside a provider", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Switch />)).toThrow(/I18nProvider/);
    error.mockRestore();
  });
});
