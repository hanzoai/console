const STATUS_TONES = {
  success: {
    accent: "text-status-success",
    fg: "text-status-success-light",
    mutedFg: "text-status-success-light",
    bg: "bg-status-success-bg",
    solidBg: "bg-status-success",
    solidFg: "text-text-inverse",
    border: "border border-status-success-border",
    dot: "status-dot status-dot-success",
  },
  warning: {
    accent: "text-status-warning",
    fg: "text-status-warning-light",
    mutedFg: "text-status-warning-light",
    bg: "bg-status-warning-bg",
    solidBg: "bg-status-warning",
    solidFg: "text-text-inverse",
    border: "border border-status-warning-border",
    dot: "status-dot status-dot-pending",
  },
  error: {
    accent: "text-status-error",
    fg: "text-status-error-light",
    mutedFg: "text-status-error-light",
    bg: "bg-status-error-bg",
    solidBg: "bg-status-error",
    solidFg: "text-text-inverse",
    border: "border border-status-error-border",
    dot: "status-dot status-dot-failed",
  },
  info: {
    accent: "text-status-info",
    fg: "text-status-info-light",
    mutedFg: "text-status-info-light",
    bg: "bg-status-info-bg",
    solidBg: "bg-status-info",
    solidFg: "text-text-inverse",
    border: "border border-status-info-border",
    dot: "status-dot status-dot-running",
  },
  neutral: {
    accent: "text-status-neutral",
    fg: "text-status-neutral-light",
    mutedFg: "text-status-neutral-light",
    bg: "bg-status-neutral-bg",
    solidBg: "bg-status-neutral",
    solidFg: "text-text-primary",
    border: "border border-status-neutral-border",
    dot: "status-dot bg-gray-400",
  },
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export function getStatusTone(tone: StatusTone) {
  return STATUS_TONES[tone];
}

export function getStatusBadgeClasses(tone: StatusTone) {
  const status = getStatusTone(tone);
  return [
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
    "shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    status.bg,
    status.fg,
    status.border,
  ].join(" ");
}

export const statusTone = STATUS_TONES;
