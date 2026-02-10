import { X } from '@/src/features/agents/components/ui/icon-bridge';
import { cn } from '@/src/features/agents/lib/utils';
import { statusTone } from '@/src/features/agents/lib/theme';
import type { FilterTag as FilterTagType, FilterColor } from '../types/filters';

interface FilterTagProps {
  tag: FilterTagType;
  onRemove?: (tagId: string) => void;
  className?: string;
}

const colorVariants: Record<FilterColor, string[]> = {
  blue: [statusTone.info.bg, statusTone.info.fg, statusTone.info.border],
  green: [statusTone.success.bg, statusTone.success.fg, statusTone.success.border],
  orange: [statusTone.warning.bg, statusTone.warning.fg, statusTone.warning.border],
  red: [statusTone.error.bg, statusTone.error.fg, statusTone.error.border],
  gray: [statusTone.neutral.bg, statusTone.neutral.fg, statusTone.neutral.border],
  purple: ["bg-bg-tertiary", "text-chart-2", "border border-border-tertiary"],
  indigo: ["bg-bg-tertiary", "text-chart-3", "border border-border-tertiary"],
  pink: ["bg-bg-tertiary", "text-chart-5", "border border-border-tertiary"],
};

export function FilterTag({ tag, onRemove, className }: FilterTagProps) {
  const colorClass = colorVariants[tag.color] || colorVariants.gray;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-bg-hover',
        colorClass,
        className
      )}
    >
      <span className="truncate max-w-32">{tag.label}</span>
      {tag.removable && onRemove && (
        <button
          onClick={() => onRemove(tag.id)}
          className="flex-shrink-0 hover:bg-bg-hover rounded-full p-0.5 transition-colors"
          aria-label={`Remove ${tag.label} filter`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
