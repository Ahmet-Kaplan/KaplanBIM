/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import type { i18n as I18nInstance } from "i18next";
import { I18nProvider, useMutinyLanguage, useT, type MutinyLanguage } from "../src";

/** Reaches the provider's i18next instance, so a test can make one switch fail. */
function InstanceProbe({ onInstance }: { onInstance: (instance: I18nInstance) => void }) {
  const { i18n } = useTranslation();
  useLayoutEffect(() => {
    onInstance(i18n);
  }, [i18n, onInstance]);
  return null;
}

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

function ErrorLine() {
  const { error } = useMutinyLanguage();
  return <span data-testid="error">{error ?? ""}</span>;
}

/** Every language the tree was committed with, in commit order. */
function LanguageLog({ log }: { log: MutinyLanguage[] }) {
  const { language } = useMutinyLanguage();
  useLayoutEffect(() => {
    log.push(language);
  });
  return <span data-testid="log-lang">{language}</span>;
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

  it("adopts a host-changed language in the same commit, without a stale frame", () => {
    const log: MutinyLanguage[] = [];
    const { rerender } = render(
      <I18nProvider language="en">
        <LanguageLog log={log} />
      </I18nProvider>,
    );
    expect(log).toEqual(["en"]);
    log.length = 0;

    rerender(
      <I18nProvider language="tr">
        <LanguageLog log={log} />
      </I18nProvider>,
    );

    // A `useEffect` sync would commit (and paint) one frame in `en` first, so the
    // very first commit after the prop change must already be Turkish.
    expect(log[0]).toBe("tr");
    expect(log).toEqual(["tr"]);
    expect(document.documentElement.lang).toBe("tr");
  });

  it("goes back to the previous language when the switch fails, and can be tried again", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    let instance: I18nInstance | undefined;

    render(
      <I18nProvider language="en">
        <Switch />
        <ErrorLine />
        <InstanceProbe onInstance={(next) => (instance = next)} />
      </I18nProvider>,
    );
    expect(screen.getByTestId("error")).toHaveTextContent("");
    if (!instance) throw new Error("no i18next instance");
    const failing = jest.spyOn(instance, "changeLanguage").mockRejectedValueOnce(new Error("offline"));

    act(() => {
      fireEvent.click(screen.getByTestId("switch"));
    });

    // The failed switch is undone: the reported language is the one the screen is really in.
    await waitFor(() => expect(screen.getByTestId("switch")).toHaveTextContent("en"));
    expect(screen.getByTestId("error")).toHaveTextContent("Couldn't switch language: offline");
    expect(document.documentElement.lang).toBe("en");
    expect(failing).toHaveBeenCalled();

    // ...and the `next === current` guard does not block a retry once it is back.
    const callsAfterFailure = failing.mock.calls.length;
    act(() => {
      fireEvent.click(screen.getByTestId("switch"));
    });
    expect(screen.getByTestId("switch")).toHaveTextContent("tr");
    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(failing.mock.calls.length).toBeGreaterThan(callsAfterFailure);
    consoleError.mockRestore();
  });

  it("clears a stale error when the host takes over the language", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    let instance: I18nInstance | undefined;

    const { rerender } = render(
      <I18nProvider language="en">
        <Switch />
        <ErrorLine />
        <InstanceProbe onInstance={(next) => (instance = next)} />
      </I18nProvider>,
    );
    if (!instance) throw new Error("no i18next instance");
    jest.spyOn(instance, "changeLanguage").mockRejectedValueOnce(new Error("offline"));

    act(() => {
      fireEvent.click(screen.getByTestId("switch"));
    });
    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("offline"));

    rerender(
      <I18nProvider language="tr">
        <Switch />
        <ErrorLine />
      </I18nProvider>,
    );

    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(screen.getByTestId("switch")).toHaveTextContent("tr");
    expect(document.documentElement.lang).toBe("tr");
  });
});
