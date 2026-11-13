# Units

## What it owns

| Where | What |
|---|---|
| `packages/bim-units/src/codes.ts` | The stable vocabulary: `KIND_IDS` (`:12`, 53 kinds) and `UNIT_CODES` (`:70`, 151 unit codes), and which units may express which kind (`KIND_UNITS`) |
| `packages/bim-units/src/kinds.ts` | The kind table (`LIST`, `:20`): each kind's dimension, its disciplines, and how a total combines it — `sum` for lengths and flows, `none` for pressures, velocities and temperatures |
| `packages/bim-units/src/units.ts` | One entry per unit code: `factor`, `offset`, symbol, label, UCUM spelling |
| `packages/bim-units/src/dimension.ts` | Dimensional exponents (`L M T I Th J C $`) and `sameDimension` |
| `packages/bim-units/src/profiles.ts` | Three built-in display profiles (`:133`): US feet-inches, US decimal feet, metric mm — each a **data** table of unit, precision and separator per kind |
| `packages/bim-units/src/format.ts` | `formatter(kind, profile)` — the cached SI → text function (`:217`) |
| `packages/bim-units/src/quantity.ts`, `parse.ts`, `adapters.ts`, `money.ts`, `lookup.ts`, `kind-point.ts` | Conversion, refusal, parsing, rate adaptation, money formatting, a unit-kind extension point |
| `packages/bim-ui/src/i18n/format.ts` | The **locale** form: `formatNumber`, `formatQuantity(value, unit, language)` (`:66`), `separatorsFor` (`:100`) |

## The contract

1. **A value carries its kind.** `Quantity<K> = number & {brand: K}` (`bim-units/src/types.ts:54`) is coherent SI and can only be produced by `qty()`/`to()`, which refuse a unit the kind cannot be written in (`quantity.ts`, `assertKindUnit`). A `Measure` (`types.ts:68`) carries `kind` and an SI `value` for code that only knows the kind at runtime. `InUnit<U>` (`types.ts:61`) marks a number computed in one fixed unit — convert it at the module boundary.
2. **A parameter names its kind, and a quantity field must name one.** `FieldDef.kind` and `FieldDef.unit` (`bim-kernel/src/registry/types.ts:152,154`). The registry builder refuses a quantity field without both (`registry.ts:102`) and, where the builder was given a unit catalog, refuses a unit that cannot express the kind (`registry.ts:106`). `fieldProviderRegistryBuilder` passes `BIM_UNIT_CATALOG` by default (`fields/providers/index.ts:33,71`); the kernel's class registry passes none and declares no fields, so the cross-check lives where fields are declared.
3. **The kernel works in millimetres.** Element geometry is mm — a plan point rounds to 0.1 mm (`bim-kernel/src/import/shape.ts:142`), QTO divides by `MM_PER_M = 1000` (`qto/measure.ts:30,69`), and `bim-geometry` states the assumption rather than converting (`polygon-measure.ts:6-8`, `polygon-label.ts:20`). Millimetres are the unit *stored*; a display profile decides what a person reads.
4. **Separators come from data, not from `toLocaleString`.** `formatter` multiplies by `factor`, adds `offset`, rounds, then joins digits with `profile.thousands` and `profile.decimal` (`format.ts:1-12`). The metric profile groups with a space (`profiles.ts:129`); a firm's own profile is a library row (`bim-library/src/apply.ts:154`). `bim-ui` reads the same two characters out of `Intl` for a language (`format.ts:100`) rather than writing them down.
5. **The number localises; the unit symbol does not.** `formatQuantity(12.5, "kVA", "tr")` is `12,5 kVA` — never `kva`, never Turkish digits (`bim-ui/src/i18n/format.ts:60-67`). Unit *names* translate (`Amps` → `Amper`); symbol strings are the same characters in every language.

## How it goes wrong

- **An untyped number in an API.** `thickness: number` where the file's convention is mm: nothing is broken until a pack that computes in feet passes one. *Tell:* a bare `number` parameter whose doc comment has to say the unit.
- **A hardcoded conversion factor.** `0.3048`, `25.4`, `1000` written into a calculation that `UNITS[x].factor` already holds. *Tell:* a magic constant next to a comment naming a unit.
- **Assuming millimetres in code that is not the kernel.** A pack that computes in amps, feet or psi and hands the result on as though it were mm. `InUnit<U>` exists to make that boundary explicit (`types.ts:61`).
- **`toLocaleString("en-US")` where the output is a string a person reads.** There are 50 such calls in `bim-kernel/src` (11) and the three trade packs that print numbers — electrical 17, plumbing 15, mechanical 7 — and 86 across `packages/*/src`: the other 36 are `bim-editor` 29 (26 of them in `.tsx`), `bim-schedules-ui` 3, `bim-library` 2, `bim-units` 1, `bim-sync` 1. Counted with `grep -rnoE 'toLocaleString\(\s*["'"'"']en-US["'"'"']' packages/*/src --include='*.ts' --include='*.tsx' | wc -l`; a `.ts`-only glob reports 58 and misses `bim-editor`'s `.tsx` files. The consequence is not a rounding error: the digits are English-formatted inside a Turkish sentence. A Turkish sentence showing `1,500 VA` where Turkish writes `1.500 VA`. It is a *decision* today, pinned in `packages/bim-ui/__tests__/i18n-prose.test.ts:135-144` — a prose slot arrives already formatted and the Turkish sentence keeps it, because re-formatting a slot that is sometimes an id or a date belongs to the display profile, not to the translator. `bim-units/src/format.ts:11` states the same rule for its own module ("No `toLocaleString`"). *Tell:* `toLocaleString` in any file whose output reaches a screen or a schedule cell.
- **A unit symbol in a locale file.** `kVA` translated to `kva`, `mm²` to `m²`. *Tell:* a `locales/tr/*.json` value that differs from its English only in a unit.
- **A rate mistaken for its dimension.** Two kinds can share a dimension and must not convert into each other — WSFU and DFU, joules and newton-metres, a temperature and a temperature difference (`quantity.ts:57-58`, kinds at `kinds.ts:63-64`). *Tell:* a conversion that compiles and means nothing.

## Where the guard is

| Guard | Catches | Blind to |
|---|---|---|
| `packages/bim-units/__tests__/units.test.ts` | `qty`/`convert` refusing a wrong-kind unit, WSFU + DFU, absolute vs delta temperature, feet-inches and station formatting, parse round-trips, every built-in unit round-tripping within 1e-9 | any code that never calls `qty` |
| `packages/bim-units/__tests__/units-format-cases.test.ts` | the perf gate's three formatter cases (CFM grouped, MBH to one place, feet-inches to 1/16") as exact output strings | a profile edited to a plausible wrong separator |
| `packages/bim-units/__tests__/rates.test.ts` | a rate staying apart from the kind that shares its dimension; rates not summed into a total | — |
| `packages/bim-units/__tests__/codes.test.ts` | the code tables' units converting as the code prints them | — |
| `packages/bim-ui/__tests__/i18n-format.test.ts` | `separatorsFor("tr")` → `{",", "."}`, `en` → `{".", ","}`, and `formatQuantity` keeping the symbol | a caller that never uses it |
| `bim-kernel/src/registry/registry.ts:102-108` | a quantity field with no kind or unit, or a unit that cannot express its kind | the registry built without a unit catalog (classes and relationships only) |
| — | **no guard** on a bare number crossing an API boundary, and **no guard** on `toLocaleString("en-US")`; the only tell is a grep | review-only |
