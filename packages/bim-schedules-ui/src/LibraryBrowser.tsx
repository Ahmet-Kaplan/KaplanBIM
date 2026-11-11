"use client";

import { Button, Spinner } from "@permitzip/bim-ui";
import { Input, NativeSelect, NativeSelectOption, Checkbox } from "./components/ui/fields";
import { useCallback, useEffect, useId, useState } from "react";
import type { LibraryItemSummary, LibraryItemType, LibraryProviderPort, LibraryScope, ScopeCapabilities } from "./ports";

import { NewFieldForm } from "./NewFieldForm";
import { useSchedulesTranslate, type Translate } from "./i18n/translate";



/**
 * What a kind of library item is called, singular and plural, in the language on
 * screen. A builder rather than a constant: a heading left in a table is the one
 * caption nobody can translate.
 */
function typeLabels(t: Translate): Readonly<Record<LibraryItemType, { one: string; many: string }>> {
  return {
    formula: { one: t("library.typeFormula", "calculation", { ns: "schedules" }), many: t("library.typeFormulaMany", "Calculations", { ns: "schedules" }) },
    field: { one: t("library.typeField", "shared field", { ns: "schedules" }), many: t("library.typeFieldMany", "Shared fields", { ns: "schedules" }) },
    schedule_template: { one: t("library.typeScheduleTemplate", "schedule template", { ns: "schedules" }), many: t("library.typeScheduleTemplateMany", "Schedule templates", { ns: "schedules" }) },
    unit_profile: { one: t("library.typeUnitProfile", "display profile", { ns: "schedules" }), many: t("library.typeUnitProfileMany", "Display profiles", { ns: "schedules" }) },
    class: { one: t("library.typeClass", "object class", { ns: "schedules" }), many: t("library.typeClassMany", "Object classes", { ns: "schedules" }) },
    relationship: { one: t("library.typeRelationship", "relationship", { ns: "schedules" }), many: t("library.typeRelationshipMany", "Relationships", { ns: "schedules" }) },
    tag_type: { one: t("library.typeTagType", "tag type", { ns: "schedules" }), many: t("library.typeTagTypeMany", "Tag types", { ns: "schedules" }) },
    discipline: { one: t("library.typeDiscipline", "discipline", { ns: "schedules" }), many: t("library.typeDisciplineMany", "Disciplines", { ns: "schedules" }) },
    element_type: { one: t("library.typeElementType", "type", { ns: "schedules" }), many: t("library.typeElementTypeMany", "Types", { ns: "schedules" }) },
  };
}


export interface LibraryBrowserProps {
  readonly provider: LibraryProviderPort;
  /** Types offered in the "Show" picker, first is the default. */
  readonly types?: readonly LibraryItemType[];
  /** "Use" on an item (insert a calculation, start from a template). Absent: browse only. */
  readonly onUse?: (item: LibraryItemSummary) => void;
  readonly useLabel?: string;
}

type Load = { readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly items: readonly LibraryItemSummary[] };

/**
 * Browses library items by scope (built-in, firm, project) and type, with
 * search. Shows loading, empty, error and read-only states in plain words.
 */

export function LibraryBrowser({ provider, types = ["formula", "schedule_template", "field"], onUse, useLabel }: LibraryBrowserProps) {
  const ids = useId();
  const t = useSchedulesTranslate();
  const use = useLabel ?? t("library.use", "Use", { ns: "schedules" });

  const [scopes, setScopes] = useState<readonly LibraryScope[] | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [scope, setScope] = useState("");
  const [type, setType] = useState<LibraryItemType>(types[0] ?? "formula");
  const [text, setText] = useState("");
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [loaded, setLoaded] = useState<{ readonly key: string; readonly load: Load } | null>(null);
  const [caps, setCaps] = useState<ScopeCapabilities | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    provider
      .scopes()
      .then((list) => {
        if (!live) return;
        setScopes(list);
        setScope((s) => s || (list.find((x) => x.kind === "firm") ?? list[0])?.id || "");
      })
      .catch((err: unknown) => {
        console.error("[LibraryBrowser] scopes failed", err);

if (live) setScopeError(t("library.scopesFailed", "Couldn't load your libraries. Check your connection and try again.", { ns: "schedules" }));

      });
    return () => {
      live = false;
    };
  }, [provider, attempt]);

  // Results belong to the query that asked for them; anything else is still loading.
  const queryKey = JSON.stringify([scope, type, text.trim(), showDeprecated, attempt]);
  const load: Load = loaded && loaded.key === queryKey ? loaded.load : { kind: "loading" };

  useEffect(() => {
    if (!scope) return;
    let live = true;
    Promise.all([provider.list(scope, { type, ...(text.trim() ? { text: text.trim() } : {}), includeDeprecated: showDeprecated }), provider.capabilities(scope)])
      .then(([items, c]) => {
        if (!live) return;
        setLoaded({ key: queryKey, load: { kind: "ready", items } });
        setCaps(c);
      })
      .catch((err: unknown) => {
        console.error("[LibraryBrowser] list failed", err);

if (live) setLoaded({ key: queryKey, load: { kind: "error", message: t("library.listFailed", "Couldn't load this library. Try again.", { ns: "schedules" }) } });

      });
    return () => {
      live = false;
    };

}, [provider, scope, type, text, showDeprecated, attempt, queryKey, t]);


  const retry = useCallback(() => {
    setScopeError(null);
    setAttempt((n) => n + 1);
  }, []);


