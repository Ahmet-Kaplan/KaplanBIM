/**
 * The schedule surfaces' own vocabulary: the roll-up names (§5 of
 * `docs/i18n/glossary.md`) and the field names a schedule lists.
 *
 * Both are read as *words*, not as data: a field arrives from the host's catalog
 * with an English label (`Gas input`, `MARK`, `ESTIMATE (VA)`) and is drawn as the
 * Turkish for the concept it names. A label this table has never heard of is
 * drawn exactly as it arrived — the model's own names are never mangled, and a
 * new field a pack ships shows in English until its row is added here.
 */
import type { Translate } from "./translate";

/**
 * The roll-up rules a column can total with (`AggregationRule` in
 * `@permitzip/bim-units`): `sum/max/min/none` are the four §5 pins
 * (toplam/azami/asgari/yok); `count`, `avg` and `list` are the aggregate
 * functions a related-item column can carry, so one table names all seven.
 */
export const ROLL_UP_RULES = ["sum", "max", "min", "none", "count", "avg", "list"] as const;

export type RollUpRule = (typeof ROLL_UP_RULES)[number];

/** "sum" → "Toplam" in tr, "Sum" in en. One word per rule, never a composed sentence. */
export function rollUpLabel(rule: string, t: Translate): string {
  switch (rule) {
    case "sum":
      return t("rollUp.sum", "Sum", { ns: "schedules" });
    case "max":
      return t("rollUp.max", "Max", { ns: "schedules" });
    case "min":
      return t("rollUp.min", "Min", { ns: "schedules" });
    case "none":
      return t("rollUp.none", "None", { ns: "schedules" });
    case "count":
      return t("rollUp.count", "Count", { ns: "schedules" });
    case "avg":
      return t("rollUp.avg", "Average", { ns: "schedules" });
    case "list":
      return t("rollUp.list", "List", { ns: "schedules" });
    default:
      return rule;
  }
}

/**
 * §5's field names, in the glossary's order, each asked of the translator with the
 * English it falls back to. Written out one call at a time rather than looped over
 * a table of strings: `npm run i18n:review` binds a key to its English by the
 * literal in the `t()` call, so a loop would leave every row looking like it had
 * neither a call site nor an English default.
 */
