/**
 * The Turkish the editor ships, in the shape `<I18nProvider>` takes.
 *
 * A host that shows the editor in another language passes this once:
 *
 * ```tsx
 * <I18nProvider language={language} resources={editorResources}>
 *   <BuildingModelSurface … />
 * </I18nProvider>
 * ```
 *
 * The kit bundles `common`; every other package brings its own namespace the same
 * way (`MUTINY_NAMESPACES` in `@permitzip/bim-ui` names them), so a host never
 * hand-writes the strings and a missing one still falls back to the English at
 * the call site.
 */
import type { Resource } from "i18next";
import trEditor from "../../../locales/tr/editor.json";
import { EDITOR_NAMESPACE } from "./translate";

/** `{ tr: { editor: … } }`: the editor's namespace, in Turkish. */
export const editorResources: Resource = { tr: { [EDITOR_NAMESPACE]: trEditor } };
