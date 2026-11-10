"use client";

import { TriangleAlertIcon } from "lucide-react";
import { isMutinyLanguage, type MutinyLanguage } from "./i18n";
import { useMutinyLanguage } from "./i18n/provider";
import { useT } from "./i18n/use-t";
import { useMutinyPresentation } from "./theme-provider";
import { cn } from "./ui/cn";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/**
 * A language name is written in its own language and is never translated:
 * someone who cannot read the current UI still finds their own name in the list.
 * Only the things around the names (the group's `aria-label`, the error) follow
 * the active language.
 */
const OPTIONS: readonly { readonly value: MutinyLanguage; readonly label: string }[] = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
];

export interface LanguageToggleProps {
  readonly className?: string;
  readonly "data-testid"?: string;
}

/**
 * English / Türkçe, always visible, for standalone MutinyBIM. Renders nothing
 * when MutinyBIM is embedded: a host that owns the surrounding page owns its
 * language too, just as it owns the colour scheme.
 *
 * The choice goes to the `I18nProvider` this sits in, which tells the host
 * through `onLanguageChange`; saving it (an account setting, `localStorage`) is
 * the host's job, because only the host knows where it belongs.
 */
export function LanguageToggle({ className, "data-testid": testId = "mutiny-language-toggle" }: LanguageToggleProps) {
  const { language, setLanguage, error } = useMutinyLanguage();
  const presentation = useMutinyPresentation();
  const t = useT();
  if (presentation === "embedded") return null;
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} data-testid={testId} data-language={language}>
      <ToggleGroup
        type="single"
        value={language}
        onValueChange={(value) => {
          // Radix sends "" when the pressed item is clicked again; keep the current pick.
          if (isMutinyLanguage(value)) setLanguage(value);
        }}
        aria-label={t("language.label", "Language")}
      >
        {OPTIONS.map(({ value, label }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              {/* `lang` makes a screen reader pronounce the name in its own language. */}
              <ToggleGroupItem value={value} lang={value} aria-label={label} data-testid={`mutiny-language-${value}`} className="w-auto px-2 text-xs font-medium">
                {label}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      {error ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span role="alert" aria-label={error} className="inline-flex text-(--mutiny-warning)" data-testid="mutiny-language-error">
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{error}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
