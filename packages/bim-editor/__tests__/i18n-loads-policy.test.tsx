/**
 * The loads-policy tree in two languages — the guard for
 * `src/editor/loads-policy`.
 *
 * The tree is one control: how a space's estimates count once devices are placed
 * in it. It was seven unkeyed sites in one file and one English splice — the
 * kernel's policy names dropped into a Turkish frame — and
 * `i18n-negative-space.test.ts` now owns the tree. This file proves the rest:
 *
 *   1. **The English on screen did not change.** The policy names and their help
 *      lines were `ALLOCATION_POLICY_LABELS`/`ALLOCATION_POLICY_HELP`; the tree
 *      writes them at the call site now, and each row is asserted against that
 *      kernel constant, so the two cannot drift apart silently in either
 *      direction.
 *   2. **A policy is never left in English on a Turkish screen**, and a fourth
 *      policy in the kernel fails to compile before it can reach one: the two
 *      switches are typed by the kernel's `AllocationPolicy` union.
 *   3. **§0.7 and §8 hold**: a sentence addresses the reader politely in the
 *      plural, a number takes no plural suffix, and §7's `×` stays a symbol.
 */
import { ALLOCATION_POLICY_HELP, ALLOCATION_POLICY_LABELS, type AllocationPolicy } from "@permitzip/bim-kernel";
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { allocationPolicyHelp, allocationPolicyLabel } from "../src/editor/loads-policy/EstimateCountingField";

const TR = translateFor("tr");
const EN = translateFor("en");

/** The editor's Turkish, flattened to the dotted keys the call sites use. */
function flatten(node: unknown, prefix = ""): Record<string, string> {
  if (typeof node === "string") return { [prefix]: node };
  if (typeof node !== "object" || node === null) return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, value]) => Object.assign(out, flatten(value, prefix === "" ? key : `${prefix}.${key}`)),
    {},
  );
}

const TURKISH = flatten((editorResources.tr as Record<string, unknown> | undefined)?.editor);

const treeKeys = (): string[] => [...editorSourceCaptions().keys()].filter((key) => key.startsWith("loadsPolicy."));

/** Every caption in this tree is written once; a second site would have to be pinned here. */
const SITES: Readonly<Record<string, number>> = {};

interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §2.3: a space is a mekan; the control says how its estimates are counted.
  { key: "loadsPolicy.label", english: "Estimates count", turkish: "Tahminlerin sayımı" },
  { key: "loadsPolicy.aria", english: "How this space's estimates count", turkish: "Bu mekanın tahminleri nasıl sayılır" },
  {
    key: "loadsPolicy.gone",
    english: "This space is no longer in the model. Someone may have deleted it; pick another space.",
    turkish: "Bu mekan artık modelde yok. Birisi silmiş olabilir; başka bir mekan seçin.",
  },
  // §5: a quantity is a miktar, a load is a yük — but this control counts estimates, not loads.
  { key: "loadsPolicy.policy.max", english: "Estimate until devices exceed it", turkish: "Cihazlar geçene kadar tahmin" },
  {
    key: "loadsPolicy.policy.actualOnly",
    english: "Devices only once any are placed",
    turkish: "Cihaz konunca yalnız cihazlar",
  },
  { key: "loadsPolicy.policy.allocationOnly", english: "Estimate only", turkish: "Yalnız tahmin" },
  {
    key: "loadsPolicy.help.max",
    english: "The estimate counts until the devices placed in the space add up to more, quantity by quantity.",
    turkish: "Mekana yerleştirilen cihazlar, kalem kalem tahminden fazla olana kadar tahmin geçerlidir.",
  },
  {
    key: "loadsPolicy.help.actualOnly",
    english: "Once any device is placed in the space, only the devices count; until then the estimate does.",
    turkish: "Mekana bir cihaz yerleştirildiğinde yalnız cihazlar sayılır; o zamana kadar tahmin sayılır.",
  },
  {
    key: "loadsPolicy.help.allocationOnly",
    english: "Only the estimate counts, whatever is placed (early studies).",
    turkish: "Ne yerleştirilirse yerleştirilsin yalnız tahmin sayılır (erken çalışmalar).",
  },
  {
    key: "loadsPolicy.asModelSays",
    english: "As the model says ({{policy}})",
    turkish: "Modelin dediği gibi ({{policy}})",
  },
  // §5's quantity kinds, framed by our own sentence: the numbers and their units are data.
  { key: "loadsPolicy.now", english: "Now: {{text}}.", turkish: "Şimdi: {{text}}." },
  {
    key: "loadsPolicy.typical",
    english: "In typical {{kind}} {{mark}}: counted once here, {{count}}× in the project totals.",
    turkish: "Tipik {{kind}} {{mark}} içinde: burada bir kez, proje toplamlarında {{count}}× sayılır.",
  },
  // One sentence per choice: a verb is not glued to an untranslated noun.
  {
    key: "loadsPolicy.undoModel",
    english: "count estimates as the model says in {{where}}",
    turkish: "{{where}}: tahminleri modelin dediği gibi say",
  },
  {
    key: "loadsPolicy.undoPolicy",
    english: "count estimates: {{policy}} in {{where}}",
    turkish: "{{where}}: tahminleri {{policy}} say",
  },
];

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "loadsPolicy.asModelSays": { policy: "cihazlar geçene kadar tahmin" },
  "loadsPolicy.now": { text: "3 cihaz, 12 A" },
  "loadsPolicy.typical": { kind: "oda", mark: "A", count: 4 },
  "loadsPolicy.undoModel": { where: "Mutfak" },
  "loadsPolicy.undoPolicy": { policy: "yalnız tahmin", where: "Mutfak" },
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("the guard is looking at this tree's captions, not an empty list", () => {
  expect(treeKeys().length).toBeGreaterThanOrEqual(14);
});

