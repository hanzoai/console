import { Icon, type IconProps } from "./icon";
import { Button } from "./button";
import { useNavigate } from "../../adapters";

interface GuidedEmptyStateAction {
  label: string;
  href: string;
  variant?: "default" | "outline" | "ghost";
}

interface GuidedEmptyStateProps {
  icon: IconProps["name"];
  title: string;
  description: string;
  primaryAction?: GuidedEmptyStateAction;
  secondaryAction?: GuidedEmptyStateAction;
  tip?: string;
}

/**
 * Reusable guided empty state component.
 * Shows a clear message with next-step actions — never a dead end.
 */
export function GuidedEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tip,
}: GuidedEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted/50 mb-4">
        <Icon name={icon} size={24} className="text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold tracking-tight mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>

      <div className="flex items-center gap-3">
        {primaryAction && (
          <Button variant={primaryAction.variant ?? "default"} onClick={() => navigate(primaryAction.href)}>
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant={secondaryAction.variant ?? "outline"} onClick={() => navigate(secondaryAction.href)}>
            {secondaryAction.label}
          </Button>
        )}
      </div>

      {tip && <p className="text-xs text-muted-foreground/70 mt-6 font-mono">{tip}</p>}
    </div>
  );
}
