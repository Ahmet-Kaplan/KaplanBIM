/**
 * The Turkish the schedule surfaces ship, in the shape `<I18nProvider>` takes.
 *
 * The editor passes this beside its own namespace:
 *
 * ```tsx
 * <I18nProvider language={language} resources={mergeResources(editorResources, schedulesResources)}>
 * ```
 *
 * A key missing here still shows the English at the call site.
 */
import type { Resource } from "i18next";
import trSchedules from "../../locales/tr/schedules.json";
import { SCHEDULES_NAMESPACE } from "./translate";

/** `{ tr: { schedules: … } }`: this package's namespace, in Turkish. */
export const schedulesResources: Resource = { tr: { [SCHEDULES_NAMESPACE]: trSchedules } };
