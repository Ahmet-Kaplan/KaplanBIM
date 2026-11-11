"use client";

import { Button, Spinner } from "@permitzip/bim-ui";
import { useId, useState } from "react";
import { Input, NativeSelect, NativeSelectOption } from "./components/ui/fields";

import type { FieldLibraryItem, LibraryProviderPort, SharedFieldItemBody } from "./ports";
import { englishOnly, useSchedulesTranslate, type Translate } from "./i18n/translate";


/**
 * New shared field (KERNEL-FOUNDATION §3.2, decision 3): a library editor
 * adds a parameter to the firm's library ("Hood ID"), and it appears in the
 * equipment list, the Inspector and tags with no code change. Stored as a
 * part parameter on equipment and fixtures; the database decides who may
 * publish to which library.
 */


/** The units a new field can hold, and what each is called in the language on screen. */
export function newFieldUnits(t: Translate): readonly { readonly unit: string; readonly kind: string; readonly label: string }[] {
  return [
    { unit: "1", kind: "dimensionless", label: t("newField.noUnit", "No unit", { ns: "schedules" }) },
    { unit: "V", kind: "voltage", label: t("newField.volts", "Volts (V)", { ns: "schedules" }) },
    { unit: "A", kind: "current", label: t("newField.amps", "Amps (A)", { ns: "schedules" }) },
    // A symbol is never translated (§7): VA, kW, Btu/h, CFM, GPM, psi carry through as they are.
    { unit: "VA", kind: "power_apparent", label: "VA" },
    { unit: "kW", kind: "power_real", label: "kW" },
    { unit: "hp", kind: "power_mechanical", label: t("newField.horsepower", "Horsepower (hp)", { ns: "schedules" }) },
    { unit: "Btu/h", kind: "thermal_power", label: "Btu/h" },
    { unit: "cfm", kind: "flow_air", label: "CFM" },
    { unit: "gpm", kind: "flow_liquid", label: "GPM" },
    { unit: "psi", kind: "pressure", label: "psi" },
    { unit: "lb", kind: "mass", label: t("newField.pounds", "Pounds (lb)", { ns: "schedules" }) },
  ];
}


export type NewFieldHolds = "text" | "number" | "yes_no";

/** "Hood ID" → `hood_id`; null when no letters or digits are left. */
export function fieldNameOf(label: string): string | null {
  const name = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 60);
  return /^[a-z][a-z0-9_]*$/.test(name) ? name : null;
}

const EQUIPMENT = ["mep.equipment", "mep.plumbing_fixture"];

/** The field item New field publishes, or why it can't. */

export function newFieldItem(
  scope: string,
  input: { readonly label: string; readonly group: string; readonly holds: NewFieldHolds; readonly unit: string },
  t: Translate = englishOnly,
): { readonly item: FieldLibraryItem } | { readonly refused: string } {
  const label = input.label.trim();
  if (label === "") return { refused: t("newField.nameRequired", "Give the field a name (Hood ID).", { ns: "schedules" }) };
  if (label.length > 80) return { refused: t("newField.nameTooLong", "Keep the name to 80 characters.", { ns: "schedules" }) };
  const name = fieldNameOf(label);
  if (!name) return { refused: t("newField.nameLetters", "Use letters or digits in the name.", { ns: "schedules" }) };

  const group = input.group.trim().slice(0, 60);
  const base: SharedFieldItemBody = {
    id: `${scope.replace(/[^A-Za-z0-9._:-]/g, "-")}:field:${name}`.slice(0, 200),
    revision: 1,
    key: `param.${name}`,
    label,
    appliesTo: EQUIPMENT,
    valueType: "text",
    ...(group ? { group } : {}),
    editable: true,
    storage: { kind: "parameter", scope: "instance", name },
  };
  if (input.holds === "text") return { item: { type: "field", body: base } };
  if (input.holds === "yes_no") return { item: { type: "field", body: { ...base, valueType: "boolean" } } };

  const unit = newFieldUnits(t).find((u) => u.unit === input.unit);
  if (!unit) return { refused: t("newField.unitRequired", "Choose the unit the number is in.", { ns: "schedules" }) };

  return { item: { type: "field", body: { ...base, valueType: "quantity", kind: unit.kind, unit: unit.unit } } };
}

export interface NewFieldFormProps {
  readonly provider: LibraryProviderPort;
  readonly scope: string;
  readonly scopeName: string;
  readonly onPublished: () => void;
  readonly onCancel: () => void;
}


