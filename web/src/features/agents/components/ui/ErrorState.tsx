import { Button } from "@/src/features/agents/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/features/agents/components/ui/card";
import { cn } from "@/src/features/agents/lib/utils";
import { AlertTriangle, RefreshCw } from "@/src/features/agents/components/ui/icon-bridge";
import type { IconComponent } from "@/src/features/agents/components/ui/icon-bridge";

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
  variant?: "card" | "inline" | "banner";
  severity?: "error" | "warning" | "info";
  icon?: IconComponent;
  className?: string;
}

const severityConfig = {
  error: {
    card: "border-red-500/20 bg-red-500/5",
    inline: "border-red-500/30 bg-red-500/5",
    banner: "border-red-500/40 bg-red-500/5",
    icon: "text-red-500",
    title: "text-red-600",
    text: "text-red-600/80"
  },
  warning: {
    card: "border-amber-500/20 bg-amber-500/5",
    inline: "border-amber-500/30 bg-amber-500/5",
    banner: "border-amber-500/40 bg-amber-500/5",
    icon: "text-amber-500",
    title: "text-amber-600",
    text: "text-amber-600/80"
  },
  info: {
    card: "border-blue-500/20 bg-blue-500/5",
    inline: "border-blue-500/30 bg-blue-500/5",
    banner: "border-blue-500/40 bg-blue-500/5",
    icon: "text-blue-500",
    title: "text-blue-600",
    text: "text-blue-600/80"
  }
};

export function ErrorState({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  onDismiss,
  retrying = false,
  variant = "card",
  severity = "error",
  icon: CustomIcon,
  className
}: ErrorStateProps) {
  const Icon = CustomIcon || AlertTriangle;
  const config = severityConfig[severity];
  const errorMessage = typeof error === 'string' ? error : error?.message;

  if (variant === "banner") {
    return (
      <Card className={cn("border", config.banner, className)}>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3 text-sm">
            <Icon className={cn("h-5 w-5", config.icon)} />
            <div>
              <span className={cn("font-medium", config.title)}>{title}</span>
              {(description || errorMessage) && (
                <p className={cn("text-xs mt-0.5", config.text)}>
                  {description || errorMessage}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                disabled={retrying}
                className="text-xs"
              >
                <RefreshCw className={cn("h-3 w-3 mr-1.5", retrying && "animate-spin")} />
                {retrying ? "Retrying" : "Retry"}
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border text-sm",
        config.inline,
        className
      )}>
        <Icon className={cn("h-4 w-4 shrink-0", config.icon)} />
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium", config.title)}>{title}</p>
          {(description || errorMessage) && (
            <p className={cn("text-xs mt-0.5 line-clamp-2", config.text)}>
              {description || errorMessage}
            </p>
          )}
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            className="shrink-0"
          >
            <RefreshCw className={cn("h-3 w-3", retrying && "animate-spin")} />
          </Button>
        )}
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn("border-dashed", config.card, className)}>
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2 text-base font-semibold", config.title)}>
          <Icon className={cn("h-5 w-5", config.icon)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(description || errorMessage) && (
          <p className={cn("text-sm", config.text)}>
            {description || errorMessage}
          </p>
        )}
        {(onRetry || onDismiss) && (
          <div className="flex gap-3">
            {onRetry && (
              <Button onClick={onRetry} disabled={retrying} variant="outline" size="sm">
                <RefreshCw className={cn("mr-2 h-4 w-4", retrying && "animate-spin")} />
                {retrying ? "Retrying..." : "Try again"}
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" onClick={onDismiss} size="sm">
                Dismiss
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
