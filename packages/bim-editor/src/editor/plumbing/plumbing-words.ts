/**
 * The words the plumbing screens show for the codes the model stores.
 *
 * `DEMAND_CURVE_LABEL`, `BUILDING_TYPE_LABEL` and `GAS_FUEL_LABEL`
 * (`@permitzip/bim-pack-plumbing`) and `SYSTEM_PATTERN_LABEL` /
 * `SYSTEM_WEIGHT_LABEL` (`@permitzip/bim-kernel`) are English data tables: the
 * model keeps `ashrae_b`, `nursing_home`, `natural`, `dash_dot` or `thin` and the
 * table says the word. A plumbing screen that draws them straight therefore puts
 * an English word in a Turkish frame — the splice the bilingual rules forbid — in
 * an option list *and*, worse, inside a sentence ("Size water pipes on …").
 *
 * So each one is a `label(t)` accessor and not a second table: the code stays the
 * key, the word comes from `t()` with the table's own English written beside it,
 * so a host with no Turkish reads exactly what it reads today. Same shape as
 * `loadTradeWord` (`loads/loads-breakdown.ts`) and `viewCategoryWord`
 * (`views-sheets/category-labels.ts`), and the seed of the field map Stage 5 owns.
 *
 * The English is written at each `t()` call rather than read off the table,
 * because `npm run i18n:review` and `editorSourceCaptions()` bind a key to the
 * English literal in the call: a key whose English came from a variable would be
 * an orphan to both. `i18n-plumbing.test.tsx` measures that every word here is
 * the table's word, character for character.
 */
import type { GasFuel } from '@permitzip/bim-pack-plumbing'
import type { PipeMaterial, SystemLinePattern, SystemLineWeight } from '@permitzip/bim-kernel'
import type { PlumbingBuildingType, PlumbingDemandCurve } from '@permitzip/bim-pack-plumbing'
import { englishOnly, type Translate } from '../i18n/translate'

export function buildingTypeWord(type: PlumbingBuildingType, t: Translate = englishOnly): string {
  switch (type) {
    case 'restaurant':
      return t('plumbing.building.restaurant', 'Restaurant', { ns: 'editor' })
    case 'hospital':
      return t('plumbing.building.hospital', 'Hospital', { ns: 'editor' })
    case 'nursing_home':
      return t('plumbing.building.nursingHome', 'Nursing home', { ns: 'editor' })
    case 'dormitory':
      return t('plumbing.building.dormitory', 'Dormitory', { ns: 'editor' })
    case 'hotel':
      return t('plumbing.building.hotel', 'Hotel', { ns: 'editor' })
    case 'motel':
      return t('plumbing.building.motel', 'Motel', { ns: 'editor' })
    case 'apartment':
      return t('plumbing.building.apartment', 'Apartment building', { ns: 'editor' })
    case 'office':
      return t('plumbing.building.office', 'Office', { ns: 'editor' })
    case 'school':
      return t('plumbing.building.school', 'School', { ns: 'editor' })
    case 'other':
      return t('plumbing.building.other', 'Other', { ns: 'editor' })
  }
}

export function demandCurveWord(curve: PlumbingDemandCurve, t: Translate = englishOnly): string {
  switch (curve) {
    case 'ashrae_a':
      return t('plumbing.curveName.ashraeA', 'ASHRAE Curve A (restaurants)', { ns: 'editor' })
    case 'ashrae_b':
      return t('plumbing.curveName.ashraeB', 'ASHRAE Curve B (hospitals, hotels, dormitories)', { ns: 'editor' })
    case 'ashrae_c':
      return t('plumbing.curveName.ashraeC', 'ASHRAE Curve C (apartments)', { ns: 'editor' })
    case 'ashrae_d':
      return t('plumbing.curveName.ashraeD', 'ASHRAE Curve D (offices, schools)', { ns: 'editor' })
    case 'ipc_e_tank':
      return t('plumbing.curveName.ipcTank', 'IPC Appendix E, flush tanks', { ns: 'editor' })
    case 'ipc_e_valve':
      return t('plumbing.curveName.ipcValve', 'IPC Appendix E, flushometer valves', { ns: 'editor' })
    case 'firm':
      return t('plumbing.curveName.firm', 'Firm curve', { ns: 'editor' })
    case 'legacy_fit':
      return t('plumbing.curveName.legacyFit', 'Hunter-style power fit (old default)', { ns: 'editor' })
  }
}