export function NewFieldForm({ provider, scope, scopeName, onPublished, onCancel }: NewFieldFormProps) {
  const ids = useId();
  const t = useSchedulesTranslate();

  const [label, setLabel] = useState("");
  const [group, setGroup] = useState("");
  const [holds, setHolds] = useState<NewFieldHolds>("text");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const why = !provider.publish
    ? t("newField.cannotPublish", "This library can't be published to from here.", { ns: "schedules" })
    : label.trim() === ""
      ? t("newField.giveName", "Give the field a name first.", { ns: "schedules" })
      : holds === "number" && unit === ""
        ? t("newField.chooseUnit", "Choose the unit first.", { ns: "schedules" })
        : null;


  const publish = async () => {
    if (!provider.publish) return;

    const made = newFieldItem(scope, { label, group, holds, unit }, t);

    if ("refused" in made) {
      setProblem(made.refused);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await provider.publish(scope, made.item, 0);
      if (!result.ok) {

        setProblem(
          result.code === "conflict"
            ? t("newField.alreadyThere", "{{name}} is already in {{scope}}; find it in the list and change it there.", { ns: "schedules", name: label.trim(), scope: scopeName })
            : t("newField.nothingSaved", "{{message}} Nothing was saved.", { ns: "schedules", message: result.message }),
        );

        return;
      }
      onPublished();
    } catch (err) {
      console.error("[NewFieldForm] publish failed", err);

      setProblem(t("newField.saveFailed", "Saving the field failed: the connection dropped. Nothing was saved; try again.", { ns: "schedules" }));

    } finally {
      setBusy(false);
    }
  };

  return (

<div
      className="mutiny-sched-section"
      role="group"
      aria-label={t("newField.groupAria", "New field in {{scope}}", { ns: "schedules", scope: scopeName })}
      data-testid="library-new-field"
    >

      <div className="mutiny-sched-row">
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-label`}>{t("newField.name", "Name", { ns: "schedules" })}</label>
          <Input
            id={`${ids}-label`}
            value={label}
            placeholder={t("newField.namePlaceholder", "Hood ID", { ns: "schedules" })}
            onChange={(e) => setLabel(e.target.value)}
          />

        </div>
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-group`}>{t("newField.section", "Section", { ns: "schedules" })}</label>
          <Input
            id={`${ids}-group`}
            value={group}
            placeholder={t("newField.sectionPlaceholder", "Kitchen", { ns: "schedules" })}
            onChange={(e) => setGroup(e.target.value)}
          />

        </div>
        <div className="mutiny-sched-field">

<label htmlFor={`${ids}-holds`}>{t("newField.holds", "Holds", { ns: "schedules" })}</label>

          <NativeSelect id={`${ids}-holds`} value={holds} onChange={(e) => setHolds(e.target.value === "number" || e.target.value === "yes_no" ? e.target.value : "text")}>

<NativeSelectOption value="text">{t("newField.holdsText", "Text", { ns: "schedules" })}</NativeSelectOption>
            <NativeSelectOption value="number">{t("newField.holdsNumber", "A number", { ns: "schedules" })}</NativeSelectOption>
            <NativeSelectOption value="yes_no">{t("newField.holdsYesNo", "Yes or no", { ns: "schedules" })}</NativeSelectOption>

          </NativeSelect>
        </div>
        {holds === "number" ? (
          <div className="mutiny-sched-field">

<label htmlFor={`${ids}-unit`}>{t("newField.unit", "Unit", { ns: "schedules" })}</label>

            <NativeSelect id={`${ids}-unit`} value={unit} onChange={(e) => setUnit(e.target.value)}>

<NativeSelectOption value="">{t("newField.choose", "Choose", { ns: "schedules" })}</NativeSelectOption>
              {newFieldUnits(t).map((u) => (

                <NativeSelectOption key={u.unit} value={u.unit}>
                  {u.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>

<p className="mutiny-sched-help">
        {t(
          "newField.help",
          "It applies to equipment and fixtures. Projects show it in the equipment list (Add column), the Inspector and tags; the section names its column group.",
          { ns: "schedules" },
        )}
      </p>

      {problem ? (
        <p className="mutiny-sched-error" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="mutiny-sched-row">
        <Button size="sm" disabled={why !== null || busy} title={why ?? undefined} onClick={() => void publish()}>
          {busy ? <Spinner /> : null}

{busy ? t("newField.saving", "Saving…", { ns: "schedules" }) : t("newField.addTo", "Add to {{scope}}", { ns: "schedules", scope: scopeName })}

        </Button>

<Button variant="outline" size="sm" onClick={onCancel}>
          {t("newField.cancel", "Cancel", { ns: "schedules" })}
        </Button>

      </div>
      {why && !busy ? <p className="mutiny-sched-muted">{why}</p> : null}
    </div>
  );
}
