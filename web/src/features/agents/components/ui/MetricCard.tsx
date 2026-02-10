import { Card, CardContent } from "@/src/features/agents/components/ui/card";
import { Skeleton } from "@/src/features/agents/components/ui/skeleton";
import { cn } from "@/src/features/agents/lib/utils";
import type { IconComponent } from "@/src/features/agents/components/ui/icon-bridge";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  icon?: IconComponent;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact" | "minimal";
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "h-20",
    padding: "p-3",
    labelText: "text-caption tracking-wider",
    valueText: "text-heading-3 leading-none",
    deltaText: "text-body-small mt-1",
    icon: "h-3 w-3"
  },
  md: {
    container: "h-24",
    padding: "p-4",
    labelText: "text-caption tracking-wider",
    valueText: "text-heading-2 leading-none",
    deltaText: "text-body-small mt-1",
    icon: "h-3.5 w-3.5"
  },
  lg: {
    container: "h-32",
    padding: "p-6",
    labelText: "text-caption tracking-wide",
    valueText: "text-heading-1 leading-none",
    deltaText: "text-body-small mt-2",
    icon: "h-4 w-4"
  }
};

const variantConfig = {
  default: {
    card: "rounded-xl border-border/50 bg-gradient-to-br from-muted/30 to-muted/5",
    hover: "hover:border-border/70 hover:from-muted/40 hover:to-muted/10"
  },
  compact: {
    card: "rounded-lg border-border/40 bg-muted/20",
    hover: "hover:border-border hover:bg-muted/30"
  },
  minimal: {
    card: "rounded-lg border-border/30 bg-background/50",
    hover: "hover:border-border/50 hover:bg-background/80"
  }
};

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  size = "md",
  variant = "default",
  onClick,
  loading = false,
  className
}: MetricCardProps) {
  const sizeClasses = sizeConfig[size];
  const variantClasses = variantConfig[variant];

  const cardContent = (
    <CardContent className={cn(
      "flex flex-col justify-between",
      sizeClasses.container,
      sizeClasses.padding
    )}>
      <div className="flex items-center justify-between text-text-tertiary">
        <span className={sizeClasses.labelText}>{label}</span>
        {Icon && <Icon className={cn(sizeClasses.icon, "text-text-tertiary")} />}
      </div>
      <div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6" />
            {delta && <Skeleton className="h-3 w-20" />}
          </div>
        ) : (
          <>
            <p className={cn(sizeClasses.valueText, "text-foreground")}>
              {value}
            </p>
            {delta && (
              <p className={cn(sizeClasses.deltaText, "text-text-secondary")}>
                {delta}
              </p>
            )}
          </>
        )}
      </div>
    </CardContent>
  );

  if (onClick) {
    return (
      <Card
        className={cn(
          variantClasses.card,
          variantClasses.hover,
          "cursor-pointer transition-all duration-200",
          "active:scale-[0.98]",
          className
        )}
        onClick={onClick}
      >
        {cardContent}
      </Card>
    );
  }

  return (
    <Card className={cn(variantClasses.card, className)}>
      {cardContent}
    </Card>
  );
}