/** The two fuels a gas system can carry; the caller lowercases it for the middle of a sentence. */
export function gasFuelWord(fuel: GasFuel, t: Translate = englishOnly): string {
  return fuel === 'natural' ? t('plumbing.fuel.natural', 'Natural gas', { ns: 'editor' }) : t('plumbing.fuel.propane', 'Propane', { ns: 'editor' })
}

export function linePatternWord(pattern: SystemLinePattern, t: Translate = englishOnly): string {
  switch (pattern) {
    case 'solid':
      return t('plumbing.pattern.solid', 'Solid', { ns: 'editor' })
    case 'dashed':
      return t('plumbing.pattern.dashed', 'Dashed', { ns: 'editor' })
    case 'dotted':
      return t('plumbing.pattern.dotted', 'Dotted', { ns: 'editor' })
    case 'dash_dot':
      return t('plumbing.pattern.dashDot', 'Dash dot', { ns: 'editor' })
    case 'dash_dot_dot':
      return t('plumbing.pattern.dashDotDot', 'Dash dot dot', { ns: 'editor' })
    case 'dash_dot_dot_dot':
      return t('plumbing.pattern.dashDotDotDot', 'Dash dot dot dot', { ns: 'editor' })
    case 'long_dash':
      return t('plumbing.pattern.longDash', 'Long dash', { ns: 'editor' })
  }
}

export function lineWeightWord(weight: SystemLineWeight, t: Translate = englishOnly): string {
  switch (weight) {
    case 'thin':
      return t('plumbing.weightWord.thin', 'Thin', { ns: 'editor' })
    case 'medium':
      return t('plumbing.weightWord.medium', 'Medium', { ns: 'editor' })
    case 'wide':
      return t('plumbing.weightWord.wide', 'Wide', { ns: 'editor' })
    case 'heavy':
      return t('plumbing.weightWord.heavy', 'Heavy', { ns: 'editor' })
  }
}

/**
 * What a pipe is made of — a `label(t)` accessor, not a table: the kernel lists the
 * materials as ids only, so the English lives in the `t()` call and a Turkish screen
 * reads the Turkish beside it. `PEX`, `CPVC`, `PVC`, `ABS`, `PP-R` and `CSST` are the
 * trade's own abbreviations (§0.3) and travel unchanged.
 */
export function materialWord(material: PipeMaterial, t: Translate = englishOnly): string {
  switch (material) {
    case 'copper':
      return t('plumbing.materialWord.copper', 'Copper', { ns: 'editor' })
    case 'pex':
      return t('plumbing.materialWord.pex', 'PEX', { ns: 'editor' })
    case 'cpvc':
      return t('plumbing.materialWord.cpvc', 'CPVC', { ns: 'editor' })
    case 'cast_iron':
      return t('plumbing.materialWord.castIron', 'Cast iron', { ns: 'editor' })
    case 'pvc':
      return t('plumbing.materialWord.pvc', 'PVC', { ns: 'editor' })
    case 'abs':
      return t('plumbing.materialWord.abs', 'ABS', { ns: 'editor' })
    case 'steel':
      return t('plumbing.materialWord.steel', 'Steel', { ns: 'editor' })
    case 'black_steel':
      return t('plumbing.materialWord.blackSteel', 'Black steel', { ns: 'editor' })
    case 'galvanized':
      return t('plumbing.materialWord.galvanized', 'Galvanized steel', { ns: 'editor' })
    case 'pp_r':
      return t('plumbing.materialWord.ppR', 'PP-R', { ns: 'editor' })
    case 'csst':
      return t('plumbing.materialWord.csst', 'CSST', { ns: 'editor' })
    case 'pe':
      return t('plumbing.materialWord.pe', 'Polyethylene (PE)', { ns: 'editor' })
  }
}
