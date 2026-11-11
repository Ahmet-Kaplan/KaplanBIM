"use client";

import { Button } from "@permitzip/bim-ui";
import { useId, useMemo, useState } from "react";
import { Checkbox, Input, NativeSelect, NativeSelectOption, Textarea } from "./components/ui/fields";
import type { ExpandPaper, FilterOp, ScheduleColumnDef, ScheduleDefinitionV2, ScheduleFilter } from "./contracts";
import { LibraryBrowser } from "./LibraryBrowser";
import type { CatalogField, FormulaEnginePort, FormulaError, FormulaSchema, FormulaType, LibraryProviderPort, ScheduleCatalog } from "./ports";
import { SaveToLibraryDialog } from "./SaveToLibrary";
import { Sheet } from "./ui/overlays";
import { useSchedulesTranslate, type Translate } from "./i18n/translate";
import { rollUpLabel, scheduleFieldLabel } from "./i18n/words";

export type BuilderSectionId = "source" | "fields" | "formulas" | "filters" | "arrange" | "paper";

/** A discipline the catalog didn't label, in the id's own words (`firm:site_work` → "Site work"); never the raw id. */
function disciplineWords(id: string): string {
  const words = id.replace(/^[a-z]+:/, "").replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

/** The conditions a filter can test, in the language on screen. */
function filterOps(t: Translate): readonly { readonly value: FilterOp; readonly label: string; readonly needsValue: boolean }[] {
  return [
    { value: "equals", label: t("builder.opIs", "is", { ns: "schedules" }), needsValue: true },
    { value: "not_equals", label: t("builder.opIsNot", "is not", { ns: "schedules" }), needsValue: true },
    { value: "contains", label: t("builder.opContains", "contains", { ns: "schedules" }), needsValue: true },
    { value: "greater_than", label: t("builder.opMoreThan", "is more than", { ns: "schedules" }), needsValue: true },
    { value: "less_than", label: t("builder.opLessThan", "is less than", { ns: "schedules" }), needsValue: true },
    { value: "present", label: t("builder.opHasValue", "has a value", { ns: "schedules" }), needsValue: false },
    { value: "absent", label: t("builder.opIsEmpty", "is empty", { ns: "schedules" }), needsValue: false },
  ];
}

export function emptyDefinition(name = "New schedule"): ScheduleDefinitionV2 {
  return {
    name,
    source: { kind: "classes", classes: [], includeSubclasses: true },
    columns: [],
    filters: [],
    sort: [],
    groups: [],
    grandTotals: false,
    itemize: true,
    presentation: { kind: "list" },
    display: { textSizeMm: 2.5, emptyText: "" },
  };
}

export interface ScheduleBuilderProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly catalog: ScheduleCatalog;
  readonly formulaEngine: FormulaEnginePort;
  readonly library?: LibraryProviderPort;
  readonly initial?: ScheduleDefinitionV2;
  /** Section to land on (Fields / Arrange in the grid toolbar). */
  readonly section?: BuilderSectionId;
  readonly onSave: (definition: ScheduleDefinitionV2) => void | Promise<void>;
}

/** The excerpt with the offending span marked, so the fault is at the cursor (heuristics 5, 9). */
function SpanView({ source, error }: { source: string; error: FormulaError }) {
  const { start, end } = error.span;
  const s = Math.max(0, Math.min(start, source.length));
  const e = Math.max(s, Math.min(end === start ? start + 1 : end, source.length));
  return (
    <p className="mutiny-sched-error-span" aria-hidden>
      {source.slice(0, s)}
      <mark>{source.slice(s, e) || " "}</mark>
      {source.slice(e)}
    </p>
  );
}

