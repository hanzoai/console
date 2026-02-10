import type { AgentDIDStatus } from "../../types/did";
import { Badge } from "../ui/badge";
import {
  CheckmarkFilled,
  WarningAltFilled,
  ErrorFilled,
  Unknown,
  Cognitive,
  Flash,
  Identification,
  Copy,
} from "@/src/features/agents/components/ui/icon-bridge";

interface DIDStatusBadgeProps {
  status: AgentDIDStatus;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DIDStatusBadge({
  status,
  showIcon = true,
  size = "md",
  className = "",
}: DIDStatusBadgeProps) {
  const getStatusConfig = (status: AgentDIDStatus) => {
    switch (status) {
      case "active":
        return {
          variant: "default" as const,
          label: "Active",
          icon: CheckmarkFilled,
          className: "bg-status-success-bg text-status-success border-status-success-border font-medium",
        };
      case "inactive":
        return {
          variant: "secondary" as const,
          label: "Inactive",
          icon: WarningAltFilled,
          className: "bg-status-warning-bg text-status-warning border-status-warning-border font-medium",
        };
      case "revoked":
        return {
          variant: "destructive" as const,
          label: "Revoked",
          icon: ErrorFilled,
          className: "bg-status-error-bg text-status-error border-status-error-border font-medium",
        };
      default:
        return {
          variant: "outline" as const,
          label: "Unknown",
          icon: Unknown,
          className: "bg-status-neutral-bg text-status-neutral border-status-neutral-border font-medium",
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = {
    sm: "text-xs px-2 py-1 gap-1",
    md: "text-sm px-3 py-1.5 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <Badge
      variant={config.variant}
      className={`inline-flex items-center rounded-full border transition-colors duration-150 ${config.className} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <config.icon size={iconSizes[size]} />}
      {config.label}
    </Badge>
  );
}

interface DIDCountBadgeProps {
  count: number;
  type: "reasoners" | "skills";
  className?: string;
}

export function DIDCountBadge({
  count,
  type,
  className = "",
}: DIDCountBadgeProps) {
  const typeConfig = {
    reasoners: {
      label: count === 1 ? "Reasoner" : "Reasoners",
      icon: Cognitive,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium",
    },
    skills: {
      label: count === 1 ? "Skill" : "Skills",
      icon: Flash,
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20 font-medium",
    },
  };

  const config = typeConfig[type];

  if (count === 0) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${config.color} ${className}`}
    >
      <config.icon size={12} />
      {count} {config.label}
    </Badge>
  );
}

interface DIDIdentityBadgeProps {
  did: string;
  maxLength?: number;
  showCopyButton?: boolean;
  onCopy?: (did: string) => void;
  className?: string;
}

export function DIDIdentityBadge({
  did,
  maxLength = 20,
  showCopyButton = true,
  onCopy,
  className = "",
}: DIDIdentityBadgeProps) {
  const formatDID = (did: string) => {
    if (did.length <= maxLength) {
      return did;
    }
    const start = did.substring(0, Math.floor(maxLength / 2) - 2);
    const end = did.substring(did.length - Math.floor(maxLength / 2) + 2);
    return `${start}...${end}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(did);
      onCopy?.(did);
    } catch (error) {
      console.error("Failed to copy DID:", error);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 group ${className}`}>
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1.5 bg-muted text-foreground border-border font-mono text-xs px-3 py-1.5 rounded-lg transition-colors duration-150 hover:bg-card-hover"
        title={did}
      >
        <Identification size={12} className="text-accent-primary" />
        {formatDID(did)}
      </Badge>
      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 opacity-0 group-hover:opacity-100"
          title="Copy DID to clipboard"
          aria-label="Copy DID to clipboard"
        >
          <Copy size={12} />
        </button>
      )}
    </div>
  );
}

interface CompositeDIDStatusProps {
  status: AgentDIDStatus;
  reasonerCount: number;
  skillCount: number;
  did?: string;
  compact?: boolean;
  className?: string;
}

export function CompositeDIDStatus({
  status,
  reasonerCount,
  skillCount,
  did,
  compact = false,
  className = "",
}: CompositeDIDStatusProps) {
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <DIDStatusBadge status={status} size="sm" />
        {(reasonerCount > 0 || skillCount > 0) && (
          <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-700">
            {reasonerCount + skillCount} DIDs
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <DIDStatusBadge status={status} />
      <DIDCountBadge count={reasonerCount} type="reasoners" />
      <DIDCountBadge count={skillCount} type="skills" />
      {did && <DIDIdentityBadge did={did} />}
    </div>
  );
}
