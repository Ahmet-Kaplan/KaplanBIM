"use client";

import { Button, Spinner } from "@permitzip/bim-ui";
import { Input, Textarea, NativeSelect, NativeSelectOption } from "./components/ui/fields";
import { useEffect, useId, useState } from "react";
import type { FormulaType, LibraryItemSummary, LibraryProviderPort, LibraryScope, OperandType, ScopeCapabilities } from "./ports";

import { Dialog } from "./ui/overlays";
import { useSchedulesTranslate } from "./i18n/translate";


/** `PZ.GasDemandBtuh`: publisher prefix, a dot, a name (B's `CALCULATION_KEY_PATTERN`). */
const CALCULATION_KEY_PATTERN = /^[A-Z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;

export function suggestCalculationKey(name: string, prefix = "PZ"): string {
  const words = name.replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const body = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return body ? `${prefix}.${/^[A-Za-z]/.test(body) ? body : `C${body}`}` : "";
}

function operand(t: FormulaType): OperandType {
  return t.type === "quantity" ? { valueType: "quantity", kind: t.kind, unit: t.unit } : { valueType: t.type };
}

function newId(): string {
  const c = globalThis.crypto;
  return c && "randomUUID" in c ? c.randomUUID() : `calc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SaveToLibraryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly provider: LibraryProviderPort;
  readonly expression: string;
  readonly result: FormulaType;
  /** Object classes the calculation applies to. */
  readonly appliesTo: readonly string[];
  readonly defaultName?: string;
  readonly onSaved?: (summary: LibraryItemSummary) => void;
}

type ScopeRow = LibraryScope & { readonly caps: ScopeCapabilities };

/**
 * "Save to firm library" (§3a): publishes a named calculation as revision 1
 * of a new library item. Libraries that can't take it are listed with the
 * reason, never hidden; refusals name the item and the fault.
 */
export function SaveToLibraryDialog({ open, onOpenChange, provider, expression, result, appliesTo, defaultName = "", onSaved }: SaveToLibraryDialogProps) {

  const ids = useId();
  const t = useSchedulesTranslate();
  const [scopes, setScopes] = useState<readonly ScopeRow[] | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState("");
  const [name, setName] = useState(defaultName);
  const [key, setKey] = useState(suggestCalculationKey(defaultName));
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string; problems?: readonly string[] } | null>(null);

  // Each opening starts fresh (reset during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setOutcome(null);
      setLoadError(null);
      setScopes(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      try {
        const list = await provider.scopes();
        const rows = await Promise.all(list.map(async (s) => ({ ...s, caps: await provider.capabilities(s.id) })));
        if (!live) return;
        setScopes(rows);
        const firstWritable = rows.find((r) => r.caps.publish && r.kind === "firm") ?? rows.find((r) => r.caps.publish);
        setScope(firstWritable?.id ?? "");
      } catch (err) {
        console.error("[SaveToLibraryDialog] loading libraries failed", err);

        if (live) setLoadError(t("save.loadFailed", "Couldn't load your libraries. Check your connection and try again.", { ns: "schedules" }));

      }
    })();
    return () => {
      live = false;
    };

  }, [open, provider, t]);

  const keyProblem =
    key === ""
      ? t("save.giveName", "Give the calculation a name.", { ns: "schedules" })
      : !CALCULATION_KEY_PATTERN.test(key)
        ? t("save.keyPattern", "Use a prefix, a dot and a name with no spaces, like PZ.GasDemandBtuh.", { ns: "schedules" })
        : null;
  const writable = scopes?.filter((s) => s.caps.publish) ?? [];
  const blocked = !provider.publish
    ? t("save.readOnly", "This library can only be read.", { ns: "schedules" })
    : writable.length === 0
      ? (scopes?.find((s) => s.caps.reason)?.caps.reason ?? t("save.cannotPublishAny", "You can't publish to any library here.", { ns: "schedules" }))
      : name.trim() === ""
        ? t("save.giveName", "Give the calculation a name.", { ns: "schedules" })
        : keyProblem;


  const publish = async () => {
    if (!provider.publish || blocked) return;
    setBusy(true);
    setOutcome(null);
    try {
      const res = await provider.publish(
        scope,
        { type: "formula", body: { id: newId(), revision: 1, key, name: name.trim(), expression, result: operand(result), appliesTo: [...appliesTo], params: [], ...(description.trim() ? { description: description.trim() } : {}) } },
        0,
      );
      if (res.ok) {

        const where = scopes?.find((s) => s.id === scope)?.name ?? t("save.theLibrary", "the library", { ns: "schedules" });
        setOutcome({
          ok: true,
          message: t("save.savedTo", "Saved to {{where}} as {{key}}, revision {{revision}}.", { ns: "schedules", where, key: res.summary.key, revision: res.summary.revision }),
        });

        onSaved?.(res.summary);
      } else {

        setOutcome({
          ok: false,
          message: res.message,
          ...(res.problems
            ? { problems: res.problems.map((p) => (p.line ? t("save.lineN", "Line {{n}}: {{message}}", { ns: "schedules", n: p.line, message: p.message }) : p.message)) }
            : {}),
        });

      }
    } catch (err) {
      console.error("[SaveToLibraryDialog] publish failed", err);

      setOutcome({ ok: false, message: t("save.noAnswer", "The library didn't answer, so nothing was saved. Try again.", { ns: "schedules" }) });

    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}

      title={t("save.title", "Save to firm library", { ns: "schedules" })}

      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>

{outcome?.ok ? t("save.done", "Done", { ns: "schedules" }) : t("save.cancel", "Cancel", { ns: "schedules" })}

          </Button>
          {!outcome?.ok ? (
            <Button variant="default" size="sm" disabled={busy || blocked !== null} aria-describedby={blocked ? `${ids}-blocked` : undefined} onClick={() => void publish()}>

{busy ? <Spinner /> : null} {t("save.publish", "Publish", { ns: "schedules" })}

            </Button>
          ) : null}
        </>
      }
    >
      <div className="mutiny-sched-section">
        <p className="mutiny-sched-help">

{t("save.helpBefore", "Everyone with access to the library can use", { ns: "schedules" })} <code>{expression}</code>{" "}
          {t("save.helpAfter", "in their schedules. Schedules that use it keep their own copy until they choose to update.", { ns: "schedules" })}

        </p>
        {loadError ? <p className="mutiny-sched-error">{loadError}</p> : null}
        {scopes === null && !loadError ? (
          <p className="mutiny-sched-muted">

<Spinner /> {t("save.loading", "Loading libraries…", { ns: "schedules" })}

          </p>
        ) : null}
        {scopes ? (
          <div className="mutiny-sched-field">

<label htmlFor={`${ids}-scope`}>{t("save.library", "Library", { ns: "schedules" })}</label>

            <NativeSelect id={`${ids}-scope`} value={scope} onChange={(e) => setScope(e.target.value)}>
              {scopes.map((s) => (
                <NativeSelectOption key={s.id} value={s.id} disabled={!s.caps.publish}>
                  {s.name}
                  {!s.caps.publish && s.caps.reason ? ` (${s.caps.reason})` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-name`}>{t("save.name", "Name", { ns: "schedules" })}</label>

          <Input
            id={`${ids}-name`}

            value={name}

            placeholder={t("save.namePlaceholder", "Gas demand (Btu/h)", { ns: "schedules" })}

            onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched) setKey(suggestCalculationKey(e.target.value));
            }}
          />
        </div>
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-key`}>{t("save.formulaName", "Formula name", { ns: "schedules" })}</label>

          <Input
            id={`${ids}-key`}

            value={key}
            aria-invalid={keyProblem !== null && key !== ""}
            aria-describedby={`${ids}-key-help`}
            onChange={(e) => {
              setKey(e.target.value);
              setKeyTouched(true);
            }}
          />
          <p id={`${ids}-key-help`} className={keyProblem && key !== "" ? "mutiny-sched-error" : "mutiny-sched-help"}>

{keyProblem && key !== "" ? keyProblem : t("save.formulaHelp", "How formulas call it, e.g. PZ.GasDemandBtuh({own.mbh}).", { ns: "schedules" })}

          </p>
        </div>
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-desc`}>{t("save.description", "Description (optional)", { ns: "schedules" })}</label>

          <Textarea id={`${ids}-desc`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {blocked && scopes ? (
          <p id={`${ids}-blocked`} className="mutiny-sched-help">
            {blocked}
          </p>
        ) : null}
        <div role="status" aria-live="polite">
          {outcome ? (
            <div className={outcome.ok ? "mutiny-sched-help" : "mutiny-sched-error"}>
              <p>{outcome.message}</p>
              {outcome.problems?.length ? (
                <ul>
                  {outcome.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