test("every caption is still keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("the policy words are the kernel's own English, so the screen says what it said before", () => {
  // The tree writes the English at the call site (the caption scan has to read it);
  // these two asserts are what keeps that copy honest against the kernel's constants.
  for (const policy of ["max", "actual_only", "allocation_only"] as const)
    expect(allocationPolicyLabel(policy, EN)).toBe(ALLOCATION_POLICY_LABELS[policy]);
  for (const policy of ["max", "actual_only", "allocation_only"] as const)
    expect(allocationPolicyHelp(policy, EN)).toBe(ALLOCATION_POLICY_HELP[policy]);
});

test("§2.3/§5: a policy reads Turkish in a Turkish frame, with no English spliced in", () => {
  const POLICIES: readonly AllocationPolicy[] = ["max", "actual_only", "allocation_only"];
  for (const policy of POLICIES) {
    expect(allocationPolicyLabel(policy, TR)).toBe(TURKISH[`loadsPolicy.policy.${policy === "max" ? "max" : policy === "actual_only" ? "actualOnly" : "allocationOnly"}`]);
    // Not the kernel's English, in any row.
    expect(allocationPolicyLabel(policy, TR)).not.toBe(ALLOCATION_POLICY_LABELS[policy]);
    expect(allocationPolicyHelp(policy, TR)).not.toBe(ALLOCATION_POLICY_HELP[policy]);
  }
  // The frame the old code built by hand: the model's label inside a Turkish bracket.
  expect(
    TR("loadsPolicy.asModelSays", "As the model says ({{policy}})", { ns: "editor", policy: "cihazlar geçene kadar tahmin" }),
  ).toBe("Modelin dediği gibi (cihazlar geçene kadar tahmin)");
});

test("every caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("no caption falls back to English, and no key is translated without a call site", () => {
  const written = new Set(treeKeys());
  expect(treeKeys().filter((key) => (TURKISH[key] ?? "").trim() === "")).toEqual([]);
  expect(Object.keys(TURKISH).filter((key) => key.startsWith("loadsPolicy.")).filter((key) => !written.has(key))).toEqual([]);
});

test("a placeholder on one side is on the other, and is never written with one brace", () => {
  const placeholders = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  expect(
    treeKeys()
      .filter((key) => placeholders(source.get(key)?.english ?? "").join(",") !== placeholders(TURKISH[key] ?? "").join(","))
      .map((key) => `${key}: EN [${placeholders(source.get(key)?.english ?? "")}] TR [${placeholders(TURKISH[key] ?? "")}]`),
  ).toEqual([]);
  expect(
    treeKeys()
      .filter((key) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(TURKISH[key] ?? ""))
      .map((key) => key),
  ).toEqual([]);
});

test("a caption written in more than one place is pinned at that count", () => {
  const source = editorSourceCaptions();
  const keys = new Set(treeKeys());
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
  expect(
    [...source.entries()]
      .filter(([key, caption]) => keys.has(key) && caption.sites > 1 && SITES[key] === undefined)
      .map(([key, caption]) => `${key}: ${caption.sites}`),
  ).toEqual([]);
});

test("a caption reads the way a call site fills it, in both languages", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    expect({ key: caption.key, text: TR(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values),
    });
  }
  // §7: the multiplication sign is a symbol, and §8: no plural suffix after a count.
  expect(TR("loadsPolicy.typical", "In typical {{kind}} {{mark}}: counted once here, {{count}}× in the project totals.", { ns: "editor", kind: "oda", mark: "A", count: 4 })).toBe(
    "Tipik oda A içinde: burada bir kez, proje toplamlarında 4× sayılır.",
  );
});
