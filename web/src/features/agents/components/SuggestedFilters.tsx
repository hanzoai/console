import { cn } from "../lib/utils";
import type {
  FilterSuggestion,
  FilterTag as FilterTagType,
} from "../types/filters";
import { FILTER_SUGGESTIONS } from "../types/filters";
import { createFilterTag } from "../utils/filterUtils";

interface SuggestedFiltersProps {
  tags: FilterTagType[];
  onTagsChange: (tags: FilterTagType[]) => void;
  className?: string;
}

// Curated list of most useful suggested filters
const SUGGESTED_FILTER_IDS = [
  "status-running",
  "status-failed",
  "time-last-24h",
  "group-workflow",
  "sort-time",
  "status-completed",
];

export function SuggestedFilters({
  tags,
  onTagsChange,
  className,
}: SuggestedFiltersProps) {
  // Get suggested filters that aren't already applied
  const availableSuggestions = FILTER_SUGGESTIONS.filter((suggestion) =>
    SUGGESTED_FILTER_IDS.includes(suggestion.id)
  )
    .filter((suggestion) => {
      // Don't show if already applied
      return !tags.some(
        (tag) => tag.type === suggestion.type && tag.value === suggestion.value
      );
    })
    .slice(0, 6); // Limit to 6 suggestions

  const handleSuggestionClick = (suggestion: FilterSuggestion) => {
    const newTag = createFilterTag(
      suggestion.type,
      suggestion.value,
      suggestion.label
    );
    onTagsChange([...tags, newTag]);
  };

  if (availableSuggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        Quick filters:
      </span>
      {availableSuggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => handleSuggestionClick(suggestion)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200",
            "hover:border-primary/50 hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/20",
            "active:scale-95"
          )}
        >
          <span className="capitalize">
            {suggestion.label.replace(/^[^:]+:\s*/, "")}
          </span>
          <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            {suggestion.type}
          </kbd>
        </button>
      ))}
    </div>
  );
}
