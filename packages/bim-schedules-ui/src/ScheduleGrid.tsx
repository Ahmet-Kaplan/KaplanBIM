"use client";

import { DataGrid, type DataGridHandle, type GridEditIntent } from "@permitzip/bim-grid";
import { Alert, AlertDescription, AlertTitle, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Spinner } from "@permitzip/bim-ui";
import { Columns3, Crosshair, ListOrdered } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { applyRowPatch } from "./apply-patch";
import {
  EDITING_CELL_MAX_TTL_MS,
  type CellEditBatch,
  type CellRef,
  type EditingPresence,
  type RowSet,
  type RowSetColumn,
  type ScheduleClosedReason,
  type ScheduleConnection,
  type ScheduleSubscription,
  type ScheduleTarget,
  type TypeScopeImpact,
} from "./contracts";
import { buildGridModel, cellKey, intentToEdits, rowSetToCsv, type CellOverlay } from "./rowset-grid";
import { ConfirmDialog, OverflowMenu, type MenuItem } from "./ui/overlays";
import { createScheduleUnits, type ScheduleUnits } from "./units";
import { useSchedulesTranslate } from "./i18n/translate";

export type BuilderSection = "fields" | "arrange";

export interface ScheduleGridProps {
  readonly connection: ScheduleConnection;
  readonly target: ScheduleTarget;
  /** As the person knows it: "Water heater schedule". */
  readonly title: string;
  readonly units?: ScheduleUnits;
  readonly height?: number;
  /** Fields / Arrange open the builder at that section. */
  readonly onOpenBuilder?: (section: BuilderSection) => void;
  /** Columns: change the schedule one column at a time (each change one undo step). Shown instead of Fields when given. */
  readonly onOpenColumns?: () => void;
  /** Select these elements in plan and 3D. */
  readonly onShowInModel?: (elementIds: readonly string[]) => void;
  /** Jump to where a locked value comes from (formula, related item, type). */
  readonly onGoToSource?: (column: RowSetColumn, cell: CellRef, elementId: string | null) => void;
  readonly onPlaceOnSheet?: () => void;
  readonly onDuplicate?: () => void;
  readonly onSaveAsTemplate?: () => void;
  readonly onPrintPreview?: () => void;
  /** Absent: Export CSV downloads a file. */
  readonly onExportCsv?: (csv: string, filename: string) => void;
  /** Column widths the person set before (host-stored per-person prefs). */
  readonly columnWidths?: Readonly<Record<string, number>>;
  readonly onColumnWidthsChange?: (widths: Readonly<Record<string, number>>) => void;
  readonly frozenColumns?: number;
}

type Status =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "closed"; readonly reason: ScheduleClosedReason; readonly message: string };

interface HeldBatch {
  readonly batch: CellEditBatch;
  readonly texts: ReadonlyMap<string, string>;
  readonly keys: readonly string[];
  readonly heldSince: number;
}