function fieldWords(t: Translate): ReadonlyMap<string, FieldWord> {
  const rows: readonly FieldWord[] = [
    { label: "mark", key: "field.mark", english: "Mark", word: t("field.mark", "Mark", { ns: "schedules" }) },
    { label: "type", key: "field.type", english: "Type", word: t("field.type", "Type", { ns: "schedules" }) },
    { label: "level", key: "field.level", english: "Level", word: t("field.level", "Level", { ns: "schedules" }) },
    { label: "room", key: "field.room", english: "Room", word: t("field.room", "Room", { ns: "schedules" }) },
    { label: "in room", key: "field.inRoom", english: "In room", word: t("field.inRoom", "In room", { ns: "schedules" }) },
    { label: "source path", key: "field.sourcePath", english: "Source path", word: t("field.sourcePath", "Source path", { ns: "schedules" }) },
    { label: "part type", key: "field.partType", english: "Part type", word: t("field.partType", "Part type", { ns: "schedules" }) },
    { label: "description", key: "field.description", english: "Description", word: t("field.description", "Description", { ns: "schedules" }) },
    { label: "unit", key: "field.unit", english: "Unit", word: t("field.unit", "Unit", { ns: "schedules" }) },
    { label: "width", key: "field.width", english: "Width", word: t("field.width", "Width", { ns: "schedules" }) },
    { label: "length", key: "field.length", english: "Length", word: t("field.length", "Length", { ns: "schedules" }) },
    { label: "height", key: "field.height", english: "Height", word: t("field.height", "Height", { ns: "schedules" }) },
    { label: "fire rating", key: "field.fireRating", english: "Fire rating", word: t("field.fireRating", "Fire rating", { ns: "schedules" }) },
    { label: "k factor", key: "field.kFactor", english: "K factor", word: t("field.kFactor", "K factor", { ns: "schedules" }) },
    { label: "temperature rating", key: "field.temperatureRating", english: "Temperature rating", word: t("field.temperatureRating", "Temperature rating", { ns: "schedules" }) },
    { label: "moment", key: "field.moment", english: "Moment", word: t("field.moment", "Moment", { ns: "schedules" }) },
    { label: "storage", key: "field.storage", english: "Storage", word: t("field.storage", "Storage", { ns: "schedules" }) },
    { label: "gas input", key: "field.gasInput", english: "Gas input", word: t("field.gasInput", "Gas input", { ns: "schedules" }) },
    { label: "served load", key: "field.servedLoad", english: "Served load", word: t("field.servedLoad", "Served load", { ns: "schedules" }) },
    { label: "supply load", key: "field.supplyLoad", english: "Supply load", word: t("field.supplyLoad", "Supply load", { ns: "schedules" }) },
    { label: "drainage load", key: "field.drainageLoad", english: "Drainage load", word: t("field.drainageLoad", "Drainage load", { ns: "schedules" }) },
    { label: "serves", key: "field.serves", english: "Serves", word: t("field.serves", "Serves", { ns: "schedules" }) },
    { label: "panel", key: "field.panel", english: "Panel", word: t("field.panel", "Panel", { ns: "schedules" }) },
    { label: "column heading", key: "field.columnHeading", english: "Column heading", word: t("field.columnHeading", "Column heading", { ns: "schedules" }) },
    { label: "formula", key: "field.formula", english: "Formula", word: t("field.formula", "Formula", { ns: "schedules" }) },
    { label: "formula name", key: "field.formulaName", english: "Formula name", word: t("field.formulaName", "Formula name", { ns: "schedules" }) },
    { label: "group by", key: "field.groupBy", english: "Group by", word: t("field.groupBy", "Group by", { ns: "schedules" }) },
    { label: "sort by", key: "field.sortBy", english: "Sort by", word: t("field.sortBy", "Sort by", { ns: "schedules" }) },
    { label: "section", key: "field.section", english: "Section", word: t("field.section", "Section", { ns: "schedules" }) },
    { label: "order", key: "field.order", english: "Order", word: t("field.order", "Order", { ns: "schedules" }) },
    { label: "schedule name", key: "field.scheduleName", english: "Schedule name", word: t("field.scheduleName", "Schedule name", { ns: "schedules" }) },
    { label: "empty cells show", key: "field.emptyCells", english: "Empty cells show", word: t("field.emptyCells", "Empty cells show", { ns: "schedules" }) },
    { label: "show only rows where", key: "field.filterRows", english: "Show only rows where", word: t("field.filterRows", "Show only rows where", { ns: "schedules" }) },
    { label: "one summary value", key: "field.singleSummary", english: "One summary value", word: t("field.singleSummary", "One summary value", { ns: "schedules" }) },
    { label: "a number", key: "field.aNumber", english: "A number", word: t("field.aNumber", "A number", { ns: "schedules" }) },
    { label: "yes or no", key: "field.yesOrNo", english: "Yes or no", word: t("field.yesOrNo", "Yes or no", { ns: "schedules" }) },
    { label: "text", key: "field.text", english: "Text", word: t("field.text", "Text", { ns: "schedules" }) },
    { label: "not printed", key: "field.notPrinted", english: "Not printed", word: t("field.notPrinted", "Not printed", { ns: "schedules" }) },
    { label: "retired", key: "field.retired", english: "Retired", word: t("field.retired", "Retired", { ns: "schedules" }) },
    { label: "total", key: "field.total", english: "Total", word: t("field.total", "Total", { ns: "schedules" }) },
    { label: "name", key: "field.name", english: "Name", word: t("field.name", "Name", { ns: "schedules" }) },
    { label: "number", key: "field.number", english: "Number", word: t("field.number", "Number", { ns: "schedules" }) },
    { label: "area", key: "field.area", english: "Area", word: t("field.area", "Area", { ns: "schedules" }) },
    { label: "status", key: "field.status", english: "Status", word: t("field.status", "Status", { ns: "schedules" }) },
    { label: "stage", key: "field.stage", english: "Stage", word: t("field.stage", "Stage", { ns: "schedules" }) },
    { label: "connection type", key: "field.connectionType", english: "Connection type", word: t("field.connectionType", "Connection type", { ns: "schedules" }) },
    { label: "planned level", key: "field.plannedLevel", english: "Planned level", word: t("field.plannedLevel", "Planned level", { ns: "schedules" }) },
    { label: "what", key: "field.what", english: "What", word: t("field.what", "What", { ns: "schedules" }) },
    { label: "estimate", key: "field.estimate", english: "Estimate", word: t("field.estimate", "Estimate", { ns: "schedules" }) },
    { label: "devices so far", key: "field.devicesSoFar", english: "Devices so far", word: t("field.devicesSoFar", "Devices so far", { ns: "schedules" }) },
    { label: "counted", key: "field.counted", english: "Counted", word: t("field.counted", "Counted", { ns: "schedules" }) },
    { label: "estimate vs devices", key: "field.estimateVsDevices", english: "Estimate vs devices", word: t("field.estimateVsDevices", "Estimate vs devices", { ns: "schedules" }) },
  ];
  return new Map(rows.map((row) => [row.label, row]));
}

/** One row as the active translator reads it: the English it falls back to, and the word it was given instead. */
interface FieldWord {
  /** The label with its unit taken off, lower-cased: what a heading is matched by. */
  readonly label: string;
  readonly key: string;
  readonly english: string;
  readonly word: string;
}

/** One field-word table per translator: a schedule asks per heading and per cell, so the fifty calls are made once per language, not once per cell. */
const WORDS = new WeakMap<Translate, ReadonlyMap<string, FieldWord>>();

function words(t: Translate): ReadonlyMap<string, FieldWord> {
  const seen = WORDS.get(t);
  if (seen) return seen;
  const built = fieldWords(t);
  WORDS.set(t, built);
  return built;
}

/**
 * A heading's words without its unit: `ESTIMATE (VA)` → { `estimate`, `VA` }. The
 * unit is a symbol (§7) and stays exactly as it is, so only the words in front are
 * replaced.
 */
export function splitUnit(label: string): { readonly words: string; readonly unit: string } {
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/u.exec(label);
  return match?.[1] !== undefined && match[2] !== undefined ? { words: match[1], unit: match[2] } : { words: label, unit: "" };
}

/**
 * A schedule field (or column heading) in the language on screen, keeping its
 * unit suffix. `MARK` → `İşaret`, `GAS INPUT (MBH)` → `Gaz girişi (MBH)`, and an
 * unknown label comes back untouched.
 *
 * A word the active language has not translated keeps the model's own label
 * character for character — `MARK` stays `MARK` in English, never `Mark`: the
 * model's headings are data, and the English is not allowed to move by one
 * character. That is why the English it falls back to is compared here rather
 * than trusted.
 */
export function scheduleFieldLabel(label: string, t: Translate): string {
  const { words: text, unit } = splitUnit(label);
  const entry = words(t).get(text.trim().toLowerCase());
  if (entry === undefined || entry.word === "" || entry.word === entry.english) return label;
  return unit === "" ? entry.word : `${entry.word} (${unit})`;
}
