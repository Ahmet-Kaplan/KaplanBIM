/**
 * @jest-environment node
 *
 * Round 11 F11: a finding names the version of the rule that made it
 * (`Finding.ruleVersion`), so the ledger's `FindingRef.source.version` moves
 * when the rule does and a decision taken against version 1 re-opens once the
 * rule is fixed as version 2.
 *
 * Before this, nothing stamped it: `RuleDef.version` was declared, `Finding.ruleVersion`
 * was declared and documented as re-opening a decision, and no code joined them. Every
 * finding read as "1" whatever its rule said, so a bump left every old acceptance
 * honoured: a fixed rule stayed silently accepted. The suite was green (124 tests)
 * because no test read a version off a finding a rule had actually emitted.
 */
import { commandSchema, planCommit, withUpgradePolicy, type Actor, type ModelState } from "@permitzip/bim-kernel";
import { dispositionIndex, dispositionStanding, lintFindingRef, standingIsOpen } from "../../bim-kernel/src/findings/api";
import { ALL_RULES, DEFAULT_RULE_VERSION, LintEngine, ruleVersionOf, type Finding, type RuleDef } from "../src";
import { FT, Model, SUPPLY, config, engineFor, linkedBuilding } from "./fixtures";

const PERSON: Actor = { id: "user-rao", name: "J. Rao", kind: "human" };

/** A rule that reports on every run segment, declared at the version it is handed (the point's own shape, unchecked here). */
function probeRule(version: unknown): RuleDef {
  return {
    id: "version-probe",
    version: version as number,
    pack: "coordination",
    severity: "warning",
    title: "A probe that reports on every run",
    scope: "element",
    kinds: ["run_segment"],
    run: (ctx, el) =>
      ctx.emit({ rule: "version-probe", severity: "warning", elementIds: [el.id], at: { level: "Level 1", x_ft: 0, y_ft: 0, z_ft: 0 }, message: "The probe reports on this run" }),
  };
}

/** One duct on Level 1: an element the probe lints. */
function oneDuct(): ModelState {
  const m = new Model();
  m.duct("sa", SUPPLY, [[10, 10], [50, 10]], 9);
  return m.head;
}

/** The probe run at `version`: what it reports on one duct. */
function probe(version: unknown): Finding[] {
  const engine = new LintEngine([probeRule(version)]);
  engine.build(oneDuct());
  return engine.check({ config: config() });
}

let decisions = 0;

/** A person's `accepted_known` on `findingId` against `sourceVersion`, recorded in the model (the kernel's own writer). */
function decided(model: ModelState, findingId: string, sourceVersion: string): ModelState {
  decisions += 1;
  const plan = withUpgradePolicy(
    () => true,
    () =>
      planCommit(model, [], {
        idempotencyKey: `f11-rule-version-${decisions}`,
        baseRevision: model.revision,
        actor: PERSON,
        command: commandSchema.parse({
          type: "record_finding_disposition",
          findingId,
          sourceVersion,
          action: "accepted_known",
          reason: "Known clash; the contractor reroutes in the field.",
          at: "2026-11-02T15:00:00Z",
        }),
      }),
  );
  if (!plan.ok) throw new Error(`record_finding_disposition: ${plan.error.message}`);
  return plan.model;
}

describe("a finding carries the version of the rule that made it", () => {
  it("the engine stamps the rule's own version on what it reports", () => {
    const found = probe(3);
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe("version-probe");
    expect(found[0]?.ruleVersion).toBe("3");
  });

  it('a rule that declares no version yields "1" (the ledger\'s default, so old ledgers still match)', () => {
    expect(DEFAULT_RULE_VERSION).toBe("1");
    expect(ruleVersionOf({ version: undefined as unknown as number })).toBe("1");
    expect(probe(undefined)[0]?.ruleVersion).toBe("1");
  });

  it('a version that is not a number yields "1", never undefined', () => {
    expect(ruleVersionOf(null)).toBe("1");
    expect(ruleVersionOf({ version: Number.NaN })).toBe("1");
    expect(ruleVersionOf({ version: Number.POSITIVE_INFINITY })).toBe("1");
    expect(probe(Number.NaN)[0]?.ruleVersion).toBe("1");
  });

  it("every finding on a real model names its rule's declared version, floating-equipment's 2 included", () => {
    const m = new Model();
    m.placeRtu("rtu-1", { x: 70 * FT, y: 20 * FT });
    const findings = engineFor(m.head, [linkedBuilding()]).check({ config: config({ ruleset: "issue" }) });
    expect(findings.length).toBeGreaterThan(0);
    const declared = new Map(ALL_RULES.map((r) => [r.id, String(r.version)]));
    for (const f of findings) expect(f.ruleVersion).toBe(declared.get(f.rule));
    const floats = findings.filter((f) => f.rule === "floating-equipment");
    expect(floats.length).toBeGreaterThan(0);
    for (const f of floats) expect(f.ruleVersion).toBe("2");
  });
});

describe("a version bump re-opens a decision taken against the old one", () => {
  it("accepted at the rule's version 1: disposed; the rule moves to 2: the same finding re-opens, the decision kept", () => {
    const at1 = probe(1)[0] as Finding;
    const at2 = probe(2)[0] as Finding;
    // The same problem under the same id: only the rule's version moved.
    expect(at2.id).toBe(at1.id);
    expect(at1.ruleVersion).toBe("1");
    expect(at2.ruleVersion).toBe("2");

    const ref1 = lintFindingRef(at1, { revision: 5 }, "main");
    const ref2 = lintFindingRef(at2, { revision: 6 }, "main");
    expect(ref1.source).toEqual({ kind: "lint_rule", id: "version-probe", version: "1" });
    expect(ref2.source).toEqual({ kind: "lint_rule", id: "version-probe", version: "2" });

    // One person accepted it, against the version they were shown.
    const index = dispositionIndex(decided(oneDuct(), ref1.id, "1").elements);

    expect(dispositionStanding(ref1, index).state).toBe("disposed");
    const reopened = dispositionStanding(ref2, index);
    expect(reopened.state).toBe("earlier_version");
    expect(reopened).toMatchObject({ words: "Accepted against an earlier version of this check", disposition: { sourceVersion: "1" } });
    expect(standingIsOpen(reopened)).toBe(true);
  });

  it("an unchanged version keeps the decision honoured", () => {
    const at2 = probe(2)[0] as Finding;
    const index = dispositionIndex(decided(oneDuct(), lintFindingRef(at2, { revision: 5 }, "main").id, "2").elements);
    const ref = lintFindingRef(at2, { revision: 5 }, "main");
    expect(dispositionStanding(ref, index).state).toBe("disposed");
    // The rule runs again, unchanged: still version 2, still the person's decision.
    const again = lintFindingRef(probe(2)[0] as Finding, { revision: 6 }, "main");
    expect(again.source.version).toBe("2");
    expect(dispositionStanding(again, index).state).toBe("disposed");
  });
});
