"use client";

import { Button } from "@permitzip/bim-ui";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Checkbox, Input, NativeSelect, NativeSelectOption } from "./components/ui/fields";
import type { ScheduleColumnDef, ScheduleColumnStep, ScheduleDefinitionV2 } from "./contracts";
import type { CatalogField } from "./ports";
import { Sheet } from "./ui/overlays";
import { useSchedulesTranslate } from "./i18n/translate";
import { scheduleFieldLabel } from "./i18n/words";

export interface ScheduleColumnsSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly definition: ScheduleDefinitionV2;
  /** The fields the schedule's rows have (the host's catalog for its classes). */
  readonly fields: readonly CatalogField[];
  /** Sends one change as one undo step; returns why it was refused, or null. */
  readonly onStep: (step: ScheduleColumnStep, label: string) => string | null;
  /** What it lists, formulas and paper: the full builder. */
  readonly onMore?: () => void;
  /** Why changes are off (read only), or null. */
  readonly blocked?: string | null;
}

type Feedback = { readonly kind: "done" | "refused"; readonly text: string } | null;

function pathOf(c: ScheduleColumnDef): string | null {
  return c.kind === "field" || c.kind === "parameter" ? c.path : null;
}

function columnId(path: string, taken: readonly ScheduleColumnDef[]): string {
  const base = path.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70) || "column";
  const ids = new Set(taken.map((c) => c.id));
  if (!ids.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!ids.has(`${base}_${n}`)) return `${base}_${n}`;
  return `${base}_${Date.now()}`;
}

/**
 * Change a schedule one column at a time: add, remove, move, rename, sort,
 * group, total and show only some rows. Every control sends one step, saved
 * at once as its own undo step (Ctrl+Z puts it back), the same step an agent
 * or a script sends. List schedules of every kind, old and new, open here.
 */