let columnSeq = 0;
const nextColumnId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(columnSeq++).toString(36)}`;

/**
 * The schedule builder (§7): what to list, columns (fields, formulas, library
 * calculations), filters, sort / group / totals and paper. Formulas check as
 * you type; a unit mismatch is refused inline with the offending span.
 */
export function ScheduleBuilder({ open, onOpenChange, catalog, formulaEngine, library, initial, section, onSave }: ScheduleBuilderProps) {
  const ids = useId();
  const [draft, setDraft] = useState<ScheduleDefinitionV2>(initial ?? emptyDefinition());
  const [fieldQuery, setFieldQuery] = useState("");
  const [formulaHeading, setFormulaHeading] = useState("");
  const [expression, setExpression] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const t = useSchedulesTranslate();

  // Each opening starts from the schedule as it is now (reset during render, not in an effect).
  const [openedWith, setOpenedWith] = useState<{ open: boolean; initial: ScheduleDefinitionV2 | undefined }>({ open, initial });
  if (openedWith.open !== open || openedWith.initial !== initial) {
    setOpenedWith({ open, initial });
    if (open) {
      setDraft(initial ?? emptyDefinition());
      setSaveError(null);
    }
  }

  const classes = useMemo<readonly string[]>(() => (draft.source.kind === "classes" ? draft.source.classes : []), [draft.source]);
  const fields = useMemo(() => catalog.fieldsFor(classes), [catalog, classes]);
  const fieldByPath = useMemo(() => new Map(fields.map((f) => [f.path, f] as const)), [fields]);
  const relationships = useMemo(() => catalog.relationshipsFor(classes), [catalog, classes]);

  const schema = useMemo<FormulaSchema>(
    () => ({
      field(path) {
        const f = fieldByPath.get(path);
        if (!f) return undefined;
        const type: FormulaType = f.valueType === "quantity" && f.kind && f.unit ? { type: "quantity", kind: f.kind, unit: f.unit } : f.valueType === "boolean" ? { type: "boolean" } : { type: "text" };
        return { type, label: f.label.toLowerCase() };
      },
      relationship: () => undefined,
    }),
    [fieldByPath],
  );

  const check = useMemo(() => (expression.trim() ? formulaEngine.compile(expression, schema) : null), [expression, schema, formulaEngine]);
  const firstError = check && !check.ok ? (check.errors[0] ?? null) : null;

  const byDiscipline = useMemo(() => {
    const groups = new Map<string, { label: string; list: { id: string; label: string }[] }>();
    for (const c of catalog.classes()) {
      const group = groups.get(c.discipline) ?? { label: c.disciplineLabel ?? disciplineWords(c.discipline), list: [] };
      group.list.push({ id: c.id, label: c.label });
      groups.set(c.discipline, group);
    }
    return [...groups.entries()];
  }, [catalog]);

  const update = (patch: Partial<ScheduleDefinitionV2>) => setDraft((d) => ({ ...d, ...patch }));
  const setClasses = (next: readonly string[]) => update({ source: { kind: "classes", classes: next, includeSubclasses: draft.source.kind === "classes" ? draft.source.includeSubclasses : true } });

  const usedPaths = new Set(draft.columns.flatMap((c) => (c.kind === "field" || c.kind === "parameter" ? [c.path] : [])));
  const q = fieldQuery.trim().toLowerCase();
  const available = fields.filter((f) => !usedPaths.has(f.path) && (!q || f.label.toLowerCase().includes(q) || f.path.includes(q)));

  const headingOf = (c: ScheduleColumnDef): string => {
    if (c.heading) return scheduleFieldLabel(c.heading, t);
    if (c.kind === "field" || c.kind === "parameter") return scheduleFieldLabel(fieldByPath.get(c.path)?.label ?? c.path, t);
    if (c.kind === "formula") return c.calculation ?? c.expression;
    // A related-item column reads "total of pipes": the English keeps its word order, and a
    // language that orders it the other way says so in its own value (`tr` reads
    // "{{relationship}} · {{fn}}"). Both halves are words, so neither is glued on.
    if (c.kind === "aggregate")
      return t("builder.aggregateHeading", "{{fn}} of {{relationship}}", { ns: "schedules", relationship: c.relationship, fn: rollUpLabel(c.fn, t).toLowerCase() });
    return c.relationship;
  };

  const totalRefusal = (c: ScheduleColumnDef): string | null => {
    if (c.kind === "expand") return t("builder.subListsNotTotalled", "Sub-lists aren't totalled; total a column inside them instead.", { ns: "schedules" });
    if (c.kind === "field" || c.kind === "parameter") {
      const f = fieldByPath.get(c.path);
      if (!f) return null;
      if (f.totalRefusedReason) return f.totalRefusedReason;
      const name = scheduleFieldLabel(f.label, t);
      if (f.valueType !== "quantity") return t("builder.textHasNoTotal", "{{name}} is text, so it has no total.", { ns: "schedules", name });
      if (f.aggregation === "none") return t("builder.valuesNotAdded", "{{name}} values aren't added together.", { ns: "schedules", name });
    }
    return null;
  };

  const move = (index: number, delta: number) => {
    const next = [...draft.columns];
    const [col] = next.splice(index, 1);
    if (!col) return;
    next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, col);
    update({ columns: next });
  };

  const addField = (f: CatalogField) => update({ columns: [...draft.columns, { id: nextColumnId("f"), kind: f.editable ? "parameter" : "field", path: f.path }] });

  const addFormula = () => {
    if (!check?.ok) return;
    update({ columns: [...draft.columns, { id: nextColumnId("calc"), kind: "formula", expression, ...(formulaHeading.trim() ? { heading: formulaHeading.trim() } : {}) }] });
    setExpression("");
    setFormulaHeading("");
  };

  const addFormulaBlocked = !expression.trim()
    ? t("builder.typeFormulaFirst", "Type a formula first.", { ns: "schedules" })
    : firstError
      ? t("builder.fixFormulaFirst", "Fix the formula first.", { ns: "schedules" })
      : null;
  const saveBlocked =
    classes.length === 0
      ? t("builder.chooseOneKind", "Choose at least one kind of item to list.", { ns: "schedules" })
      : draft.columns.length === 0
        ? t("builder.addOneColumn", "Add at least one column.", { ns: "schedules" })
        : draft.name.trim() === ""
          ? t("builder.giveName", "Give the schedule a name.", { ns: "schedules" })
          : null;
  const hasExpand = draft.columns.some((c) => c.kind === "expand");
  const expandCol = draft.columns.find((c): c is Extract<ScheduleColumnDef, { kind: "expand" }> => c.kind === "expand");

  const save = async () => {
    if (saveBlocked) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      onOpenChange(false);
    } catch (err) {
      console.error("[ScheduleBuilder] save failed", err);
      setSaveError(
        err instanceof Error
          ? t("builder.notSaved", "Not saved: {{reason}}", { ns: "schedules", reason: err.message })
          : t("builder.notSavedTry", "Not saved. Try again.", { ns: "schedules" }),
      );
    } finally {
      setSaving(false);
    }
  };

  const setFilter = (i: number, patch: Partial<ScheduleFilter>) => update({ filters: draft.filters.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={initial ? t("builder.editTitle", "Edit {{name}}", { ns: "schedules", name: initial.name }) : t("builder.newTitle", "New schedule", { ns: "schedules" })}
        description={t("builder.description", "Choose what this schedule lists, its columns and how it reads on paper.", { ns: "schedules" })}
        initialFocusId={section ? `${ids}-${section}` : undefined}
        footer={
          <>
            {saveBlocked ? <span className="mutiny-sched-help">{saveBlocked}</span> : null}
            {saveError ? (
              <span className="mutiny-sched-error" role="alert">
                {saveError}
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t("builder.cancel", "Cancel", { ns: "schedules" })}
            </Button>
            <Button variant="default" size="sm" disabled={saveBlocked !== null || saving} onClick={() => void save()}>
              {saving ? t("builder.saving", "Saving…", { ns: "schedules" }) : t("builder.save", "Save schedule", { ns: "schedules" })}
            </Button>
          </>
        }
      >
        <section className="mutiny-sched-section" aria-labelledby={`${ids}-source`}>
          <h3 id={`${ids}-source`} tabIndex={-1} className="mutiny-sched-section-title">
            {t("builder.whatToList", "What to list", { ns: "schedules" })}
          </h3>
          <div className="mutiny-sched-field">
            <label htmlFor={`${ids}-name`}>{t("builder.scheduleName", "Schedule name", { ns: "schedules" })}</label>
            <Input id={`${ids}-name`} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          {byDiscipline.map(([discipline, { label: disciplineHeading, list }]) => (
            <fieldset key={discipline} className="mutiny-sched-section">
              <legend className="mutiny-sched-discipline">{disciplineHeading}</legend>
              <div className="mutiny-sched-row">
                {list.map((c) => (
                  <label key={c.id} className="mutiny-sched-row">
                    <Checkbox checked={classes.includes(c.id)} onChange={(e) => setClasses(e.target.checked ? [...classes, c.id] : classes.filter((x) => x !== c.id))} /> {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {draft.source.kind === "classes" ? (
            <label className="mutiny-sched-row">
              <Checkbox checked={draft.source.includeSubclasses} onChange={(e) => update({ source: { kind: "classes", classes, includeSubclasses: e.target.checked } })} />{" "}
              {t("builder.includeSubclasses", "Include more specific kinds (a pump schedule also lists booster pumps)", { ns: "schedules" })}
            </label>
          ) : null}
        </section>

        <section className="mutiny-sched-section" aria-labelledby={`${ids}-fields`}>
          <h3 id={`${ids}-fields`} tabIndex={-1} className="mutiny-sched-section-title">
            {t("builder.columns", "Columns", { ns: "schedules" })}
          </h3>
          {draft.columns.length === 0 ? <p className="mutiny-sched-muted">{t("builder.noColumns", "No columns yet. Add fields or a calculation below.", { ns: "schedules" })}</p> : null}
          <ul className="mutiny-sched-list" aria-label={t("builder.columnsList", "Columns in this schedule", { ns: "schedules" })}>
            {draft.columns.map((c, i) => {
              const refusal = totalRefusal(c);
              const heading = headingOf(c);
              return (
                <li key={c.id} className="mutiny-sched-list-item">
                  <span className="mutiny-sched-grow">{heading}</span>
                  <span className="mutiny-sched-badge">
                    {c.kind === "formula"
                      ? t("builder.badgeCalculation", "Calculation", { ns: "schedules" })
                      : c.kind === "expand"
                        ? t("builder.badgeSubList", "Sub-list", { ns: "schedules" })
                        : c.kind === "aggregate"
                          ? t("builder.badgeTotal", "Total", { ns: "schedules" })
                          : t("builder.badgeField", "Field", { ns: "schedules" })}
                  </span>
                  <label className="mutiny-sched-row" title={refusal ?? undefined}>
                    <Input
                      type="checkbox"
                      checked={Boolean(c.total) && !refusal}
                      disabled={refusal !== null}
                      aria-describedby={refusal ? `${ids}-total-${c.id}` : undefined}
                      onChange={(e) => update({ columns: draft.columns.map((x) => (x.id === c.id ? { ...x, total: e.target.checked } : x)) })}
                    />
                    {t("builder.total", "Total", { ns: "schedules" })}
                  </label>
                  {refusal ? (
                    <span id={`${ids}-total-${c.id}`} className="mutiny-sched-help mutiny-sched-list-note">
                      {refusal}
                    </span>
                  ) : null}
                  <Button variant="ghost" size="icon-sm" aria-label={t("builder.moveUp", "Move {{name}} up", { ns: "schedules", name: heading })} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("builder.moveDown", "Move {{name}} down", { ns: "schedules", name: heading })}
                    disabled={i === draft.columns.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("builder.remove", "Remove {{name}}", { ns: "schedules", name: heading })}
                    onClick={() => update({ columns: draft.columns.filter((x) => x.id !== c.id) })}
                  >
                    ×
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="mutiny-sched-field">
            <label htmlFor={`${ids}-fieldq`}>{t("builder.addField", "Add a field", { ns: "schedules" })}</label>
            <Input
              id={`${ids}-fieldq`}
              type="search"

              placeholder={classes.length ? t("builder.searchFields", "Search fields", { ns: "schedules" }) : t("builder.chooseWhatFirst", "Choose what to list first", { ns: "schedules" })}
              disabled={classes.length === 0}
              value={fieldQuery}
              onChange={(e) => setFieldQuery(e.target.value)}
            />
          </div>
          {classes.length > 0 ? (
            available.length ? (
              <ul className="mutiny-sched-list" aria-label={t("builder.fieldsYouCanAdd", "Fields you can add", { ns: "schedules" })}>
                {available.map((f) => (
                  <li key={f.path} className="mutiny-sched-list-item">
                    <span className="mutiny-sched-grow">
                      {scheduleFieldLabel(f.label, t)} <span className="mutiny-sched-muted">{f.unit ? `(${f.unit})` : ""}</span>
                      {!f.editable ? (
                        <span className="mutiny-sched-muted"> {t("builder.fromModel", "· from the model", { ns: "schedules" })}</span>
                      ) : null}
                    </span>
                    <Button variant="outline" size="sm" aria-label={t("builder.addNamed", "Add {{name}}", { ns: "schedules", name: scheduleFieldLabel(f.label, t) })} onClick={() => addField(f)}>
                      {t("builder.add", "Add", { ns: "schedules" })}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mutiny-sched-muted">
                {q
                  ? t("builder.noFieldsMatch", "No fields match “{{query}}”.", { ns: "schedules", query: fieldQuery.trim() })
                  : t("builder.everyFieldIsColumn", "Every field is already a column.", { ns: "schedules" })}
              </p>
            )
          ) : null}
          {relationships.map((r) => (
            <div key={r.id} className="mutiny-sched-row">
              <Button
                variant="outline"
                size="sm"
                disabled={draft.columns.some((c) => c.kind === "aggregate" && c.relationship === r.id && c.fn === "count")}
                onClick={() => update({ columns: [...draft.columns, { id: nextColumnId("agg"), kind: "aggregate", fn: "count", relationship: r.id, heading: `${r.label} count` }] })}
              >
                {t("builder.addCount", "Add {{name}} count", { ns: "schedules", name: r.label })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={draft.columns.some((c) => c.kind === "expand" && c.relationship === r.id)}
                onClick={() => update({ columns: [...draft.columns, { id: nextColumnId("exp"), kind: "expand", relationship: r.id, columns: ["mark"], paper: "nested", heading: r.label }] })}
              >
                {t("builder.addSubList", "Add {{name}} as a sub-list", { ns: "schedules", name: r.label })}
              </Button>
            </div>
          ))}
        </section>

        <section className="mutiny-sched-section" aria-labelledby={`${ids}-formulas`}>
          <h3 id={`${ids}-formulas`} tabIndex={-1} className="mutiny-sched-section-title">
            {t("builder.calculations", "Calculations", { ns: "schedules" })}
          </h3>
          <div className="mutiny-sched-field">
            <label htmlFor={`${ids}-fh`}>{t("builder.columnHeading", "Column heading", { ns: "schedules" })}</label>
            <Input
              id={`${ids}-fh`}
              value={formulaHeading}
              placeholder={t("builder.headingPlaceholder", "Gas input (Btu/h)", { ns: "schedules" })}
              onChange={(e) => setFormulaHeading(e.target.value)}
            />
          </div>
          <div className="mutiny-sched-field">
            <label htmlFor={`${ids}-expr`}>{t("builder.formula", "Formula", { ns: "schedules" })}</label>
            <Textarea
              id={`${ids}-expr`}

              value={expression}
              placeholder="{own.mbh} * 1000"
              spellCheck={false}
              aria-invalid={firstError !== null}
              aria-describedby={`${ids}-expr-help`}
              disabled={classes.length === 0}
              onChange={(e) => setExpression(e.target.value)}
            />
            <div id={`${ids}-expr-help`} aria-live="polite">
              {firstError ? (
                <>
                  <p className="mutiny-sched-error">{firstError.message}</p>
                  <SpanView source={expression} error={firstError} />
                </>
              ) : check?.ok ? (
                <p className="mutiny-sched-help">
                  {t("builder.result", "Result: {{type}}", {
                    ns: "schedules",
                    type: check.formula.type.type === "quantity" ? `${check.formula.type.kind.replace(/_/g, " ")} (${check.formula.type.unit})` : check.formula.type.type,
                  })}
                </p>
              ) : (
                <p className="mutiny-sched-help">
                  {classes.length
                    ? t("builder.formulaHint", "Use fields in braces, like {own.mbh} * 1000. Units are checked as you type.", { ns: "schedules" })
                    : t("builder.chooseWhatFirst", "Choose what to list first", { ns: "schedules" })}
                </p>
              )}
            </div>
          </div>
          <div className="mutiny-sched-row">
            <Button variant="outline" size="sm" disabled={addFormulaBlocked !== null} title={addFormulaBlocked ?? undefined} onClick={addFormula}>
              {t("builder.addAsColumn", "Add as column", { ns: "schedules" })}
            </Button>
            {library ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!check?.ok}
                title={check?.ok ? undefined : t("builder.fixFormulaFirst", "Fix the formula first.", { ns: "schedules" })}
                onClick={() => setSaveOpen(true)}
              >
                {t("builder.saveToFirmLibrary", "Save to firm library", { ns: "schedules" })}
              </Button>
            ) : null}
            {addFormulaBlocked && expression.trim() ? <span className="mutiny-sched-help">{addFormulaBlocked}</span> : null}
          </div>
          {library ? (
            <details open={libraryOpen} onToggle={(e) => setLibraryOpen(e.currentTarget.open)}>
              <summary>{t("builder.useLibraryCalculation", "Use a calculation from a library", { ns: "schedules" })}</summary>
              {libraryOpen ? (
              <LibraryBrowser
                provider={library}
                types={["formula"]}
                useLabel={t("builder.add", "Add", { ns: "schedules" })}
                onUse={(item) => update({ columns: [...draft.columns, { id: nextColumnId("lib"), kind: "formula", calculation: item.key, expression: "", heading: item.name }] })}
              />
              ) : null}
            </details>
          ) : null}
        </section>

        <section className="mutiny-sched-section" aria-labelledby={`${ids}-filters`}>
          <h3 id={`${ids}-filters`} tabIndex={-1} className="mutiny-sched-section-title">
            {t("builder.filters", "Filters", { ns: "schedules" })}
          </h3>
          {draft.filters.length === 0 ? <p className="mutiny-sched-muted">{t("builder.everyItemListed", "Every matching item is listed.", { ns: "schedules" })}</p> : null}
          {draft.filters.map((f, i) => {
            const op = filterOps(t).find((o) => o.value === f.op);
            return (
              <div key={i} className="mutiny-sched-row" role="group" aria-label={t("builder.filterGroup", "Filter {{n}}", { ns: "schedules", n: i + 1 })}>
                <NativeSelect aria-label={t("builder.field", "Field", { ns: "schedules" })} value={f.path} onChange={(e) => setFilter(i, { path: e.target.value })}>
                  {fields.map((x) => (
                    <NativeSelectOption key={x.path} value={x.path}>
                      {scheduleFieldLabel(x.label, t)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label={t("builder.condition", "Condition", { ns: "schedules" })}
                  value={f.op}
                  onChange={(e) => {
                    const next = filterOps(t).find((o) => o.value === e.target.value);
                    if (next) setFilter(i, { op: next.value });
                  }}
                >
                  {filterOps(t).map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {op?.needsValue ? (
                  <Input aria-label={t("builder.value", "Value", { ns: "schedules" })} value={f.value ?? ""} onChange={(e) => setFilter(i, { value: e.target.value })} />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("builder.removeFilter", "Remove filter {{n}}", { ns: "schedules", n: i + 1 })}
                  onClick={() => update({ filters: draft.filters.filter((_, k) => k !== i) })}
                >
                  ×
                </Button>
              </div>
            );
          })}
          <div>
            <Button variant="outline" size="sm" disabled={fields.length === 0} onClick={() => update({ filters: [...draft.filters, { path: fields[0]?.path ?? "mark", op: "equals", value: "" }] })}>
              {t("builder.addFilter", "Add filter", { ns: "schedules" })}
            </Button>
          </div>
        </section>

        <section className="mutiny-sched-section" aria-labelledby={`${ids}-arrange`}>
          <h3 id={`${ids}-arrange`} tabIndex={-1} className="mutiny-sched-section-title">
            {t("builder.sortGroupTotals", "Sort, group and totals", { ns: "schedules" })}
          </h3>
          <div className="mutiny-sched-row">
            <div className="mutiny-sched-field">
              <label htmlFor={`${ids}-sort`}>{t("builder.sortBy", "Sort by", { ns: "schedules" })}</label>
              <NativeSelect
                id={`${ids}-sort`}

                value={draft.sort[0]?.path ?? ""}
                onChange={(e) => update({ sort: e.target.value ? [{ path: e.target.value, direction: draft.sort[0]?.direction ?? "asc" }] : [] })}
              >
                <NativeSelectOption value="">{t("builder.modelOrder", "Model order", { ns: "schedules" })}</NativeSelectOption>
                {fields.map((f) => (
                  <NativeSelectOption key={f.path} value={f.path}>
                    {scheduleFieldLabel(f.label, t)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="mutiny-sched-field">
              <label htmlFor={`${ids}-dir`}>{t("builder.order", "Order", { ns: "schedules" })}</label>
              <NativeSelect
                id={`${ids}-dir`}

                disabled={!draft.sort[0]}
                value={draft.sort[0]?.direction ?? "asc"}
                onChange={(e) => {
                  const first = draft.sort[0];
                  if (first) update({ sort: [{ path: first.path, direction: e.target.value === "desc" ? "desc" : "asc" }] });
                }}
              >
                <NativeSelectOption value="asc">{t("builder.ascending", "A to Z, smallest first", { ns: "schedules" })}</NativeSelectOption>
                <NativeSelectOption value="desc">{t("builder.descending", "Z to A, largest first", { ns: "schedules" })}</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="mutiny-sched-field">
              <label htmlFor={`${ids}-group`}>{t("builder.groupBy", "Group by", { ns: "schedules" })}</label>
              <NativeSelect
                id={`${ids}-group`}

                value={draft.groups[0]?.path ?? ""}
                onChange={(e) => update({ groups: e.target.value ? [{ path: e.target.value, header: true, footer: true, totals: draft.groups[0]?.totals ?? true }] : [] })}
              >
                <NativeSelectOption value="">{t("builder.noGroups", "No groups", { ns: "schedules" })}</NativeSelectOption>
                {fields
                  .filter((f) => f.valueType !== "quantity")
                  .map((f) => (
                    <NativeSelectOption key={f.path} value={f.path}>
                      {scheduleFieldLabel(f.label, t)}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
          </div>
          <label className="mutiny-sched-row">
            <Checkbox checked={draft.groups[0]?.totals ?? false} disabled={!draft.groups[0]} onChange={(e) => update({ groups: draft.groups.map((g, k) => (k === 0 ? { ...g, totals: e.target.checked } : g)) })} />{" "}
            {t("builder.totalsForEachGroup", "Totals for each group", { ns: "schedules" })}
          </label>
          <label className="mutiny-sched-row">
            <Checkbox checked={draft.grandTotals} onChange={(e) => update({ grandTotals: e.target.checked })} />{" "}
            {t("builder.grandTotals", "Grand totals at the bottom", { ns: "schedules" })}
          </label>
          <p className="mutiny-sched-help">
            {t("builder.totalsHint", "Only columns ticked “Total” are added up, and only where adding makes sense for that kind of value.", { ns: "schedules" })}
          </p>
        </section>

        <section className="mutiny-sched-section" aria-labelledby={`${ids}-paper`}>
          <h3 id={`${ids}-paper`} tabIndex={-1} className="mutiny-sched-section-title">
            {t("builder.presentation", "Presentation and paper", { ns: "schedules" })}
          </h3>
          {hasExpand && expandCol ? (
            <div className="mutiny-sched-field">
              <label htmlFor={`${ids}-paper-expand`}>{t("builder.onTheSheet", "{{name}} on the sheet", { ns: "schedules", name: headingOf(expandCol) })}</label>
              <NativeSelect
                id={`${ids}-paper-expand`}

                value={expandCol.paper}
                onChange={(e) => {
                  const paper: ExpandPaper = e.target.value === "summary" ? "summary" : e.target.value === "hidden" ? "hidden" : "nested";
                  update({ columns: draft.columns.map((c) => (c.id === expandCol.id ? { ...expandCol, paper } : c)) });
                }}
              >
                <NativeSelectOption value="nested">{t("builder.nestedRows", "Indented rows under each item", { ns: "schedules" })}</NativeSelectOption>
                <NativeSelectOption value="summary">{t("builder.summaryValue", "One summary value", { ns: "schedules" })}</NativeSelectOption>
                <NativeSelectOption value="hidden">{t("builder.notPrinted", "Not printed", { ns: "schedules" })}</NativeSelectOption>
              </NativeSelect>
            </div>
          ) : null}
          <div className="mutiny-sched-row">
            <div className="mutiny-sched-field">
              <label htmlFor={`${ids}-text`}>{t("builder.textHeight", "Text height on paper (mm)", { ns: "schedules" })}</label>
              <Input
                id={`${ids}-text`}
                type="number"
                min={1.5}
                max={6}
                step={0.5}

                value={draft.display.textSizeMm}
                onChange={(e) => update({ display: { ...draft.display, textSizeMm: Number(e.target.value) || 2.5 } })}
              />
            </div>
            <div className="mutiny-sched-field">
              <label htmlFor={`${ids}-empty`}>{t("builder.emptyCells", "Empty cells show", { ns: "schedules" })}</label>
              <Input
                id={`${ids}-empty`}
                value={draft.display.emptyText}
                placeholder={t("builder.blankPlaceholder", "(blank)", { ns: "schedules" })}
                onChange={(e) => update({ display: { ...draft.display, emptyText: e.target.value } })}
              />
            </div>
          </div>
        </section>
      </Sheet>
      {library && check?.ok ? (
        <SaveToLibraryDialog open={saveOpen} onOpenChange={setSaveOpen} provider={library} expression={expression} result={check.formula.type} appliesTo={classes} defaultName={formulaHeading} />
      ) : null}
    </>
  );
}
