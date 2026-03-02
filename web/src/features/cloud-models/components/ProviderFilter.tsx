import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { providerLabels } from "../types";

export function ProviderFilter({
  providers,
  selected,
  onSelect,
}: {
  providers: string[];
  selected: string | null;
  onSelect: (provider: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={selected === null ? "default" : "outline"} size="sm" onClick={() => onSelect(null)}>
        All
      </Button>
      {providers.map((provider) => (
        <Button
          key={provider}
          variant={selected === provider ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(provider === selected ? null : provider)}
        >
          {providerLabels[provider] ?? provider}
          <Badge variant="secondary" className="ml-1.5">
            {provider}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