export function ScheduleColumnsSheet({ open, onOpenChange, definition, fields, onStep, onMore, blocked = null }: ScheduleColumnsSheetProps) {
  const ids = useId();
  const t = useSchedulesTranslate();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [adding, setAdding] = useState("");
  const [filterPath, setFilterPath] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const columns = definition.columns;
  const fieldLabel = (path: string | null) => (path ? scheduleFieldLabel(fields.find((f) => f.path === path)?.label ?? path, t) : null);
  const label = (c: ScheduleColumnDef) => (c.heading ? scheduleFieldLabel(c.heading, t) : (fieldLabel(pathOf(c)) ?? c.id));
  const shown = new Set(columns.map(pathOf).filter((p): p is string => p !== null));
  const addable = fields.filter((f) => !shown.has(f.path));
  const sortPath = definition.sort[0]?.path ?? null;
  const groupPath = definition.groups[0]?.path ?? null;

  const send = (step: ScheduleColumnStep, words: string) => {
    if (blocked) {
      setFeedback({ kind: "refused", text: blocked });
      return false;
    }
    const refused = onStep(step, words);
    setFeedback(
      refused
        ? { kind: "refused", text: t("columns.notChanged", "Not changed: {{reason}}", { ns: "schedules", reason: refused }) }
        : { kind: "done", text: t("columns.done", "{{words}}. Undo (Ctrl+Z) puts it back.", { ns: "schedules", words }) },
    );
    return refused === null;
  };

  const totalWhy = (c: ScheduleColumnDef): string | null => {
    if (c.kind === "expand" || (c.kind === "aggregate" && c.fn === "list"))
      return t("columns.listsItemsNoTotal", "This column lists items, so it has no total.", { ns: "schedules" });
    const field = fields.find((f) => f.path === pathOf(c));
    if (field?.totalRefusedReason) return field.totalRefusedReason;
    if (field && (field.valueType !== "quantity" || field.aggregation === "none")) return t("columns.onlyNumbersAdd", "Only numbers add up.", { ns: "schedules" });
    return null;
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("columns.title", "Columns · {{name}}", { ns: "schedules", name: definition.name })}
      description={t("columns.description", "Each change is saved as you make it, and Undo puts it back.", { ns: "schedules" })}
      footer={
        onMore ? (
          <Button variant="outline" size="sm" onClick={onMore}>
            {t("columns.more", "What it lists, formulas and paper…", { ns: "schedules" })}
          </Button>
        ) : undefined
      }
    >
      <div className="mutiny-sched-columns" data-testid="schedule-columns-panel">
        {blocked && (
          <p className="mutiny-sched-muted" role="note">
            {t("columns.readOnly", "Read only: {{reason}}", { ns: "schedules", reason: blocked })}
          </p>
        )}
        <ol className="mutiny-sched-columns-list" aria-label={t("columns.list", "Columns, left to right", { ns: "schedules" })}>
          {columns.map((c, i) => {
            const path = pathOf(c);
            const why = totalWhy(c);
            return (
              <li key={c.id} className="mutiny-sched-columns-row" data-testid={`schedule-column-${c.id}`}>
                <Input
                  key={c.heading ?? ""}
                  aria-label={t("columns.headingOfColumn", "Heading of column {{n}}", { ns: "schedules", n: i + 1 })}
                  defaultValue={c.heading ?? ""}
                  placeholder={fieldLabel(path) ?? c.id}
                  maxLength={60}
                  disabled={blocked !== null}
                  onBlur={(e) => {
                    const heading = e.currentTarget.value.trim();
                    if (heading === (c.heading ?? "")) return;
                    send(
                      { op: "rename_column", columnId: c.id, heading: heading === "" ? null : heading },
                      heading === ""
                        ? t("columns.fieldNameAgain", "{{name}} uses its field name again", { ns: "schedules", name: label(c) })
                        : t("columns.renamedTo", "Renamed to {{name}}", { ns: "schedules", name: heading }),
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("columns.moveLeft", "Move {{name}} left", { ns: "schedules", name: label(c) })}
                  disabled={i === 0 || blocked !== null}
                  onClick={() => send({ op: "move_column", columnId: c.id, to: i - 1 }, t("columns.movedLeft", "Moved {{name}} left", { ns: "schedules", name: label(c) }))}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("columns.moveRight", "Move {{name}} right", { ns: "schedules", name: label(c) })}
                  disabled={i === columns.length - 1 || blocked !== null}
                  onClick={() => send({ op: "move_column", columnId: c.id, to: i + 1 }, t("columns.movedRight", "Moved {{name}} right", { ns: "schedules", name: label(c) }))}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant={sortPath === path && path ? "outline" : "ghost"}
                  aria-pressed={Boolean(path) && sortPath === path}
                  size="sm"
                  disabled={!path || blocked !== null}
                  title={
                    path
                      ? t("columns.sortHint", "Sort the rows by this column; again to reverse", { ns: "schedules" })
                      : t("columns.sortHintFormula", "Sort by a formula from What it lists, formulas and paper", { ns: "schedules" })
                  }
                  onClick={() => {
                    if (!path) return;
                    const desc = sortPath === path && definition.sort[0]?.direction === "asc";
                    send(
                      { op: "sort", sort: [{ path, direction: desc ? "desc" : "asc" }] },
                      desc
                        ? t("columns.sortedZa", "Sorted by {{name}}, Z to A", { ns: "schedules", name: label(c) })
                        : t("columns.sortedAz", "Sorted by {{name}}, A to Z", { ns: "schedules", name: label(c) }),
                    );
                  }}
                >
                  {t("columns.sort", "Sort", { ns: "schedules" })}
                </Button>
                <Button
                  variant={groupPath === path && path ? "outline" : "ghost"}
                  aria-pressed={Boolean(path) && groupPath === path}
                  size="sm"
                  disabled={!path || blocked !== null}
                  title={
                    path
                      ? t("columns.groupHint", "Group the rows by this column; again to stop grouping", { ns: "schedules" })
                      : t("columns.groupHintField", "Only a field column groups rows", { ns: "schedules" })
                  }
                  onClick={() => {
                    if (!path) return;
                    const off = groupPath === path;
                    send(
                      { op: "group", groups: off ? [] : [{ path, header: true, footer: true, totals: true }] },
                      off ? t("columns.notGrouped", "Not grouped", { ns: "schedules" }) : t("columns.groupedBy", "Grouped by {{name}}", { ns: "schedules", name: label(c) }),
                    );
                  }}
                >
                  {t("columns.group", "Group", { ns: "schedules" })}
                </Button>
                <label className="mutiny-sched-columns-check" title={why ?? t("columns.totalHint", "Add this column up in each group and at the bottom", { ns: "schedules" })}>
                  <Checkbox
                    checked={Boolean(c.total)}
                    disabled={(why !== null && !c.total) || blocked !== null}
                    onChange={(e) =>
                      send(
                        { op: "totals", columnId: c.id, show: e.target.checked },
                        e.target.checked
                          ? t("columns.totalled", "{{name}} totalled", { ns: "schedules", name: label(c) })
                          : t("columns.notTotalled", "{{name}} not totalled", { ns: "schedules", name: label(c) }),
                      )
                    }
                  />{" "}
                  {t("columns.total", "Total", { ns: "schedules" })}
                </label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("columns.remove", "Remove {{name}}", { ns: "schedules", name: label(c) })}
                  disabled={columns.length === 1 || blocked !== null}
                  title={
                    columns.length === 1
                      ? t("columns.removeHintOne", "A schedule keeps at least one column", { ns: "schedules" })
                      : t("columns.removeHint", "Remove this column (Undo puts it back)", { ns: "schedules" })
                  }
                  onClick={() => send({ op: "remove_column", columnId: c.id }, t("columns.removed", "Removed {{name}}", { ns: "schedules", name: label(c) }))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ol>
        <div className="mutiny-sched-columns-add">
          <label htmlFor={`${ids}-add`}>{t("columns.addColumn", "Add a column", { ns: "schedules" })}</label>
          <NativeSelect id={`${ids}-add`} value={adding} onChange={(e) => setAdding(e.target.value)} disabled={blocked !== null || addable.length === 0}>
            <NativeSelectOption value="">
              {addable.length === 0 ? t("columns.everyFieldShown", "Every field is shown", { ns: "schedules" }) : t("columns.pickField", "Pick a field…", { ns: "schedules" })}
            </NativeSelectOption>
            {addable.map((f) => (
              <NativeSelectOption key={f.path} value={f.path}>
                {scheduleFieldLabel(f.label, t)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={!adding || blocked !== null}
            title={adding ? undefined : t("columns.pickFieldFirst", "Pick a field first", { ns: "schedules" })}
            onClick={() => {
              const field = fields.find((f) => f.path === adding);
              if (!field) return;
              if (
                send(
                  { op: "add_column", column: { id: columnId(field.path, columns), kind: "field", path: field.path } },
                  t("columns.added", "Added {{name}}", { ns: "schedules", name: scheduleFieldLabel(field.label, t) }),
                )
              )
                setAdding("");
            }}
          >
            {t("columns.add", "Add", { ns: "schedules" })}
          </Button>
        </div>
        <div className="mutiny-sched-columns-filter">
          <label htmlFor={`${ids}-filter`}>{t("columns.showRowsWhere", "Show only rows where", { ns: "schedules" })}</label>
          <NativeSelect id={`${ids}-filter`} value={filterPath} onChange={(e) => setFilterPath(e.target.value)} disabled={blocked !== null}>
            <NativeSelectOption value="">{t("columns.pickField", "Pick a field…", { ns: "schedules" })}</NativeSelectOption>
            {fields.map((f) => (
              <NativeSelectOption key={f.path} value={f.path}>
                {scheduleFieldLabel(f.label, t)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Input
            aria-label={t("columns.is", "is", { ns: "schedules" })}
            placeholder={t("columns.isPlaceholder", "is…", { ns: "schedules" })}
            value={filterValue}
            maxLength={120}
            onChange={(e) => setFilterValue(e.target.value)}
            disabled={blocked !== null}
          />
          <Button
            size="sm"
            disabled={!filterPath || !filterValue.trim() || blocked !== null}
            title={filterPath && filterValue.trim() ? undefined : t("columns.pickFieldAndValue", "Pick a field and type a value", { ns: "schedules" })}
            onClick={() => {
              const words = t("columns.showingOnly", "Showing only {{field}} is {{value}}", { ns: "schedules", field: fieldLabel(filterPath) ?? "", value: filterValue.trim() });
              if (send({ op: "filter", filters: [...definition.filters, { path: filterPath, op: "equals", value: filterValue.trim() }] }, words)) setFilterValue("");
            }}
          >
            {t("columns.apply", "Apply", { ns: "schedules" })}
          </Button>
          {definition.filters.length > 0 && (
            <ul aria-label={t("columns.rowsShownWhere", "Rows shown only where", { ns: "schedules" })}>
              {definition.filters.map((f, i) => (
                <li key={`${f.path}-${i}`}>
                  {fieldLabel(f.path)} {f.op === "equals" ? t("columns.isOp", "is", { ns: "schedules" }) : f.op.replace(/_/g, " ")} {f.value ?? ""}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("columns.stopFiltering", "Stop showing only {{field}} {{value}}", { ns: "schedules", field: fieldLabel(f.path) ?? "", value: f.value ?? "" })}
                    disabled={blocked !== null}
                    onClick={() =>
                      send(
                        { op: "filter", filters: definition.filters.filter((_, k) => k !== i) },
                        t("columns.showEveryAgain", "Showing every {{field}} again", { ns: "schedules", field: fieldLabel(f.path) ?? "" }),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="mutiny-sched-columns-check">
          <Checkbox
            checked={definition.grandTotals}
            disabled={blocked !== null}
            onChange={(e) =>
              send(
                { op: "totals", show: e.target.checked },
                e.target.checked
                  ? t("columns.grandTotalsShown", "Grand totals shown", { ns: "schedules" })
                  : t("columns.grandTotalsHidden", "Grand totals hidden", { ns: "schedules" }),
              )
            }
          />{" "}
          {t("columns.grandTotals", "Grand totals at the bottom", { ns: "schedules" })}
        </label>
        {feedback && (
          <p className={feedback.kind === "refused" ? "mutiny-sched-error" : "mutiny-sched-muted"} role={feedback.kind === "refused" ? "alert" : "status"} data-testid="schedule-columns-feedback">
            {feedback.text}
          </p>
        )}
      </div>
    </Sheet>
  );
}
