/**
 * A view category's name, in the language on screen.
 *
 * `VIEW_CATEGORY_LABELS` in `@permitzip/bim-kernel` is English data the kernel and the
 * agent both read, so it is not translated there. This editor is where those words
 * reach a person — in Visibility/Graphics, in the right-click menu and in a hidden
 * category's sentence — and a translated frame around an English noun
 * ("{{name}} kategorisi gizli") reads as half a sentence. One accessor, asked at each
 * site, keeps the data English and the screen in one language.
 *
 * Stage 5 owns the wider domain map; this is the small set of view categories and it
 * moves there with the rest when that lands.
 */
import type { ViewCategory } from "@permitzip/bim-kernel";
import { VIEW_CATEGORY_LABELS } from "@permitzip/bim-kernel";
import { englishOnly, type Translate } from "../i18n/translate";

/** "Duct" → "Kanal", "Doors and windows" → "Kapı ve pencereler", in the host's language. */
export function viewCategoryWord(category: ViewCategory, t: Translate = englishOnly): string {
  switch (category) {
    case "duct":
      return t("category.duct", "Duct", { ns: "editor" });
    case "duct_fitting":
      return t("category.ductFitting", "Duct fittings", { ns: "editor" });
    case "pipe":
      return t("category.pipe", "Pipe and fittings", { ns: "editor" });
    case "air_terminal":
      return t("category.airTerminal", "Air terminals", { ns: "editor" });
    case "equipment":
      return t("category.equipment", "Equipment", { ns: "editor" });
    case "walls":
      return t("category.walls", "Walls", { ns: "editor" });
    case "doors_windows":
      return t("category.doorsWindows", "Doors and windows", { ns: "editor" });
    case "rooms":
      return t("category.rooms", "Rooms", { ns: "editor" });
    case "grids":
      return t("category.grids", "Grids", { ns: "editor" });
    case "structure":
      return t("category.structure", "Structure", { ns: "editor" });
    case "tags":
      return t("category.tags", "Tags", { ns: "editor" });
    case "dimensions":
      return t("category.dimensions", "Dimensions", { ns: "editor" });
    case "electrical_devices":
      return t("category.electricalDevices", "Electrical devices", { ns: "editor" });
    case "lighting_fixtures":
      return t("category.lightingFixtures", "Lighting fixtures", { ns: "editor" });
    case "electrical_equipment":
      return t("category.electricalEquipment", "Panels and electrical equipment", { ns: "editor" });
    case "insulation":
      return t("category.insulation", "Duct and pipe insulation", { ns: "editor" });
    default:
      return VIEW_CATEGORY_LABELS[category];
  }
}
