import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { getStatusBadgeClasses, statusTone, type StatusTone } from "../../lib/theme"
import {
  CheckCircle,
  XCircle,
  SpinnerGap,
  Clock,
  WarningDiamond,
  Question,
} from "@/src/features/agents/components/ui/icon-bridge"
import type { IconComponent, IconWeight } from "@/src/features/agents/components/ui/icon-bridge"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-0.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-bg-secondary text-text-primary border border-border-secondary hover:bg-bg-tertiary shadow-sm",
        secondary:
          "bg-bg-tertiary text-text-secondary border border-border-tertiary hover:bg-bg-secondary shadow-sm",
        destructive:
          cn(
            statusTone.error.bg,
            statusTone.error.fg,
            statusTone.error.border,
            "shadow-sm"
          ),
        outline:
          "text-text-primary border border-border bg-transparent hover:bg-bg-hover shadow-sm",
        metadata:
          "rounded-md bg-muted/40 text-text-secondary border border-border/60 px-1.5 py-0.5 text-[10px] font-medium font-mono",
        count:
          "rounded-full bg-bg-secondary text-text-primary border border-border-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        pill:
          "rounded-full bg-muted/30 text-text-primary border border-border/40 px-2.5 py-0.5 text-[11px]",

        // Status variants with standardized colors and icons
        success:
          cn(getStatusBadgeClasses("success" satisfies StatusTone), "font-mono tracking-tight"),
        failed:
          cn(getStatusBadgeClasses("error" satisfies StatusTone), "font-mono tracking-tight"),
        running:
          cn(getStatusBadgeClasses("info" satisfies StatusTone), "font-mono tracking-tight"),
        pending:
          cn(getStatusBadgeClasses("warning" satisfies StatusTone), "font-mono tracking-tight"),

        // Additional status variants for degraded states
        degraded:
          cn(getStatusBadgeClasses("warning" satisfies StatusTone), "font-mono tracking-tight"),
        unknown:
          cn(getStatusBadgeClasses("neutral" satisfies StatusTone), "font-mono tracking-tight"),
      },
      size: {
        sm: "px-1.5 py-0 text-[10px]",
        md: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  showIcon?: boolean;
}

// Temporary icon mapping (to be replaced with phosphor icons)
const statusIcons: Partial<Record<BadgeVariant, { icon: IconComponent; weight?: IconWeight }>> = {
  success: { icon: CheckCircle, weight: "bold" },
  failed: { icon: XCircle, weight: "bold" },
  running: { icon: SpinnerGap, weight: "bold" },
  pending: { icon: Clock, weight: "bold" },
  degraded: { icon: WarningDiamond, weight: "bold" },
  unknown: { icon: Question, weight: "bold" },
  destructive: { icon: XCircle, weight: "bold" },
};

function Badge({ className, variant, size, icon, showIcon = true, children, ...props }: BadgeProps) {
  const toneByVariant: Partial<Record<BadgeVariant, StatusTone>> = {
    success: "success",
    failed: "error",
    running: "info",
    pending: "warning",
    degraded: "warning",
    unknown: "neutral",
    destructive: "error",
  };

  const shouldShowIcon = showIcon && variant && variant in statusIcons;
  const statusIconEntry = shouldShowIcon ? statusIcons[variant] : null;
  const StatusIconComponent = statusIconEntry?.icon;
  const iconTone = variant ? toneByVariant[variant] : undefined;

  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon || (StatusIconComponent && (
        <StatusIconComponent
          size={12}
          weight={statusIconEntry?.weight}
          className={cn(
            "flex-shrink-0",
            iconTone ? statusTone[iconTone].accent : undefined
          )}
        />
      ))}
      {children}
    </div>
  )
}

// Convenience status badge components
function StatusBadge({
  status,
  children,
  className,
  ...props
}: Omit<BadgeProps, 'variant'> & {
  status: 'success' | 'failed' | 'running' | 'pending' | 'degraded' | 'unknown'
}) {
  return (
    <Badge variant={status} className={className} {...props}>
      {children || status.toUpperCase()}
    </Badge>
  );
}

export { Badge, StatusBadge, badgeVariants }
