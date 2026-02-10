import { cn } from "@/src/features/agents/lib/utils";
import { statusTone, type StatusTone } from "@/src/features/agents/lib/theme";
import type { ComponentType, SVGProps } from "react";

export type StatusType = "success" | "warning" | "error" | "info" | "neutral" | "active" | "idle" | "attention";

interface StatusIndicatorProps {
  status: StatusType;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "filled" | "outline" | "subtle";
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  className?: string;
}

const toneByStatus: Record<StatusType, StatusTone> = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
  neutral: "neutral",
  active: "success",
  idle: "neutral",
  attention: "warning",
};

const sizeConfig = {
  sm: {
    container: "px-2 py-1 text-[10px] gap-1",
    icon: "h-3 w-3"
  },
  md: {
    container: "px-2.5 py-1.5 text-xs gap-1.5",
    icon: "h-3.5 w-3.5"
  },
  lg: {
    container: "px-3 py-2 text-sm gap-2",
    icon: "h-4 w-4"
  }
};

export function StatusIndicator({
  status,
  label,
  size = "md",
  variant = "subtle",
  icon: Icon,
  className
}: StatusIndicatorProps) {
  const tone = toneByStatus[status] ?? "neutral";
  const toneStyles = statusTone[tone];
  const statusClasses = cn(
    variant === "filled" && [
      toneStyles.solidBg,
      toneStyles.solidFg,
      "border border-transparent"
    ],
    variant === "outline" && [
      "bg-transparent",
      toneStyles.accent,
      toneStyles.border
    ],
    variant === "subtle" && [
      toneStyles.bg,
      toneStyles.fg,
      toneStyles.border
    ]
  );
  const sizeClasses = sizeConfig[size];

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        statusClasses,
        sizeClasses.container,
        className
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            sizeClasses.icon,
            variant === "filled"
              ? toneStyles.solidFg
              : variant === "outline"
                ? toneStyles.accent
                : toneStyles.fg
          )}
        />
      )}
      {label}
    </span>
  );
}