const scopeName = scopes?.find((s) => s.id === scope)?.name ?? t("library.thisLibrary", "this library", { ns: "schedules" });
  const label = typeLabels(t)[type];


  if (scopeError) {
    return (

<div className="mutiny-sched-section" role="region" aria-label={t("library.region", "Library", { ns: "schedules" })}>
        <p className="mutiny-sched-error">{scopeError}</p>
        <Button variant="outline" size="sm" onClick={retry}>
          {t("library.tryAgain", "Try again", { ns: "schedules" })}
        </Button>
      </div>

    );
  }

  return (

<div className="mutiny-sched-section" role="region" aria-label={t("library.region", "Library", { ns: "schedules" })}>
      <div className="mutiny-sched-row">
        <div className="mutiny-sched-field">
          <label htmlFor={`${ids}-scope`}>{t("library.library", "Library", { ns: "schedules" })}</label>

          <NativeSelect id={`${ids}-scope`} value={scope} disabled={!scopes} onChange={(e) => setScope(e.target.value)}>
            {(scopes ?? []).map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {types.length > 1 ? (
          <div className="mutiny-sched-field">

<label htmlFor={`${ids}-type`}>{t("library.show", "Show", { ns: "schedules" })}</label>

            <NativeSelect id={`${ids}-type`} value={type} onChange={(e) => {
                const next = types.find((t) => t === e.target.value);
                if (next) setType(next);
              }}
            >

{types.map((kind) => (
                <NativeSelectOption key={kind} value={kind}>
                  {typeLabels(t)[kind].many}
                </NativeSelectOption>
              ))}

            </NativeSelect>
          </div>
        ) : null}
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-q`}>{t("library.search", "Search", { ns: "schedules" })}</label>
          <Input
            id={`${ids}-q`}
            type="search"
            placeholder={t("library.searchPlaceholder", "Name or formula name", { ns: "schedules" })}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

        </div>
      </div>
      <label className="mutiny-sched-row">

<Checkbox checked={showDeprecated} onChange={(e) => setShowDeprecated(e.target.checked)} />{" "}
        {t("library.includeRetired", "Include retired items", { ns: "schedules" })}

      </label>

{caps && !caps.publish ? (
        <p className="mutiny-sched-help">{caps.reason ?? t("library.readOnly", "{{name}} is read-only here.", { ns: "schedules", name: scopeName })}</p>
      ) : null}

      {type === "field" && provider.publish ? (
        adding && caps?.publish ? (
          <NewFieldForm
            provider={provider}
            scope={scope}
            scopeName={scopeName}
            onCancel={() => setAdding(false)}
            onPublished={() => {
              setAdding(false);
              retry();
            }}
          />
        ) : (
          <div className="mutiny-sched-row">

<Button
              size="sm"
              variant="outline"
              disabled={!caps?.publish}
              title={caps?.publish ? undefined : (caps?.reason ?? t("library.readOnly", "{{name}} is read-only here.", { ns: "schedules", name: scopeName }))}
              onClick={() => setAdding(true)}
              data-testid="library-add-field"
            >
              {t("library.newField", "New field", { ns: "schedules" })}
            </Button>

          </div>
        )
      ) : null}
      {load.kind === "loading" ? (
        <p className="mutiny-sched-muted" role="status">

<Spinner /> {t("library.loading", "{{types}} loading…", { ns: "schedules", types: label.many.toLowerCase() })}

        </p>
      ) : load.kind === "error" ? (
        <div>

<p className="mutiny-sched-error">{load.message}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            {t("library.tryAgain", "Try again", { ns: "schedules" })}
          </Button>

        </div>
      ) : load.items.length === 0 ? (

<p className="mutiny-sched-muted">
          {text.trim()
            ? t("library.noMatch", "No {{types}} in {{scope}} match “{{query}}”.", { ns: "schedules", types: label.many.toLowerCase(), scope: scopeName, query: text.trim() })
            : t("library.noneYet", "{{scope}} has no {{types}} yet.", { ns: "schedules", scope: scopeName, types: label.many.toLowerCase() })}
        </p>

      ) : (

<ul className="mutiny-sched-list" aria-label={t("library.listAria", "{{types}} in {{scope}}", { ns: "schedules", types: label.many, scope: scopeName })}>

          {load.items.map((item) => (
            <li key={item.id} className="mutiny-sched-list-item">
              <div className="mutiny-sched-grow">
                <div>{item.name}</div>
                <div className="mutiny-sched-muted">

<code>{item.key}</code> · {t("library.revision", "revision {{n}}", { ns: "schedules", n: item.revision })}

                </div>
              </div>

{item.deprecated ? <span className="mutiny-sched-badge">{t("library.retired", "Retired", { ns: "schedules" })}</span> : null}

              {onUse ? (

<Button variant="outline" size="sm" aria-label={`${use} ${item.name}`} onClick={() => onUse(item)}>
                  {use}
                </Button>

              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
