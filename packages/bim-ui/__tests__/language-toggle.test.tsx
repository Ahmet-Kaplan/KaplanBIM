/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import type { i18n as I18nInstance } from "i18next";
import { I18nProvider, LanguageToggle, MutinyThemeProvider, type MutinyLanguage, type MutinyPresentation } from "../src";

/** Reaches the provider's i18next instance, so a test can make one switch fail. */
function InstanceProbe({ onInstance }: { onInstance: (instance: I18nInstance) => void }) {
  const { i18n } = useTranslation();
  useLayoutEffect(() => {
    onInstance(i18n);
  }, [i18n, onInstance]);
  return null;
}

function renderToggle(
  language: MutinyLanguage,
  options: { presentation?: MutinyPresentation; onLanguageChange?: (next: MutinyLanguage) => void; onInstance?: (instance: I18nInstance) => void } = {},
) {
  return render(
    <MutinyThemeProvider presentation={options.presentation ?? "standalone"}>
      <I18nProvider language={language} onLanguageChange={options.onLanguageChange}>
        <LanguageToggle />
        {options.onInstance ? <InstanceProbe onInstance={options.onInstance} /> : null}
      </I18nProvider>
    </MutinyThemeProvider>,
  );
}

describe("LanguageToggle", () => {
  afterEach(() => {
    document.documentElement.lang = "";
  });

  it("renders EN and TR options and marks the active one", () => {
    renderToggle("tr");
    expect(screen.getByRole("radio", { name: "Türkçe" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("mutiny-language-tr")).toHaveTextContent("Türkçe");
    expect(screen.getByTestId("mutiny-language-en")).toHaveTextContent("English");
  });

  it("clicking TR calls setLanguage('tr')", () => {
    const changes: MutinyLanguage[] = [];
    renderToggle("en", { onLanguageChange: (next) => changes.push(next) });
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");

    act(() => {
      fireEvent.click(screen.getByTestId("mutiny-language-tr"));
    });

    expect(changes).toEqual(["tr"]);
    expect(screen.getByRole("radio", { name: "Türkçe" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.lang).toBe("tr");
  });

  it("a second click on the active language keeps it, instead of clearing the choice", () => {
    const changes: MutinyLanguage[] = [];
    renderToggle("tr", { onLanguageChange: (next) => changes.push(next) });

    act(() => {
      fireEvent.click(screen.getByTestId("mutiny-language-tr"));
    });

    expect(changes).toEqual([]);
    expect(screen.getByRole("radio", { name: "Türkçe" })).toHaveAttribute("aria-checked", "true");
  });

  it("renders nothing when embedded", () => {
    renderToggle("en", { presentation: "embedded" });
    expect(screen.queryByTestId("mutiny-language-toggle")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("every visible label is translated in tr", () => {
    const { unmount } = renderToggle("en");
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
    // A language name is written in its own language, in both locales.
    expect(screen.getByRole("radio", { name: "English" })).toBeInTheDocument();
    unmount();

    renderToggle("tr");
    expect(screen.getByRole("radiogroup", { name: "Dil" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Türkçe" })).toBeInTheDocument();
  });

  it("says so when the switch fails, and goes back to the language on screen", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    let instance: I18nInstance | undefined;
    renderToggle("en", { onInstance: (next) => (instance = next) });
    if (!instance) throw new Error("no i18next instance");
    jest.spyOn(instance, "changeLanguage").mockRejectedValueOnce(new Error("offline"));

    act(() => {
      fireEvent.click(screen.getByTestId("mutiny-language-tr"));
    });

    await waitFor(() => expect(screen.getByTestId("mutiny-language-error")).toHaveAttribute("aria-label", expect.stringContaining("Couldn't switch language")));
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    consoleError.mockRestore();
  });
});