const SAVED_FLASH_MS = 1500;

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A model schedule as a live spreadsheet. See SCHEDULES-PLAN §6–§7. */
export function ScheduleGrid(props: ScheduleGridProps) {
  const { connection, target, title, height = 520, onOpenBuilder, onShowInModel, onGoToSource } = props;
  const t = useSchedulesTranslate();
  const units = useMemo(() => props.units ?? createScheduleUnits(), [props.units]);
  const me = connection.actor;

  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [reconnecting, setReconnecting] = useState(false);
  const [rowSet, setRowSet] = useState<RowSet | null>(null);
  const [presence, setPresence] = useState<readonly EditingPresence[]>([]);
  /** "Now" for presence TTLs; ticks at the next expiry and on every presence event. */
  const [presenceClock, setPresenceClock] = useState(() => Date.now());
  const [overlays, setOverlays] = useState<ReadonlyMap<string, CellOverlay>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [explanations, setExplanations] = useState<ReadonlyMap<string, string>>(new Map());
  const [widths, setWidths] = useState<ReadonlyMap<string, number>>(() => new Map(Object.entries(props.columnWidths ?? {})));
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{ batch: CellEditBatch; texts: ReadonlyMap<string, string>; impacts: readonly TypeScopeImpact[] } | null>(null);
  const [activeRow, setActiveRow] = useState<{ elementId: string | null } | null>(null);

  const subRef = useRef<ScheduleSubscription | null>(null);
  const heldRef = useRef<HeldBatch[]>([]);
  /** Bumped when an edit is held, so the release timer re-arms even if nobody's presence changes. */
  const [heldTick, setHeldTick] = useState(0);
  const gridRef = useRef<DataGridHandle>(null);
  const presenceRef = useRef<readonly EditingPresence[]>([]);

  const viewKey = "viewId" in target ? target.viewId : target.definition.name;
  // Re-open only when the schedule changes, not when a parent re-creates the target object.
  const targetRef = useRef(target);
  const widthsChangeRef = useRef(props.onColumnWidthsChange);
  useLayoutEffect(() => {
    targetRef.current = target;
    widthsChangeRef.current = props.onColumnWidthsChange;
  });

  // A different schedule starts from "loading" (reset during render, not in an effect).
  const [openedKey, setOpenedKey] = useState(viewKey);
  if (openedKey !== viewKey) {
    setOpenedKey(viewKey);
    setStatus({ kind: "loading" });
    setRowSet(null);
  }

  useEffect(() => {
    const sub = connection.open(targetRef.current, (event) => {
      switch (event.type) {
        case "rows":
          setRowSet(event.rows);
          setStatus({ kind: "ready" });
          return;
        case "patch":
          setRowSet((rs) => (rs ? applyRowPatch(rs, event.patch) : rs));
          return;
        case "closed":
          setStatus({ kind: "closed", reason: event.reason, message: event.message });
          return;
        case "presence": {
          const others = event.editing.filter((p) => p.actor.id !== me.id);
          presenceRef.current = others;
          setPresence(others);
          setPresenceClock(Date.now());
          return;
        }
        case "connection":
          setReconnecting(event.state === "reconnecting");
          return;
      }
    });
    subRef.current = sub;
    return () => {
      sub.setEditingCell(null);
      sub.close();
      subRef.current = null;
    };
  }, [connection, viewKey, me.id]);

  const setOverlay = useCallback((updates: readonly (readonly [string, CellOverlay | null])[]) => {
    setOverlays((prev) => {
      const next = new Map(prev);
      for (const [k, v] of updates) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      return next;
    });
  }, []);

  const send = useCallback(
    async (batch: CellEditBatch, texts: ReadonlyMap<string, string>) => {
      const sub = subRef.current;
      if (!sub) return;
      const keys = batch.edits.map((e) => cellKey(e));
      setOverlay(keys.map((k) => [k, { state: "pending", text: texts.get(k) ?? "" }] as const));
      setMessage(
        batch.edits.length === 1
          ? t("grid.savingOne", "Saving 1 change…", { ns: "schedules" })
          : t("grid.savingMany", "Saving {{n}} changes…", { ns: "schedules", n: batch.edits.length }),
      );
      try {
        const outcome = await sub.edit(batch);
        if (!outcome.ok) {
          setOverlay(keys.map((k) => [k, { state: "refused", reason: outcome.message, text: texts.get(k) ?? "" }] as const));
          setMessage(t("grid.notSaved", "Not saved: {{reason}}", { ns: "schedules", reason: outcome.message }));
          return;
        }
        const refusedKeys = new Map(outcome.refusals.map((r) => [cellKey(r), r.reason] as const));
        setOverlay(keys.map((k) => [k, refusedKeys.has(k) ? { state: "refused", reason: refusedKeys.get(k) ?? "", text: texts.get(k) ?? "" } : { state: "saved" }] as const));
        const savedCount = keys.length - refusedKeys.size;
        if (refusedKeys.size === 0)
          setMessage(
            savedCount === 1
              ? t("grid.saved", "Saved.", { ns: "schedules" })
              : t("grid.savedMany", "Saved {{n}} changes.", { ns: "schedules", n: savedCount }),
          );
        else {
          const cells =
            refusedKeys.size === 1
              ? t("grid.cellOne", "1 cell", { ns: "schedules" })
              : t("grid.cellMany", "{{n}} cells", { ns: "schedules", n: refusedKeys.size });
          setMessage(
            t("grid.savedSome", "Saved {{saved}} of {{total}}. {{cells}} weren't changed: {{first}}", {
              ns: "schedules",
              saved: savedCount,
              total: keys.length,
              cells,
              first: [...refusedKeys.values()][0] ?? "",
            }),
          );
        }
        setTimeout(() => {
          setOverlays((prev) => {
            const next = new Map(prev);
            for (const k of keys) if (next.get(k)?.state === "saved") next.delete(k);
            return next;
          });
        }, SAVED_FLASH_MS);
      } catch (err) {
        console.error("[ScheduleGrid] edit failed", err);
        const reason = err instanceof Error ? err.message : t("grid.editFailed", "The connection dropped before the change was saved.", { ns: "schedules" });
        setOverlay(keys.map((k) => [k, { state: "refused", reason, text: texts.get(k) ?? "" }] as const));
        setMessage(t("grid.notSavedTryAgain", "Not saved: {{reason}} Try again.", { ns: "schedules", reason }));
      }
    },
    [setOverlay],
  );

  /** Type-scope edits ask first (D2): preview the blast radius, Cancel is the default. */
  const previewAndSend = useCallback(
    async (batch: CellEditBatch, texts: ReadonlyMap<string, string>) => {
      const sub = subRef.current;
      if (!sub) return;
      try {
        const preview = await sub.preview(batch);
        if (preview.typeScope.length > 0) {
          setConfirm({ batch, texts, impacts: preview.typeScope });
          return;
        }
      } catch (err) {
        console.error("[ScheduleGrid] preview failed", err);
        setMessage(t("grid.previewFailed", "Couldn't check what this change affects. Nothing was changed; try again.", { ns: "schedules" }));
        return;
      }
      await send(batch, texts);
    },
    [send],
  );

  const othersInCell = useCallback((key: string) => presenceRef.current.find((p) => cellKey(p) === key && p.expiresAt > Date.now()), []);

  /** Releases held edits whose cells are free (other person done, or TTL over). */
  const releaseHeld = useCallback(() => {
    const now = Date.now();
    const still: HeldBatch[] = [];
    for (const h of heldRef.current) {
      const blocked = h.keys.some((k) => othersInCell(k)) && now - h.heldSince < EDITING_CELL_MAX_TTL_MS;
      if (blocked) still.push(h);
      else void previewAndSend(h.batch, h.texts);
    }
    heldRef.current = still;
  }, [othersInCell, previewAndSend]);

  useEffect(() => {
    releaseHeld();
    if (heldRef.current.length === 0) return;
    const nextExpiry = Math.min(
      ...heldRef.current.map((h) => h.heldSince + EDITING_CELL_MAX_TTL_MS),
      ...presence.map((p) => p.expiresAt),
    );
    const t = setTimeout(() => {
      releaseHeld();
      setHeldTick((n) => n + 1);
    }, Math.max(0, nextExpiry - Date.now()) + 10);
    return () => clearTimeout(t);
  }, [presence, releaseHeld, heldTick]);

  // Presence past its TTL stops drawing even if the other client never sends a release.
  const livePresence = useMemo(() => presence.filter((p) => p.expiresAt > presenceClock), [presence, presenceClock]);
  useEffect(() => {
    if (livePresence.length === 0) return;
    const next = Math.min(...livePresence.map((p) => p.expiresAt));
    const t = setTimeout(() => setPresenceClock(Date.now()), Math.max(0, next - Date.now()) + 10);
    return () => clearTimeout(t);
  }, [livePresence]);

  const model = useMemo(
    () =>
      rowSet
        ? buildGridModel({
            rowSet,
            units,
            expanded,
            overlays,
            presence: livePresence,
            explanations,
            widths,
            t,
            onGoToSource: (column, cell) => {
              const el = cell.parent ? null : (rowSet.elementIds[rowSet.rowKeys.indexOf(cell.rowKey)] ?? null);
              onGoToSource?.(column, cell, el);
            },
          })
        : null,
    [rowSet, units, expanded, overlays, livePresence, explanations, widths, onGoToSource],
  );

  const onEdit = useCallback(
    (intent: GridEditIntent) => {
      if (!model) return;
      const { edits, refused, texts } = intentToEdits(intent, model, units, t);
      if (refused.length) {
        setOverlay(refused.filter((r) => r.text !== "").map((r) => [cellKey(r.ref), { state: "refused", reason: r.reason, text: r.text }] as const));
        const first = refused[0];
        if (first)
          setMessage(
            edits.length
              ? t("grid.cellsSkipped", "{{cells}} skipped: {{reason}}", {
                  ns: "schedules",
                  cells:
                    refused.length === 1
                      ? t("grid.cellOne", "1 cell", { ns: "schedules" })
                      : t("grid.cellMany", "{{n}} cells", { ns: "schedules", n: refused.length }),
                  reason: first.reason,
                })
              : t("grid.notChanged", "Not changed: {{reason}}", { ns: "schedules", reason: first.reason }),
          );
      }
      if (edits.length === 0) return;
      const batch: CellEditBatch = { source: intent.source, edits };
      const keys = edits.map((e) => cellKey(e));
      const holder = keys.map((k) => othersInCell(k)).find(Boolean);
      if (holder) {
        heldRef.current = [...heldRef.current, { batch, texts, keys, heldSince: Date.now() }];
        setHeldTick((n) => n + 1);
        setOverlay(keys.map((k) => [k, { state: "held", heldBy: holder.actor.name, text: texts.get(k) ?? "" }] as const));
        setMessage(t("grid.heldBy", "{{name}} is editing this cell. Your change will be sent when they finish.", { ns: "schedules", name: holder.actor.name }));
        return;
      }
      void previewAndSend(batch, texts);
    },
    [model, units, setOverlay, othersInCell, previewAndSend],
  );

  const onActiveCellChange = useCallback(
    (cell: { rowKey: string; columnId: string } | null) => {
      if (!model || !cell) {
        setActiveRow(null);
        return;
      }
      const resolved = model.resolve(cell.rowKey, cell.columnId);
      setActiveRow({ elementId: resolved.elementId });
      const key = cellKey(resolved.ref);
      if (resolved.column && !resolved.column.writer && resolved.column.source && !explanations.has(key)) {
        subRef.current
          ?.explain(resolved.ref)
          .then((text) => {
            if (text) setExplanations((prev) => new Map(prev).set(key, text));
          })
          .catch((err: unknown) => console.error("[ScheduleGrid] explain failed (non-blocking)", err));
      }
    },
    [model, explanations],
  );

  const onEditingChange = useCallback(
    (cell: { rowKey: string; columnId: string } | null) => {
      if (!model) return;
      subRef.current?.setEditingCell(cell ? model.resolve(cell.rowKey, cell.columnId).ref : null);
    },
    [model],
  );

  const onToggleExpand = useCallback((rowKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const onColumnResize = useCallback((columnId: string, width: number) => {
    setWidths((prev) => {
      const next = new Map(prev).set(columnId, width);
      widthsChangeRef.current?.(Object.fromEntries(next));
      return next;
    });
  }, []);

  const exportCsv = () => {
    if (!rowSet) return;
    const csv = rowSetToCsv(rowSet, units, t);
    const filename = `${title.replace(/[^\w-]+/g, "-").toLowerCase()}.csv`;
    if (props.onExportCsv) props.onExportCsv(csv, filename);
    else downloadCsv(csv, filename);
    setMessage(
      t("grid.exported", "Exported {{rows}} to {{file}}.", {
        ns: "schedules",
        rows:
          rowSet.rowCount === 1
            ? t("grid.rowOne", "1 row", { ns: "schedules" })
            : t("grid.rowMany", "{{n}} rows", { ns: "schedules", n: rowSet.rowCount.toLocaleString("en-US") }),
        file: filename,
      }),
    );
  };

  const notHere = t("grid.notHere", "Not available in this view.", { ns: "schedules" });
  const menuItems: MenuItem[] = [
    { label: t("grid.placeOnSheet", "Place on sheet", { ns: "schedules" }), ...(props.onPlaceOnSheet ? { onSelect: props.onPlaceOnSheet } : { disabledReason: notHere }) },
    { label: t("grid.duplicate", "Duplicate", { ns: "schedules" }), ...(props.onDuplicate ? { onSelect: props.onDuplicate } : { disabledReason: notHere }) },
    { label: t("grid.saveAsTemplate", "Save as template", { ns: "schedules" }), ...(props.onSaveAsTemplate ? { onSelect: props.onSaveAsTemplate } : { disabledReason: notHere }) },
    {
      label: t("grid.exportCsv", "Export CSV", { ns: "schedules" }),
      ...(rowSet ? { onSelect: exportCsv } : { disabledReason: t("grid.waitForRows", "Wait for the rows to load.", { ns: "schedules" }) }),
    },
    { label: t("grid.printPreview", "Print preview", { ns: "schedules" }), ...(props.onPrintPreview ? { onSelect: props.onPrintPreview } : { disabledReason: notHere }) },
  ];

  const showInModelReason = !onShowInModel
    ? t("grid.notHere", "Not available in this view.", { ns: "schedules" })
    : !activeRow?.elementId
      ? t("grid.pickRowFirst", "Pick a row first.", { ns: "schedules" })
      : null;

  return (
    <section className="mutiny-sched" aria-label={title}>
      <div className="mutiny-sched-toolbar" role="toolbar" aria-label={t("grid.tools", "{{title}} tools", { ns: "schedules", title })}>
        <h2 className="mutiny-sched-title">{title}</h2>
        <div className="mutiny-sched-toolbar-actions">
          {props.onOpenColumns ? (
            <Button
              variant="outline"
              size="sm"
              onClick={props.onOpenColumns}
              title={t("grid.columnsHint", "Add, remove, move, rename, sort, group and total columns; each change undoes on its own", { ns: "schedules" })}
              data-testid="schedule-columns-open"
            >
              <Columns3 aria-hidden /> {t("grid.columns", "Columns", { ns: "schedules" })}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenBuilder?.("fields")}
              disabled={!onOpenBuilder}
              title={onOpenBuilder ? t("grid.fieldsHint", "Choose what this schedule lists and which columns it shows", { ns: "schedules" }) : notHere}
            >
              <Columns3 aria-hidden /> {t("grid.fields", "Fields", { ns: "schedules" })}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenBuilder?.("arrange")} disabled={!onOpenBuilder} title={onOpenBuilder ? t("grid.arrangeHint", "Sort, group and total", { ns: "schedules" }) : notHere}>
            <ListOrdered aria-hidden /> {t("grid.arrange", "Arrange", { ns: "schedules" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={showInModelReason !== null}
            title={showInModelReason ?? t("grid.showInModelHint", "Select this row's item in plan and 3D", { ns: "schedules" })}
            onClick={() => activeRow?.elementId && onShowInModel?.([activeRow.elementId])}
          >
            <Crosshair aria-hidden /> {t("grid.showInModel", "Show in model", { ns: "schedules" })}
          </Button>
          <OverflowMenu label={t("grid.moreActions", "More schedule actions", { ns: "schedules" })} items={menuItems} />
        </div>
      </div>
      <p className="mutiny-sched-status" role="status" aria-live="polite">
        {reconnecting ? t("grid.reconnecting", "Connection lost. Reconnecting… your unsaved edits are kept.", { ns: "schedules" }) : message}
      </p>
      {status.kind === "loading" ? (
        <div className="mutiny-sched-loading" style={{ height }}>
          <Spinner /> {t("grid.loading", "Loading {{title}}…", { ns: "schedules", title })}
        </div>
      ) : status.kind === "closed" ? (
        <Alert variant={status.reason === "denied" ? "destructive" : "default"}>
          <AlertTitle>
            {status.reason === "denied"
              ? t("grid.closedDeniedTitle", "You can't see this schedule any more", { ns: "schedules" })
              : status.reason === "deleted"
                ? t("grid.closedDeletedTitle", "This schedule was deleted", { ns: "schedules" })
                : t("grid.closedTitle", "This schedule was closed", { ns: "schedules" })}
          </AlertTitle>
          <AlertDescription>
            {status.message}{" "}
            {status.reason === "denied"
              ? t("grid.closedDeniedWhy", "Ask the project lead for access, then open it again.", { ns: "schedules" })
              : t("grid.closedWhy", "Open another schedule from Views and Sheets.", { ns: "schedules" })}
          </AlertDescription>
        </Alert>
      ) : model ? (
        <DataGrid
          ref={gridRef}
          ariaLabel={title}
          rows={model.rows}
          columns={model.columns}
          hierarchical={model.hierarchical}
          frozenColumns={props.frozenColumns ?? 1}
          height={height}
          onEdit={onEdit}
          onToggleExpand={onToggleExpand}
          onUndo={() => subRef.current?.undo()}
          onRedo={() => subRef.current?.redo()}
          onActiveCellChange={onActiveCellChange}
          onEditingChange={onEditingChange}
          onColumnResize={onColumnResize}
          emptyState={
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("grid.emptyTitle", "Nothing to list yet", { ns: "schedules" })}</EmptyTitle>
                <EmptyDescription>
                  {t("grid.emptyBody", "No items in the model match this schedule. Change what it lists with {{where}}.", {
                    ns: "schedules",
                    where: props.onOpenColumns
                      ? t("grid.whereColumns", "Columns › What it lists, formulas and paper", { ns: "schedules" })
                      : t("grid.whereFields", "Fields", { ns: "schedules" }),
                  })}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        title={t("grid.changeTypeTitle", "Change every part of this type?", { ns: "schedules" })}
        confirmLabel={
          confirm
            ? t("grid.changeAll", "Change all {{n}}", { ns: "schedules", n: confirm.impacts.reduce((n, i) => n + i.instanceCount, 0).toLocaleString("en-US") })
            : t("grid.changeAllBare", "Change all", { ns: "schedules" })
        }
        onCancel={() => {
          if (confirm) {
            setOverlay(confirm.batch.edits.map((e) => [cellKey(e), null] as const));
            setMessage(t("grid.notChangedBare", "Not changed.", { ns: "schedules" }));
          }
          setConfirm(null);
          gridRef.current?.focus();
        }}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          gridRef.current?.focus();
          if (c) void send(c.batch, c.texts);
        }}
      >
        <ul className="mutiny-sched-impacts">
          {(confirm?.impacts ?? []).map((i) => (
            <li key={`${i.typeLabel}|${i.columnHeading}`}>
              {t("grid.typeImpact", "Changes all {{parts}} of type {{type}} ({{column}}), including any not in this schedule.", {
                ns: "schedules",
                parts:
                  i.instanceCount === 1
                    ? t("grid.partOne", "1 part", { ns: "schedules" })
                    : t("grid.partMany", "{{n}} parts", { ns: "schedules", n: i.instanceCount }),
                type: i.typeLabel,
                column: i.columnHeading,
              })}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </section>
  );
}
