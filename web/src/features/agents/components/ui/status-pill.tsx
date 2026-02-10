import { cn } from "@/src/features/agents/lib/utils";
import { getStatusLabel, getStatusTheme, normalizeExecutionStatus } from "@/src/features/agents/utils/status";

interface StatusPillProps {
  status: string;
  className?: string;
  showLabel?: boolean;
}

export function StatusPill({ status, className, showLabel = true }: StatusPillProps) {
  const normalized = normalizeExecutionStatus(status);
  const theme = getStatusTheme(normalized);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        theme.bgClass,
        theme.borderClass,
        theme.textClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", theme.dotClass)} />
      {showLabel && <span className="capitalize">{getStatusLabel(normalized)}</span>}
    </span>
  );
}
